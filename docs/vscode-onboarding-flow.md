# Onboarding flow

Signed-out users see a Home welcome card with Get Started and Sign In actions. Sign-in still uses the existing secure API-token input and VS Code SecretStorage. Once connected, Home shows projects, account controls, workspace linking, and deployment actions without requiring the Command Palette.

Vibe coders with a local folder and no Git/GitHub can deploy directly from Home via **Upload folder** (`deployxa.deployFolderUpload`). Deployxa packages the folder, uploads it, and runs the same build as a repository-backed deployment — no version control setup required.
