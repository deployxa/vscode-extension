# Deploy with AI by Deployxa

**Deploy, monitor, troubleshoot, and manage your applications without ever leaving Visual Studio Code.**

Deployxa transforms VS Code into a complete deployment workspace. Whether you're a professional developer, indie hacker, AI builder, or just getting started, Deployxa lets you deploy projects visually with just a few clicks—no terminal required.

**👉 Create your free Deployxa account:**  
**https://deployxa.com/dashboard**

---

# Why Deployxa?

Stop switching between terminals, dashboards, cloud consoles, and deployment logs.

Deployxa brings everything into one beautiful VS Code experience:

* 🚀 One-click deployments
* 📊 Live deployment progress
* 📜 Streaming deployment logs
* 🌍 Domain management
* 🔒 SSL monitoring
* 🗄 Database insights
* ❤️ Runtime health monitoring
* 🤖 AI-powered deployment diagnostics
* ☁️ Native Deployxa Cloud integration

Everything is powered by the official **@deployxa/sdk**, ensuring every action goes directly through Deployxa Engine with secure authentication and authoritative deployment data.

---

# Built for Everyone

Deployxa isn't just for experienced DevOps engineers.

Whether you're:

* AI vibe coding with ChatGPT, Claude, or Gemini
* Building your first web application
* Managing client deployments
* Running production SaaS platforms
* Working in a development team

Deployxa gives you a visual deployment experience that removes the complexity of cloud infrastructure.

Simple Mode makes deployment accessible to beginners, while Advanced Mode exposes powerful tools for experienced developers.

---

# Visual Home Dashboard

The extension opens with a modern Deployxa Home experience featuring:

* Personalized welcome screen
* Organization switcher
* Workspace detection
* Project cards with one-click Deploy buttons
* Monitoring overview
* Recent deployments
* Quick actions
* Native project overview panels

No command memorization required.

---

# Secure Authentication

Deployxa keeps your credentials secure by design.

* Sign in with a Deployxa API token
* Tokens stored securely using VS Code SecretStorage
* Multiple accounts supported
* Easy account switching
* Organization selection
* Secure sign out
* Tokens are never written to project files or workspace settings

---

# One-Click Deployments

Deploy applications directly from Visual Studio Code. Two ways to get your code online:

## Upload a folder directly (no GitHub required)

New to Git and GitHub? You don't need them. Deployxa can package your local folder and build it for you:

* Pick **Upload folder** from the Deployxa Home screen or the Command Palette (`Deployxa: Upload and Deploy Folder`)
* Choose your project folder
* Deployxa packages it (excluding `node_modules`, build output, and `.git`), uploads it, and runs the same build as a repository deploy

This is the fastest path for AI-generated projects and anyone not using Git.

## Deploy from a repository

Connect GitHub or use a repository URL. Before deployment you'll see:

* Repository
* Branch
* Framework
* Runtime
* Confirmation dialog

Then watch every deployment stage in real time:

* Repository Analysis
* Planning
* Building
* Uploading
* Provisioning
* Health Checks
* Deployment Complete

Deployment notifications include actions to:

* Open your application
* Copy the live URL
* View deployment logs
* Explain deployment issues

---

# Projects

Browse every project in your organization.

Automatically:

* Detect Git repositories
* Match Git remotes
* Link workspaces
* View deployment history
* Open projects in the Deployxa Dashboard

---

# Logs & Monitoring

Stay informed without leaving VS Code.

View:

* Live deployment logs
* Deployment timelines
* CPU usage
* Memory usage
* Runtime health
* SSL status
* Recent activity
* Deployment history

Logs can be streamed live or viewed on demand.

---

# Platform Resources

Manage your entire application from one place.

The sidebar provides dedicated sections for:

* 🚀 Deployments
* 🌍 Domains
* 🔒 SSL
* 🌱 Environment Variables
* 🗄 Databases
* ❤️ Runtime
* 📈 Monitoring
* 📜 Activity

---

# AI-Powered Diagnostics

When something goes wrong, Deployxa helps you understand why.

Use built-in deployment diagnostics to:

* Identify deployment failures
* Review readiness checks
* Understand deployment stages
* Receive contextual recommendations
* Troubleshoot faster

---

# GitHub Integration

Connect your GitHub account to Deployxa and:

* Link repositories automatically
* Deploy directly from linked projects
* Keep your Deployxa projects synchronized

---

# Built-in Dashboard

Access your Deployxa dashboard without opening a browser.

View:

* Project summaries
* Deployments
* Monitoring
* Runtime health
* Domains
* Environment details

Need more? Open the full Deployxa Dashboard with one click.

---

# Getting Started

1. Install the Deployxa extension.
2. Create a free Deployxa account at **https://deployxa.com/dashboard**
3. Generate an API token from your Deployxa dashboard.
4. Sign in from the Deployxa Home screen.
5. Link your workspace.
6. Click **Deploy**.

That's it.

---

# Commands

* Deployxa: Sign In with API Token
* Deployxa: Sign Out
* Deployxa: Switch Account
* Deployxa: Manage Tokens
* Deployxa: Select Organization
* Deployxa: Link Current Workspace
* Deployxa: Deploy Project
* Deployxa: Upload and Deploy Folder
* Deployxa: Show Deployment Logs
* Deployxa: Stream Deployment Logs
* Deployxa: Cancel Deployment
* Deployxa: Roll Back Deployment
* Deployxa: Open Dashboard

---

# Security

Deployxa follows security best practices.

* Secure credential storage using VS Code SecretStorage
* No credentials stored in workspace files
* No credentials committed to source control
* Official @deployxa/sdk communication only
* Engine-authoritative deployment operations

---

# Why Developers Love Deployxa

* ⚡ Deploy without leaving VS Code
* 🎯 Beginner-friendly visual interface
* 🚀 One-click deployments
* 📊 Live deployment monitoring
* 📜 Streaming logs
* 🌍 Domain and runtime management
* 🤖 AI-assisted troubleshooting
* 🔒 Enterprise-grade security
* ☁️ Powered by Deployxa Cloud

---

## Ready to Ship Faster?

Install Deployxa, create your free account, and start deploying in minutes.

**👉 Register for free:** **https://deployxa.com/dashboard**

Deploy smarter. Monitor in real time. Ship faster with Deployxa.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run package
```
