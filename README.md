# Pathbound Online

Multiplayer 3D RPG prototype with:
- Vite + Babylon.js client
- Node.js + Express + Colyseus authoritative server

## Local Development
```bash
npm install
npm run dev
```

## Production Build
```bash
npm run build
npm run start
```

`npm run start` launches the Colyseus server and serves the built client when `apps/client/dist` exists.

## Hostinger Deployment
Use Node.js app import from Git and set:
- Build command: `npm run build`
- Start command: `npm run start`
- Node version: `20+`

If your plan does not allow inbound WebSockets, deploy server on VPS and point the client to that `VITE_SERVER_URL`.
