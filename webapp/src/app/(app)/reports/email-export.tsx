"use client";

import { useState } from "react";
import { btnPrimary } from "@/lib/ui";

// One row of the report table, already reduced to plain strings by the server.
export type ExportRow = {
  tender: string;
  label: string;
  score: string;
  stage: string;
  note: string;
};

export type ExportData = {
  generatedOn: string;
  scanned: number;
  qualified: number;
  onBoard: number;
  active: number;
  pipeline: ExportRow[];
  exits: ExportRow[];
};

// Outlook strips <style> blocks and ignores class attributes, so every rule has
// to live on the element itself. These are the styles the desktop client
// actually honours — no flexbox, no grid, no CSS variables.
const TD = "padding:6px 10px;border:1px solid #d0d5dd;vertical-align:top;font-size:13px;";
const TH =
  "padding:6px 10px;border:1px solid #d0d5dd;background:#f2f4f7;text-align:left;" +
  "font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;";

// Word's HTML engine collapses whitespace unpredictably around inline tags, so
// empty cells get a hard space rather than nothing.
function cell(text: string): string {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return safe.trim() === "" ? "&nbsp;" : safe;
}

function table(caption: string, rows: ExportRow[], reasonHeader: string): string {
  if (rows.length === 0) return "";
  const body = rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="${TD}">${cell(r.tender)}</td>` +
        `<td style="${TD}">${cell(r.label)}${r.score ? ` (${cell(r.score)})` : ""}</td>` +
        `<td style="${TD}">${cell(r.stage)}</td>` +
        `<td style="${TD}">${cell(r.note)}</td>` +
        `</tr>`
    )
    .join("");
  return (
    `<p style="font-size:14px;font-weight:600;margin:18px 0 6px;">${cell(caption)}</p>` +
    // border-collapse must be inline; Outlook drops it from a stylesheet and
    // the table renders with doubled 2px borders.
    `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;` +
    `font-family:Calibri,Arial,sans-serif;color:#101828;">` +
    `<tr><th style="${TH}">Opportunity</th><th style="${TH}">Score</th>` +
    `<th style="${TH}">Status</th><th style="${TH}">${cell(reasonHeader)}</th></tr>` +
    body +
    `</table>`
  );
}

function buildHtml(d: ExportData): string {
  return (
    `<div style="font-family:Calibri,Arial,sans-serif;color:#101828;font-size:14px;">` +
    `<p style="margin:0 0 12px;">Public sector pipeline overview, ${cell(d.generatedOn)}.</p>` +
    `<p style="margin:0 0 12px;">` +
    `${d.scanned} tenders scanned · ${d.qualified} qualified · ` +
    `${d.onBoard} taken into the pipeline · ${d.active} active right now.</p>` +
    table("Currently being pursued", d.pipeline, "Notes / observation") +
    table("Left the pipeline", d.exits, "Reason") +
    `</div>`
  );
}

// Plain-text fallback for clients that refuse HTML paste.
function buildText(d: ExportData): string {
  const lines = [
    `Public sector pipeline overview, ${d.generatedOn}.`,
    "",
    `${d.scanned} tenders scanned · ${d.qualified} qualified · ${d.onBoard} taken into the pipeline · ${d.active} active right now.`,
  ];
  const section = (caption: string, rows: ExportRow[]) => {
    if (rows.length === 0) return;
    lines.push("", caption.toUpperCase());
    for (const r of rows) {
      const score = r.score ? ` (${r.score})` : "";
      lines.push(`- ${r.tender} | ${r.label}${score} | ${r.stage}${r.note ? ` | ${r.note}` : ""}`);
    }
  };
  section("Currently being pursued", d.pipeline);
  section("Left the pipeline", d.exits);
  return lines.join("\n");
}

export function EmailExportButton({ data }: { data: ExportData }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const html = buildHtml(data);
    const text = buildText(data);
    try {
      // Writing both flavours lets Outlook take the HTML while a plain-text
      // editor still gets something readable.
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      setState("copied");
    } catch {
      // Firefox has no ClipboardItem for html, and any browser refuses the
      // async API without a secure context. Plain text is better than nothing.
      try {
        await navigator.clipboard.writeText(text);
        setState("copied");
      } catch {
        setState("failed");
      }
    }
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button onClick={copy} className={`${btnPrimary} print:hidden`}>
      {state === "copied"
        ? "Copied — paste into Outlook"
        : state === "failed"
          ? "Copy failed"
          : "Copy for email"}
    </button>
  );
}
