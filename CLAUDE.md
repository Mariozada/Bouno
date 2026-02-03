# BrowseRun - Project Context

## Quick Reference

- **Package manager**: `bun` (NOT npm or yarn)
- **File extensions**: `.tsx` for React, `.ts` for TypeScript
- **Build**: `bun run build` → outputs to `dist/`
- **Dev server**: `bun run dev` → UI preview at localhost:5173

## What is BrowseRun?

A Chrome Extension (Manifest V3) for **browser automation with external API support**. It allows an AI agent to:
- Read page content as an accessibility tree
- Click, type, scroll on elements
- Navigate between pages
- Take screenshots
- Execute JavaScript
- Capture console/network logs

Inspired by [browser-use](https://github.com/browser-use/browser-use) Python library.

## How to Build & Test

```bash
bun run build
```

Then load in Chrome:
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder

For UI-only changes, use `bun run dev` for hot reload preview.

## Project Structure

```
src/
├── cdp/                  # Chrome DevTools Protocol (PRIMARY)
│   ├── client.ts         # chrome.debugger API wrapper
│   ├── sessionManager.ts # Auto-attach/detach (30s timeout)
│   ├── treeFetcher.ts    # Parallel fetch: DOM + Snapshot + AX
│   ├── treeMerger.ts     # Merge trees via backendNodeId
│   └── index.ts
├── content/              # Content script (FALLBACK)
│   ├── index.ts          # Message handler entry point
│   ├── accessibilityTree.ts  # Manual AX tree builder
│   ├── elementRefs.ts    # ref_N ↔ Element mapping
│   ├── elementFinder.ts  # Natural language search
│   ├── eventSimulator.ts # Click, type, scroll, drag
│   ├── formHandler.ts    # Form input handling
│   ├── consoleCapture.ts # Intercept console.log/error
│   └── imageUpload.ts    # File upload simulation
├── background/           # Service worker
│   └── index.ts          # Tool registration, message routing
├── tools/                # Tool implementations
│   ├── registry.ts       # registerTool(), executeTool()
│   ├── pageReading.ts    # read_page, get_page_text, find
│   ├── interaction.ts    # computer, form_input, upload_image
│   ├── tabs.ts           # navigate, tabs_context, tabs_create
│   ├── debugging.ts      # console, network, javascript_tool
│   ├── media.ts          # gif_creator
│   └── ui.ts             # update_plan, turn_answer_start
├── shared/               # Shared code
│   ├── types.ts          # ElementRef, AXStateProperties, etc.
│   ├── messages.ts       # Message type constants
│   └── constants.ts      # Config values
└── ui/                   # Side panel (React)
    ├── main.tsx          # Entry point
    ├── App.tsx           # Main component
    └── styles/
```

## Core Concept: Two-Mode AX Tree

### CDP Mode (Primary)
Uses `chrome.debugger` API to get **real** accessibility tree from Chrome:
- Fetches 3 trees in parallel: DOM, DOMSnapshot, Accessibility
- Merges using `backendNodeId` as correlation key
- Pierces shadow DOM automatically
- Accesses cross-origin iframes
- Gets Chrome-computed accessible names (follows ARIA spec)

### Content Script Mode (Fallback)
When CDP unavailable (chrome:// pages, user denies debugger):
- Manual DOM traversal
- Approximates AX properties from HTML/ARIA attributes
- Cannot pierce shadow DOM or cross-origin iframes

## Output Format

The `read_page` tool returns a **text-based accessibility tree** (Claude format):

```
link "Home" [ref_1] href="/"
 navigation [ref_2]
  link "About" [ref_3] href="/about"
  link "Contact" [ref_4] href="/contact"
 main [ref_5]
  heading "Welcome" [ref_6]
  textbox [ref_7] placeholder="Search..."
  button "Submit" [ref_8] type="submit"
  checkbox "Remember me" [ref_9] checked
```

**Format**: `<role> "<name>" [ref_N] <attributes>`

**Response structure**:
```typescript
interface ReadPageResult {
  pageContent: string    // The text tree above
  viewport: { width: number; height: number }
  refCount: number
  error?: string
}
```

## Registered Tools

| Tool | Description |
|------|-------------|
| `read_page` | Get accessibility tree (CDP first, fallback to content) |
| `get_page_text` | Extract raw text content |
| `find` | Natural language element search |
| `computer` | Mouse/keyboard actions: click, type, scroll, screenshot |
| `form_input` | Set form values by ref |
| `upload_image` | Upload image to file input |
| `navigate` | Go to URL, back, forward |
| `tabs_context` | List all tabs |
| `tabs_create` | Create new tab |
| `resize_window` | Resize browser window |
| `read_console_messages` | Get console output |
| `read_network_requests` | Get HTTP requests |
| `javascript_tool` | Execute JS in page context |
| `gif_creator` | Record/export GIF |

## Message Flow

```
External API / Side Panel
         │
         ▼
┌─────────────────────────┐
│   Background Script     │
│   (Tool Registry)       │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌────────┐    ┌──────────────┐
│  CDP   │    │Content Script│
│        │    │  (fallback)  │
└────────┘    └──────────────┘
```

## Key Functions (accessibilityTree.ts)

| Function | Purpose |
|----------|---------|
| `getRole(el)` | Maps HTML → ARIA roles (`<a>` → link, `<button>` → button) |
| `getAccessibleName(el)` | Gets label from aria-label, placeholder, title, alt, `<label>`, or text |
| `isVisible(el)` | Checks display, visibility, opacity, dimensions |
| `isInteractive(el)` | Detects clickable elements (links, buttons, inputs, contenteditable) |
| `assignRef(el)` | Creates/retrieves `ref_N` for an element (uses WeakRef) |
| `getElementByRef(ref)` | Gets DOM element from `ref_N` string |

## Important Implementation Details

1. **Element refs** (`ref_1`, `ref_2`): Use WeakRef for garbage collection. Persist across `read_page` calls until page navigation.

2. **50KB limit**: Output truncates if too large. Use `depth` param or `ref_id` to focus.

3. **Filters**: `"all"` (default) includes landmarks and labeled elements. `"interactive"` only clickable elements.

4. **Viewport culling**: Only includes visible on-screen elements by default.

5. **Accessible name priority**: aria-label → placeholder → title → alt → associated label → text content.

## Path Aliases

```typescript
import { ... } from '@shared/types'
import { ... } from '@cdp/index'
import { ... } from '@tools/registry'
import { ... } from '@content/elementRefs'
```

Configured in `vite.config.ts` and `tsconfig.json`.

## Permissions (manifest.json)

- `debugger` - CDP access
- `tabs` - Tab management
- `activeTab` - Current tab access
- `scripting` - Execute scripts
- `webRequest` - Network monitoring
- `sidePanel` - Side panel UI
- `storage` - Extension storage
- `<all_urls>` - Host permission for all sites
