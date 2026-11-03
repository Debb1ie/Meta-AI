---
name: nmblr:notebook
description: |
  Load project documents and ask questions about them.
  Use when user wants to query, compare, summarize, or explore project documentation interactively.
user-invocable: true
argument-hint: "\"<question>\" [--all|--type TYPE|--doc ID|--dir PATH] [--deep]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---

<skill_info>
<name>nmblr:notebook</name>
<summary>NotebookLM-style Q&A over project documents. Load docs by scope and ask questions with citation-backed answers.</summary>
<agent>notebook-analyst</agent>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:notebook "&lt;question&gt;"</syntax>
<syntax>nmblr:notebook "&lt;question&gt;" --type RFC,PRD</syntax>
<syntax>nmblr:notebook "&lt;question&gt;" --doc RFC-0015,PRD-0003</syntax>
<syntax>nmblr:notebook "&lt;question&gt;" --dir docs/engineering</syntax>
<syntax>nmblr:notebook "&lt;question&gt;" --doc RFC-0015 --deep</syntax>
</usage>

<arguments>
<argument name="question" required="true">
<description>The question to ask about the documents. Must be quoted.</description>
</argument>
</arguments>

<options>
<option name="--all">Load all project documents (default when no scope flag is provided)</option>
<option name="--type" value_type="types">Comma-separated document types to load (e.g., RFC,PRD,ADR)</option>
<option name="--doc" value_type="ids">Comma-separated document IDs to load (e.g., RFC-0015,PRD-0003)</option>
<option name="--dir" value_type="path">Load all markdown documents from a directory path</option>
<option name="--deep">Enable section-by-section deep-dive analysis (best with single document)</option>
</options>

<execution_instructions>
When this skill is invoked:

1. **Parse arguments**
   - Extract the question (required, quoted string)
   - Determine scope: `--type`, `--doc`, `--dir`, or default to `--all`
   - Note if `--deep` flag is present

2. **Read project configuration**
   - Load `.claude/nmblr/config.yaml`
   - Get document root directory

3. **Resolve document scope to file paths**

   **If `--all` or no scope flag:**
   - Run `bash .claude/nmblr/scripts/docs/list-documents.sh --type {TYPE}` for each known type: PD, TD, ADR, RFC, PRD, AD, PPD, PSR, TP, TC
   - Collect all `path` values from the JSON output
   - Skip any types that return empty results

   **If `--type RFC,PRD`:**
   - Split the comma-separated types
   - Run `bash .claude/nmblr/scripts/docs/list-documents.sh --type {TYPE}` for each requested type
   - Collect all `path` values from the JSON output

   **If `--doc RFC-0015,PRD-0003`:**
   - Split the comma-separated document IDs
   - Run `bash .claude/nmblr/scripts/docs/find-document.sh {ID}` for each ID
   - Extract the `path` from each JSON result where `exists` is true
   - Warn if any document ID was not found

   **If `--dir docs/engineering`:**
   - Use Glob to find all `*.md` files under the specified directory
   - Filter out any non-document files (e.g., README.md)

4. **Delegate to notebook-analyst agent**
   - Spawn `notebook-analyst` agent via Task tool
   - Pass the following context:
     - The user's question
     - The resolved list of document file paths
     - Whether `--deep` mode is active
   - The agent will read documents, synthesize an answer with citations, and suggest follow-ups

5. **Present the agent's response**
   - Output the agent's formatted response directly to the user
</execution_instructions>

<examples>
<example>
<command>/nmblr:notebook "What are the main open problems in the project?"</command>
<description>Query all docs (default scope) about open problems</description>
</example>
<example>
<command>/nmblr:notebook "What security considerations have been raised?" --type RFC,ADR</command>
<description>Query only RFCs and ADRs about security</description>
</example>
<example>
<command>/nmblr:notebook "Walk me through the implementation plan" --doc RFC-0015 --deep</command>
<description>Deep dive into a specific RFC</description>
</example>
<example>
<command>/nmblr:notebook "How does RFC-0015 address the requirements in PRD-0003?" --doc RFC-0015,PRD-0003</command>
<description>Cross-document relationship analysis</description>
</example>
<example>
<command>/nmblr:notebook "What technical debt has been identified?" --type TD</command>
<description>Query all technical debt documents</description>
</example>
<example>
<command>/nmblr:notebook "Summarize all architecture decisions" --dir docs/architecture</command>
<description>Query all docs in the architecture directory</description>
</example>
</examples>

<supported_doc_types>
<type>PD</type>
<type>TD</type>
<type>ADR</type>
<type>RFC</type>
<type>PRD</type>
<type>AD</type>
<type>PPD</type>
<type>PSR</type>
<type>TP</type>
<type>TC</type>
</supported_doc_types>
