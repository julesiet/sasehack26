import { fileURLToPath } from "node:url";
import { DEFAULT_SESSION_ID } from "@kasama/shared";
import { runDemoRehearsal } from "./demo-rehearse";

export async function runDemoRehearsalCli(argv: string[]): Promise<{ status: number; text: string }> {
  const sessionFlag = argv.findIndex((arg) => arg === "--session-id");
  const sessionId = sessionFlag >= 0 ? argv[sessionFlag + 1] : DEFAULT_SESSION_ID;
  if (!sessionId) {
    return { status: 1, text: "--session-id needs a value.\n" };
  }

  const result = await runDemoRehearsal({ sessionId });
  const lines = [
    result.ok ? "Demo rehearsal passed." : "Demo rehearsal failed.",
    `sessionId: ${result.sessionId}`,
    `caretaker: ${result.dashboard.overviewBadge ?? result.dashboard.overviewStatus}`,
    ...result.beats.map((beat) => `${beat.ok ? "ok" : "FAIL"}  ${beat.id}: ${beat.reply}`),
    "",
  ];
  return { status: result.ok ? 0 : 1, text: lines.join("\n") };
}

const isDirect = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirect) {
  runDemoRehearsalCli(process.argv.slice(2))
    .then(({ status, text }) => {
      if (status === 0) process.stdout.write(text);
      else process.stderr.write(text);
      process.exit(status);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Demo rehearsal failed.";
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}
