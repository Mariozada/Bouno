export interface ParsedToolCall {
  name: string
  params: Record<string, unknown>
}

export interface ParseResult {
  toolCalls: ParsedToolCall[]
  textContent: string
  hasToolCalls: boolean
}

export function parseToolCalls(text: string): ParseResult {
  const toolCalls: ParsedToolCall[] = []
  const toolCallRegex = /<tool_call\s+name=["']([^"']+)["']>([\s\S]*?)<\/tool_call>/g

  let match: RegExpExecArray | null
  let textContent = text

  while ((match = toolCallRegex.exec(text)) !== null) {
    const [fullMatch, toolName, content] = match

    const params = parseToolParams(content)

    toolCalls.push({
      name: toolName,
      params,
    })

    textContent = textContent.replace(fullMatch, '')
  }

  textContent = textContent
    .replace(/```xml\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  return {
    toolCalls,
    textContent,
    hasToolCalls: toolCalls.length > 0,
  }
}

function parseToolParams(content: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g

  let match: RegExpExecArray | null

  while ((match = paramRegex.exec(content)) !== null) {
    const [, paramName, rawValue] = match
    const value = extractValue(rawValue)
    params[paramName] = parseValue(value)
  }

  return params
}

function extractValue(rawValue: string): string {
  const cdataMatch = rawValue.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  if (cdataMatch) {
    return cdataMatch[1]
  }
  return rawValue.trim()
}

function parseValue(value: string): unknown {
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  if (value === 'true') return true
  if (value === 'false') return false

  const num = Number(value)
  if (!isNaN(num) && value !== '') {
    return num
  }

  return value
}

export function formatToolResult(toolName: string, result: unknown): string {
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)

  return `<tool_result name="${toolName}">
${resultStr}
</tool_result>`
}

export function hasToolCalls(text: string): boolean {
  return /<tool_call\s+name=["'][^"']+["']>/.test(text)
}
