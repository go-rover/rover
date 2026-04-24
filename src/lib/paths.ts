import fs from "node:fs";
import path from "node:path";

/**
 * Workspace root: the rover package directory (run CLI/runtime with `cwd` here).
 */
export const WORKSPACE_ROOT = process.cwd();

export function workspacePath(...segments: string[]): string {
  return path.join(WORKSPACE_ROOT, ...segments);
}

/**
 * Atomic file write: write to .tmp then rename.
 * Prevents corrupt state files on crash mid-write.
 */
export function writeFileAtomic(filePath: string, data: string): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, filePath);
}

/** Well-known files at repo root (not inside src/). */
export const paths = {
  root: WORKSPACE_ROOT,
  packageJson: () => workspacePath("package.json"),
  env: () => workspacePath(".env"),
  /** Legacy JSON config; prefer `rover.config.ts` + env. */
  userConfigJson: () => workspacePath("user-config.json"),
  roverConfigTs: () => workspacePath("rover.config.ts"),
};
