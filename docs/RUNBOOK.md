# Pathbound Online Runbook

## Prerequisites
- Node.js 20+
- npm 10+

## Install
```bash
npm install
```

## Develop (client + server)
```bash
npm run dev
```

Expected local endpoints:
- Client: `http://localhost:5173`
- Server health: `http://localhost:2567/health`
- Colyseus WS: `ws://localhost:2567`

Open two browser tabs on the client URL to validate multiplayer sync.

## Test / Quality
```bash
npm run typecheck
npm test
npm run build
npm run start
```

## Controls
- Movement: `WASD`
- Look: Mouse (click canvas to lock pointer)
- Sprint: `Shift`
- Jump: `Space`
- Attacks: `1` sword, `2` archer, `3` mage

## Archetype Selection
Use query param `class`:
- `?class=Archer`
- `?class=Mage`
- `?class=Swordsman`
- `?class=Assassin`

Example:
`http://localhost:5173/?class=Archer`
