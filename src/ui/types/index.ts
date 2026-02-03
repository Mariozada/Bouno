export interface TabInfo {
  id: number
  title: string
  url: string
}

export interface ToolParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select'
  required?: boolean
  default?: string | number | boolean
  options?: string[]
  description?: string
}

export interface ToolDef {
  name: string
  description: string
  params: ToolParam[]
}

export interface ToolResult {
  success: boolean
  result?: unknown
  error?: string
}

export type ToolParamValues = Record<string, string | number | boolean>
