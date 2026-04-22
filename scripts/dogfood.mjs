import { spawnSync } from "node:child_process";

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

// Always keep dogfood safe by default.
process.env.DRY_RUN ||= "true";

run("bun", ["run", "vocab"]);
run("bun", ["run", "typecheck"]);
run("bun", ["run", "lint"]);

// Unit tests only: integration tests need live LLM/RPC keys and fail in CI/Railway without them.
if (process.env.DOGFOOD_SKIP_TESTS !== "1") {
  if (process.env.DOGFOOD_INTEGRATION === "1") {
    run("bun", ["run", "test"]);
  } else {
    run("bun", ["run", "test:unit"]);
  }
}

// Swarm smoke is optional (needs GOROVER_SCOUT_KEY). If present, verify server+client path.
if (process.env.GOROVER_SCOUT_KEY && String(process.env.GOROVER_SCOUT_KEY).trim()) {
  run("node", ["scripts/smoke-swarm.mjs"]);
} else {
  process.stdout.write("SKIP: Swarm smoke (missing GOROVER_SCOUT_KEY).\n");
}

process.stdout.write("OK: dogfood checks passed.\n");

