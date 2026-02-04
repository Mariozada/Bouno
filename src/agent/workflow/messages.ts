import type { StepResult, ToolCallInfo, ToolExecutionResult, AgentSession } from './types'
import { formatToolResult } from '../xmlParser'
import { appendAssistantMessage, appendUserMessage } from './session'

export function buildAssistantResponse(stepResult: StepResult): string {
  let response = stepResult.text

  for (const tc of stepResult.toolCalls) {
    response += `\n<tool_call name="${tc.name}">\n`
    for (const [key, value] of Object.entries(tc.input)) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
      response += `  <${key}>${valueStr}</${key}>\n`
    }
    response += `</tool_call>`
  }

  return response
}

export function buildToolResultsMessage(toolResults: ToolExecutionResult[]): string {
  return toolResults
    .map(tr => formatToolResult(tr.toolCall.name, tr.result))
    .join('\n\n')
}

export function appendStepMessages(
  session: AgentSession,
  stepResult: StepResult,
  toolResults: ToolExecutionResult[]
): void {
  const assistantContent = buildAssistantResponse(stepResult)
  appendAssistantMessage(session, assistantContent)

  const toolResultsContent = buildToolResultsMessage(toolResults)
  appendUserMessage(session, toolResultsContent)
}
