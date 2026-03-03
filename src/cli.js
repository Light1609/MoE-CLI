#!/usr/bin/env node
import { cmdApply, cmdCacheClear, cmdCacheStats, cmdDoctor, cmdInit, cmdPlan, cmdRun, cmdVerify } from "./commands.js";
import { printResponse } from "./response.js";

const [, , command, ...args] = process.argv;

function argAfter(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return "";
  return args[idx + 1] ?? "";
}

async function main() {
  switch (command) {
    case "init":
      printResponse(cmdInit());
      break;
    case "plan":
      printResponse(cmdPlan(args.join(" ")));
      break;
    case "run":
      printResponse(await cmdRun(args.join(" ")));
      break;
    case "verify":
      printResponse(cmdVerify());
      break;
    case "doctor":
      printResponse(cmdDoctor());
      break;
    case "apply":
      printResponse(cmdApply(argAfter("--patch")));
      break;
    case "cache":
      if (args[0] === "stats") printResponse(cmdCacheStats());
      else if (args[0] === "clear") printResponse(cmdCacheClear());
      else printResponse({ ok: false, command: "cache", runId: null, data: {}, errors: ["available: cache stats|clear"] });
      break;
    default:
      printResponse({
        ok: false,
        command: command ?? "",
        runId: null,
        data: {},
        errors: [
          "unknown command",
          "available: init | plan <objective> | run <objective> | verify | doctor | apply --patch <runId> | cache stats|clear"
        ]
      });
  }
}

main();
