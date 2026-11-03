---
name: nmblr:finalize
description: |
  Finalize RFC implementation and create PR.
  Use when user wants to complete an RFC, run quality checks, and create a pull request.
user-invocable: true
argument-hint: "<RFC-ID> [--skip-tests] [--no-pr] [--message MSG]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:finalize</name>
<summary>Complete RFC implementation, verify quality, commit all changes, and create a ready pull request.</summary>
<agent>rfc-executor</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:finalize &lt;rfc-id&gt;</syntax>
<syntax>nmblr:finalize &lt;rfc-id&gt; --skip-tests</syntax>
<syntax>nmblr:finalize &lt;rfc-id&gt; --no-pr</syntax>
</usage>

<arguments>
<argument name="rfc-id" required="true">
<description>RFC ID to finalize (e.g., RFC-0015)</description>
</argument>
</arguments>

<options>
<option name="--skip-tests">Skip running full test suite (not recommended)</option>
<option name="--no-pr">Don't create PR, just verify and commit</option>
<option name="--message" value_type="msg">Custom commit message</option>
</options>

<prerequisites>
<item>All tasks in RFC context must be complete</item>
<item>RFC must be in "In Progress" state</item>
<item>Branch must exist</item>
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get GitHub settings for PR creation

2. **Delegate to rfc-executor agent**
   - Spawn `rfc-executor` agent with RFC ID and finalize mode
   - Pass configuration context

3. **The rfc-executor will**:
   - Run pre-finalization checklist (completeness, code quality, testing, docs)
   - Execute quality checks: run lint, test, and build commands if configured in config.yaml; warn if no commands configured
   - Verify all features implemented and acceptance criteria met
   - **Update the changelog if the project has opted in** (a `CHANGELOG.md` with an `[Unreleased]` section exists) — non-interactively append/update a best-effort entry keyed by the RFC; skip silently otherwise
   - Commit all changes (staged and unstaged)
   - Push to remote
   - Check for an existing draft PR on the branch:
     - If a draft PR exists: convert it to ready for review
     - If no draft PR exists: create a new ready PR with comprehensive description
   - Update state file to "Completed"
</execution_instructions>

<examples>
<example>
<command>/nmblr:finalize RFC-0015</command>
<description>Finalize, commit, and create ready PR (or convert draft PR to ready)</description>
</example>
<example>
<command>/nmblr:finalize RFC-0015 --no-pr</command>
<description>Finalize and commit without creating PR</description>
</example>
<example>
<command>/nmblr:finalize RFC-0015 --skip-tests</command>
<description>Finalize without running test suite (not recommended)</description>
</example>
</examples>

<finalization_process>
<step number="1" name="Pre-Finalization Checks">
<action>Verify all tasks marked complete</action>
<action>Check code quality (no linting errors, build passes)</action>
<action>Verify test coverage</action>
<action>Confirm documentation updated</action>
</step>

<step number="2" name="Quality Checks">
<action>Run lint command from config.yaml (commands.lint) if configured</action>
<action>Run test command from config.yaml (commands.test) if configured</action>
<action>Run build command from config.yaml (commands.build) if configured</action>
<action>Warn if no quality commands are configured in config.yaml</action>
</step>

<step number="2.5" name="Changelog Entry (opt-in, non-interactive)">
<description>
If (and only if) the project has opted in to changelog maintenance, append a
best-effort entry to `[Unreleased]`. Opt-in is a parse check — NOT a config read.
</description>
<action>Resolve the changelog path (default `CHANGELOG.md`), tolerating a missing config:
`bash .claude/nmblr/scripts/util/read-config.sh changelog.path 2>/dev/null | jq -r '.value' 2>/dev/null` — default to `CHANGELOG.md` if empty/`null`.</action>
<action>Gate on the presence of an `[Unreleased]` section (parse, do NOT read config for the gate):
```bash
bash .claude/nmblr/scripts/docs/changelog-parse.sh --path {CHANGELOG_PATH} 2>/dev/null | jq -r '.has_unreleased'
```
If this is not `true` (no file, or no `[Unreleased]`), **do nothing** — finalize behavior is byte-identical to today. Skip the rest of this step.</action>
<action>Draft a best-effort category and a one-line, user-facing message:
- Category: map the RFC's source-doc type (from `related_prds`/`related_pds`/`related_tds`/`related_adrs`) via `changelog.source_doc_category` (default `{PRD: Added, PD: Fixed, TD: Changed, ADR: Changed}`); if none applies, use `changelog.default_category` (default `Changed`). Read config keys with `... 2>/dev/null` and fall back to the defaults.
- Message: a crisp summary of what shipped (not a commit log line).</action>
<action>Append/update the entry non-interactively (idempotent by the RFC marker — safe to re-run):
```bash
bash .claude/nmblr/scripts/docs/changelog-add-entry.sh \
  --path {CHANGELOG_PATH} --category {CAT} --message "{MSG}" --ref RFC-{NNNN}
```
No prompt. The human curates wording/category in the PR diff before release.</action>
<action>If `changelog-add-entry.sh` exits non-zero, log a warning to stderr and continue — a changelog hiccup must never block finalization.</action>
</step>

<step number="3" name="Commit and Create Pull Request">
<action>Ensure the changelog edit (if any) is staged so it lands in the final commit</action>
<action>Stage and commit all changes</action>
<action>Push to remote</action>
<action>Check for existing draft PR on branch</action>
<action>If draft PR exists: mark as ready for review (convert draft to ready)</action>
<action>If no draft PR: create new ready PR with summary, changes, testing details, and related docs</action>
</step>
</finalization_process>

<state_file_update>
<field>Status: "Completed"</field>
<field>Completion date</field>
<field>PR link</field>
<field>Final commit hash</field>
</state_file_update>

<verification_failures>
If verification fails:
- Report specific failures
- Do not create PR
- Keep state as "In Progress"
- Provide guidance on fixes
</verification_failures>
