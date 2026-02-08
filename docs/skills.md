# Skills

Skills are reusable instruction packages that extend what the agent can do. Each skill is a markdown file with YAML frontmatter (a `SKILL.md`) that gets parsed, stored in IndexedDB, and injected into the system prompt when invoked.

## SKILL.md Format

```markdown
---
name: my-skill
description: What this skill does
version: 1.0.0
author: Your Name
user-invocable: true
auto-discover: false
allowed-tools: [get_page_text, read_page]
requires:
  tools: [get_page_text]
arguments:
  - name: query
    description: The search query
    required: true
  - name: limit
    description: Max number of results
    required: false
    default: "10"
---

# Skill Instructions

Your markdown instructions here. The agent follows these when the skill is invoked.

You can reference arguments with $query or ${query} syntax.
```

### Frontmatter Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | **yes** | — | Unique identifier. Lowercase alphanumeric and hyphens only (`/^[a-z0-9-]+$/`). Also used as the `/command` name. |
| `description` | string | **yes** | — | Short description shown in the UI and to the agent. |
| `version` | string | no | `1.0.0` | Semver version string. |
| `author` | string | no | — | Author name. |
| `user-invocable` | boolean | no | `true` | Whether the skill appears in the slash command menu. Users trigger it with `/name`. |
| `auto-discover` | boolean | no | `false` | Whether the agent can invoke the skill autonomously via the `invoke_skill` tool, without the user typing a slash command. |
| `allowed-tools` | string[] | no | — | Whitelist of tools this skill is allowed to use. If omitted, all tools are available. |
| `requires.tools` | string[] | no | — | Tools that must be available for this skill to work. |
| `arguments` | array | no | — | Parameterized arguments (see below). |

### Skill vs. Command

The codebase distinguishes two modes based on frontmatter flags:

- **Command** (`user-invocable: true`, `auto-discover: false`) — Only triggered by the user typing `/name`. The agent never invokes it on its own. The built-in `/summary` is an example.
- **Skill** (`auto-discover: true`) — Listed in the system prompt under "Installed Skills" so the agent can invoke it via the `invoke_skill` tool when relevant.

A skill can be both user-invocable and auto-discoverable.

### Arguments

Skills can accept parameters that get substituted into the instructions body:

```yaml
arguments:
  - name: url
    description: The URL to analyze
    required: true
  - name: depth
    description: How deep to crawl
    required: false
    default: "1"
```

In the instructions body, use `$url` or `${url}` to reference argument values. When invoked via slash command, arguments are parsed from the text after the command name:

- **Key-value**: `/my-skill url=https://example.com depth=3`
- **Positional**: `/my-skill https://example.com` (assigns to the first argument)

### YAML Parser Notes

The frontmatter uses a built-in lightweight YAML parser (not a full YAML library). It supports:

- Simple key-value pairs: `name: value`
- Booleans: `true`/`false`/`yes`/`no`/`on`/`off`
- Numbers: integers and floats
- Quoted strings: `"value"` or `'value'`
- Inline arrays: `[a, b, c]`
- Block arrays with `- item` syntax
- One level of nested objects (e.g. `requires:` with indented `tools:`)
- Comments with `#`
- Kebab-case keys are normalized: `user-invocable` → `userInvocable`, `auto-discover` → `autoDiscover`, `allowed-tools` → `allowedTools`

### Validation Rules

- `name` is required and must match `/^[a-z0-9-]+$/`
- `description` is required
- Instructions body must be at least 10 characters

## Installation

### From the Settings UI

1. Open the Bouno side panel → Settings → Skills tab.
2. Click **Import File** to upload a `.md` or `.skill.md` file, or click **Paste Content** to paste the raw SKILL.md content.
3. Click **Install Skill**.

### Programmatically

```typescript
import { installSkill } from '@skills/index'

await installSkill({
  rawContent: '---\nname: my-skill\n...',
  source: 'user',  // 'builtin' | 'user' | 'registry'
})
```

### Built-in Skills

Built-in skills (source: `builtin`) are auto-installed on first run via `initializeBuiltinSkills()`. They ship in `src/skills/builtin.ts`. Currently the only built-in is `summary`.

## Storage

Skills are stored in IndexedDB (`bouno-chat` database, `skills` table) via Dexie. Each skill record includes:

- Parsed frontmatter and raw content
- Source (`builtin`, `user`, or `registry`)
- Enabled/disabled flag
- Install and update timestamps

The skill manager maintains a 5-second in-memory cache that is invalidated on writes.

## How Invocation Works

### User-triggered (slash command)

1. User types `/summary` (or `/skill-name args`) in the chat input.
2. `parseSlashCommand()` extracts the skill name and arguments string.
3. The skill is looked up from cache, arguments are parsed, and the user's message is transformed.
4. The skill is passed as `activeSkill` to the workflow runner.
5. `renderSystemPrompt()` appends an `## Active Skill: name` section with the substituted instructions to the system prompt.

### Agent-triggered (auto-discover)

1. During session setup, all `autoDiscover: true` skills are fetched.
2. They're listed in the system prompt under `## Installed Skills` with the XML syntax for `invoke_skill`.
3. The agent calls `invoke_skill` with `skill_name`, which returns the skill's instructions.
4. The agent follows the returned instructions.

## Managing Skills

From the Skills tab in Settings you can:

- **Enable/disable** a skill (toggle switch)
- **Export** a skill back to `.skill.md` file
- **Uninstall** user-installed skills (built-in skills can't be deleted individually)
- **Reset Built-in** to reinstall the default skills
- **Delete All** to wipe everything

## Example: Minimal Skill

```markdown
---
name: screenshot-page
description: Take a full-page screenshot and describe what you see
version: 1.0.0
user-invocable: true
auto-discover: false
---

# Screenshot & Describe

1. Call `screenshot` to capture the current page
2. Describe the visual layout, main content, and any notable UI elements
3. Keep the description concise (3-5 sentences)
```

## Example: Parameterized Skill

```markdown
---
name: find-on-page
description: Find and highlight specific content on the page
version: 1.0.0
user-invocable: true
auto-discover: false
arguments:
  - name: query
    description: Text or pattern to search for
    required: true
---

# Find on Page

Search the current page for: **$query**

1. Call `get_page_text` to read the page content
2. Look for occurrences of "$query" (case-insensitive)
3. Report how many matches you found and where they appear
4. If there are interactive elements near the matches, mention them
```

Usage: `/find-on-page login button` or `/find-on-page query="submit form"`
