import type { ApiErrorResponse } from '@deployxa/contracts';
import { DeployxaError, NetworkError, TimeoutError, sdkError } from './errors.js';

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
  fetch?: typeof fetch;
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

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
        let payload: ApiErrorResponse | { error?: string; message?: string } | undefined;
        try { payload = await response.json(); } catch {}
        const structured = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'object' ? payload.error : undefined;
        const message = structured?.message || (payload && 'error' in payload && typeof payload.error === 'string' ? payload.error : undefined) || (payload && 'message' in payload ? payload.message : undefined) || response.statusText;
        throw sdkError(response.status, message || 'Deployxa request failed.', structured?.code, structured?.requestId, structured?.details);
      }
      if (response.status === 204) return undefined as T;
      const contentType = response.headers.get('content-type') || '';
      return contentType.includes('application/json') ? response.json() as Promise<T> : response.text() as Promise<T>;
    } catch (error) {
      if (error instanceof DeployxaError) throw error;
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError(error instanceof Error ? error.message : 'Network request failed.', error);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', relayAbort);
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
        let payload: ApiErrorResponse | { error?: string; message?: string } | undefined;
        try { payload = await response.json(); } catch {}
        const structured = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'object' ? payload.error : undefined;
        const message = structured?.message || (payload && 'error' in payload && typeof payload.error === 'string' ? payload.error : undefined) || (payload && 'message' in payload ? payload.message : undefined) || response.statusText;
        throw sdkError(response.status, message || 'Deployxa request failed.', structured?.code, structured?.requestId, structured?.details);
      }
      if (response.status === 204) return undefined as T;
      const contentType = response.headers.get('content-type') || '';
      return contentType.includes('application/json') ? response.json() as Promise<T> : response.text() as Promise<T>;
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
