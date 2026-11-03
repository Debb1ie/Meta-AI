---
name: nmblr:amend
description: |
  Resume work on a finalized RFC to address PR feedback or add changes.
  Use when user needs to make additional changes to an RFC whose PR hasn't been merged yet.
user-invocable: true
argument-hint: "<RFC-ID> [--task TEXT] [--reason TEXT]"
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
<name>nmblr:amend</name>
<summary>Resume execution workflow on a finalized RFC whose PR hasn't been merged yet. Use this to address review feedback, fix issues, or add changes before merge.</summary>
<agent>rfc-executor</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:amend &lt;rfc-id&gt;</syntax>
<syntax>nmblr:amend &lt;rfc-id&gt; --task "Task description"</syntax>
<syntax>nmblr:amend &lt;rfc-id&gt; --reason "Amendment reason"</syntax>
</usage>

<arguments>
<argument name="rfc-id" required="true">
<description>RFC ID to amend (e.g., RFC-0001)</description>
</argument>
</arguments>

<options>
<option name="--task" value_type="description">Add a specific task to the amendment</option>
<option name="--reason" value_type="text">Reason for the amendment (e.g., "PR review feedback")</option>
</options>

<prerequisites>
<item>RFC must be in "Completed" state (finalized)</item>
<item>PR must exist and NOT be merged yet</item>
<item>Feature branch must still exist</item>
</prerequisites>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get GitHub settings

2. **Delegate to rfc-executor agent**
   - Spawn `rfc-executor` agent with RFC ID and amend mode
   - Pass task/reason options

3. **The rfc-executor will**:
   - Validate RFC state is "Completed" and PR is not merged
   - Checkout existing feature branch
   - Update context and state files to "Amending" status
   - Gather amendment tasks (from --task or interactively)
   - Execute amendment tasks following standard execution pattern
   - On completion: update status back to "Completed", push to update PR
   - Does NOT re-finalize or create new PR
</execution_instructions>

<examples>
<example>
<command>/nmblr:amend RFC-0001</command>
<description>Resume work on RFC-0001 to make additional changes</description>
</example>
<example>
<command>/nmblr:amend RFC-0001 --task "Fix unused import in service.go"</command>
<description>Add specific task and start working</description>
</example>
<example>
<command>/nmblr:amend RFC-0001 --reason "Address PR review comments"</command>
<description>Start amendment with documented reason</description>
</example>
</examples>

<amendment_flow>
<step number="1" name="Validate State">
<action>Check RFC state is "Completed"</action>
<action>Verify PR exists and is not merged</action>
<action>Verify feature branch exists</action>
</step>

<step number="2" name="Checkout Branch">
<action>Fetch latest from remote</action>
<action>Checkout existing feature branch</action>
<action>Sync with main if needed (rebase)</action>
</step>

<step number="3" name="Update State Files">
<action>Change context status: "Completed" → "Amending"</action>
<action>Change state status: "Completed" → "Amending"</action>
<action>Add amendment metadata to state file</action>
</step>

<step number="4" name="Execute Amendment Tasks">
<action>Follow same execution pattern as original</action>
<action>Update state after each task</action>
<action>Run tests continuously</action>
</step>

<step number="5" name="Complete Amendment">
<action>Mark all amendment tasks complete</action>
<action>Update status: "Amending" → "Completed"</action>
<action>Push to remote (updates existing PR)</action>
<action>STOP - do not re-finalize</action>
</step>
</amendment_flow>

<multiple_amendments>
If amending an already-amended RFC:
- Increment amendment_count
- Create new "## Amendment N" section
- Preserve history of previous amendments
- Task numbering: A.1, A.2 (first), B.1, B.2 (second), etc.
</multiple_amendments>

<quality_checks>
Before marking amendment complete:
<check>All amendment tasks completed</check>
<check>Tests passing</check>
<check>Build successful</check>
<check>No new lint errors introduced</check>
</quality_checks>
