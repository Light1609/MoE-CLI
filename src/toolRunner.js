import { spawnSync } from "node:child_process";

function runCommand(cmd, args, config) {
  if (!config.tool_allowlist?.includes(cmd)) {
    return { ok: false, code: null, stdout: "", stderr: `not_allowlisted:${cmd}` };
  }

  const proc = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: 120000,
    shell: false,
    cwd: process.cwd(),
    env: { ...process.env }
  });

  return {
    ok: proc.status === 0,
    code: proc.status,
    stdout: proc.stdout ?? "",
    stderr: proc.stderr ?? ""
  };
}

export function runGates(config) {
  const results = {};
  const gates = config.gates ?? {};

  if (gates.lint) results.lint = runCommand("npm", ["run", "lint", "--silent"], config);
  if (gates.typecheck) results.typecheck = runCommand("npm", ["run", "typecheck", "--silent"], config);
  if (gates.tests) results.tests = runCommand("npm", ["test", "--silent"], config);
  if (gates.build) results.build = runCommand("npm", ["run", "build", "--silent"], config);

  const ok = Object.values(results).every((r) => r.ok);
  return { ok, results };
}

export function detectBinary(name) {
  const proc = spawnSync("which", [name], { encoding: "utf8", shell: false });
  return { ok: proc.status === 0, path: (proc.stdout ?? "").trim() };
}
