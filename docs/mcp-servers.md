# MCP Servers

Bouno supports connecting to external [Model Context Protocol](https://modelcontextprotocol.io) servers. MCP tools appear alongside built-in tools in the system prompt and can be invoked by the agent during any conversation.

## Transport

Bouno uses **Streamable HTTP** — the current MCP standard transport, introduced in the [2025-03-26 spec revision](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports). Streamable HTTP replaced the older SSE transport (now deprecated) and is the recommended protocol for all new MCP servers and clients.

> **Note on other transports:** The MCP spec defines two other transports — **stdio** (for local process communication) and **SSE** (legacy, deprecated). stdio is impossible in a browser context since extensions can't spawn local processes. SSE has been officially deprecated in favor of Streamable HTTP and is scheduled for removal in a future spec version. If you have an older SSE-only server, migrating it to Streamable HTTP is typically a one-line URL change on the server side.

The client:
1. Sends `initialize` with protocol version `2025-03-26`
2. Fires a `notifications/initialized` notification
3. Calls `tools/list` to discover available tools
4. Calls `tools/call` to execute individual tools

## Adding a Server

### From the Settings UI

1. Open the Bouno side panel → Settings → MCP tab.
2. Click the **+** button.
3. Paste a JSON configuration and click **Add & Discover Tools**.

### JSON Configuration Format

```json
{
  "server-name": {
    "url": "http://localhost:3000/mcp",
    "headers": {
      "Authorization": "Bearer sk-..."
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| key (server name) | string | **yes** | Display name for the server. Also used as a namespace prefix for tool names. |
| `url` | string | **yes** | The Streamable HTTP endpoint URL. |
| `headers` | object | no | Custom HTTP headers sent with every request (e.g. auth tokens). |

### Multiple Servers

You can add multiple servers in a single JSON block:

```json
{
  "weather": {
    "url": "http://localhost:3001/mcp"
  },
  "database": {
    "url": "http://localhost:3002/mcp",
    "headers": { "X-Api-Key": "abc123" }
  }
}
```

### Wrapper Auto-Unwrap

The UI auto-unwraps common wrapper keys, so these formats also work:

```json
{
  "mcpServers": {
    "my-server": { "url": "http://..." }
  }
}
```

```json
{
  "servers": {
    "my-server": { "url": "http://..." }
  }
}
```

## Tool Naming

MCP tools are namespaced to avoid collisions with built-in tools and between servers. The format is:

```
mcp__<server-name>__<tool-name>
```

For example, a tool called `get_weather` from a server named `weather` becomes `mcp__weather__get_weather`. This prefixed name is what the agent sees and calls in the XML tool format.

## Tool Discovery

When you add or refresh a server, Bouno:

1. Calls `initialize` to establish the MCP session
2. Calls `tools/list` to fetch all available tools
3. Caches the tool list (name, description, input schema) in `chrome.storage.local`

Cached tools are used to build tool definitions without needing the server to be online at every conversation start. Click the refresh button on a server to re-discover tools.

## Tool Schema Mapping

MCP tool input schemas (JSON Schema) are converted to Bouno's internal tool parameter format:

| JSON Schema type | Bouno type |
|-----------------|------------|
| `string` | `string` |
| `number`, `integer` | `number` |
| `boolean` | `boolean` |
| `array` | `array` |
| `object` | `object` |
| anything else | `string` |

Properties marked in the schema's `required` array are flagged as required. `enum`, `default`, and `items` are also carried over when present.

## How MCP Tools Appear to the Agent

MCP tool definitions are rendered in a separate `## MCP Tools` section of the system prompt, after the built-in tools. Each tool shows its prefixed name, description, and parameters. Disabled tools are listed at the bottom with a note not to use them.

The agent invokes MCP tools with the same XML format as built-in tools:

```xml
<tool_calls>
<invoke name="mcp__weather__get_weather">
<parameter name="city">San Francisco</parameter>
</invoke>
</tool_calls>
```

## Tool Execution Flow

1. The agent emits a tool call with a `mcp__` prefixed name
2. The workflow runner's custom `toolExecutor` detects the prefix via `parsePrefixedName()`
3. `McpManager.executeTool()` looks up the server by name and calls `tools/call` on its URL
4. The MCP server's response (`content` array of text/image parts) is extracted and returned to the agent as the tool result

## Storage

MCP server configs are stored in `chrome.storage.local` under the key `bouno_mcp_servers`. Each config includes:

```typescript
{
  id: string          // Auto-generated unique ID
  name: string        // Server display name / namespace
  url: string         // Streamable HTTP endpoint
  enabled: boolean    // Whether tools from this server are active
  headers?: object    // Custom HTTP headers
  disabledTools?: string[]    // Individual tools turned off
  cachedTools?: McpCachedTool[]  // Cached tool list from last discovery
}
```

## Managing Servers

From the MCP tab in Settings:

- **Enable/disable** a server (toggle) — disabled servers' tools are excluded from the prompt
- **Expand** a server to see its individual tools
- **Enable/disable individual tools** — granular control over which tools the agent can use
- **Refresh** — re-discover tools from the server (useful after the server adds new tools)
- **Remove** — delete the server config entirely

## Requirements

- The MCP server must support **Streamable HTTP** transport (POST with JSON-RPC 2.0) — this is the current MCP standard
- The server must be reachable from the browser (localhost or CORS-enabled remote server)
- For remote servers, ensure CORS headers allow requests from the Chrome extension origin
