# Cashflow PWA Invoice

Standalone PWA for creating and managing invoices. Part of the Cashflow stack; deploys to Firebase Hosting (target `pwa-invoice`).

## Setup

```bash
npm install
npm run dev
```

## Build & Deploy

- **Build:** `npm run build` (output: `dist/`)
- **Deploy:** GitHub Actions on push to `main`, or manually:
  ```bash
  npm run build
  firebase deploy --only hosting
  ```

## Firebase

- Project: `cashflow-483906`
- Hosting target: `pwa-invoice`
- API/query rewrites to Cloud Run `api-dev-upgrade-v2` (asia-southeast1).
