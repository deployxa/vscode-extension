import * as vscode from 'vscode';
import type { ExtensionAnalyticsEventName, TrackExtensionEventRequest } from '@deployxa/sdk';

export type FunnelEvent = ExtensionAnalyticsEventName;
interface PendingEvent { event: FunnelEvent; at: string; }

/** Consent-controlled, best-effort funnel delivery. Failed events remain local for a later retry. */
export class FunnelTracker {
  constructor(private readonly context: vscode.ExtensionContext, private readonly installationId: () => string,
    private readonly transport: (input: TrackExtensionEventRequest) => Promise<unknown>) {}
  consent() { return this.context.globalState.get<boolean>('deployxa.funnelConsent') === true && vscode.env.isTelemetryEnabled; }
  async setConsent(enabled: boolean) { await this.context.globalState.update('deployxa.funnelConsent', enabled); if (!enabled) await this.context.globalState.update('deployxa.funnelEvents', []); }
  async record(event: FunnelEvent) {
    if (!this.consent()) return;
    const events = this.context.globalState.get<PendingEvent[]>('deployxa.funnelEvents') || [];
    const pending = events.some(item => item.event === event) ? events : [...events, { event, at: new Date().toISOString() }];
    await this.context.globalState.update('deployxa.funnelEvents', pending);
    void this.flush();
  }
  async flush() {
    if (!this.consent()) return;
    const pending = this.context.globalState.get<PendingEvent[]>('deployxa.funnelEvents') || [];
    for (const item of pending) {
      try {
        await this.transport({ event: item.event, installationId: this.installationId(), occurredAt: item.at });
        const current = this.context.globalState.get<PendingEvent[]>('deployxa.funnelEvents') || [];
        await this.context.globalState.update('deployxa.funnelEvents', current.filter(candidate => candidate.event !== item.event));
      } catch { return; }
    }
  }
}
