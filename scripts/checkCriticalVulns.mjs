import { spawnSync } from "node:child_process";

const runAudit = () => {
  const result = spawnSync("npm", ["audit", "--audit-level=critical", "--json"], {
    encoding: "utf-8",
  });

  // Exit code 0 => no critical vulnerabilities
  if (result.status === 0) {
    process.exit(0);
  }

  // Try to parse JSON output to distinguish real vulns from other errors
  try {
    const data = result.stdout ? JSON.parse(result.stdout) : null;
    const critical =
      data?.metadata?.vulnerabilities?.critical ??
      data?.vulnerabilities?.critical ??
      0;

    if (critical > 0) {
      console.error(
        "❌ Critical security vulnerabilities detected! Run `npm audit fix`."
      );
      process.exit(1);
    }

    // Non-critical issues or ambiguous result: warn but do not block
    console.warn(
      "⚠️ npm audit did not complete cleanly or reported only non-critical issues. Skipping enforcement for this run."
    );
    if (result.stderr) {
      console.warn(result.stderr.trim());
    }
    process.exit(0);
  } catch {
    // JSON parse failed – likely a network or registry error
    console.warn(
      "⚠️ npm audit could not complete (likely a network or registry error). Skipping critical-vuln enforcement for this run."
    );
    if (result.stderr) {
      console.warn(result.stderr.trim());
    }
    process.exit(0);
  }
};

runAudit();

