---
name: nmblr:pause
description: |
  Pause RFC execution, commit all changes, and create/update a draft PR.
  Use when user wants to save work for later resumption across sessions.
user-invocable: true
argument-hint: "<RFC-ID> [--reason TEXT] [--blocker TEXT]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Bash
  - Task
---

<skill_info>
<name>nmblr:pause</name>
<summary>Pause RFC execution, commit all changes, push to remote, and create or update a draft PR.</summary>
<agent>rfc-executor</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:pause &lt;rfc-id&gt;</syntax>
<syntax>nmblr:pause &lt;rfc-id&gt; --reason "&lt;reason&gt;"</syntax>
<syntax>nmblr:pause &lt;rfc-id&gt; --blocker "&lt;blocker-description&gt;"</syntax>
</usage>

<arguments>
<argument name="rfc-id" required="true">
<description>RFC ID to pause (e.g., RFC-0015)</description>
</argument>
</arguments>

<options>
<option name="--reason" value_type="reason">Document reason for pausing</option>
<option name="--blocker" value_type="description">Mark as blocked with description</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`

2. **Delegate to rfc-executor agent**
   - Spawn `rfc-executor` agent with RFC ID and pause mode
   - Pass reason/blocker options

3. **The rfc-executor will**:
   - Complete any atomic unit of work in progress
   - Update state file with current progress
   - Record timestamp, reason/blocker, and in-progress work notes
   - Mark state as "Paused" or "Blocked"
   - Add resume notes for later continuation
   - Commit all changes (staged and unstaged) with a WIP message
   - Push the branch to remote
   - Create a draft PR if one does not exist for this branch, or update the existing draft PR
   - Report the draft PR link

If a draft PR already exists for this branch, it will be updated. Otherwise a new draft PR is created.
</execution_instructions>

<examples>
<example>
<command>/nmblr:pause RFC-0015 --reason "End of day, continuing tomorrow"</command>
<description>Pause with reason -- commits, pushes, and creates/updates draft PR</description>
</example>
<example>
<command>/nmblr:pause RFC-0015 --blocker "Waiting for API documentation from external team"</command>
<description>Pause due to blocker -- commits, pushes, and creates/updates draft PR</description>
</example>
<example>
<command>/nmblr:pause RFC-0015</command>
<description>Quick pause -- commits all changes, pushes, and creates/updates draft PR</description>
</example>
</examples>

<blocked_vs_paused>
<paused>
<description>Voluntary pause, can resume anytime</description>
</paused>
<blocked>
<description>Waiting on external dependency, cannot proceed</description>
<note>Use `--blocker` to mark as blocked, which:</note>
<effect>Sets status to "Blocked"</effect>
<effect>Adds to blocked items list</effect>
<effect>Shows in `nmblr:blocked` output</effect>
</blocked>
</blocked_vs_paused>
