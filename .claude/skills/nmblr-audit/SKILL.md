---
name: nmblr:audit
description: |
  Run a full platform completion & quality audit end-to-end: catalog the promised capabilities,
  trace them to specs, verify them against code, review spec quality and code health, and
  synthesize a layered audit report. Read-only — findings and recommendations only.
  Use when asked to audit how complete/correct a platform is versus what it promises.
user-invocable: true
argument-hint: "[--source <tier0-paths>] [--repos <list|config>] [--no-pdf]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---

<skill_info>
<name>nmblr:audit</name>
<summary>End-to-end platform completion & quality audit (claim -> spec -> code), with a layered report.</summary>
<agents>capability-extractor, repo-acquirer, spec-mapper, build-verifier, adversarial-verifier, spec-quality-reviewer (consistency-checker + flow-simulator), code-health-runner, defect-hunter, security-scanner, audit-synthesizer, deliverable-pdf-renderer</agents>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:audit --source docs/sales/feature-guide.pdf,docs/sales/pricing.pdf</syntax>
<syntax>nmblr:audit --repos config   # use ecosystem.repositories from config.yaml</syntax>
</usage>

<execution_instructions>
All phases write into a single versioned, immutable run folder established by nmblr:audit-init: `<root>/project/audit/AUDIT-NNNN/` (`<root>` = `documents.root` from config.yaml, default `docs`; `NNNN` zero-padded, mirroring `PRD-0001`). The highest-numbered `AUDIT-NNNN` is the current run; a re-audit is a new run folder — frozen runs are never overwritten.

Run the phases in order, each its own sub-skill; stop and report if a phase yields nothing to act on.
1. nmblr:audit-init — acquire repos (repo-acquirer), pin SHAs, scaffold the catalog.
2. nmblr:audit-catalog — capability-extractor builds the Capability Catalog from Tier-0.
3. nmblr:audit-trace — spec-mapper fills T1 (spec alignment) + drift report.
4. nmblr:audit-verify — build-verifier + adversarial-verifier fill T2 + final Status (fan out per capability).
5. nmblr:audit-quality — spec-quality-reviewer (consistency-checker + flow-simulator) + code-health-runner + defect-hunter + security-scanner.
6. nmblr:audit-report — audit-synthesizer assembles report + depth docs, runs consistency-checker over the outputs, then deliverable-pdf-renderer (unless --no-pdf).
Principles: treat self-reports as hypotheses to verify; adversarially confirm load-bearing findings firsthand; pin commit SHAs; state limitations honestly.
</execution_instructions>
