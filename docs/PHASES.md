# Pathbound Online Phase Checklist

## Phase 0 - Project Bootstrap
- [x] Monorepo workspace structure (`apps/client`, `apps/server`, `packages/shared`)
- [x] Root scripts for `dev`, `build`, `typecheck`, `lint`, `test`
- [x] Client connects to Colyseus server room
- [x] Strict TypeScript baseline in shared config

## Phase 1 - Multiplayer Vertical Slice
- [x] Two browser tabs can join same room and see each other
- [x] Movement replication with client interpolation for remote players
- [x] Local prediction for movement/jump with reconciliation
- [x] Three server-authoritative attacks (`sword`, `archer`, `mage`)
- [x] Training dummies with respawn
- [x] Combat feedback feed in HUD
- [x] Skill XP awarded only on server-valid hits
- [x] Client HUD shows skill levels and XP
- [x] Baseline anti-cheat validation: attack cooldown/range/arc/yaw drift checks
- [x] Added per-intent anti-spam guard and richer combat feedback payload
- [x] Added additional server combat rule tests

## Next Phase
- [ ] Phase 2 precision mechanics and drill-specific UI
