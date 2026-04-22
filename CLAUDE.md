# Rover — CLAUDE.md
> GoRover agent codebase. Read before touching anything.
> Naming: Rover/Seeker/Keeper/Cycle/Stake/Enter/Exit/Beacon/Drift/Log/Adapt

---

## Architecture Overview

```
src/runtime/rover.ts          Main entry: REPL + cron orchestration + Telegram bot polling
src/core/engine.ts            ReAct Cycle loop (OpenRouter/OpenAI-compatible): LLM → tool call → repeat
src/core/config.ts            Runtime config from rover.config.ts + .env; exposes config object
src/core/cortex.ts            Builds system prompt per agent role (SEEKER / KEEPER / GENERAL)
src/core/registry.ts          Stake registry (registry.json): tracks ranges, drift timestamps, notes
src/core/memory.ts            Log engine (memory.json): derives Logs + Adapt threshold evolution
src/core/poollog.ts           Per-pool deploy history + snapshots (poollog.json)
src/core/playbook.ts          Saved strategy presets (playbook.json)
src/core/briefing.ts          Daily Telegram briefing (HTML)
src/platform/notify.ts        Telegram bot: polling, notifications (Enter/Exit/swap/Drift)
src/core/swarm.ts             Swarm Beacon client (POST /beacon to swarm.gorover.xyz)
src/core/tracker.ts           Tracked wallets (tracker.json)
src/core/blocklist.ts         Token blocklist (blocklist.json)
src/platform/logger.ts        Structured logs

src/tools/
  definitions.js    Tool schemas in OpenAI format (what LLM sees)
  executor.js       Tool dispatch: name → fn, safety checks, pre/post hooks
  pool.ts           Meteora DLMM SDK wrapper (deploy, close, claim, positions, PnL)
  scan.ts           Pool discovery from Meteora API (Seeker)
  treasury.ts       SOL/token balances (Helius) + Jupiter swap + referral
  asset.ts          Token info/holders/narrative (Jupiter API)
  radar.ts          Top LPer study via Swarm Radar endpoint
  deploy.ts         Enter/Exit execution with retry logic
```

---

## Agent Roles & Tool Access

Three agent roles filter which tools the LLM can call:

| Role | GoRover Name | Purpose | Key Tools |
|------|-------------|---------|-----------|
| `SEEKER` | Seeker Cycle | Find and Enter new positions | deploy_position, get_top_candidates, get_token_holders, check_smart_wallets_on_pool |
| `KEEPER` | Keeper Cycle | Manage open Stakes | close_position, claim_fees, swap_token, get_position_pnl, set_position_note |
| `GENERAL` | Manual / REPL | Chat / manual commands | All tools |

Sets defined in `src/core/cortex.ts`. If you add a tool, also add it to the relevant set(s).

---

## Adding a New Tool

1. **`src/tools/definitions.js`** — Add OpenAI-format schema object to the `tools` array
2. **`src/tools/executor.js`** — Add `tool_name: functionImpl` to `toolMap`
3. **`src/core/cortex.ts`** — Add tool name to `KEEPER_TOOLS` and/or `SEEKER_TOOLS` if role-restricted
4. If the tool writes on-chain state, add it to `WRITE_TOOLS` in executor.js for safety checks

---

## Config System

`src/core/config.ts` loads config at startup from `rover.config.ts` (via `rover.config.json` snapshot) then `.env`. Runtime mutations go through `update_config` tool which:
- Updates the live `config` object immediately
- Persists to local config
- Restarts cron jobs if intervals changed

**Valid config keys and their sections:**

| Key | Section | Default |
|-----|---------|---------|
| minFeeActiveTvlRatio | screening | 0.05 |
| minTvl / maxTvl | screening | 10k / 150k |
| minVolume | screening | 500 |
| minOrganic | screening | 60 |
| minHolders | screening | 500 |
| minMcap / maxMcap | screening | 150k / 10M |
| minBinStep / maxBinStep | screening | 80 / 125 |
| timeframe | screening | "5m" |
| category | screening | "trending" |
| minTokenFeesSol | screening | 30 |
| maxBundlersPct | screening | 30 |
| maxTop10Pct | screening | 60 |
| blockedLaunchpads | screening | [] |
| deployAmountSol | management | 0.5 |
| maxDeployAmount | risk | 50 |
| maxPositions | risk | 3 |
| gasReserve | management | 0.2 |
| positionSizePct | management | 0.35 |
| minSolToOpen | management | 0.55 |
| outOfRangeWaitMinutes | management | 30 |
| managementIntervalMin | schedule | 10 |
| screeningIntervalMin | schedule | 30 |
| managementModel / screeningModel / generalModel | llm | — |

**`computeDeployAmount(walletSol)`** — scales position size with wallet balance (compounding). Formula: `clamp(deployable × positionSizePct, floor=deployAmountSol, ceil=maxDeployAmount)`.

---

## Stake Lifecycle

1. **Enter**: `deploy_position` → executor safety checks → `trackPosition()` in registry → Telegram notify
2. **Monitor**: Keeper Cycle → `getMyPositions()` → `getPositionPnl()` → Drift detection → pool-memory snapshots
3. **Exit**: `close_position` → `recordPerformance()` in memory → auto-swap base token to SOL → Telegram notify
4. **Adapt**: `evolveThresholds()` runs on performance data → updates config.screening → persists to local config

---

## Seeker Safety Checks (executor.js)

Before `deploy_position` executes:
- `bin_step` must be within `[minBinStep, maxBinStep]`
- Position count must be below `maxPositions` (force-fresh scan, no cache)
- No duplicate pool allowed (same pool_address)
- No duplicate base token allowed (same base_mint in another pool)
- If `amount_x > 0`: strip `amount_y` and `amount_sol` (tokenX-only deploy — no SOL needed)
- SOL balance must cover `amount_y + gasReserve` (skipped for tokenX-only)
- `blockedLaunchpads` enforced in `getTopCandidates()` before LLM sees candidates

---

## bins_below Calculation (Seeker)

Linear formula based on pool volatility (set in Seeker prompt):

```
bins_below = round(35 + (volatility / 5) * 34), clamped to [35, 69]
```

- Low volatility (0) → 35 bins
- High volatility (5+) → 69 bins
- Any value in between is valid (continuous, not tiered)

---

## Telegram Commands

Handled directly in `rover.ts` (bypass LLM):

| Command | Action |
|---------|--------|
| `/positions` | List open Stakes with progress bar |
| `/close <n>` | Close Stake by list index |
| `/set <n> <note>` | Set note on Stake by list index |
| `/swarm` | Show Swarm connection status |
| `/swarm pull` | Manually pull latest thresholds from Swarm |

Progress bar format: `[████████░░░░░░░░░░░░] 40%` (no bin numbers, no arrows)

---

## Race Condition: Double Enter

`_screeningLastTriggered` in `rover.ts` prevents concurrent Seeker invocations. Keeper Cycle sets this before triggering Seeker. Also, `deploy_position` safety check uses `force: true` on `getMyPositions()` for a fresh count.

---

## Bundler Detection (asset.ts)

Two signals used in `getTokenHolders()`:
- `common_funder` — multiple wallets funded by same source
- `funded_same_window` — multiple wallets funded in same time window

**Thresholds in config**: `maxBundlersPct` (default 30%), `maxTop10Pct` (default 60%)
Jupiter audit API: `botHoldersPercentage` (5–25% is normal for legitimate tokens)

---

## Base Fee Calculation (pool.ts)

Read from pool object at deploy time:
```js
const baseFactor = pool.lbPair.parameters?.baseFactor ?? 0;
const actualBaseFee = baseFactor > 0
  ? parseFloat((baseFactor * actualBinStep / 1e6 * 100).toFixed(4))
  : null;
```

---

## Model Configuration

- Default model: `process.env.LLM_MODEL` or `google/gemini-flash-1.5`
- LLM fallback chain: config model → `google/gemini-flash-1.5` → `anthropic/claude-haiku-20240307` → skip Cycle + notify
- Fallback on 502/503/529: retry with next model in chain
- Per-role models: `managementModel`, `screeningModel`, `generalModel` in local config
- LM Studio: set `LLM_BASE_URL=http://localhost:1234/v1` and `LLM_API_KEY=lm-studio`
- `maxOutputTokens` minimum: 2048 (free models may have lower limits causing empty responses)

---

## Log System (Memory)

`src/core/memory.ts` records closed Stake performance and auto-derives Logs. Key points:
- `getLessonsForPrompt({ agentType })` — injects relevant Logs into system prompt
- `evolveThresholds()` — Adapt: adjusts screening thresholds based on winners vs losers
- Performance recorded via `recordPerformance()` called from executor.js after `close_position`
- **Known issue**: Adapt is intentionally conservative until enough closed Stakes exist.

---

## Swarm

Swarm is GoRover's collective intelligence service (`swarm.gorover.xyz`).

In the public Rover build, Swarm sync is Beacon-only:
- POST `/beacon` with HMAC-SHA256 signature (signed with `GOROVER_SCOUT_KEY`)
- optional GET `/thresholds` pull (free, returns median thresholds from active Scouts)

Beacon sent after every Cycle. Includes: Logs, closed Stakes (verified on-chain), thresholds.

---

## Environment Variables

| Var | Required | Purpose |
|-----|----------|---------|
| `WALLET_PRIVATE_KEY` | Yes | Base58 or JSON array private key |
| `RPC_URL` | Yes | Solana RPC endpoint (Helius recommended) |
| `OPENROUTER_API_KEY` | Yes | LLM API key (OpenRouter) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram notifications |
| `TELEGRAM_CHAT_ID` | No | Telegram chat target |
| `LLM_BASE_URL` | No | Override for local LLM (e.g. LM Studio) |
| `LLM_MODEL` | No | Override default model |
| `DRY_RUN` | No | Skip all on-chain transactions |
| `GOROVER_SWARM_API_BASE` | No | Swarm base URL (default: `https://swarm.gorover.xyz`) |
| `GOROVER_SCOUT_KEY` | No | Scout key (sc_xxx) for Swarm auth + Beacon signing |
| `GOROVER_ROVER_ID` | No | Rover UUID — auto-set from `rover.config.ts`; included in every Beacon |
| `HELIUS_API_KEY` | No | Enhanced wallet balance data |

---

## Known Issues / Tech Debt

- Adapt (threshold evolution) is gated — needs enough closed Stakes to avoid low-signal drift.
- `get_wallet_positions` tool is in definitions.js but not in KEEPER_TOOLS or SEEKER_TOOLS — only available in GENERAL role.
