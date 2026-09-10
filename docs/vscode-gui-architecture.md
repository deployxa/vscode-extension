# Deployxa VS Code GUI architecture

The Home webview is a presentation layer over `ClientManager` and `@deployxa/sdk`. Webview buttons post a command message; commands call the same operations used by the existing Explorer and Command Palette. No platform logic, state machine, provider, queue, or credential handling is implemented in the UI.

The Home view is intentionally lightweight: projects and recent deployments load on demand when the view resolves or refreshes. Monitoring, environment, domains, databases, and raw logs remain lazy SDK-backed surfaces and are not fabricated when the server does not return them.
