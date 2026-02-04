import { streamText, type LanguageModel } from 'ai'
import { setCurrentTabId } from './tools'
import { XMLStreamParser, STREAM_EVENT_TYPES, type ToolCallEvent } from './streamParser'
import { formatToolResult } from './xmlParser'
import { renderSystemPrompt } from '@prompts/render'
import { getEnabledToolDefinitions } from '@tools/definitions'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[Agent:StreamLoop]', ...args)
const logError = (...args: unknown[]) => console.error('[Agent:StreamLoop]', ...args)

export interface ToolCallInfo {
  id: string
  name: string
  input: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: unknown
  error?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamAgentOptions {
  model: LanguageModel
  messages: Message[]
  tabId: number
  maxSteps?: number
  abortSignal?: AbortSignal

  // Callbacks
  onTextDelta?: (text: string) => void
  onTextDone?: (fullText: string) => void
  onToolCallStart?: (toolCall: ToolCallInfo) => void
  onToolCallDone?: (toolCall: ToolCallInfo) => void
  onStep?: (step: number) => void
  onStreamStart?: () => void
  onStreamDone?: () => void
}

export interface StreamAgentResult {
  text: string
  toolCalls: ToolCallInfo[]
  steps: number
  finishReason: string
}

async function executeToolCall(
  name: string,
  params: Record<string, unknown>,
  tabId: number
): Promise<unknown> {
  const paramsWithTab = { ...params, tabId }

  log(`Executing tool: ${name}`, paramsWithTab)

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EXECUTE_TOOL',
      tool: name,
      params: paramsWithTab,
    })

    if (response?.success) {
      return response.result ?? { success: true }
    } else {
      return { error: response?.error ?? 'Tool execution failed' }
    }
  } catch (err) {
    logError(`Tool execution error: ${name}`, err)
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function runStreamingAgentLoop(options: StreamAgentOptions): Promise<StreamAgentResult> {
  const {
    model,
    messages: initialMessages,
    tabId,
    maxSteps = 15,
    abortSignal,
    onTextDelta,
    onTextDone,
    onToolCallStart,
    onToolCallDone,
    onStep,
    onStreamStart,
    onStreamDone,
  } = options

  setCurrentTabId(tabId)

  const toolDefinitions = getEnabledToolDefinitions()
  const systemPrompt = renderSystemPrompt(toolDefinitions)

  log('Starting streaming agent loop, max steps:', maxSteps)
  log('Tools available:', toolDefinitions.map(t => t.name).join(', '))

  let currentMessages: Message[] = [...initialMessages]
  let step = 0
  let finalText = ''
  const allToolCalls: ToolCallInfo[] = []

  onStreamStart?.()

  while (step < maxSteps) {
    log(`=== Step ${step + 1} ===`)
    onStep?.(step + 1)

    if (abortSignal?.aborted) {
      log('Aborted by user')
      break
    }

    try {
      const parser = new XMLStreamParser()
      const pendingToolCalls: ToolCallEvent[] = []
      let stepText = ''

      parser.on(STREAM_EVENT_TYPES.TEXT_DELTA, (event) => {
        const text = event.data as string
        stepText += text
        onTextDelta?.(text)
      })

      parser.on(STREAM_EVENT_TYPES.TOOL_CALL_DONE, (event) => {
        const toolCall = event.data as ToolCallEvent
        pendingToolCalls.push(toolCall)

        const toolCallInfo: ToolCallInfo = {
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.params,
          status: 'pending',
        }
        allToolCalls.push(toolCallInfo)
        onToolCallStart?.(toolCallInfo)
      })

      const result = await streamText({
        model,
        system: systemPrompt,
        messages: currentMessages,
        abortSignal,
      })

      for await (const chunk of result.textStream) {
        parser.processChunk(chunk)
      }

      parser.flush()

      log('Step completed:', {
        textLength: stepText.length,
        toolCalls: pendingToolCalls.length,
      })

      if (stepText.trim()) {
        finalText += stepText
        onTextDone?.(stepText)
      }

      if (pendingToolCalls.length === 0) {
        log('No tool calls found, finishing')
        onStreamDone?.()
        return {
          text: finalText.trim(),
          toolCalls: allToolCalls,
          steps: step + 1,
          finishReason: 'stop',
        }
      }

      const toolResultsContent: string[] = []

      for (const tc of pendingToolCalls) {
        const toolCallInfo = allToolCalls.find(t => t.id === tc.id)
        if (toolCallInfo) {
          toolCallInfo.status = 'running'
        }

        log(`Executing tool: ${tc.name}`, tc.params)

        const toolResult = await executeToolCall(tc.name, tc.params, tabId)

        const hasError = toolResult && typeof toolResult === 'object' && 'error' in toolResult
        if (toolCallInfo) {
          toolCallInfo.result = toolResult
          toolCallInfo.status = hasError ? 'error' : 'completed'
          toolCallInfo.error = hasError ? String((toolResult as { error: unknown }).error) : undefined
          onToolCallDone?.(toolCallInfo)
        }

        log(`Tool result for ${tc.name}:`, hasError ? 'error' : 'success')

        toolResultsContent.push(formatToolResult(tc.name, toolResult))
      }

      const fullResponse = buildFullResponse(stepText, pendingToolCalls)

      currentMessages.push({
        role: 'assistant',
        content: fullResponse,
      })

      currentMessages.push({
        role: 'user',
        content: toolResultsContent.join('\n\n'),
      })

      step++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const isAbortError = errorMessage === 'AbortError' || errorMessage.includes('aborted')

      if (isAbortError) {
        log('Aborted')
        onStreamDone?.()
        return {
          text: finalText.trim(),
          toolCalls: allToolCalls,
          steps: step + 1,
          finishReason: 'aborted',
        }
      }

      logError('Error in streaming agent loop:', err)
      onStreamDone?.()
      throw err
    }
  }

  log('Reached max steps limit')
  onStreamDone?.()

  return {
    text: finalText.trim() + '\n\n(Reached maximum steps limit)',
    toolCalls: allToolCalls,
    steps: step,
    finishReason: 'max-steps',
  }
}

function buildFullResponse(text: string, toolCalls: ToolCallEvent[]): string {
  let response = text

  for (const tc of toolCalls) {
    response += `\n<tool_call name="${tc.name}">\n`
    for (const [key, value] of Object.entries(tc.params)) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
      response += `  <${key}>${valueStr}</${key}>\n`
    }
    response += `</tool_call>`
  }

  return response
}
