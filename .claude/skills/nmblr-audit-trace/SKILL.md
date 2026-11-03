---
name: nmblr:audit-trace
description: |
  Tier-1 of the audit: map each catalogued capability to its specification (PRD/RFC/PD) and
  classify alignment (Specced/Partial/Drift/Undoc), flagging contradictions and version skew.
user-invocable: true
argument-hint: "[--focus <tier>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit-trace</name>
<summary>Map capabilities to specs and classify alignment; fill the catalog's T1 column.</summary>
<agents>spec-mapper, consistency-checker</agents>
</skill_info>

<usage>
<syntax>nmblr:audit-trace</syntax>
<syntax>nmblr:audit-trace --focus payments</syntax>
</usage>

<execution_instructions>
Write into the current audit run folder: `<root>/project/audit/AUDIT-NNNN/` (highest `NNNN`; `<root>` = `documents.root` from config.yaml, default `docs`), established by nmblr:audit-init.

1. For each capability, run spec-mapper to locate the governing PRD/RFC/PD and classify alignment.
2. Use consistency-checker to surface cross-document contradictions and stale "Implemented" specs.
3. Fill the catalog's T1 column and emit a Drift & gaps summary (the Drift/Undoc IDs).
</execution_instructions>
