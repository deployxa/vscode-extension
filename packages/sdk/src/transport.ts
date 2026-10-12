import type { ApiErrorResponse } from '@deployxa/contracts';
import { DeployxaError, NetworkError, ResponseTooLargeError, TimeoutError, sdkError } from './errors.js';

export interface TokenProvider { getAccessToken(): string | null | Promise<string | null>; }
export interface RefreshingTokenProvider extends TokenProvider { refreshAccessToken(): string | null | Promise<string | null>; }
export interface RequestOptions { signal?: AbortSignal; timeoutMs?: number; organizationId?: string; retries?: number; }
export interface ClientOptions {
  baseUrl?: string;
  token?: string;
  tokenProvider?: TokenProvider;
  organizationId?: string;
  timeoutMs?: number;
  retries?: number;
  /** Reject responses larger than this many bytes before parsing them. */
  maxResponseBytes?: number;
  fetch?: typeof fetch;
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});
const ERROR_BODY_LIMIT = 16_384;

function describeError(payload: any): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const structured = 'error' in payload && typeof payload.error === 'object' && payload.error !== null ? payload.error : undefined;
  return structured?.message
    || (typeof payload.error_description === 'string' ? payload.error_description : undefined)
    || (typeof payload.error === 'string' ? payload.error : undefined)
    || (typeof payload.message === 'string' ? payload.message : undefined);
}

/**
 * Normalize the non-standard fields an Engine credential error may carry. The
 * Engine returns flat API-key/OAuth errors (`{ error, error_description,
 * required_scope }`) while some routes nest a `details` object; both are folded
 * into the structured `code`/`requestId`/`details` the SDK error exposes so an
 * agent can tell a 404 from a missing scope.
 */
function structuredError(payload: any): { code?: string; requestId?: string; details?: unknown } {
  const nested = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'object' && payload.error !== null ? payload.error : undefined;
  const code = nested?.code ?? (typeof payload?.error === 'string' && /^[a-z][a-z0-9_]*$/.test(payload.error) ? payload.error : undefined);
  const details = nested?.details ?? (typeof payload?.required_scope === 'string' ? { requiredScope: payload.required_scope } : undefined);
  return { code, requestId: nested?.requestId, details };
}

export class HttpTransport {
  private readonly fetcher: typeof fetch;
  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetch || globalThis.fetch?.bind(globalThis);
    if (!this.fetcher) throw new Error('A Fetch API implementation is required.');
  }

  async request<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const retries = options.retries ?? this.options.retries ?? 2;
    for (let attempt = 0; ; attempt++) {
      try { return await this.execute<T>(method, path, body, options); }
      catch (error) {
        const retryable = error instanceof DeployxaError && (error.status === 429 || error.status >= 500);
        if (!retryable || attempt >= retries || !['GET', 'HEAD'].includes(method)) throw error;
        await wait(Math.min(4000, 250 * 2 ** attempt), options.signal);
      }
    }
  }

  /**
   * Send a raw binary body (archive upload) with caller-supplied headers.
   * Unlike request(), the body is not JSON-stringified and Content-Type is
   * set by the caller. Returns parsed JSON (or text) like request().
   */
  async sendRaw<T>(method: string, path: string, body: BodyInit, headers: Record<string, string>, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out.')), options.timeoutMs ?? this.options.timeoutMs ?? 600000);
    const relayAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', relayAbort, { once: true });
    try {
      const token = this.options.token || await this.options.tokenProvider?.getAccessToken();
      const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
      if (token) requestHeaders.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const organizationId = options.organizationId || this.options.organizationId;
      if (organizationId) requestHeaders['x-organization-id'] = organizationId;
      const response = await this.fetcher(`${(this.options.baseUrl || 'https://api.deployxa.com').replace(/\/$/, '')}${path}`, {
        method, headers: requestHeaders, body, signal: controller.signal, duplex: 'half',
      } as RequestInit & { duplex?: 'half' });
      if (!response.ok) {
        const payload = await this.errorPayload(response);
        const structured = structuredError(payload);
        throw sdkError(response.status, describeError(payload) || response.statusText || 'Deployxa request failed.', structured.code, structured.requestId, structured.details);
      }
      return this.parseResponse<T>(response);
    } catch (error) {
      if (error instanceof DeployxaError) throw error;
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError(error instanceof Error ? error.message : 'Network request failed.', error);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', relayAbort);
    }
  }

  /**
   * Read a response body while enforcing the optional maxResponseBytes cap.
   * A declared Content-Length is rejected before the body is read; otherwise
   * the body is measured after reading and rejected before JSON parsing.
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const limit = this.options.maxResponseBytes ?? 0;
    if (limit > 0) {
      const declared = Number(response.headers.get('content-length') || 0);
      if (Number.isFinite(declared) && declared > limit) throw new ResponseTooLargeError(limit);
    }
    const contentType = response.headers.get('content-type') || '';
    if (limit <= 0) return contentType.includes('application/json') ? response.json() as Promise<T> : response.text() as Promise<T>;
    if (contentType.includes('application/json')) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > limit) throw new ResponseTooLargeError(limit);
      return JSON.parse(new TextDecoder().decode(bytes)) as T;
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > limit) throw new ResponseTooLargeError(limit);
    return text as T;
  }

  /**
   * Read an error body for the message only. Oversized bodies are parsed from a
   * bounded prefix so a large error payload cannot be JSON.parse'd in full.
   */
  private async errorPayload(response: Response): Promise<ApiErrorResponse | { error?: string; message?: string } | undefined> {
    const declared = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(declared) && declared > ERROR_BODY_LIMIT) return undefined;
    try {
      const raw = await response.text();
      return JSON.parse(raw.length > ERROR_BODY_LIMIT ? raw.slice(0, ERROR_BODY_LIMIT) : raw);
    } catch {
      return undefined;
    }
  }

  private async execute<T>(method: string, path: string, body: unknown, options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out.')), options.timeoutMs ?? this.options.timeoutMs ?? 30000);
    const relayAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', relayAbort, { once: true });
    try {
      const token = this.options.token || await this.options.tokenProvider?.getAccessToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const organizationId = options.organizationId || this.options.organizationId;
      if (organizationId) headers['x-organization-id'] = organizationId;
      const response = await this.fetcher(`${(this.options.baseUrl || 'https://api.deployxa.com').replace(/\/$/, '')}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await this.errorPayload(response);
        const structured = structuredError(payload);
        throw sdkError(response.status, describeError(payload) || response.statusText || 'Deployxa request failed.', structured.code, structured.requestId, structured.details);
      }
      return this.parseResponse<T>(response);
    } catch (error) {
      if (error instanceof DeployxaError) throw error;
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError(error instanceof Error ? error.message : 'Network request failed.', error);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', relayAbort);
    }
  }
}
