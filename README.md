# Bookhaven

A full-stack digital library with a private shelf for each reader and a public collection of free classics.

**Live free demo:** The static build uses browser storage for each visitor's shelf and attached files. It has no account system or cross-device sync. The full-stack server below runs locally and supports private accounts.

## Features

- Create an account and sign in with email and password.
- Add, search, edit, filter, and remove books; track reading status and notes.
- Attach a PDF or EPUB (up to 3 MB) and download it through an owner-only API route.
- Browse five free classics without an account. EPUB downloads are linked to the original Project Gutenberg editions; the app does not copy or host those books.
- Responsive interface for desktop and mobile.

## Stack

React 19, TypeScript, Vite, Express 5, Node.js 24's built-in SQLite module, and local private file storage. One Express process serves the built frontend and API in production. No platform-specific SDK is required.

## Run locally

Requires Node.js 24 or newer.

```bash
npm install
```

Start these in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

Open `http://localhost:5173`. The Vite development server proxies `/api` to Express on port 3001. Account data and uploads go into `./data`, which is ignored by Git.

## Test and build

```bash
npm test
npm run build
```

To serve the production build locally:

```bash
NODE_ENV=production npm start
```

Then open `http://localhost:3001`.

## Deploy

The repository includes a Render Blueprint (`render.yaml`) for a **free static site**. It builds with `VITE_DEMO=true`, so the shelf is stored in the reader's browser using localStorage and IndexedDB. No payment method, hosted database, or disk is required. Open Render's **New Blueprint** flow, select this repository, and confirm the static site. Render can redeploy it automatically from `main`.

The static demo is a portfolio preview. Each visitor's shelf lives on that browser and device. Clearing site data removes it, and private browsing may not retain it. Do not use the demo for irreplaceable uploads. A shared account service needs durable database and object storage; the Node server requires a persistent volume and should not be deployed to an ephemeral free web service.

You can also build and run the included Dockerfile on another host with a **persistent volume**. Mount that volume at `/data` and use:

```text
NODE_ENV=production
PORT=3001
DATA_DIR=/data
TRUST_PROXY=true
```

Set `TRUST_PROXY=true` only when a trusted HTTPS reverse proxy is directly in front of the app. The session cookie is `HttpOnly`, `SameSite=Lax`, and marked `Secure` for HTTPS requests. Use HTTPS for any public deployment. Back up `/data/bookhaven.sqlite` and `/data/uploads` together. This single-volume SQLite setup is intended for one app instance; use a shared database and object storage before scaling to multiple instances.

## Code map

| Location | Purpose |
| --- | --- |
| `client/src/App.tsx` | Reader interface and public free-book shelf |
| `client/src/api.ts`, `client/src/local-api.ts` | Server API requests or browser-local demo storage |
| `server/app.mjs` | Authenticated API routes and file downloads |
| `server/db.mjs` | SQLite schema and book serialization |
| `server/security.mjs` | Password hashing and session token helpers |
| `server/app.test.mjs` | Integration tests for isolation and files |

## Content and scope

The free shelf links to Project Gutenberg. Those source listings describe the editions as public domain in the United States; readers elsewhere should check local law and the source terms. Personal uploads remain available only to their owner. Paid books, checkout, merchant payouts, and publishing rights management are not part of this version.

This repository contains application code only. Do not commit the `data/` directory, account information, uploaded books, or future payment keys.
