import fs from "node:fs";
import { workspacePath } from "@/lib/paths";

type LockInfo = {
  pid: number;
  createdAt: string;
  argv: string[];
  // Linux kernel `starttime` (22nd field of /proc/<pid>/stat, in clock ticks
  // since system boot). Used to detect stale locks across container restarts
  // where the new process may reuse the same pid (notably pid=1 in Docker).
  startTime?: string | null;
};

const LOCK_PATH = workspacePath(".rover.lock");

function readProcStartTime(pid: number): string | null {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    // The comm field is wrapped in parentheses and may contain spaces, so we
    // locate the final ')' and split the remainder on whitespace.
    const rparen = raw.lastIndexOf(")");
    if (rparen === -1) return null;
    const rest = raw.slice(rparen + 2).split(/\s+/);
    // After comm, fields are: state ppid pgrp session tty_nr tpgid flags
    // minflt cminflt majflt cmajflt utime stime cutime cstime priority nice
    // num_threads itrealvalue starttime ... → starttime is index 19 in `rest`.
    const startTime = rest[19];
    return startTime ?? null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock(): LockInfo | null {
  try {
    if (!fs.existsSync(LOCK_PATH)) return null;
    const raw = fs.readFileSync(LOCK_PATH, "utf8");
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

function isLockStale(existing: LockInfo): boolean {
  if (!existing?.pid || existing.pid <= 0) return true;
  // If the stored pid matches our own, it's a carry-over from a previous run
  // (we haven't written our lock yet). Always stale.
  if (existing.pid === process.pid) return true;
  if (!isProcessAlive(existing.pid)) return true;
  // pid is reported alive; verify kernel start-time matches. In containers,
  // pid=1 is always alive but refers to *this* new process, not the old one.
  const recordedStart = existing.startTime ?? null;
  const currentStart = readProcStartTime(existing.pid);
  if (recordedStart && currentStart && recordedStart !== currentStart) {
    return true;
  }
  return false;
}

export function acquireInstanceLock() {
  const existing = readLock();
  if (existing && !isLockStale(existing)) {
    const msg = `Another Rover instance is already running (pid=${existing.pid}). Refusing to start.`;
    const err = new Error(msg);
    // @ts-expect-error
    err.code = "ROVER_LOCKED";
    throw err;
  }

  if (existing) {
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch {
      // ignore
    }
  }

  const info: LockInfo = {
    pid: process.pid,
    createdAt: new Date().toISOString(),
    argv: process.argv.slice(0, 10),
    startTime: readProcStartTime(process.pid),
  };

  fs.writeFileSync(LOCK_PATH, JSON.stringify(info, null, 2));

  const cleanup = () => {
    try {
      const current = readLock();
      if (current?.pid === process.pid) fs.unlinkSync(LOCK_PATH);
    } catch {
      // ignore
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

  return { lockPath: LOCK_PATH };
}
