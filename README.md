# BrowseRun

Browser automation Chrome extension with external API support. Uses Chrome DevTools Protocol (CDP) for accurate accessibility tree extraction.

## Development

**This project uses [bun](https://bun.sh/) as the package manager. Do not use npm.**

```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Build for production
bun run build

# Lint
bun run lint
```

## Loading the Extension

1. Run `bun run build`
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Architecture

- **Background Script**: Tool registry and CDP session management
- **Content Script**: Fallback DOM access when CDP unavailable
- **CDP Module**: Chrome DevTools Protocol for real accessibility tree
- **Side Panel**: React UI for manual interaction

## Key Features

- Real accessibility tree via CDP (not simulated)
- Shadow DOM piercing
- Cross-origin iframe support
- Auto-detach debugger after 30s inactivity
- Fallback to content script when CDP unavailable
