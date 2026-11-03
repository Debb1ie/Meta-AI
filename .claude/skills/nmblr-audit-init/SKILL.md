---
name: nmblr:audit-init
description: |
  Initialize a platform audit: define the Tier-0 source of truth and repo scope, clone & pin the
  in-scope repositories, and scaffold the capability catalog. First step of nmblr:audit.
user-invocable: true
argument-hint: "[--source <paths>] [--repos <list|config>]"
allowed-tools:
  - Read
  - Glob
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit-init</name>
<summary>Set up an audit: source-of-truth + repo scope, clone & pin SHAs, scaffold the catalog.</summary>
<agent>repo-acquirer</agent>
</skill_info>

<usage>
<syntax>nmblr:audit-init --source feature-guide.pdf,pricing.pdf --repos config</syntax>
</usage>

<execution_instructions>
1. Confirm the Tier-0 sources (commercial/product material) and the repo scope (explicit list or config.yaml ecosystem).
2. Establish the audit run folder (versioned, immutable). Each audit is a frozen, point-in-time run; a re-audit is a NEW run, never an edit of a prior one.
   - Compute the next run id:
     `bash .claude/nmblr/scripts/docs/next-run-id.sh --prefix AUDIT --dir <root>/project/audit`
     where `<root>` is `documents.root` from config.yaml (default `docs`). Parse the `run` field (e.g. `AUDIT-0001`).
   - Create `<root>/project/audit/<run>/` — every deliverable for this run (catalog, trace, verify/, quality/, report) lives here.
   - Create or refresh the run index `<root>/project/audit/README.md`: one row per `AUDIT-NNNN` run; the highest number is the current run.
3. Invoke repo-acquirer to shallow-clone the in-scope repos into the run's workspace and produce the pinned-commit table + blockers list.
4. Scaffold an empty Capability-Catalog from the template into the run folder, ready for nmblr:audit-catalog.
Output: the run folder path, the workspace layout, the pinned-commit table, and any acquisition blockers.
</execution_instructions>
