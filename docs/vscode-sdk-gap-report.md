# SDK gap report

The SDK exposes projects, deployments, Rich Progress, timelines, diagnosis, logs, environment variables, domains, DNS guidance, typed database capabilities, readiness, assistant chat, monitoring, runtime, organizations, and repository resources. The extension uses these surfaces directly.

## Acquisition funnel gaps

The Engine does not currently provide a browser/device authorization flow for the VS Code extension. Registration can be opened with acquisition source parameters, but automatic sign-in must wait for a short-lived, single-use authorization-code exchange. Raw API tokens must not be returned in browser callback URLs.

GitHub OAuth currently returns its credential to the web Dashboard. It needs an extension-aware callback using a one-time code, plus a typed SDK exchange method, before the extension can securely detect `github_connected` and list the authenticated user's repositories without manual token handling.

There is no approved analytics ingestion endpoint or telemetry sender for extension funnel events. The extension therefore records consent-controlled milestones locally only and does not transmit them. Aggregate install-to-first-deployment measurement requires a documented privacy policy, retention rules, opt-in/opt-out behavior, an Engine ingestion endpoint, and a typed SDK resource.

The UI does not invent these capabilities or report events as delivered when no transport exists.
