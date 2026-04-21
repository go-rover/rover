# Changelog

All notable changes to Rover are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) — Semantic Versioning.

---

## [0.4.1] — 2026-04-21

### Added
- `roverId` field in `rover.config.ts` — auto-embedded when you download config from the dashboard. Links your running Rover to its dashboard record so status and PnL sync without any manual setup.
- `VAV_ROVER_ID` env var — auto-set from `rover.config.ts` on `vav-agent start`. Included in every Beacon payload (HMAC-signed) so Swarm can direct-match to the correct Rover record.

### Changed
- `vav-agent init` now only creates `.env` (wallet key, RPC, LLM, Telegram). It no longer generates a `rover.config.ts` with a placeholder Scout key — instead it guides you to download the real config from the dashboard with your actual `roverId` and `scoutKey` already filled in.

### Fixed
- Suppressed `bigint-buffer` native bindings warning on startup (cosmetic, no functional impact).
- Removed leftover `agent` wording from runtime log labels.

---

## [0.4.0] — 2026-04-21

### Added
- `vav-agent` CLI — new binary, installable via `bunx vav-agent`:
  - `vav-agent init` — interactive setup wizard, creates `.env` with wallet, RPC, LLM provider, Telegram, risk preset, and scheduling config.
  - `vav-agent start <rover.config.ts>` — loads config, applies safety defaults (`DRY_RUN=true`), starts management + screening cron jobs.
  - `vav-agent status <rover.config.ts>` — prints live Stakes, cumulative PnL summary, and Swarm connection info.
  - `vav-agent balance` — SOL and token balances.
  - `vav-agent positions` — all open Stakes.
  - `vav-agent pnl <position>` — PnL for a specific position.
  - `vav-agent deploy / claim / close / swap` — direct on-chain actions.
  - `vav-agent candidates` — top pool candidates, fully enriched.
  - `vav-agent screen / manage` — run one AI cycle manually.
  - `vav-agent lessons / evolve / blacklist / performance` — memory and config management.
  - `vav-agent config get / set` — read and update runtime config.
- `rover.config.ts` loader (`src/core/rover-config.ts`) — load and apply typed config from a TS file; persists snapshot to `rover.config.json` for synchronous runtime reads.
- Rover-style structured log output — all log labels use Rover vocabulary (Seeker / Keeper / Cycle / Stake / Beacon).
- `SKILL.md` auto-generated to `~/.vav-agent/SKILL.md` on every CLI run — machine-readable reference for AI assistants.

### Changed
- Full rename from legacy branding to Rover vocabulary across all source files.
- `DRY_RUN=true` enforced as default in `applyRoverConfig` unless explicitly set to `false`.
- Beacon signing upgraded to HMAC-SHA256 (`signBeacon`) — compatible with Swarm verification.

---

## Versioning

```
MAJOR  breaking change to config format or Swarm API contract
MINOR  new feature (new CLI command, new tool, new runtime capability)
PATCH  bug fix, chore, or non-breaking improvement
```
