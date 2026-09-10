import type { TokenProvider } from './transport.js';
export interface CredentialStore { get(key: string): string | null | Promise<string | null>; set(key: string, value: string): void | Promise<void>; delete(key: string): void | Promise<void>; }
export class StoredTokenProvider implements TokenProvider { constructor(private readonly store: CredentialStore, private readonly key = 'deployxa.access_token') {} getAccessToken() { return this.store.get(this.key); } }
