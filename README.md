# zijApp

This project contains two parts:

- `backend/` for the server
- `frontend/` for the client (Vite)

## Prerequisites

- Node.js 18+ (recommended)
- npm

## Installation

From the project root, install all dependencies (root + backend + frontend):

```bash
npm run install-all
```

This runs:

- `npm install` in the root
- `npm install` in `backend/`
- `npm install` in `frontend/`

## Run in Development

Start both backend and frontend together:

```bash
npm run dev
```

This uses `concurrently` to run:

- `npm run server` (backend dev server)
- `npm run client` (frontend dev server)

## Build Process

Run the project build pipeline from the root:

```bash
npm run build
```

According to current scripts, this executes:

1. `npm run build-server` -> `cd backend && npm run build`
2. `npm run build-client` -> `cd frontend && npm run build`

Notes:

- Backend currently has no compilation/transpile step, so its build script is a no-op message.
- Frontend build is handled by Vite and outputs production assets.

## Useful Individual Commands

From project root:

- `npm run server` -> run backend only
- `npm run client` -> run frontend only