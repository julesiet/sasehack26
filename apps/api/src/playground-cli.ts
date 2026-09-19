import { fileURLToPath } from "node:url";
import {
  PLAYGROUND_DEMO_TRANSCRIPT,
  playgroundUntilSchema,
  type PlaygroundUntil,
} from "@kasama/shared";
import { runPlaygroundTurn } from "./playground";

/**
 * In-process playground CLI. Does not need a running API.
 *
 *   pnpm playground
 *   pnpm playground -- "Please get me a ride to my doctor tomorrow."
 *   pnpm playground -- --until turn "I need a ride"
 */

type CliOptions = {
  transcript: string;
  sessionId?: string;
  until: PlaygroundUntil;
  help: boolean;
};

export function parsePlaygroundArgs(argv: string[]): CliOptions {
  const rest: string[] = [];
  let sessionId: string | undefined;
  let until: PlaygroundUntil = "checkpoint";
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--until") {
      const value = argv[i + 1];
      const parsed = playgroundUntilSchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`--until must be "turn" or "checkpoint".`);
      }
      until = parsed.data;
      i += 1;
      continue;
    }
    if (arg === "--session-id") {
      sessionId = argv[i + 1];
      if (!sessionId) {
        throw new Error("--session-id needs a value.");
      }
      i += 1;
      continue;
    }
    if (arg?.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (arg) rest.push(arg);
  }

  return {
    transcript: rest.join(" ").trim() || PLAYGROUND_DEMO_TRANSCRIPT,
    sessionId,
    until,
    help,
  };
}

export function playgroundHelp(): string {
  return [
    "Kasama text playground — exercise intent, tools, and policy without iOS.",
    "",
    "Usage:",
    '  pnpm playground',
    `  pnpm playground -- "${PLAYGROUND_DEMO_TRANSCRIPT}"`,
    '  pnpm playground -- --until turn "I need a ride"',
    "  pnpm playground -- --session-id demo-1 --until checkpoint",
    "",
    "HTTP: POST /playground (needs pnpm dev:api):",
    `  curl -s http://localhost:3001/playground -H 'content-type: application/json' -d '{"transcript":"${PLAYGROUND_DEMO_TRANSCRIPT}"}'`,
    "",
    "Never books or sends. A pending approval is a structured prompt for a human.",
  ].join("\n");
}

export async function runPlaygroundCli(argv: string[]): Promise<{ status: number; text: string }> {
  let options: CliOptions;
  try {
    options = parsePlaygroundArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid arguments.";
    return { status: 1, text: `${message}\n\n${playgroundHelp()}` };
  }

  if (options.help) {
    return { status: 0, text: playgroundHelp() };
  }

  const result = await runPlaygroundTurn({
    transcript: options.transcript,
    sessionId: options.sessionId,
    until: options.until,
  });
  const text = `${JSON.stringify(result.body, null, 2)}\n`;
  return { status: result.status === 200 ? 0 : 1, text };
}

const isDirect = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirect) {
  runPlaygroundCli(process.argv.slice(2))
    .then(({ status, text }) => {
      if (status === 0) {
        process.stdout.write(text);
      } else {
        process.stderr.write(text);
      }
      process.exit(status);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Playground failed.";
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}
