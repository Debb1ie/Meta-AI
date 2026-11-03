---
name: nmblr:compare
description: |
  Compare documents and find discrepancies.
  Use when user wants to compare two or more documents for alignment issues.
user-invocable: true
argument-hint: "<doc-id-1> <doc-id-2> [--detailed] [--suggest-updates]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Task
---

<skill_info>
<name>nmblr:compare</name>
<summary>Compare two or more documents to find discrepancies and alignment issues.</summary>
<agent>document-reviewer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:compare &lt;doc-id-1&gt; &lt;doc-id-2&gt;</syntax>
<syntax>nmblr:compare &lt;doc-id&gt; --against-all-related</syntax>
<syntax>nmblr:compare --prd &lt;prd-id&gt; --rfcs</syntax>
</usage>

<arguments>
<argument name="doc-id-1" required="true">
<description>First document ID to compare</description>
</argument>
<argument name="doc-id-2" required="false">
<description>Second document ID to compare</description>
</argument>
</arguments>

<options>
<option name="--against-all-related">Compare against all related documents</option>
<option name="--prd" value_type="id">Compare PRD against implementing RFCs</option>
<option name="--rfcs">Include all related RFCs in comparison</option>
<option name="--detailed">Show detailed line-by-line differences</option>
<option name="--suggest-updates">Suggest document updates to resolve discrepancies</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Delegate to document-reviewer agent**
   - Spawn `document-reviewer` agent with document IDs and options
   - Pass configuration context

3. **The document-reviewer will**:
   - Locate and read both documents
   - Compare scope, requirements, data models, and API designs
   - Identify discrepancies and alignment issues
   - Generate coverage analysis
   - Suggest updates if --suggest-updates flag is used
</execution_instructions>

<examples>
<example>
<command>/nmblr:compare PRD-0001 RFC-0015</command>
<description>Compare PRD with RFC</description>
</example>
<example>
<command>/nmblr:compare --prd PRD-0001 --rfcs</command>
<description>Compare PRD against all implementing RFCs</description>
</example>
<example>
<command>/nmblr:compare RFC-0015 ADR-0005</command>
<description>Compare RFC with ADR</description>
</example>
<example>
<command>/nmblr:compare PRD-0001 RFC-0015 --detailed --suggest-updates</command>
<description>Full comparison with suggestions</description>
</example>
</examples>

<comparison_types>
<comparison type="PRD vs RFC">
<check>Requirement coverage</check>
<check>Feature completeness</check>
<check>API alignment</check>
<check>Data model consistency</check>
</comparison>

<comparison type="RFC vs ADR">
<check>Decision implementation</check>
<check>Architecture alignment</check>
<check>Constraint adherence</check>
</comparison>

<comparison type="PRD vs PRD">
<check>Scope overlap</check>
<check>Dependency conflicts</check>
<check>Terminology consistency</check>
</comparison>
</comparison_types>
