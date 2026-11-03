---
name: nmblr:remediation-plan
description: |
  Turn a completed completion/quality audit into a remediation plan & estimate — scope the gaps into
  workstreams, size effort, model the schedule across staffing options, and produce a layered plan
  (with a gantt) and PDF. Read-only on the audited source; references the frozen audit, does not modify it.
  Use after an audit, when the team asks "what will it take to reach 100%?".
user-invocable: true
argument-hint: "[--audit <path>] [--engineers N] [--hours-per-day H] [--no-pdf]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:remediation-plan</name>
<summary>Audit -> remediation plan & estimate (gaps -> workstreams -> effort -> schedule -> layered plan + PDF).</summary>
<agents>remediation-scoper, effort-estimator, schedule-modeler, remediation-plan-writer, deliverable-pdf-renderer</agents>
</skill_info>

<usage>
<syntax>nmblr:remediation-plan --audit analysis/audit-report.md</syntax>
<syntax>nmblr:remediation-plan --engineers 2 --hours-per-day 8</syntax>
</usage>

<execution_instructions>
Prerequisite: a completed audit (e.g. via nmblr:audit) — the capability scorecard + findings.

Output location (versioned, immutable). Each remediation is a frozen, point-in-time run; re-scoping produces a NEW run, never an edit of a prior one.
- Compute the next run id:
  `bash .claude/nmblr/scripts/docs/next-run-id.sh --prefix REMED --dir <root>/project/remediation`
  where `<root>` is `documents.root` from config.yaml (default `docs`). Parse the `run` field (e.g. `REMED-0001`).
- Write all deliverables (scope, estimate, schedule, layered plans + PDFs) into `<root>/project/remediation/<run>/`.
- Pin the source audit run (the `AUDIT-NNNN` whose `--audit` path you consumed) in every cross-reference, so each figure traces to the exact frozen audit. Remediation and audit run numbers are independent.
- Create or refresh the run index `<root>/project/remediation/README.md`: one row per `REMED-NNNN` run; the highest number is the current run.

1. remediation-scoper turns the audit gaps into workstreams (gap-only; Done excluded) + sellable/100% milestone definitions + decisions/external dependencies.
2. effort-estimator sizes each workstream in hours (fixed-effort, AI-augmented; developer self-QA in, formal QA out) and totals sellable and 100%.
3. schedule-modeler converts effort to working-day tables across intensity x team size, finds the critical-path floor, and emits the gantt spec.
4. remediation-plan-writer assembles the layered plan (inverted pyramid, formal register; sellable vs 100% defined; dev-complete + QA-scope notes), then renders the PDF via deliverable-pdf-renderer unless --no-pdf.
Principles: hours are fixed work content (AI raises capability, not speed); cost only the gaps; selling points are never optional; report working days, not calendar.
</execution_instructions>
