---
name: nmblr:propagate
description: |
  Propagate architectural decisions to affected documents.
  When a decision changes (ADR or RFC), automatically identifies and updates all affected docs.
  Optionally creates an ADR if one doesn't exist for the decision.
user-invocable: true
argument-hint: "<ADR-ID|RFC-ID> [--dry-run] [--create-adr]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<skill_info>
<name>nmblr:propagate</name>
<summary>Propagate architectural decisions to all affected documents with optional ADR creation.</summary>
<agent>decision-propagator</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:propagate &lt;ADR-ID&gt;</syntax>
<syntax>nmblr:propagate &lt;ADR-ID&gt; --dry-run</syntax>
<syntax>nmblr:propagate &lt;RFC-ID&gt; --create-adr</syntax>
</usage>

<arguments>
<argument name="doc-id" required="true">
<description>ADR or RFC ID containing the decision to propagate (e.g., ADR-0005, RFC-0010)</description>
</argument>
</arguments>

<options>
<option name="--dry-run">Show impact report without making changes</option>
<option name="--create-adr">Extract the decision from an RFC and create an ADR first, then propagate</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read source decision document**
   - Locate document:
     ```bash
     bash .claude/nmblr/scripts/docs/find-document.sh {TYPE-NNNN}
     ```
   - Read the full document

2. **If --create-adr (RFC source only)**
   - Extract the key architectural decision from the RFC
   - Spawn `adr-writer` agent to create an ADR capturing the decision
   - Use the new ADR as the propagation source going forward

3. **Delegate to decision-propagator agent**
   - Spawn `decision-propagator` agent with:
     - Source document path and content
     - Whether this is a dry run
     - Key decision summary and implications

4. **The decision-propagator will**:
   - Extract key decision, rationale, and implications from source
   - Scan all documents for references to the affected area
   - Identify documents that need updating
   - Generate impact report
   - On approval (or if not --dry-run), apply updates

</execution_instructions>

<examples>
<example>
<command>/nmblr:propagate ADR-0005</command>
<description>Propagate ADR-0005's decision to all affected documents</description>
</example>
<example>
<command>/nmblr:propagate ADR-0005 --dry-run</command>
<description>Show which documents would be affected without making changes</description>
</example>
<example>
<command>/nmblr:propagate RFC-0010 --create-adr</command>
<description>Extract decision from RFC-0010, create ADR, then propagate to affected docs</description>
</example>
</examples>
