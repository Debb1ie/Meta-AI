---
name: nmblr:execute
description: |
  Execute RFC implementation with state tracking, or resume a paused execution.
  Use when user wants to implement an RFC, resume paused work, or complete an implementation.
user-invocable: true
argument-hint: "<RFC-ID> [--direct] [--phase N]"
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
<name>nmblr:execute</name>
<summary>Execute RFC implementation with state tracking, or resume a paused execution.</summary>
<agent>rfc-executor</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:execute &lt;rfc-id&gt;</syntax>
<syntax>nmblr:execute &lt;rfc-id&gt; --task &lt;task-number&gt;</syntax>
<syntax>nmblr:execute &lt;rfc-id&gt; --phase &lt;phase-number&gt;</syntax>
</usage>

<arguments>
<argument name="rfc-id" required="true">
<description>RFC ID to execute (e.g., RFC-0015)</description>
</argument>
</arguments>

<options>
<option name="--task" value_type="number">Start from specific task number</option>
<option name="--phase" value_type="number">Start from specific phase</option>
<option name="--dry-run">Show what would be done without making changes</option>
<option name="--continue">Continue from last saved state (default behavior)</option>
<option name="--direct">Execute tasks sequentially in current context (bypass subagent orchestration)</option>
</options>

<prerequisites>
<item>RFC must be planned (context file exists at .claude/nmblr/execution/RFC-{NNNN}-context.md)</item>
<item>Run `/nmblr:plan &lt;rfc-id&gt;` first if not planned</item>
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Determine project language and guide paths
   - Get GitHub settings for PR creation

2. **Delegate to rfc-executor agent**
   - Spawn `rfc-executor` agent with the RFC ID and options
   - Pass configuration context to the agent

3. **The rfc-executor will**:
   - Load context file from execution directory
   - Create or resume state file
   - Create git branch if new execution
   - Execute one phase using orchestrated or direct mode
   - Use language-specific guides from config
   - Print phase summary with file list and stop
   - No commits during execution -- developer commits via `/nmblr:pause` or `/nmblr:finalize`
</execution_instructions>

<config_usage>
The executor reads config.yaml to determine:

```yaml
project:
  language: go              # Which language guides to use

guides:
  languages:
    go: guides/go           # Path to Go implementation guides

github:
  owner: talino-labs        # For PR creation
  repo: tds.gahi-platform
  default_branch: main

commands:
  test: "make test"         # How to run tests
  lint: "make lint"         # How to run linter
```
</config_usage>

<examples>
<example>
<command>/nmblr:execute RFC-0015</command>
<description>Execute next phase (creates branch if new, resumes if paused, runs next phase)</description>
</example>
<example>
<command>/nmblr:execute RFC-0015 --phase 2</command>
<description>Start from specific phase</description>
</example>
<example>
<command>/nmblr:execute RFC-0015 --direct</command>
<description>Execute sequentially without spawning subagents</description>
</example>
</examples>

<execution_modes>
<mode name="Phase Stop (Default)">
<description>Executes one phase, prints summary with file list, then stops. Developer reviews changes and runs execute again for next phase.</description>
<checkpoints>
- After each phase: Summary with files created/modified and next commands
- After final phase: Summary with verify/finalize/pause next commands
</checkpoints>
</mode>

<mode name="Orchestrated">
<description>Spawns phase-executor subagents for parallel task execution</description>
<trigger>Context file has wave annotations</trigger>
</mode>

<mode name="Direct">
<description>Implements tasks sequentially in current context</description>
<trigger>--direct flag or no wave annotations in context</trigger>
</mode>
</execution_modes>

<state_tracking>
<location>.claude/nmblr/execution/RFC-{NNNN}-state.md</location>
<tracked_items>
- Current phase and task
- Completed tasks
- Files modified
- Blockers encountered
</tracked_items>
</state_tracking>

<quality_checks>
<check>Tests run after significant changes</check>
<check>Code follows project patterns (from language guides)</check>
</quality_checks>
