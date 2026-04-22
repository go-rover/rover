export type RoverPreset = "conservative" | "moderate" | "aggressive";

export type RoverConfig = {
  // ─── GoRover (auto-generated — do not edit) ──────────────────────
  /** Scout key from app.gorover.xyz dashboard (starts with `sc_`). */
  vavScoutKey: string;
  /** Swarm base URL. Production: https://swarm.gorover.xyz */
  vavSwarmUrl: string;
  /** GoRover Jupiter referral wallet. Auto-filled from dashboard. */
  vavReferralWallet: string;

  // ─── Your wallet ⚠️ sensitive ────────────────────────────────────
  /** Base58 private key of your dedicated trading wallet. */
  walletKey: string;

  // ─── RPC ─────────────────────────────────────────────────────────
  /** Helius RPC endpoint with API key. Get one free at helius.dev */
  rpcUrl: string;

  // ─── LLM ─────────────────────────────────────────────────────────
  /** OpenRouter API key (sk-or-...). Get one at openrouter.ai */
  llmKey: string;
  /** Primary LLM model. Auto-fallback: gemini-flash → claude-haiku → skip Cycle */
  llmModel?: string;

  // ─── Behavior ────────────────────────────────────────────────────
  preset: RoverPreset;
  /**
   * Safety default. Keep true until you're confident in live trading.
   * You can also set DRY_RUN=true in your .env.
   */
  dryRun: boolean;

  // ─── Safety ──────────────────────────────────────────────────────
  /** Skip Enter if wallet balance below this (SOL). Default: 0.1 */
  minBalanceSol?: number;
  /** Minimum SOL per Stake. Default: 0.05 */
  minPositionSol?: number;
  /** Slippage tolerance in BPS. 100 = 1%. Default: 100 */
  slippageBps?: number;

  // ─── Optional ────────────────────────────────────────────────────
  /** Telegram chat ID for alerts. Get from @userinfobot */
  telegramChatId?: string;
  /** Max concurrent open Stakes. Default: 3 */
  maxPositions?: number;
  /** Seeker Cycle interval in ms. Default: 1800000 (30 min) */
  seekerIntervalMs?: number;
  /** Keeper Cycle interval in ms. Default: 600000 (10 min) */
  keeperIntervalMs?: number;
};

export const roverConfig: RoverConfig = {
  // ─── GoRover (auto-generated — do not edit) ──────────────────────
  vavScoutKey:       "sc_xxx",
  vavSwarmUrl:       "https://swarm.gorover.xyz",
  vavReferralWallet: "GOROVER_SOL_WALLET",

  // ─── Your wallet ⚠️ sensitive ────────────────────────────────────
  walletKey:         "YOUR_PRIVATE_KEY_BASE58",

  // ─── RPC ─────────────────────────────────────────────────────────
  rpcUrl:            "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",

  // ─── LLM ─────────────────────────────────────────────────────────
  llmKey:            "sk-or-YOUR_KEY",
  llmModel:          "google/gemini-flash-1.5",

  // ─── Behavior ────────────────────────────────────────────────────
  preset:            "moderate",
  dryRun:            true,

  // ─── Safety ──────────────────────────────────────────────────────
  minBalanceSol:     0.1,
  minPositionSol:    0.05,
  slippageBps:       100,

  // ─── Optional ────────────────────────────────────────────────────
  telegramChatId:    "",
  maxPositions:      3,
  seekerIntervalMs:  1800000,
  keeperIntervalMs:  600000,
};
