---
name: nmblr:audit-catalog
description: |
  Build the Capability Catalog (Tier-0 spine) from the product's source of truth — the master
  list of promised capabilities the rest of the audit traces to spec and code.
user-invocable: true
argument-hint: "[--source <paths>]"
allowed-tools:
  - Read
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit-catalog</name>
<summary>Extract the tier-grouped Capability Catalog from Tier-0 sources.</summary>
<agent>capability-extractor</agent>
</skill_info>

<usage>
<syntax>nmblr:audit-catalog --source feature-guide.pdf,pricing.pdf</syntax>
</usage>

<execution_instructions>
Write into the current audit run folder: `<root>/project/audit/AUDIT-NNNN/` (highest `NNNN`; `<root>` = `documents.root` from config.yaml, default `docs`), established by nmblr:audit-init.

Invoke capability-extractor over the Tier-0 sources to produce the Capability Catalog
(Capability-Catalog template): one checkable capability per row, grouped by tier, with a Quickview
rollup. Any vendor self-assessment is recorded as a separate column to be verified, not trusted.
</execution_instructions>
