# Contributing to Jira Tracker

Thanks for your interest in contributing! This guide will get you up and running.

## Prerequisites

- **Node.js 20+** and npm
- A **Red Hat Jira PAT** (Personal Access Token) for local development — [create one here](https://issues.redhat.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens)
- Access to the **Firebase project** (for auth testing) — ask the maintainer if needed

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/accorvin/jira-tracker.git
cd jira-tracker
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your Jira PAT:
```
JIRA_TOKEN=your-personal-access-token
```

The Firebase config values in `.env.example` are already set to the correct project. These are public-facing values (safe to use as-is).

### 3. Run locally

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express dev server (port 3001) concurrently. The Vite dev server proxies `/api` requests to the Express backend.

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001/api

### 4. Run tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

## Project Structure

```
├── src/                    # Vue 3 frontend
│   ├── components/         # Vue components
│   ├── composables/        # Composition API hooks (useAuth, useAdmin, useSavedFilters)
│   ├── services/api.js     # API client
│   ├── utils/              # Utility functions
│   └── __tests__/          # Frontend tests (Vitest + jsdom)
├── server/                 # Local dev server
│   ├── dev-server.js       # Express app (mirrors Lambda API)
│   └── storage.js          # Local file storage (replaces S3 in dev)
├── amplify/                # AWS Amplify backend
│   └── backend/function/   # Lambda functions
│       └── */src/shared/   # Shared business logic (used by both Lambda and dev server)
├── amplify.yml             # Amplify build config
├── index.html              # Entry point
└── vite.config.js          # Vite config
```

### Key Architecture Notes

- **Shared business logic** lives in `amplify/backend/function/*/src/shared/`. These are pure functions with no I/O dependencies — used by both Lambda (prod) and the Express dev server (local).
- **Auth:** Firebase Google sign-in, restricted to `@redhat.com` domain. The `AuthGuard` component handles login flow.
- **Storage:** S3 in production, local JSON files in development (`server/storage.js`).

## Making Changes

### Branch naming

Use descriptive branch names:
- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — code improvements

### Development workflow

1. Create a branch from `main`
2. Make your changes
3. Write or update tests for any changed logic
4. Run `npm test` to make sure everything passes
5. Run `npm run build` to verify the production build works
6. Open a PR against `main`

### Pull requests

- PRs require at least one review before merge
- CI must pass (tests + build)
- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why

### Writing tests

Tests use **Vitest** with **jsdom** and **@vue/test-utils**. Put test files in `src/__tests__/` with the `.spec.js` extension.

```bash
# Run a specific test file
npx vitest run src/__tests__/YourComponent.spec.js

# Run tests in watch mode
npm run test:watch
```

### Code style

- Vue 3 Composition API (no Options API)
- Tailwind CSS for styling
- Keep components focused and composable
- Extract reusable logic into composables (`src/composables/`)

## Deployment

Production deploys happen automatically when changes merge to `main` via AWS Amplify. You don't need AWS access to contribute — just get your PR reviewed and merged.

The app is live at [red.ht/rhoai-jira-tracking](https://red.ht/rhoai-jira-tracking).

## Questions?

Open an issue or reach out to @accorvin.
