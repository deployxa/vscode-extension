import type { DeploymentDto, PlatformEvent } from '@deployxa/contracts';
export interface PollOptions { intervalMs?: number; signal?: AbortSignal; }
const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); });
export async function* pollDeployment(get: () => Promise<DeploymentDto>, options: PollOptions = {}) { let previous = ''; while (!options.signal?.aborted) { const deployment = await get(); const snapshot = JSON.stringify(deployment); if (snapshot !== previous) { previous = snapshot; yield deployment; } if (['SUCCESS', 'FAILED', 'CANCELLED', 'ACTIVE'].includes(String(deployment.status))) return; await delay(options.intervalMs || 2000, options.signal); } }
export async function* pollValues<T>(read: () => Promise<T>, options: PollOptions = {}) { while (!options.signal?.aborted) { yield await read(); await delay(options.intervalMs || 2000, options.signal); } }
export type EventSubscription = AsyncIterable<PlatformEvent>;
