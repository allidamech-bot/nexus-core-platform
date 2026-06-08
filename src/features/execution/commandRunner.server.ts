import "@tanstack/react-start/server-only";
import * as cp from "node:child_process";
const { spawn } = cp;

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = 30000,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    try {
      const child = spawn(command, args, { cwd, shell: true });
      let isDone = false;

      const timeoutId = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          child.kill();
          resolve({ stdout, stderr, exitCode: null, error: "Execution timed out" });
        }
      }, timeoutMs);

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutId);
          resolve({ stdout, stderr, exitCode: null, error: err.message });
        }
      });

      child.on("close", (code) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timeoutId);
          resolve({ stdout, stderr, exitCode: code });
        }
      });
    } catch (err) {
      resolve({
        stdout,
        stderr,
        exitCode: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
