---
name: nmblr:help
description: |
  Show available nmblr commands grouped by workflow phase.
  Displays version info, command listing, and quickstart guide.
user-invocable: true
argument-hint: ""
allowed-tools:
  - Read
  - Glob
  - Bash
---

<skill_info>
<name>nmblr:help</name>
<summary>Display all available nmblr commands grouped by workflow phase, with optional filtering by search term.</summary>
<config_file>.claude/nmblr/config.yaml</config_file>
</skill_info>

<usage>
<syntax>nmblr:help</syntax>
<syntax>nmblr:help &lt;search-term&gt;</syntax>
</usage>

<arguments>
<argument name="search-term" required="false">
<description>Optional keyword to filter commands (e.g., "rfc", "create", "report"). Case-insensitive. Filters both command names and descriptions.</description>
</argument>
</arguments>

<execution_instructions>
When this skill is invoked:

1. **Read version**
   - Attempt to read `.claude/nmblr/install-manifest.json` and extract the `version` field
   - If not found, attempt to read `.claude/nmblr/config.yaml` and extract `agent_kit.version`
   - If neither is available, use `"unknown"`

2. **Read project name**
   - Read `.claude/nmblr/config.yaml` and extract `project.name` (or `project_name`, depending on shape)
   - If the file does not exist or the field is absent, use the placeholder: `"Not configured — run /nmblr:init"`

3. **Check for a search term**
   - If the user provided an argument (e.g., `/nmblr:help rfc`), treat it as a case-insensitive filter
   - When a filter is active, only output sections and rows where the command name or description contains the search term
   - If no rows in a section match, omit that section entirely
   - Prepend the output with a note: `> Showing results matching: "{search-term}"`

4. **Output the command reference** using the exact markdown structure below. When no filter is active, output all sections in full.

---

## nmblr Agent Kit v{version}

**Project:** {project_name}

### Getting Started
| Command | Description |
|---------|-------------|
| `/nmblr:init` | Configure project and scaffold |
| `/nmblr:help` | Show this command reference |

### Document Creation
| Command | Description |
|---------|-------------|
| `/nmblr:create` | Create PRD, PD, TD, ADR, RFC, and more |
| `/nmblr:create-tc` | Create/update test cases (advanced) |
| `/nmblr:create-ux` | Create/update UX specifications |
| `/nmblr:create-ts` | Generate test automation scripts |

### RFC Workflow
| Command | Description |
|---------|-------------|
| `/nmblr:plan` | Plan RFC implementation |
| `/nmblr:execute` | Execute RFC implementation |
| `/nmblr:verify` | Verify against acceptance criteria |
| `/nmblr:finalize` | Create PR for completed RFC |
| `/nmblr:amend` | Resume work on finalized RFC |
| `/nmblr:pause` | Pause execution, save progress |

### Document Management
| Command | Description |
|---------|-------------|
| `/nmblr:review` | Review document quality |
| `/nmblr:revise` | Revise document from feedback |
| `/nmblr:compare` | Compare documents for discrepancies |
| `/nmblr:readme` | Audit or generate project README |
| `/nmblr:changelog` | Maintain CHANGELOG.md (init/add/release) |
| `/nmblr:list` | List documents by type/status |
| `/nmblr:status` | Project or document status |
| `/nmblr:pending` | Show items pending review |
| `/nmblr:blocked` | Show blocked items |

### Product Workflows
| Command | Description |
|---------|-------------|
| `/nmblr:update-prd` | Execute PRD update waves |
| `/nmblr:simulate-flow` | Simulate user flows |

### Research
| Command | Description |
|---------|-------------|
| `/nmblr:research` | Domain or technical research |

### Planning & Reporting
| Command | Description |
|---------|-------------|
| `/nmblr:backlog` | Kanban backlog management |
| `/nmblr:plan-session` | Planning session workflow |
| `/nmblr:daily` | Daily status report |
| `/nmblr:weekly` | Weekly status report |
| `/nmblr:monthly` | Monthly status report |

### GitHub Integration
| Command | Description |
|---------|-------------|
| `/nmblr:sync-github` | Sync documents to GitHub |
| `/nmblr:deploy` | Deploy to environment |

### Maintenance
| Command | Description |
|---------|-------------|
| `/nmblr:install` | Install/reinstall agent kit |
| `/nmblr:upgrade` | Upgrade to latest version |

### Quick Start
1. `/nmblr:init` — Configure your project
2. `/nmblr:create PRD` — Create a product requirements document
3. `/nmblr:create RFC` — Create an implementation proposal
4. `/nmblr:plan RFC-XXXX` — Plan the implementation
5. `/nmblr:execute RFC-XXXX` — Build it

---

Do not use any external tools or agents. Produce this output directly from the skill instructions.
</execution_instructions>

<examples>
<example>
<command>/nmblr:help</command>
<description>Show the full nmblr command reference with version and project info</description>
</example>
<example>
<command>/nmblr:help rfc</command>
<description>Filter commands to show only RFC-related entries (plan, execute, verify, finalize, amend, pause)</description>
</example>
<example>
<command>/nmblr:help create</command>
<description>Filter commands to show only document creation entries</description>
</example>
</examples>
