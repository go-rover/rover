/**
 * Dev (deployer) blocklist — deployer wallet addresses that should never be deployed into.
 *
 * Agent/user can add deployers via Telegram ("block this deployer").
 * Screening hard-filters any pool whose base token was deployed by a blocked wallet
 * before the pool list reaches the LLM.
 */

// @ts-nocheck
import fs from "node:fs";
import { workspacePath, writeFileAtomic } from "@/lib/paths";
import { log } from "@/platform/logger";

const BLOCKLIST_FILE = workspacePath("deployer-blacklist.json");
const LEGACY_BLOCKLIST_FILE = workspacePath("dev-blocklist.json");

function defaultSeedAddresses() {
  return String(process.env.ROVER_KNOWN_RUGGER_DEPLOYERS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalize(raw) {
  if (!raw || typeof raw !== "object") return {};

  // New/canonical format: { blocked: { [wallet]: metadata } }
  if (raw.blocked && typeof raw.blocked === "object" && !Array.isArray(raw.blocked)) {
    return raw.blocked;
  }

  // Legacy format from README docs: { addresses: ["..."] }
  if (Array.isArray(raw.addresses)) {
    const migrated = {};
    for (const wallet of raw.addresses) {
      const addr = String(wallet || "").trim();
      if (!addr) continue;
      migrated[addr] = {
        label: "known_rugger",
        reason: "legacy deployer-blacklist seed",
        added_at: new Date().toISOString(),
      };
    }
    return migrated;
  }

  // Old map format used by tools: { [wallet]: metadata }
  return raw;
}

function readFileOrEmpty(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    log("dev_blocklist_error", `Invalid ${file}: ${error.message}`);
    throw new Error(`Safety blocklist is unreadable: ${file}`);
  }
}

function ensureSeededBlocklist() {
  const fromCanonical = normalize(readFileOrEmpty(BLOCKLIST_FILE));
  const fromLegacy = normalize(readFileOrEmpty(LEGACY_BLOCKLIST_FILE));

  const merged = { ...fromLegacy, ...fromCanonical };
  for (const wallet of defaultSeedAddresses()) {
    if (merged[wallet]) continue;
    merged[wallet] = {
      label: "known_rugger",
      reason: "seeded from ROVER_KNOWN_RUGGER_DEPLOYERS",
      added_at: new Date().toISOString(),
    };
  }

  const payload = {
    _note:
      "Known farm/rug deployers. Add wallet addresses here to hard-block their pools before LLM screening.",
    blocked: merged,
  };
  const serialized = JSON.stringify(payload, null, 2);
  const current =
    fs.existsSync(BLOCKLIST_FILE) ? fs.readFileSync(BLOCKLIST_FILE, "utf8") : null;
  if (current !== serialized) {
    writeFileAtomic(BLOCKLIST_FILE, serialized);
  }

  if (fs.existsSync(LEGACY_BLOCKLIST_FILE)) {
    try {
      fs.unlinkSync(LEGACY_BLOCKLIST_FILE);
    } catch {
      // Keep running even if cleanup fails.
    }
  }
}

function load() {
  ensureSeededBlocklist();
  const raw = readFileOrEmpty(BLOCKLIST_FILE);
  return normalize(raw);
}

function save(data) {
  writeFileAtomic(
    BLOCKLIST_FILE,
    JSON.stringify(
      {
        _note:
          "Known farm/rug deployers. Add wallet addresses here to hard-block their pools before LLM screening.",
        blocked: data,
      },
      null,
      2
    )
  );
}

export function isDevBlocked(devWallet) {
  if (!devWallet) return false;
  return !!load()[devWallet];
}

export function getBlockedDevs() {
  return load();
}

export function blockDev({ wallet, reason, label }) {
  if (!wallet) return { error: "wallet required" };
  const db = load();
  if (db[wallet])
    return { already_blocked: true, wallet, label: db[wallet].label, reason: db[wallet].reason };
  db[wallet] = {
    label: label || "unknown",
    reason: reason || "no reason provided",
    added_at: new Date().toISOString(),
  };
  save(db);
  log("dev_blocklist", `Blocked deployer ${label || wallet}: ${reason}`);
  return { blocked: true, wallet, label, reason };
}

export function unblockDev({ wallet }) {
  if (!wallet) return { error: "wallet required" };
  const db = load();
  if (!db[wallet]) return { error: `Wallet ${wallet} not on dev blocklist` };
  const entry = db[wallet];
  delete db[wallet];
  save(db);
  log("dev_blocklist", `Removed deployer ${entry.label || wallet} from blocklist`);
  return { unblocked: true, wallet, was: entry };
}

export function listBlockedDevs() {
  const db = load();
  const entries = Object.entries(db).map(([wallet, info]) => ({ wallet, ...info }));
  return { count: entries.length, blocked_devs: entries };
}
