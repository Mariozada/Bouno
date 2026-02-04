export { createProvider, validateSettings, ProviderError } from './providers'
export { PROVIDER_CONFIGS, getModelsForProvider, getDefaultModelForProvider } from './config'
export type { ModelConfig, ProviderConfig } from './config'

export { setCurrentTabId, getCurrentTabId } from './tools'

export { parseToolCalls, formatToolResult, hasToolCalls } from './xmlParser'
export type { ParsedToolCall, ParseResult } from './xmlParser'

export { XMLStreamParser, STREAM_EVENT_TYPES, parsePartialJSON } from './streamParser'
export type { StreamEvent, ToolCallEvent, ToolResultEvent } from './streamParser'

export { runStreamingAgentLoop } from './streamLoop'
export type { StreamAgentOptions, StreamAgentResult, ToolCallInfo } from './streamLoop'
