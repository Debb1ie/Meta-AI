---
name: nmblr:create-ts
description: |
  Generate, maintain, and validate test automation scripts from Test Cases (TCs).
  Framework-agnostic — supports Robot Framework + Appium, Playwright, Jest/Vitest,
  Go test, and pytest. Based on the test-script-writer agent.
  Operates in four modes:
  - **Generate** (default): 3-phase workflow for new features
  - **Selector Check**: Detects selector drift between codebase and scripts
  - **Update**: Incrementally updates scripts when TCs change
  - **Check & Update**: Sequential selector check then update
user-invocable: true
argument-hint: "<TC-ID|feature> [--mode generate|selector-check|update|check-and-update] [--framework <name>] [--rfc RFC-ID]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
  - Agent
---

<skill_info>
<name>nmblr:create-ts</name>
<summary>Generate, maintain, and validate test automation scripts from Test Cases (TCs). Framework-agnostic with support for Robot Framework + Appium, Playwright, Jest/Vitest, Go test, and pytest. Manages the full script lifecycle: generation, selector validation, and incremental updates.</summary>
<agent>test-script-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:create-ts &lt;TC-ID&gt;</syntax>
<syntax>nmblr:create-ts &lt;TC-ID&gt; --mode generate</syntax>
<syntax>nmblr:create-ts &lt;TC-ID&gt; --mode selector-check</syntax>
<syntax>nmblr:create-ts &lt;TC-ID&gt; --mode update</syntax>
<syntax>nmblr:create-ts &lt;TC-ID&gt; --mode check-and-update</syntax>
<syntax>nmblr:create-ts &lt;feature&gt; --framework playwright --rfc &lt;RFC-ID&gt;</syntax>
<syntax>nmblr:create-ts &lt;TC-ID&gt; --mode generate --framework robot-appium</syntax>
</usage>

<arguments>
<argument name="TC-ID or feature" required="true">
<description>
TC document ID (e.g., TC-0004) or a feature name/description.
When a feature name is provided without a TC-ID, the agent searches for matching TC documents.
</description>
</argument>
</arguments>

<options>
<option name="--mode">
Execution mode. Default: generate.
Options:
  - generate          — Full 3-phase generation workflow for new scripts (with approval gate between phases)
  - selector-check    — Scan existing scripts for selector drift against the current codebase
  - update            — Incrementally update scripts when TCs or implementation change (with approval gate)
  - check-and-update  — Run selector-check, then update in sequence
</option>
<option name="--framework">
Override the test framework. Defaults to the value in config.yaml.
Options: robot-appium, playwright, jest, vitest, go-test, pytest.
</option>
<option name="--rfc">RFC ID to cross-reference for implementation details during generation or update (e.g., --rfc RFC-0023).</option>
<option name="--prd">PRD ID to cross-reference for additional context (e.g., --prd PRD-0004).</option>
</options>

<mode_detection>
If --mode is not explicitly provided, mode is inferred from context:

| User phrasing / argument pattern               | Inferred mode      |
|------------------------------------------------|--------------------|
| TC-NNNN (no other flags)                       | generate           |
| "generate scripts for TC-NNNN"                 | generate           |
| "create test scripts"                          | generate           |
| "check selectors for TC-NNNN"                  | selector-check     |
| "selector check"                               | selector-check     |
| "validate selectors"                           | selector-check     |
| "update scripts for TC-NNNN"                   | update             |
| "TC changed, update scripts"                   | update             |
| "check and update TC-NNNN"                     | check-and-update   |
| "refresh scripts for TC-NNNN"                  | check-and-update   |
</mode_detection>

<tc_filtering_rules>
Not all test cases in a TC document are scripted. The agent applies these rules:

**Include for scripting:**
- Test cases marked Automation: Yes (or equivalent)
- Functional test cases with deterministic pass/fail outcomes
- E2E flows with UI interactions
- Integration test cases that include UI or API surface

**Exclude from scripting:**
- Test cases marked Manual-only or Automation: No
- API-only backend test cases without UI surface (unless framework is go-test or pytest)
- Performance and load test cases (require dedicated tooling)
- Exploratory testing notes

**Special handling:**
- UX/Visual test cases: generate visual assertion stubs with TODO markers
- Parameterized test cases: generate data-driven test structure with example data table
</tc_filtering_rules>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract TC-ID or feature name
   - Infer mode if --mode not provided (see mode_detection table)
   - Resolve --framework (from arg, else from config.yaml)
   - Resolve --rfc and --prd if provided

2. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get: default test framework, test script output paths, TC document directory

3. **Resolve file paths**
   - Locate TC file by TC-ID in configured docs directory
   - If RFC or PRD provided, locate those files
   - Determine output directory for scripts based on framework config
   - Abort with clear message if TC file cannot be found

4. **Execute by mode**

   **Generate mode** (2-step with approval gate):

   Phase 1 + 2 — Analysis and scaffold:
   - Delegate to test-script-writer agent for phases 1 and 2
   - Agent reads TC document and applies TC filtering rules
   - Agent reads codebase to extract current selectors, API contracts, and component structure
   - Agent generates Phase 1 report: test cases to be scripted, framework mapping, file structure plan
   - Agent generates Phase 2 scaffolds: script files with test structure, selector constants, and TODO markers
   - Present Phase 1+2 output to user for review

   Approval gate — Wait for user confirmation before Phase 3.

   Phase 3 — Full implementation:
   - After approval, delegate Phase 3 to test-script-writer agent
   - Agent fills in all test logic, assertions, and data fixtures
   - Agent removes TODO markers where implementation is complete
   - Report final output: files created, test counts by type, any remaining TODOs

   **Selector Check mode** (1-step):
   - Delegate to test-script-writer agent in selector-check mode
   - Agent scans existing script files for element selectors and API endpoint references
   - Agent cross-references each against current codebase
   - Agent produces drift report: broken selectors, changed API paths, renamed components
   - Present report; if drift found, offer to apply fixes automatically

   **Update mode** (1-step with approval gate):
   - Delegate to test-script-writer agent in update mode
   - Agent diffs current TC document against the version the scripts were generated from
   - Agent identifies: new test cases, changed acceptance criteria, removed test cases
   - Agent presents proposed script changes for user review (supports partial approval: user can approve specific changes only)
   - After approval, apply approved changes to script files
   - Report: scripts updated, new scripts added, scripts deprecated

   **Check & Update mode**:
   - Run selector-check phase first (as above)
   - Present selector drift report
   - Then run update phase (as above)
   - Present combined results

5. **Context preservation between re-invocations**
   - If the agent detects an existing `.claude/nmblr/execution/ts-{TC-ID}-state.md`, it resumes from that state
   - This allows approval gates to work correctly when the skill is re-invoked after user review
   - State file is cleaned up after successful completion

6. **Report results**
   - Output file paths (created or updated)
   - Test script counts by framework and type
   - Selector drift issues found (if selector-check ran)
   - Remaining TODOs or manual-only test cases not scripted
</execution_instructions>

<manifest_reference>
The agent reads manifest data from:
- `.claude/nmblr/manifest.json` — for framework configuration and output paths
- Key JSON paths:
  - `.test_frameworks.default` — default framework name
  - `.test_frameworks.{framework}.output_path` — script output directory
  - `.test_frameworks.{framework}.file_extension` — script file extension
</manifest_reference>

<key_standards>
- Scripts must be deterministic and idempotent (safe to re-run)
- Each script file corresponds to one TC document section or user story
- Selector constants are defined in a dedicated constants/selectors file, not inline
- Test IDs from the TC document are referenced in script comments for traceability
- Data fixtures are kept separate from test logic
- No hardcoded environment URLs or credentials — use environment variables or config
</key_standards>

<file_output_structure>
Per-framework default output locations (overridden by config.yaml):

| Framework     | Default output path                  | File extension |
|---------------|--------------------------------------|----------------|
| robot-appium  | tests/robot/                         | .robot         |
| playwright    | tests/e2e/                           | .spec.ts       |
| jest          | tests/unit/ or src/**/__tests__/     | .test.ts       |
| vitest        | tests/unit/ or src/**/__tests__/     | .test.ts       |
| go-test       | Next to source files (Go convention) | _test.go       |
| pytest        | tests/                               | test_*.py      |

Script files are named after the TC ID and feature area:
`{tc-id}-{feature-slug}.{ext}` (e.g., `tc-0004-checkout-flow.spec.ts`)
</file_output_structure>

<examples>
<example>
<command>/nmblr:create-ts TC-0004</command>
<description>Generate test scripts for TC-0004 using the default framework from config.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --framework playwright</command>
<description>Generate Playwright E2E scripts for TC-0004.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --mode generate --rfc RFC-0018</command>
<description>Generate scripts for TC-0004 cross-referenced against RFC-0018 for implementation details.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --mode selector-check</command>
<description>Check existing TC-0004 scripts for selector drift against the current codebase.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --mode update</command>
<description>Update TC-0004 scripts to reflect changes in the TC document.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --mode check-and-update</command>
<description>Run selector check then update scripts for TC-0004 in one pass.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0007 --framework robot-appium --rfc RFC-0021 --prd PRD-0007</command>
<description>Generate Robot Framework + Appium scripts for TC-0007 with full RFC and PRD context.</description>
</example>
<example>
<command>/nmblr:create-ts "checkout flow" --framework playwright</command>
<description>Search for a TC matching "checkout flow" and generate Playwright scripts for it.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --mode update --rfc RFC-0025</command>
<description>Update TC-0004 scripts incorporating implementation changes from RFC-0025.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0010 --framework go-test --prd PRD-0010</command>
<description>Generate Go test scripts for TC-0010 with PRD context for backend API coverage.</description>
</example>
<example>
<command>/nmblr:create-ts TC-0004 --mode selector-check --framework playwright</command>
<description>Check selector drift specifically in the Playwright scripts for TC-0004.</description>
</example>
</examples>
