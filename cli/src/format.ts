import type { Report } from "./run.ts";

const MARK = { error: "✗", warn: "!" } as const;

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function counts(report: Report): { errors: number; warnings: number } {
  return {
    errors: report.findings.filter((f) => f.level === "error").length,
    warnings: report.findings.filter((f) => f.level === "warn").length,
  };
}

/** Compact, rtk-style text: one header per product, one line per finding, one total line. */
export function formatReports(reports: Report[], options: { quiet?: boolean } = {}): string {
  const lines: string[] = [];
  let errors = 0;
  let warnings = 0;
  for (const report of reports) {
    const count = counts(report);
    errors += count.errors;
    warnings += count.warnings;
    const clean = report.findings.length === 0;
    if (clean && options.quiet && report.overrides.length === 0) continue;
    const summary = clean ? "ok" : `${plural(count.errors, "error")}, ${plural(count.warnings, "warning")}`;
    lines.push(`${report.name}  ${summary}`);
    for (const finding of report.findings) {
      const message = finding.message.replace(/\n/g, "\n      ");
      lines.push(`  ${MARK[finding.level]} ${finding.check}  ${finding.file ?? ""}  ${message}`.replace(/  +$/, ""));
    }
    for (const override of report.overrides) lines.push(`  override ${override.check}: ${override.reason}`);
  }
  lines.push(`${plural(reports.length, "product")} · ${plural(errors, "error")} · ${plural(warnings, "warning")}`);
  return lines.join("\n");
}

export function exitCode(reports: Report[]): number {
  return reports.some((report) => report.findings.some((f) => f.level === "error")) ? 1 : 0;
}
