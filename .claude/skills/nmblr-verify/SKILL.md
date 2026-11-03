---
name: nmblr:verify
description: |
  Verify RFC implementation against acceptance criteria.
  Use when user wants to verify an RFC implementation is complete and correct before finalization.
user-invocable: true
argument-hint: "<RFC-ID> [--fix] [--acceptance-only] [--tests-only]"
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
<name>nmblr:verify</name>
<summary>Verify an RFC implementation against acceptance criteria and run tests.</summary>
<agent>rfc-verifier</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:verify &lt;rfc-id&gt;</syntax>
<syntax>nmblr:verify &lt;rfc-id&gt; --fix</syntax>
<syntax>nmblr:verify &lt;rfc-id&gt; --acceptance-only</syntax>
<syntax>nmblr:verify &lt;rfc-id&gt; --tests-only</syntax>
</usage>

<arguments>
<argument name="rfc-id" required="true">
<description>RFC ID to verify (e.g., RFC-0015)</description>
</argument>
</arguments>

<options>
<option name="--fix">Auto-spawn debug agents to fix failures (up to one attempt per failure)</option>
<option name="--acceptance-only">Only check acceptance criteria (skip full test suite)</option>
<option name="--tests-only">Only run test suite (skip acceptance criteria walk-through)</option>
</options>

<prerequisites>
<item>RFC must be implemented (state file shows "Completed" or RFC status is "Implemented")</item>
<item>Feature branch should be checked out</item>
<item>RFC document should have an "Acceptance Criteria" section</item>
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get test and lint commands

2. **Delegate to rfc-verifier agent**
   - Spawn `rfc-verifier` agent with RFC ID and options
   - Pass configuration context

3. **The rfc-verifier will**:
   - Load RFC document and state file
   - Extract acceptance criteria from RFC
   - For each criterion, verify implementation (read source, run targeted tests)
   - Run full test suite (unless --acceptance-only)
   - Generate verification report
   - If --fix: spawn debug-agent for each failure, re-verify
   - Generate final report with pass/fail/fixed/escalated results
</execution_instructions>

<examples>
<example>
<command>/nmblr:verify RFC-0015</command>
<description>Full verification: acceptance criteria + tests + lint + build</description>
</example>
<example>
<command>/nmblr:verify RFC-0015 --fix</command>
<description>Verify and auto-fix any failures found</description>
</example>
<example>
<command>/nmblr:verify RFC-0015 --acceptance-only</command>
<description>Quick check of acceptance criteria without running full test suite</description>
</example>
<example>
<command>/nmblr:verify RFC-0015 --tests-only</command>
<description>Run only the test suite to check for regressions</description>
</example>
</examples>

<verification_scope>
<check name="Acceptance Criteria">
Each criterion in the RFC's Acceptance Criteria section is verified by:
- Reading relevant source files
- Running targeted tests
- Checking API behavior matches specification
</check>

<check name="Test Suite">
Full test suite execution using commands from config.yaml:
- Tests: Run test command (`commands.test`)
- Lint: Run lint command (`commands.lint`)
- Build: Run build command (`commands.build`)
</check>

<check name="Documentation">
If applicable:
- OpenAPI spec updated
- CLAUDE.md conventions followed
- README updated
</check>
</verification_scope>

<auto_fix_behavior>
When --fix is used:

1. For each failure, a debug-agent is spawned with:
   - Failure description
   - File and line number
   - Failing test name
   - Pattern reference (similar working code)

2. Debug-agent attempts a surgical fix:
   - Maximum 3 files read (target + pattern + test)
   - No architectural changes
   - Single-file modification only

3. After fix attempt:
   - Re-run the specific failing test
   - If PASS: Mark as "Fixed"
   - If FAIL: Mark as "Escalated"

**Note:** Auto-fix is best-effort. Complex issues are escalated for human review.
</auto_fix_behavior>

<when_to_use>
<use_case>After completing RFC implementation, before creating PR</use_case>
<use_case>During PR review, to verify all criteria are met</use_case>
<use_case>After amendments, to ensure fixes didn't break other criteria</use_case>
<use_case>Before finalization, as final quality gate</use_case>
</when_to_use>

<integration_with_workflow>
Typical workflow:
1. `/nmblr:execute RFC-0015` - Implement the RFC
2. `/nmblr:verify RFC-0015` - Verify implementation
3. If failures: `/nmblr:verify RFC-0015 --fix` or manual fixes
4. `/nmblr:finalize RFC-0015` - Create PR
</integration_with_workflow>
