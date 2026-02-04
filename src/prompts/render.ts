import type { ToolDefinition } from '@tools/definitions'
import { render as renderSystemTemplate } from './templates/system.jinja'

export function renderSystemPrompt(tools: ToolDefinition[]): string {
  return renderSystemTemplate({ tools })
}
