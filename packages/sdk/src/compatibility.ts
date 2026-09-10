import type { ClientOptions } from './transport.js';
import { NetworkError, TimeoutError, sdkError } from './errors.js';

export interface SdkResponse<T = any> { data: T; status: number; headers: Headers; }
export interface SdkRequestConfig { headers?: Record<string, string>; timeout?: number; responseType?: 'stream' | 'arraybuffer' | 'text'; params?: Record<string, unknown>; signal?: AbortSignal; maxContentLength?: number; maxBodyLength?: number; }

/** Compatibility bridge for consumers migrating from Axios without owning HTTP behavior. */
export class SdkRequestClient {
  constructor(private readonly options: ClientOptions = {}) {}
  get<T = any>(path: string, config?: SdkRequestConfig) { return this.request<T>('GET', path, undefined, config); }
  post<T = any>(path: string, body?: unknown, config?: SdkRequestConfig) { return this.request<T>('POST', path, body, config); }
  patch<T = any>(path: string, body?: unknown, config?: SdkRequestConfig) { return this.request<T>('PATCH', path, body, config); }
  put<T = any>(path: string, body?: unknown, config?: SdkRequestConfig) { return this.request<T>('PUT', path, body, config); }
  delete<T = any>(path: string, config?: SdkRequestConfig) { return this.request<T>('DELETE', path, undefined, config); }

  private async request<T>(method: string, path: string, body?: any, config: SdkRequestConfig = {}): Promise<SdkResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeout ?? this.options.timeoutMs ?? 30000);
    try {
      const token = this.options.token || await this.options.tokenProvider?.getAccessToken();
      const headers = new Headers(config.headers);
      if (token && !headers.has('authorization')) headers.set('authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
      if (this.options.organizationId && !headers.has('x-organization-id')) headers.set('x-organization-id', this.options.organizationId);
      let requestBody = body;
      const isStream = body && typeof body === 'object' && typeof body.pipe === 'function';
      if (body !== undefined && !isStream && !(body instanceof ArrayBuffer) && !(body instanceof Blob)) { headers.set('content-type', 'application/json'); requestBody = JSON.stringify(body); }
      const url = new URL(path.startsWith('http') ? path : `${(this.options.baseUrl || 'https://api.deployxa.com').replace(/\/$/, '')}${path}`);
      for (const [key, value] of Object.entries(config.params || {})) if (value !== undefined) url.searchParams.set(key, String(value));
      const response = await (this.options.fetch || globalThis.fetch)(url, { method, headers, body: requestBody, signal: config.signal || controller.signal, ...(isStream ? { duplex: 'half' as any } : {}) } as RequestInit);
      if (!response.ok) { let payload: any; try { payload = await response.json(); } catch {} throw sdkError(response.status, payload?.error || payload?.message || response.statusText); }
      let data: any;
      if (config.responseType === 'arraybuffer') data = await response.arrayBuffer();
      else if (config.responseType === 'stream') data = response.body;
      else if (config.responseType === 'text') data = await response.text();
      else data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
      return { data, status: response.status, headers: response.headers };
    } catch (error) {
      if (error instanceof Error && error.name === 'DeployxaError') throw error;
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError(error instanceof Error ? error.message : 'SDK request failed.', error);
    } finally { clearTimeout(timeout); }
  }
}
