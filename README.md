# KeyEase Lab

KeyEase Lab is a small static web app for collecting personal typing-effort data for generated password-like strings.

It is for generated test strings only. Do not type real passwords.

## Privacy

- No backend, database, login, telemetry, analytics, or external API.
- No real password manager behavior.
- Candidate strings are generated locally with `crypto.getRandomValues`.
- Trial data stays in browser `localStorage` until you export it or clear it.
- The app does not intentionally make network requests.

## What It Records

Each completed trial includes:

- `trialId`
- `target`
- `typed`
- `startedAtEpochMs`
- `endedAtEpochMs`
- `durationMs`
- `success`
- `backspaceCount`
- `editDistance`
- `keydownEvents`

The keydown event list records key/code, timestamps, relative timestamps, and modifier-key state.

## Local Development

```bash
npm install
npm run dev
```

Vite will print a local URL, usually `http://localhost:5173/`.

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Tests

```bash
npm test
```

The included tests cover edit distance, CSV escaping, and CSV serialization.

## GitHub Pages Deployment

This project is configured for a repository named `keyease-lab`, so Vite uses:

```ts
base: "/keyease-lab/"
```

The workflow at `.github/workflows/pages.yml` builds the app and deploys `dist` to GitHub Pages whenever `main` is pushed.

To enable deployment:

1. Push this repo to GitHub as `keyease-lab`.
2. In GitHub, open the repository settings.
3. Go to **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Push to the `main` branch.

## Useful Commands

```bash
npm install
npm run dev
npm test
npm run build
```
