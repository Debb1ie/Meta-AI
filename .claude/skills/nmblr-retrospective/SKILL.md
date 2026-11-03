---
name: nmblr:retrospective
description: |
  Run a session retrospective to capture learnings, pain points, and improvement ideas.
  Supports interactive (full), quick (abbreviated), and list (browse) modes.
user-invocable: true
argument-hint: "[--quick] [--list] [--since DATE]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<skill_info>
<name>nmblr:retrospective</name>
<summary>Capture session learnings in a structured retrospective with actionable follow-ups.</summary>
<agent>retro-writer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:retrospective</syntax>
<syntax>nmblr:retrospective --quick</syntax>
<syntax>nmblr:retrospective --list</syntax>
<syntax>nmblr:retrospective --list --since 2026-03-01</syntax>
</usage>

<options>
<option name="--quick">Abbreviated retro — pain points, improvements, and action items only (5 sections instead of 7)</option>
<option name="--list">Browse past retrospectives in a summary table</option>
<option name="--since" value_type="DATE">Filter past retros by date when used with --list (YYYY-MM-DD format)</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get `documents.retros` path (default: `docs/project/retros`)
   - Get `agent_kit_repo` (default: `talino-labs/nmblr.agent-kit`)

2. **Determine mode**
   - No flags → interactive (default)
   - `--quick` → quick mode
   - `--list` → list mode (optionally with `--since`)

3. **Delegate to retro-writer agent**
   - Spawn `retro-writer` agent with the determined mode
   - Pass configuration context (retros directory, agent-kit repo)

4. **The retro-writer will**:
   - **Interactive mode:** Gather context from session + git + docs, ask structured questions for all 7 sections, rate improvements, classify action items, write retro document, execute approved action items (PDs/TDs/Issues)
   - **Quick mode:** Gather context automatically, ask only about pain points and improvements, auto-rate/classify, write abbreviated doc (5 sections), execute approved action items
   - **List mode:** Scan retros directory, read frontmatter, display summary table

</execution_instructions>

<config_usage>
The retro skill reads config.yaml for:

```yaml
documents:
  retros: docs/project/retros    # Where retro documents are stored

agent_kit_repo: talino-labs/nmblr.agent-kit  # For creating agent-kit feedback Issues
```
</config_usage>

<examples>
<example>
<command>/nmblr:retrospective</command>
<description>Full interactive retrospective for the current session</description>
</example>
<example>
<command>/nmblr:retrospective --quick</command>
<description>Quick retro — just pain points, improvements, and action items</description>
</example>
<example>
<command>/nmblr:retrospective --list</command>
<description>Browse all past retrospectives</description>
</example>
<example>
<command>/nmblr:retrospective --list --since 2026-03-01</command>
<description>Show retros since March 1st</description>
</example>
</examples>

<output_modes>
<mode name="Interactive">
<description>Full guided retrospective with all 7 sections, priority matrix, and action item routing</description>
<sections>Session Summary, What Went Well, What Didn't Work, Agent Reliability, Improvement Suggestions, Priority Matrix, Action Items</sections>
<input>Session context + git log + recent docs + user Q&A (5-7 questions)</input>
<output>Full retro document + created PDs/TDs/Issues</output>
</mode>

<mode name="Quick">
<description>Abbreviated retrospective focused on pain points and improvements</description>
<sections>Session Summary, What Didn't Work, Improvement Suggestions, Priority Matrix, Action Items</sections>
<input>Session context + git log + recent docs + 2 user questions</input>
<output>Abbreviated retro document + created PDs/TDs/Issues</output>
</mode>

<mode name="List">
<description>Summary table of past retrospectives</description>
<input>None (reads filesystem)</input>
<output>Table with Date, Project, Mode, Action Items Created</output>
</mode>
</output_modes>
