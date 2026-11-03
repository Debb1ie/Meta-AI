---
name: nmblr:audit-quality
description: |
  Assess quality, not just presence: spec quality (functional sense, contradictions, usability
  gaps), code health (type-check/lint gates + blind spots), breaking-class defects in high-risk
  flows, and security (secrets, CORS, token storage, dependency CVEs).
user-invocable: true
argument-hint: "[--focus spec|code|security|all]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit-quality</name>
<summary>Spec quality + code health + defects + security for the audit.</summary>
<agents>consistency-checker, flow-simulator, code-health-runner, defect-hunter, security-scanner</agents>
</skill_info>

<usage>
<syntax>nmblr:audit-quality</syntax>
<syntax>nmblr:audit-quality --focus security</syntax>
</usage>

<execution_instructions>
Write into the current audit run folder: `<root>/project/audit/AUDIT-NNNN/` (highest `NNNN`; `<root>` = `documents.root` from config.yaml, default `docs`), established by nmblr:audit-init. The depth docs go in its `quality/` sub-folder.

1. Spec quality: consistency-checker (contradictions) + flow-simulator (usability gaps / dead-ends) + a functional-soundness read → severity-rated findings with impact + fix.
2. Code health: code-health-runner runs type-check/lint per repo and flags error-swallowing builds.
3. Defects: defect-hunter statically reviews payments/webhooks/auth and verifies documented TDs.
4. Security: security-scanner for secrets, CORS, token storage, and dependency CVEs.
Collate into the Quality-Findings deliverable.
</execution_instructions>
