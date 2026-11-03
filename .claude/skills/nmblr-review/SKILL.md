---
name: nmblr:review
description: |
  Review a document for completeness and quality.
  Use when user wants a document reviewed before approval or to check quality.
user-invocable: true
argument-hint: "<doc-id|--all|--type TYPE> [--detailed] [--checklist-only] [--for-approval] [--status STATUS]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:review</name>
<summary>Review a document for completeness, clarity, and quality.</summary>
<agent>document-reviewer</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:review &lt;doc-id&gt;</syntax>
<syntax>nmblr:review &lt;doc-id&gt; --detailed</syntax>
<syntax>nmblr:review &lt;doc-id&gt; --checklist-only</syntax>
<syntax>nmblr:review --all</syntax>
<syntax>nmblr:review --type PD</syntax>
<syntax>nmblr:review --type PD --status Draft</syntax>
</usage>

<arguments>
<argument name="doc-id" required="false">
<description>Document ID to review (e.g., RFC-0023, PRD-0001). Required unless --all or --type is used.</description>
</argument>
</arguments>

<options>
<option name="--detailed">Provide detailed feedback with specific recommendations</option>
<option name="--checklist-only">Only show checklist without scoring</option>
<option name="--for-approval">Focus review on approval readiness</option>
<option name="--all">Review all documents with status Draft or In-Review</option>
<option name="--type" value_type="TYPE">Review all documents of a specific type (PD, RFC, PRD, ADR, TD, PPD, TP, TC)</option>
<option name="--status" value_type="STATUS">Filter by status when used with --all or --type (default: Draft)</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document locations

2. **Resolve documents to review**
   - **Single doc:** Use doc-id directly
   - **Bulk (--all or --type):** Use `list-documents.sh` to find matching documents:
     ```bash
     # All Draft documents of a specific type
     bash .claude/nmblr/scripts/docs/list-documents.sh --type {TYPE} --status {STATUS:-Draft}
     # For --all, iterate over types: PD, RFC, PRD, ADR, TD, PPD, TP, TC
     ```
   - Parse the JSON array output to get document paths

3. **Delegate to document-reviewer agent**
   - **Single doc:** Spawn `document-reviewer` agent with doc ID and options
   - **Bulk:** Spawn a single `document-reviewer` agent with all document paths and request batch review mode
   - Pass configuration context

4. **The document-reviewer will**:
   - **Single doc:** Locate, read, evaluate, score, and provide approval recommendation
   - **Batch mode:** Review all documents and output:
     1. Summary table first: `| Doc ID | Type | Score | Recommendation |`
     2. Individual reviews for documents scoring below 7/10
     3. Skip detailed output for documents scoring 7+ (just include in summary)
</execution_instructions>

<examples>
<example>
<command>/nmblr:review RFC-0023</command>
<description>Review an RFC</description>
</example>
<example>
<command>/nmblr:review RFC-0023 --detailed --for-approval</command>
<description>Detailed review for approval</description>
</example>
<example>
<command>/nmblr:review PRD-0001 --checklist-only</command>
<description>Quick checklist review</description>
</example>
<example>
<command>/nmblr:review --all</command>
<description>Review all Draft documents across all types</description>
</example>
<example>
<command>/nmblr:review --type PD --status Draft</command>
<description>Review all Draft PDs</description>
</example>
<example>
<command>/nmblr:review --type RFC --for-approval</command>
<description>Approval readiness review for all Draft RFCs</description>
</example>
</examples>

<review_criteria>
<criteria_for type="RFC">
<item>Background and problem statement</item>
<item>Proposed solution completeness</item>
<item>Implementation feasibility</item>
<item>Testing strategy</item>
<item>Security and performance</item>
<item>Rollback plan</item>
</criteria_for>

<criteria_for type="PRD">
<item>Business value clarity</item>
<item>User story completeness</item>
<item>Acceptance criteria</item>
<item>Technical feasibility</item>
<item>Dependency identification</item>
</criteria_for>

<criteria_for type="ADR">
<item>Context and drivers</item>
<item>Options evaluation</item>
<item>Decision rationale</item>
<item>Consequence documentation</item>
</criteria_for>
</review_criteria>
