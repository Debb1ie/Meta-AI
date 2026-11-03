---
name: nmblr:audit-report
description: |
  Synthesize all audit findings into the layered deliverables — an executive summary (progress,
  readiness, risk rollup) plus detailed findings and depth docs — verify the outputs are
  self-consistent, and render status-indicative PDFs.
user-invocable: true
argument-hint: "[--no-pdf]"
allowed-tools:
  - Read
  - Glob
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit-report</name>
<summary>Assemble the layered audit report + depth docs, self-check, and render PDFs.</summary>
<agents>audit-synthesizer, consistency-checker, deliverable-pdf-renderer</agents>
</skill_info>

<usage>
<syntax>nmblr:audit-report</syntax>
<syntax>nmblr:audit-report --no-pdf</syntax>
</usage>

<execution_instructions>
Write all deliverables into the current audit run folder: `<root>/project/audit/AUDIT-NNNN/` (highest `NNNN`; `<root>` = `documents.root` from config.yaml, default `docs`), established by nmblr:audit-init.

1. audit-synthesizer rolls findings into the completion scorecard, weighted %, and risk-exposure
   rollup, and writes the Audit-Report (exec + detailed) plus the depth docs, cross-linked, with a
   commit-SHA reproducibility appendix.
2. Run consistency-checker over the produced files; reconcile any contradiction before publishing.
3. Unless --no-pdf, deliverable-pdf-renderer produces color-coded, status-indicative PDFs.
</execution_instructions>
