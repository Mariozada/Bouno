# BrowseRun

Chrome Extension (Manifest V3) for browser automation with external API support.

## Features

- Read page content as accessibility tree
- Click, type, scroll on elements
- Navigate between pages
- Take screenshots
- Execute JavaScript
- Capture console/network logs

## Build

```bash
bun run build     # Build to dist/
bun run dev       # Dev server at localhost:5173
```

Load in Chrome: `chrome://extensions` > Developer mode > Load unpacked > select `dist/`

## Structure

```
src/
├── cdp/          # Chrome DevTools Protocol (primary)
├── content/      # Content script (fallback)
├── background/   # Service worker
├── tools/        # Tool implementations
├── shared/       # Types, messages, constants
└── ui/           # Side panel (React)
```

## Two-Mode Operation

**CDP Mode (Primary)**: Uses `chrome.debugger` API for real accessibility tree.

**Content Script Mode (Fallback)**: Manual DOM traversal when CDP unavailable.

## Output Format

```
link "Home" [ref_1] href="/"
 navigation [ref_2]
  link "About" [ref_3] href="/about"
 main [ref_4]
  heading "Welcome" [ref_5]
  textbox [ref_6] placeholder="Search..."
  button "Submit" [ref_7]
```

Format: `<role> "<name>" [ref_N] <attributes>`

## Tools

| Tool | Description |
|------|-------------|
| `read_page` | Get accessibility tree |
| `get_page_text` | Extract raw text |
| `find` | Natural language element search |
| `computer` | Mouse/keyboard actions, screenshot |
| `form_input` | Set form values |
| `upload_image` | Upload to file input |
| `navigate` | Go to URL, back, forward |
| `tabs_context` | List tabs |
| `tabs_create` | Create tab |
| `resize_window` | Resize window |
| `read_console_messages` | Get console output |
| `read_network_requests` | Get HTTP requests |
| `javascript_tool` | Execute JS |
| `gif_creator` | Record/export GIF |

## Path Aliases

```typescript
import { ... } from '@shared/types'
import { ... } from '@cdp/index'
import { ... } from '@tools/registry'
import { ... } from '@content/elementRefs'
```

## Permissions

`debugger`, `tabs`, `activeTab`, `scripting`, `webRequest`, `sidePanel`, `storage`, `<all_urls>`
