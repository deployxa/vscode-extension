# Changelog

## 0.5.2

- Optimized package size by excluding raw packages source from VSIX distribution.
- Verified MIT license metadata and repository links for Open VSX marketplace publication.
- Added native Open VSX publishing pipeline (`npm run publish:ovsx`).

## 0.5.0

- Integrated official **Deployxa Domain Registrar**:
  - Added `Deployxa: Check Domain Availability & Pricing` (`deployxa.checkDomainAvailability`) to search any domain and inspect real-time pricing and renewal costs directly from VS Code.
  - Added `Deployxa: Suggest Available Domains` (`deployxa.suggestDomains`) for smart keyword and brand name suggestions.
  - Added `Deployxa: Purchase & Register Domain` (`deployxa.purchaseDomain`) with explicit confirmation modal, price display, organization credit billing, and instant project binding.
  - Updated Project Overview panel with direct "🔍 Search & Buy" action in the Domains card.
  - Updated Advanced Explorer tree to expand project domains with live DNS verification badges.
- Added **AI & Model Context Protocol (MCP) Setup**:
  - Added `Deployxa: Setup MCP for AI Copilot` (`deployxa.setupMcp`) to generate `.vscode/mcp.json` and `.mcp.json` configured for `https://mcp.deployxa.com/mcp`, enabling 1-click integration with VS Code GitHub Copilot, Cline, and AI extensions.
- Upgraded vendored `@deployxa/contracts` and `@deployxa/sdk` with registrar clients, enhanced error typing, and bounded streaming parsing.

## 0.4.0

- Added direct folder upload deployment for users without Git or GitHub.
  Home and the Command Palette now offer **Upload folder**, which packages a
  local folder (excluding `node_modules`, build output, and `.git`) into a
  streaming `.tar.gz` and sends it to the Engine build worker via the new
  `DeployxaClient.uploadProject` SDK method. The build, health checks, and
  live URL are identical to a repository deployment.
- Re-deploying an upload-backed project now re-uploads the folder to the
  existing project instead of attempting a git clone on the `upload:` sentinel
  URL. Upload-backed projects also display "Uploaded folder" in the project
  panel instead of the raw sentinel.

## 0.3.3

- Updated the Marketplace overview and account onboarding link.

## 0.3.2

- Added authoritative project readiness scores, checks, and recommendations.
- Added typed database summaries with metrics, storage, connections, backups, users, and endpoints.
- Added DNS guidance with provider records, copy actions, and verification.
- Upgraded deployment visualization to authoritative Rich Progress data.
- Added the supported Deployxa Assistant entry point for readiness, deployment, and domain help.

- Added a GUI-first Deployxa Home as the primary Activity Bar experience.
- Added visual onboarding, account controls, project cards, quick actions, and recent activity.
- Added personalized greetings, organization context, a mini monitoring dashboard, and always-visible project Deploy buttons.
- Added Simple and Advanced presentation modes using shared SDK-backed operations.
- Added stage-by-stage visual deployment progress plus friendly success and failure experiences.
- Added richer deployment notifications with Open, Copy URL, Logs, and diagnosis actions.
- Preserved the Advanced Explorer, commands, secure authentication, logs, rollback, cancellation, and Dashboard integration.
- Added GUI architecture, accessibility, performance, SDK gap, onboarding, deployment, and visual QA documentation.

## 0.3.1

- Updated the Marketplace icon and listing presentation.
- Expanded feature, command, security, and getting-started documentation.
- Added Marketplace discovery keywords for cloud-native deployment workflows.

## 0.3.0

- Added multiple secure account profiles with add, switch, and remove commands.
- Added Engine-owned deployment progress through the SDK; the extension no longer estimates percentages.
- Added lazy project sections for deployments, environment, domains, databases, runtime, monitoring, and recent activity.
- Added monitoring summaries to the native Dashboard view.
- Added SDK and MCP access to deployment progress, timelines, and monitoring summaries.

## 0.2.0

- Added a branded sign-in welcome experience and status-bar sign-in entry point.
- Added account switching, token management, workspace linking, and live URL copy commands.
- Added richer Quick Deploy confirmation with project metadata.
- Added SDK-backed deployment progress, terminal-state handling, native completion/failure notifications, and status-bar feedback.
- Added Activity Bar branding, Explorer deployment actions, and stream-log support.

## 0.1.0

- Initial Deployxa project and deployment explorer.
- Secure API-token authentication.
- Deploy, cancel, rollback, logs, organization selection, and Dashboard navigation.
