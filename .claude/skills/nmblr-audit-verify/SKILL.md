---
name: nmblr:audit-verify
description: |
  Tier-2 of the audit: verify each capability against the cloned source code (built/partial/
  missing, wired vs stub/deprecated), then adversarially re-check the contested findings, and
  assign each capability a final Status. Naturally a fan-out workflow.
user-invocable: true
argument-hint: "[--focus <tier>] [--adversarial all|contested]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit-verify</name>
<summary>Verify capabilities against code and adversarially confirm; fill T2 + final Status.</summary>
<agents>build-verifier, adversarial-verifier</agents>
</skill_info>

<usage>
<syntax>nmblr:audit-verify</syntax>
<syntax>nmblr:audit-verify --adversarial contested</syntax>
</usage>

<execution_instructions>
Write into the current audit run folder: `<root>/project/audit/AUDIT-NNNN/` (highest `NNNN`; `<root>` = `documents.root` from config.yaml, default `docs`), established by nmblr:audit-init.

Fan out per capability (a pipeline): stage 1 build-verifier confirms presence + wiring with
file-level evidence; stage 2 adversarial-verifier attempts to refute every confirmed/contested
or surprising result (e.g. "built" where the self-report said "no"). Assign the final Status
from the adversarial verdict. Fill the catalog's T2 + Status columns. Items needing an un-cloned
repo are Unverifiable, not Missing.
</execution_instructions>
