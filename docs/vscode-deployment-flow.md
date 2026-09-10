# Deployment flow

Deployxa supports two ways to get code online, both using the same Engine build pipeline and the same friendly progress, success, and failure experiences.

## Repository deployment

Home's Deploy buttons invoke `deployxa.deploy`, the same command used by the Explorer. The SDK creates the deployment and streams authoritative Engine progress. Home renders friendly stages, terminal success/failure cards, live URL actions, logs, cancellation, and supported deployment diagnosis. The extension does not calculate authoritative state or progress.

## Direct folder upload

For users without Git or GitHub, `deployxa.deployFolderUpload` (and the `deployByUpload` path used when a folder has no git remote) packages the local folder into a streaming `.tar.gz`, creates a project with an `upload:` sentinel repository URL via `clients.client().uploadProject`, and streams the archive to `POST /api/deployments/upload`. The Engine build worker detects `uploadPath` and extracts the archive instead of cloning a repository, so the build, health checks, and deployment are identical to a repository deploy. Build artifacts and dependencies (`node_modules`, `dist`, `.git`, etc.) are excluded by `upload.ts` to keep the archive small and let the Engine regenerate them.
