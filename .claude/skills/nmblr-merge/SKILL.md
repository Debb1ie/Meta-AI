---
name: nmblr:merge
description: |
  Merge documents with automatic cross-reference cleanup.
  Works for any document type: PD, RFC, TD, ADR, PRD, etc.
  Type is inferred from the target document ID prefix.
user-invocable: true
argument-hint: "<target-id> <source-ids...> [--dry-run]"
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
<name>nmblr:merge</name>
<summary>Merge documents with automatic cross-reference cleanup across all docs.</summary>
<agent>document-manager</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:merge &lt;target-id&gt; &lt;source-id&gt; [&lt;source-id&gt;...]</syntax>
<syntax>nmblr:merge &lt;target-id&gt; &lt;source-id&gt; --dry-run</syntax>
</usage>

<arguments>
<argument name="target-id" required="true">
<description>Document ID to merge INTO (e.g., PD-0010). This document survives the merge.</description>
</argument>
<argument name="source-ids" required="true">
<description>One or more document IDs to merge FROM (e.g., PD-0003 PD-0007). These documents are marked as Merged.</description>
</argument>
</arguments>

<options>
<option name="--dry-run">Show merge plan and affected documents without making changes</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract target ID and source IDs
   - Infer document type from ID prefix (PD-, RFC-, TD-, ADR-, PRD-, etc.)
   - Validate all documents are the same type

2. **Read all documents**
   - Locate each document:
     ```bash
     bash .claude/nmblr/scripts/docs/find-document.sh {TYPE-NNNN}
     ```
   - Read target and all source documents fully

3. **Scan for cross-references**
   - Search ALL documents in the project for references to any source ID:
     ```bash
     grep -r "{SOURCE-ID}" docs/ --include="*.md" -l
     ```
   - Build a list of affected documents that reference source IDs

4. **Generate merge plan** (always shown, required for --dry-run)
   - Show what content will be merged from each source into the target
   - Show which documents reference source IDs and will be updated
   - Show GitHub Issues that will be closed (if sources have github_issue)

5. **If --dry-run, stop here and output the plan**

6. **Execute merge** (delegate to document-manager agent with merge workflow)
   - **Merge content** into target using type-specific rules:
     - **PD:** Combine problem statements, impact assessments, root causes, proposed solutions
     - **RFC:** Combine background, approaches, acceptance criteria, implementation phases
     - **TD:** Combine debt descriptions, impact assessments, resolution approaches
     - **ADR:** Combine context, decision drivers, considered options
     - **PRD:** Combine user stories, features, data models, API endpoints
     - **Other types:** Combine all body sections, deduplicate where possible
   - **Merge frontmatter arrays** with deduplication (related_docs, related_rfcs, etc.)
   - **Update target** version (minor bump) and changelog
   - **Mark sources** as `status: Merged` with `merged_into: {target-id}` in frontmatter
   - **Update cross-references** in all affected documents: replace source IDs with target ID
     - In frontmatter arrays (related_pds, related_rfcs, etc.)
     - In markdown body text and tables
     - Update resolved links via `resolve-doc-link.sh`
   - **Close source GitHub Issues** (if they have github_issue set):
     ```bash
     bash .claude/nmblr/scripts/github/gh-close-issue.sh --issue {number} --comment "Merged into {target-id}"
     ```

7. **Report results**

</execution_instructions>

<examples>
<example>
<command>/nmblr:merge PD-0010 PD-0003 PD-0007</command>
<description>Merge PD-0003 and PD-0007 into PD-0010</description>
</example>
<example>
<command>/nmblr:merge RFC-0015 RFC-0012 --dry-run</command>
<description>Preview merging RFC-0012 into RFC-0015</description>
</example>
<example>
<command>/nmblr:merge TD-0005 TD-0002 TD-0003 TD-0004</command>
<description>Consolidate three TD items into one</description>
</example>
</examples>

<merge_output_format>
```markdown
## Merge Complete: {target-id}

### Merged Documents
| Source | Status | GitHub Issue |
|--------|--------|--------------|
| {source-id} | Merged | Closed #{number} |

### Cross-References Updated
| Document | Field/Section | Old Reference | New Reference |
|----------|---------------|---------------|---------------|
| {doc-id} | {field} | {source-id} | {target-id} |

### Target Document
- **Version:** {old} → {new}
- **Sections added/updated:** {list}

**Next steps:**
- Review merged target document for coherence
- Run `/nmblr:review {target-id}` to check quality
```
</merge_output_format>
