# ParaWave PTT - Application Push-to-Talk pour Parapentistes

A half-duplex communication application specialized for paragliding, using Apple's iOS 16+ PushToTalk framework with a Cloudflare Workers backend. A hybrid system designed to complement traditional VHF/UHF radios.

**Based on** the Vite 7 + HeroUI (v2) + Auth0 with Turborepo and Yarn 4 workspaces template.

[Try it on CodeSandbox](https://githubbox.com/sctg-development/vite-react-heroui-auth0-template)

## Star the project

**If you appreciate my work, please consider giving it a star! 🤩**

## ParaWave PTT

ParaWave PTT is a Push‑to‑Talk (PTT) half‑duplex communication system built for paragliding clubs and pilots. It combines an iOS client (native Swift app) using Apple's PushToTalk framework with a Cloudflare Workers backend for low‑latency audio chunk ingestion and session management.

This repository contains multiple workspaces:

- `ios/ParaWavePTT/ParaWavePTT` (iOS app) — Swift app using Apple's PushToTalk, AVFoundation and AVAudioEngine for audio capture and AAC encoding.
- `apps/cloudflare-worker` — Cloudflare Workers backend and Durable Objects that handle PTT sessions and audio chunk ingestion.
- `apps/backend-admin` — Admin web UI and API documentation for server operators.
- `docs/` — Design notes, API analysis and OpenAPI spec.

### Goals
- Provide a reliable, low‑latency group voice channel optimized for paragliding use cases (site channels, emergency channel, geo‑local channels).
- Use AAC‑LC for energy‑efficient hardware accelerated encoding on iOS.
- Integrate Apple PushToTalk framework for best UX on iOS 16+ devices.
- Support server‑side session management, push token handling and real‑time distribution via WebSockets/Durable Objects.

### Features
- iOS client with PushToTalk integration (channel join/leave, transmit/stop, ephemeral PTT push tokens).
- Audio capture with AVAudioEngine and conversion to AAC‑LC before upload.
- Chunked audio upload endpoint for streaming audio to the backend.
- Cloudflare Workers backend with API endpoints for transmission lifecycle (start, chunk, end) and optional WebSocket/Durable Object relay.
- Admin UI for channel management and telemetry.

### Quick project structure
- `ios/ParaWavePTT/ParaWavePTT` — Main iOS app project
- `apps/cloudflare-worker` — Worker code, tests and migrations
- `apps/backend-admin` — Admin web app and OpenAPI client
- `docs/openapi.json` — API specification used by the apps

### Development notes — iOS
- Target iOS 16.0 or later. PushToTalk framework is only available on real devices.
- Make sure the app has the following entitlements and capabilities:
   - Push‑to‑Talk capability (`com.apple.developer.push-to-talk`)
   - App Group configured if you share data between extensions
   - Background audio modes including `push-to-talk` in `UIBackgroundModes`
   - Remote notifications (for PTT push flow)
- Microphone permission required (`AVAudioSession` `requestRecordPermission`).
- Audio capture: app uses `AVAudioEngine` input node and installs a tap to obtain `AVAudioPCMBuffer`. The buffer is encoded to AAC‑LC before being base64 encoded and sent to the backend chunk endpoint.

### Backend notes
- The backend accepts chunked audio via `POST /api/v1/transmissions/{session_id}/chunk` and expects base64‑encoded payloads.
- AudioFormat supported: `aac-lc`, `opus`, `pcm`. The iOS client should send `aac-lc` by default.
- Durable Objects / WebSocket relay used for delivering real‑time audio to channel participants when available.

### How to build & run (high level)

#### iOS client
- Open `ios/ParaWavePTT/ParaWavePTT.xcodeproj` in Xcode 14+.
- Select a physical device (PushToTalk is not supported in Simulator).
- Ensure provisioning profile includes PushToTalk capability and App Group if configured.
- Build & run.

#### Cloudflare Worker (local dev)
- Install Node 18+ and Wrangler (per Cloudflare docs).
- From repo root:

```bash
yarn install
yarn dev:env
```

### Admin web UI
- Located at `apps/backend-admin`. Uses Vite. See that app's README for dev commands.

### API and tests
- The repository includes an OpenAPI description in `docs/openapi.json` used by the admin UI and backend tests.
- Unit and integration tests for the Cloudflare Worker are in `apps/cloudflare-worker/test`.

## Notes & Caveats
- AAC encoding on iOS should use `AVAudioConverter`/`AudioToolbox` to produce AAC‑LC frames. Be careful to produce proper ADTS/ADIF headers if the backend expects raw AAC frames or packaged containers. The current implementation encodes to MPEG‑4 AAC frames and the backend expects base64 of that stream.
- For production, tune audio bitrate and packet sizing for network conditions (e.g., 24–64 kbps typical for voice).
- Always test end‑to‑end on physical devices across network conditions.

## Contributing
- Open issues or PRs for features and fixes. Follow the repo's code style and run tests for the affected parts.

## License
- See top‑level `LICENSE` file. Some files are AGPL‑3.0‑or‑later (noted in file headers). Other parts of the monorepo may use MIT.

## Contact
- Repo owner / maintainer: highcanfly-club
- For security issues please open an issue labelled `security`.
To use the authentication system in your application, wrap your components with the `AuthenticationProvider`:

### Auth0 Configuration

To use Auth0, follow these steps:

1. **Create an Auth0 Account:**
   - Go to [Auth0](https://auth0.com) and sign up for a free account.

2. **Create a New Application:**
   - In the Auth0 dashboard, navigate to the "Applications" section.
   - Click on "Create Application".
   - Choose a name for your application.
   - Select "Single Page Web Applications" as the application type.
   - Click "Create".

3. **Configure Application Settings:**
   - In the application settings, you will find your `Client ID` and `Domain`.
   - Set the "Allowed Callback URLs" to `http://localhost:5173` (or your development URL).
   - Set the "Allowed Logout URLs" to `http://localhost:5173` (or your development URL).
   - Set the "Allowed Web Origins" to `http://localhost:5173` (or your development URL).

4. **Sample settings:**
   - The settings used by the demo deployment on GitHub Pages are:
     - Allowed Callback URLs: `https://sctg-development.github.io/vite-react-heroui-auth0-template`
     - Allowed Logout URLs: `https://sctg-development.github.io/vite-react-heroui-auth0-template`
     - Allowed Web Origins: `https://sctg-development.github.io`
     - On Github repository settings, the `AUTH0_CLIENT_ID` secret is set to the Auth0 client ID and the `AUTH0_DOMAIN` secret is set to the Auth0 domain.
     - The full Auth0 configuration screenshot is available [here](https://sctg-development.github.io/vite-react-heroui-auth0-template/auth0-settings.pdf).

5. **Configure API in Auth0:**
   - Navigate to "APIs" section in the Auth0 dashboard
   - Click "Create API"
   - Provide a descriptive name (e.g., "My Application API")
   - Set the identifier (audience) - typically a URL or URI (e.g., `https://api.myapp.com`)
   - Configure the signing algorithm (RS256 recommended)

6. **Configure API Settings:**
   - Enable RBAC (Role-Based Access Control) if you need granular permission management
   - Define permissions (scopes) that represent specific actions (e.g., `read:api`, `write:api`)
   - Configure token settings as needed (expiration, etc.)
   - Include permissions in the access token

7. **Set Environment Variables (example - anonymized):**
   The repository uses a number of environment variables. Below is an anonymized example that mirrors the keys in the project's `.env` file — values are masked and must be replaced with your real credentials/URLs.

   ```env
   # --- Local .env and GitHub Secrets (anonymized examples) ---
   # Replace placeholders with real values. NEVER commit real secrets.

   # App bundle identifier (used by iOS builds)
   APPLE_APP_BUNDLE_ID=club.highcanfly.parawave-ptt

   # Cloudflare (used for publishing workers and optional dev tunnels)
   CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   CLOUDFLARE_API_TOKEN=REDACTED_CLOUDFLARE_TOKEN
   CLOUDFLARE_TUNNEL_TOKEN=REDACTED_TUNNEL_TOKEN
   CLOUDFLARE_TUNNEL_FRONTEND_TOKEN=REDACTED_FRONTEND_TOKEN

   # Encryption key for storing/restoring encrypted development artifacts
   # (used only by the repository's helper scripts)
   CRYPTOKEN=REDACTED

   # Authentication provider selection
   AUTHENTICATION_PROVIDER_TYPE=auth0

   # Auth0 tenant credentials (replace with your tenant values)
   AUTH0_CLIENT_ID=REDACTED_CLIENT_ID
   AUTH0_CLIENT_SECRET=REDACTED_CLIENT_SECRET
   AUTH0_DOMAIN=REDACTED_AUTH0_DOMAIN
   AUTH0_SCOPE="openid profile email read:api write:api admin:api"
   AUTH0_AUDIENCE=http://localhost:5173

   # Optional: pre-fetched token for local tests ONLY (do not use in CI or prod)
   AUTH0_TOKEN=REDACTED

   # API endpoints and CORS origins
   API_BASE_URL=https://parawave-ptt.example/api
   CORS_ORIGIN=https://parawave-ptt-admin.example,http://localhost:5173

   # Permissions / application flags
   READ_PERMISSION=read:api
   WRITE_PERMISSION=write:api
   ADMIN_PERMISSION=admin:api
   ACCESS_PERMISSION_PREFIX=access
   TENANT_ADMIN_PERMISSION=tenant:admin

   # Auth0 management (M2M) used by backend services
   AUTH0_MANAGEMENT_AUDIENCE=https://your-auth0-tenant/api/v2/
   AUTH0_MANAGEMENT_CLIENT_ID=REDACTED_M2M_CLIENT_ID
   AUTH0_MANAGEMENT_CLIENT_SECRET=REDACTED_M2M_CLIENT_SECRET

   # Misc
   API_VERSION="1.0.0"
   ENVIRONMENT=development
   DEX_JWKS_ENDPOINT=

   # SECURITY NOTE:
   # - Keep all real tokens/credentials out of the repository. Use GitHub Secrets or
   #   your CI/CD secret store for deployment keys.
   # - .env files should be added to .gitignore. Treat AUTH0_TOKEN, CLOUDFLARE_API_TOKEN,
   #   and all CLIENT_SECRET values as high‑sensitivity secrets.
   ```

8. **Sample Configuration:**
   For reference, view the [Auth0 API configuration](https://sctg-development.github.io/vite-react-heroui-auth0-template/auth0-api.pdf) used in the demo deployment.
