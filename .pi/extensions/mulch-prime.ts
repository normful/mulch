import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * Pi extension that automatically runs `mulch prime` on session start and after compaction.
 *
 * This mimics the Claude hooks integration that mulch setup installs, but runs
 * automatically within Pi rather than as a git hook.
 *
 * Only runs when:
 * - The current directory has a .mulch/ directory (mulch is initialized)
 * - The 'mulch' command is available in PATH
 *
 * Can be disabled with the `mulch-auto-prime` flag:
 *   /flag mulch-auto-prime  (toggle)
 *   /flag mulch-auto-prime=false  (disable)
 *   /flag mulch-auto-prime=true   (enable)
 */
export default function (pi: ExtensionAPI) {
  // Register the flag with a default of true (enabled)
  pi.registerFlag("mulch-auto-prime", {
    description: "Auto-run 'mulch prime' on session start and after compaction",
    default: true,
  });

  // Run mulch prime on session start
  pi.on("session_start", async (_event, ctx) => {
    await runMulchPrime(pi, ctx);
  });

  // Run mulch prime after compaction
  pi.on("session_compact", async (_event, ctx) => {
    await runMulchPrime(pi, ctx);
  });
}

async function runMulchPrime(pi: ExtensionAPI, ctx: ExtensionContext) {
  // Check if auto-prime is disabled via flag
  const autoPrimeEnabled = pi.getFlag("mulch-auto-prime");
  if (autoPrimeEnabled === false) {
    return;
  }

  // Check if .mulch/ exists in current directory
  const mulchDir = join(ctx.cwd, ".mulch");
  if (!existsSync(mulchDir)) {
    // Not a mulch project, skip silently
    return;
  }

  // Check if mulch command is available
  try {
    await pi.exec("command -v mulch", { cwd: ctx.cwd });
  } catch {
    // mulch not installed, skip silently
    return;
  }

  try {
    // Run mulch prime in the current working directory
    const result = await pi.exec("mulch prime", { cwd: ctx.cwd });

    if (result.exitCode === 0) {
      ctx.ui.notify("Mulch: expertise loaded", "info");
    } else {
      const output = result.stdout.trim() || result.stderr.trim() || `exit ${result.exitCode}`;
      ctx.ui.notify(`Mulch: prime failed (${output.slice(0, 50)})`, "warning");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`Mulch: ${message.slice(0, 50)}`, "error");
  }
}
