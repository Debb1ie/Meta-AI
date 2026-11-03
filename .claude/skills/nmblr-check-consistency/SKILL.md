---
name: nmblr:check-consistency
description: |
  Automated cross-document validation for data models, routes, RBAC, and terminology.
  Use after parallel document creation or before milestone reviews to catch contradictions.
user-invocable: true
argument-hint: "[--scope all|milestone M1] [--focus data-models|routes|rbac|terminology|status|all] [DOC-ID DOC-ID]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:check-consistency</name>
<summary>Cross-document consistency validation — catches contradictions in data models, APIs, RBAC, and terminology.</summary>
<agent>consistency-checker</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:check-consistency</syntax>
<syntax>nmblr:check-consistency --scope all</syntax>
<syntax>nmblr:check-consistency --scope milestone M1</syntax>
<syntax>nmblr:check-consistency --focus data-models</syntax>
<syntax>nmblr:check-consistency PRD-0001 RFC-0003</syntax>
</usage>

<arguments>
<argument name="doc-ids" required="false">
<description>Optional specific document pair to check (e.g., PRD-0001 RFC-0003)</description>
</argument>
</arguments>

<options>
<option name="--scope" value_type="scope">Scope of check: "all" for all documents, "milestone M1" for milestone-scoped docs (default: all non-archived)</option>
<option name="--focus" value_type="area">Focus area: data-models, routes, rbac, terminology, status, all (default: all)</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Determine scope**
   - **No args / --scope all:** Collect all non-archived documents across all types
   - **--scope milestone {ID}:** Read PPD to find milestone scope array, collect those documents
   - **Specific doc pair:** Use only the provided document IDs
   - Use `list-documents.sh` for each type to gather documents:
     ```bash
     bash .claude/nmblr/scripts/docs/list-documents.sh --type PD
     bash .claude/nmblr/scripts/docs/list-documents.sh --type RFC
     bash .claude/nmblr/scripts/docs/list-documents.sh --type PRD
     bash .claude/nmblr/scripts/docs/list-documents.sh --type ADR
     bash .claude/nmblr/scripts/docs/list-documents.sh --type AD
     ```

2. **Delegate to consistency-checker agent**
   - Spawn `consistency-checker` agent with document paths and focus area
   - Pass the full list of document paths and the focus area

3. **The consistency-checker will**:
   - Read all documents in scope
   - Extract and compare data models, API definitions, RBAC rules, terminology
   - Identify contradictions and inconsistencies
   - Output a structured contradiction report

</execution_instructions>

<examples>
<example>
<command>/nmblr:check-consistency</command>
<description>Check all documents for cross-document inconsistencies</description>
</example>
<example>
<command>/nmblr:check-consistency --focus data-models</command>
<description>Check only data model consistency across PRDs, RFCs, and AD</description>
</example>
<example>
<command>/nmblr:check-consistency --scope milestone M1</command>
<description>Check consistency within milestone M1 scope</description>
</example>
<example>
<command>/nmblr:check-consistency PRD-0001 RFC-0003</command>
<description>Check specific PRD vs RFC for alignment</description>
</example>
</examples>

<focus_areas>
<area name="data-models">
Compare entity definitions across PRDs (data models section), RFCs (implementation), and AD (architecture).
Flag when fields are added/removed/renamed without being noted across documents.
</area>
<area name="routes">
Compare API endpoint definitions in PRDs vs RFC implementation plans vs AD.
Flag mismatched paths, methods, request/response schemas.
</area>
<area name="rbac">
Compare role definitions and permission matrices across documents.
Flag when a role exists in one document but not another, or permissions differ.
</area>
<area name="terminology">
Flag when the same concept uses different names across documents
(e.g., "user" vs "account" vs "member" for the same entity).
</area>
<area name="status">
Flag documents referencing other documents whose status has changed
(e.g., PRD referencing superseded ADR, RFC referencing completed PD).
</area>
</focus_areas>
