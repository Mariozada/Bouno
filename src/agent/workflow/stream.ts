import { streamText, type CoreMessage, type UserContent } from 'ai'
import { XMLStreamParser, STREAM_EVENT_TYPES, type ToolCallEvent } from '../streamParser'
import type { AgentSession, StepResult, ToolCallInfo, Message, ContentPart } from './types'
import { getMessageText } from './types'
import { getTracer, type SpanContext, type TracingConfig, type ChatMessage } from '../tracing'

// Convert our Message format to Vercel AI SDK CoreMessage format
function convertToSDKMessages(messages: Message[]): CoreMessage[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: msg.content,
      } as CoreMessage
    }

    // Multimodal content
    if (msg.role === 'user') {
      const userContent: UserContent = msg.content.map(part => {
        switch (part.type) {
          case 'text':
            return { type: 'text' as const, text: part.text }
          case 'image':
            return {
              type: 'image' as const,
              image: part.image,
              ...(part.mediaType && { mimeType: part.mediaType }),
            }
          case 'file':
            return {
              type: 'file' as const,
              data: part.data,
              mimeType: part.mediaType,
              ...(part.filename && { name: part.filename }),
            }
        }
      })
      return {
        role: 'user' as const,
        content: userContent,
      }
    }

    // Assistant messages - extract just text for now
    // (assistant multimodal responses would need separate handling)
    const textContent = msg.content
      .filter((part): part is ContentPart & { type: 'text' } => part.type === 'text')
      .map(part => part.text)
      .join('')

    return {
      role: 'assistant' as const,
      content: textContent,
    }
  })
}

export interface StreamTracingOptions {
  config: TracingConfig
  parentContext: SpanContext
  modelName?: string
  provider?: string
}

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void
  onToolCallParsed?: (toolCall: ToolCallInfo) => void
  onReasoningDelta?: (text: string) => void
  tracing?: StreamTracingOptions
  reasoningEnabled?: boolean
  provider?: string
  modelId?: string
}

function isOpenAIReasoningModel(modelId?: string): boolean {
  if (!modelId) return false
  // Match o1, o1-mini, o1-pro, o3, o3-mini, o4-mini, etc.
  // Also match openrouter format: openai/o1, openai/o3-mini, etc.
  return /(?:^|\/)(o[1-4])(?:-|$)/i.test(modelId)
}

function isAnthropicModel(modelId?: string): boolean {
  if (!modelId) return false
  // Match anthropic/claude-* or just claude-*
  return modelId.toLowerCase().includes('claude')
}

function isGoogleModel(modelId?: string): boolean {
  if (!modelId) return false
  // Match google/gemini-* or just gemini-*
  return modelId.toLowerCase().includes('gemini')
}

function getProviderOptions(provider?: string, reasoningEnabled?: boolean, modelId?: string): Record<string, unknown> | undefined {
  if (!reasoningEnabled) return undefined

  // Direct Anthropic provider
  if (provider === 'anthropic') {
    return {
      anthropic: {
        thinking: {
          type: 'enabled',
          budgetTokens: 16000,
        },
      },
    }
  }

  // Direct Google provider - just enable thought streaming, use model's default thinking level
  if (provider === 'google') {
    return {
      google: {
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    }
  }

  // Direct OpenAI provider with o-series models
  if (provider === 'openai' && isOpenAIReasoningModel(modelId)) {
    return {
      openai: {
        reasoningEffort: 'medium',
      },
    }
  }

  // OpenRouter - detect underlying provider from model ID
  if (provider === 'openrouter') {
    if (isOpenAIReasoningModel(modelId)) {
      return {
        openai: {
          reasoningEffort: 'medium',
        },
      }
    }
    if (isAnthropicModel(modelId)) {
      return {
        anthropic: {
          thinking: {
            type: 'enabled',
            budgetTokens: 16000,
          },
        },
      }
    }
    if (isGoogleModel(modelId)) {
      return {
        google: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      }
    }
  }

  return undefined
}

export async function streamLLMResponse(
  session: AgentSession,
  callbacks?: StreamCallbacks
): Promise<StepResult> {
  const parser = new XMLStreamParser()
  const toolCalls: ToolCallInfo[] = []
  let text = ''
  let reasoning = ''
  let rawOutput = ''  // Original LLM output for Phoenix (no filtering)

  // Start LLM span if tracing enabled
  const tracer = getTracer(callbacks?.tracing?.config)
  const llmSpan = callbacks?.tracing ? tracer.startLLMSpan({
    model: callbacks.tracing.modelName ?? 'unknown',
    provider: callbacks.tracing.provider,
    inputMessages: session.messages.map(m => ({
      role: m.role as ChatMessage['role'],
      content: getMessageText(m),  // Extract text for tracing
    })),
    parentContext: callbacks.tracing.parentContext,
  }) : null

  // Convert messages to SDK format (handles multimodal content)
  const sdkMessages = convertToSDKMessages(session.messages)

  parser.on(STREAM_EVENT_TYPES.TEXT_DELTA, (event) => {
    const delta = event.data as string
    text += delta
    callbacks?.onTextDelta?.(delta)
  })

  parser.on(STREAM_EVENT_TYPES.TOOL_CALL_DONE, (event) => {
    const tc = event.data as ToolCallEvent
    const toolCallInfo: ToolCallInfo = {
      id: tc.id,
      name: tc.name,
      input: tc.params,
      status: 'pending',
    }
    toolCalls.push(toolCallInfo)
    callbacks?.onToolCallParsed?.(toolCallInfo)
  })

  try {
    const providerOptions = getProviderOptions(callbacks?.provider, callbacks?.reasoningEnabled, callbacks?.modelId)

    const result = await streamText({
      model: session.model,
      system: session.systemPrompt,
      messages: sdkMessages,
      abortSignal: session.abortSignal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      providerOptions: providerOptions as any,
    })

    // Use fullStream to capture reasoning events
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        rawOutput += part.text
        parser.processChunk(part.text)
      } else if (part.type === 'reasoning-delta') {
        reasoning += part.text
        callbacks?.onReasoningDelta?.(part.text)
      }
    }

    parser.flush()

    // End LLM span with RAW output (original, unfiltered)
    llmSpan?.end({
      outputMessage: rawOutput ? { role: 'assistant', content: rawOutput } : undefined,
      toolCalls: toolCalls.map(tc => ({
        name: tc.name,
        input: tc.input,
      })),
    })

    return { text, toolCalls, reasoning: reasoning || undefined }
  } catch (err) {
    // End LLM span with error (still include raw output captured so far)
    llmSpan?.end({
      outputMessage: rawOutput ? { role: 'assistant', content: rawOutput } : undefined,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    throw err
  }
}

export function hasToolCalls(result: StepResult): boolean {
  return result.toolCalls.length > 0
}
