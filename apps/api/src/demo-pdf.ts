import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_SCRIPT_ID, demoScriptBeats, type DemoScriptBeat } from "@kasama/shared";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type PdfOp = { page: number; y: number; size: number; text: string };

function pdfEscape(text: string): string {
  return ascii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function ascii(text: string): string {
  return text
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
}

function wrap(text: string, size: number): string[] {
  const maxChars = Math.max(18, Math.floor(CONTENT_WIDTH / (size * 0.5)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function collectOps(beats: DemoScriptBeat[]): PdfOp[] {
  const ops: PdfOp[] = [];
  let page = 1;
  let y = PAGE_HEIGHT - 56;

  const push = (text: string, size: number, gap = 4) => {
    for (const line of wrap(text, size)) {
      if (y < 64) {
        page += 1;
        y = PAGE_HEIGHT - 56;
      }
      ops.push({ page, y, size, text: line });
      y -= size + gap;
    }
  };

  const rule = () => {
    y -= 8;
    push("----------------------------------------------------------------", 9, 2);
    y -= 6;
  };

  push("KASAMA  3-MINUTE DEMO", 22, 6);
  push("Read this sheet. Do not improvise. Typed fallback is the same line.", 12, 4);
  push(`Script ${DEMO_SCRIPT_ID}. Rules-based copy (KASAMA_DEMO=1). Uber is the controlled provider.`, 11, 8);
  rule();

  for (const beat of beats) {
    push(`${beat.title.toUpperCase()}   (~${beat.seconds}s)`, 14, 6);
    if (beat.say) {
      push(`SAY OR TYPE:  ${beat.say}`, 16, 5);
    }
    if (beat.tap) {
      push(`TAP:  ${beat.tap}`, 13, 4);
    }
    if (beat.expect) {
      push(`EXPECT:  ${beat.expect}`, 12, 4);
    }
    if (beat.pointAt) {
      push(`POINT:  ${beat.pointAt}`, 12, 4);
    }
    if (beat.fallback) {
      push(`IF IT FAILS:  ${beat.fallback}`, 12, 4);
    }
    rule();
  }

  push("DO NOT", 14, 5);
  push("Do not skip Confirm. Do not let ChatGPT plan (KASAMA_DEMO=1). Do not diagnose. Do not book twice. If Confirm stays on screen, the send/book failed — retry, do not claim success.", 12, 4);
  push("Time budget is 170 seconds. Leave a few seconds of silence between beats so Kasama can finish speaking.", 12, 4);

  return ops;
}

function pageStream(ops: PdfOp[], page: number): string {
  const lines = ["BT"];
  let currentSize = 0;
  for (const op of ops.filter((item) => item.page === page)) {
    if (op.size !== currentSize) {
      lines.push(`/F1 ${op.size} Tf`);
      currentSize = op.size;
    }
    lines.push(`1 0 0 1 ${MARGIN} ${op.y.toFixed(1)} Tm (${pdfEscape(op.text)}) Tj`);
  }
  lines.push("ET");
  return lines.join("\n");
}

export function renderDemoScriptPdf(): Buffer {
  const beats = demoScriptBeats();
  const ops = collectOps(beats);
  const pageCount = ops.reduce((max, op) => Math.max(max, op.page), 1);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");

  const pageIds = Array.from({ length: pageCount }, (_, i) => 3 + i);
  const contentIds = pageIds.map((id) => id + pageCount);
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  );

  for (let i = 0; i < pageCount; i += 1) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${3 + pageCount * 2} 0 R >> >> >>`,
    );
  }

  for (let i = 0; i < pageCount; i += 1) {
    const stream = pageStream(ops, i + 1);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
  }

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    output += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(output, "utf8");
}

export function demoPdfPath(repoRoot: string): string {
  return resolve(repoRoot, "docs/demo/kasama-3-minute-demo.pdf");
}

export function writeDemoScriptPdf(repoRoot: string): string {
  const path = demoPdfPath(repoRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderDemoScriptPdf());
  return path;
}

const isDirect = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirect) {
  const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
  const path = writeDemoScriptPdf(repoRoot);
  process.stdout.write(`Wrote ${path}\n`);
}
