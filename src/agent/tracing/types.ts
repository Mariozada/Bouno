// Tracing configuration
export interface TracingConfig {
  enabled: boolean
  endpoint: string
  projectName: string
}

export const DEFAULT_TRACING_CONFIG: TracingConfig = {
  enabled: false,
  endpoint: 'http://0.0.0.0:6006',
  projectName: 'browserun',
}

// Max image size for Phoenix display (20MB)
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024

// Message content types for multimodal support
export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  image: {
    url: string  // Can be URL or data:image/...;base64,...
  }
}

export interface FileContent {
  type: 'file'
  file: {
    url: string
    name?: string
    mimeType?: string
  }
}

export type MessageContent = TextContent | ImageContent | FileContent

// Chat message format (matches OpenInference)
// Simple text message
export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

// Multimodal message with mixed content
export interface MultimodalMessage {
  role: 'user' | 'assistant' | 'system'
  contents: MessageContent[]
}

export type ChatMessage = SimpleMessage | MultimodalMessage

// Helper to check if message is multimodal
export function isMultimodalMessage(msg: ChatMessage): msg is MultimodalMessage {
  return 'contents' in msg && Array.isArray(msg.contents)
}

// Tool call format
export interface ToolCallTrace {
  name: string
  input: Record<string, unknown>
  output?: unknown
  error?: string
  durationMs?: number
}

// OpenInference semantic convention keys
export const OI = {
  SPAN_KIND: 'openinference.span.kind',
  LLM_MODEL_NAME: 'llm.model_name',
  LLM_PROVIDER: 'llm.provider',
  LLM_INPUT_MESSAGES: 'llm.input_messages',
  LLM_OUTPUT_MESSAGES: 'llm.output_messages',
  TOOL_NAME: 'tool.name',
  TOOL_PARAMETERS: 'tool.parameters',
  TOOL_OUTPUT: 'tool.output',
  INPUT_VALUE: 'input.value',
  OUTPUT_VALUE: 'output.value',
  SESSION_ID: 'session.id',
  // Message attributes
  MESSAGE_ROLE: 'message.role',
  MESSAGE_CONTENT: 'message.content',
  MESSAGE_CONTENTS: 'message.contents',
  MESSAGE_CONTENT_TYPE: 'message_content.type',
  MESSAGE_CONTENT_TEXT: 'message_content.text',
  MESSAGE_CONTENT_IMAGE: 'message_content.image',
  IMAGE_URL: 'image.url',
} as const

// OpenInference span kinds
export type OISpanKind = 'LLM' | 'CHAIN' | 'TOOL' | 'AGENT'
