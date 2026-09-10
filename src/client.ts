import * as vscode from 'vscode';
import { DeployxaClient, StoredTokenProvider, type UserDto } from '@deployxa/sdk';
import { nextActiveAccountId } from './model.js';
import crypto from 'crypto';

const accountsKey = 'deployxa.accounts';
const activeAccountKey = 'deployxa.activeAccount';
const secretKey = (id: string) => `deployxa.account.${id}.token`;
const pendingFlowKey = (kind: 'auth' | 'github') => `deployxa.pending.${kind}`;
const pendingVerifierKey = (kind: 'auth' | 'github') => `deployxa.pending.${kind}.verifier`;
const installationKey = 'deployxa.analytics.installationId';
interface PendingFlow { state: string; createdAt: number; }

export interface StoredAccount { id: string; email: string; organizationId?: string; }

class VsCodeCredentialStore {
  constructor(private readonly secrets: vscode.SecretStorage, private readonly key: string) {}
  async get() { return (await this.secrets.get(this.key)) || null; }
  async set(_key: string, value: string) { await this.secrets.store(this.key, value); }
  async delete() { await this.secrets.delete(this.key); }
}

export class ClientManager {
  constructor(private readonly context: vscode.ExtensionContext) {}
  installationId() {
    const existing = this.context.globalState.get<string>(installationKey);
    if (existing) return existing;
    const created = crypto.randomUUID(); void this.context.globalState.update(installationKey, created); return created;
  }
  accounts() { return this.context.globalState.get<StoredAccount[]>(accountsKey, []); }
  activeAccount() { const id = this.context.globalState.get<string>(activeAccountKey); return this.accounts().find(account => account.id === id); }
  client() {
    const config = vscode.workspace.getConfiguration('deployxa');
    const account = this.activeAccount();
    const key = account ? secretKey(account.id) : 'deployxa.accessToken';
    return new DeployxaClient({
      baseUrl: config.get<string>('apiUrl') || 'https://api.deployxa.com',
      organizationId: config.get<string>('organizationId') || account?.organizationId,
      tokenProvider: new StoredTokenProvider(new VsCodeCredentialStore(this.context.secrets, key), key),
    });
  }
  async token() { const account = this.activeAccount(); return (await this.context.secrets.get(account ? secretKey(account.id) : 'deployxa.accessToken')) || null; }
  async addAccount(token: string, user: UserDto) {
    const accounts = this.accounts();
    const existing = accounts.find(account => account.email.toLowerCase() === user.email.toLowerCase());
    const account = existing || { id: user.id, email: user.email };
    if (!existing) await this.context.globalState.update(accountsKey, [...accounts, account]);
    await this.context.secrets.store(secretKey(account.id), token.replace(/^Bearer\s+/i, '').trim());
    await this.context.globalState.update(activeAccountKey, account.id);
    return account;
  }
  async authenticate(token: string) {
    const baseUrl = vscode.workspace.getConfiguration('deployxa').get<string>('apiUrl') || 'https://api.deployxa.com';
    const candidate = new DeployxaClient({ baseUrl, token: token.replace(/^Bearer\s+/i, '').trim() });
    return this.addAccount(token, await candidate.auth.me());
  }
  private async createPkce(kind: 'auth' | 'github') {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const state = `${kind === 'github' ? 'dxa_vscode_' : ''}${crypto.randomBytes(32).toString('base64url')}`;
    const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    await this.context.globalState.update(pendingFlowKey(kind), { state, createdAt: Date.now() } satisfies PendingFlow);
    await this.context.secrets.store(pendingVerifierKey(kind), verifier);
    return { state, codeChallenge };
  }
  async beginExtensionAuth() {
    const input = await this.createPkce('auth');
    return new DeployxaClient({ baseUrl: vscode.workspace.getConfiguration('deployxa').get<string>('apiUrl') || 'https://api.deployxa.com' }).auth.beginExtensionAuth({ ...input, installationId: this.installationId() });
  }
  async beginGithubConnection() { return this.client().repositories.beginGithubConnection({ ...await this.createPkce('github'), installationId: this.installationId() }); }
  async handleExtensionCallback(uri: vscode.Uri) {
    const kind = uri.path === '/github/callback' ? 'github' : uri.path === '/auth/callback' ? 'auth' : undefined;
    if (!kind || uri.scheme !== 'vscode' || uri.authority !== 'deployxa') throw new Error('Deployxa rejected an unrecognized callback URL.');
    const query = new URLSearchParams(uri.query); const code = query.get('code'); const state = query.get('state'); const callbackError = query.get('error');
    const pending = this.context.globalState.get<PendingFlow>(pendingFlowKey(kind));
    const verifier = await this.context.secrets.get(pendingVerifierKey(kind));
    if (!state || !pending || !verifier || pending.state !== state || Date.now() - pending.createdAt > 10 * 60_000) throw new Error('This browser authorization is invalid or expired. Please start again from Deployxa Home.');
    try {
      if (callbackError) throw new Error(callbackError === 'access_denied' ? 'GitHub authorization was cancelled. Your Deployxa account is unchanged.' : 'GitHub could not authorize Deployxa. Please try again.');
      if (!code) throw new Error('The browser callback did not contain an authorization code.');
      if (kind === 'github') return await this.client().repositories.exchangeGithubCode({ code, state, codeVerifier: verifier, installationId: this.installationId() });
      const session = await new DeployxaClient({ baseUrl: vscode.workspace.getConfiguration('deployxa').get<string>('apiUrl') || 'https://api.deployxa.com' }).auth.exchangeExtensionCode({ code, state, codeVerifier: verifier, installationId: this.installationId() });
      await this.addAccount(session.token, { id: session.user.userId, avatar: null, ...session.user } as UserDto);
      return session;
    } finally {
      await this.context.globalState.update(pendingFlowKey(kind), undefined);
      await this.context.secrets.delete(pendingVerifierKey(kind));
    }
  }
  async switchAccount(id: string) { await this.context.globalState.update(activeAccountKey, id); }
  async removeAccount(id: string) {
    const activeId = this.context.globalState.get<string>(activeAccountKey);
    await this.context.secrets.delete(secretKey(id));
    const remaining = this.accounts().filter(account => account.id !== id);
    await this.context.globalState.update(accountsKey, remaining);
    const nextActiveId = nextActiveAccountId(activeId, id, remaining.map(account => account.id));
    if (nextActiveId !== activeId) await this.context.globalState.update(activeAccountKey, nextActiveId);
  }
  async clearToken() { const account = this.activeAccount(); if (account) return this.removeAccount(account.id); return this.context.secrets.delete('deployxa.accessToken'); }
}
