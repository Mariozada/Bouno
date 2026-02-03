/**
 * Tool Registry
 * Central registration and dispatch for all tools
 */

import type { ToolResult } from '@shared/types'

// Tool handler type
type ToolHandler<T = unknown> = (params: Record<string, unknown>) => Promise<T>

// Registered tools
const toolHandlers = new Map<string, ToolHandler>()

/**
 * Register a tool handler
 */
export function registerTool(name: string, handler: ToolHandler): void {
  toolHandlers.set(name, handler)
}

/**
 * Execute a tool
 */
export async function executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  const handler = toolHandlers.get(name)

  if (!handler) {
    return {
      success: false,
      error: `Unknown tool: ${name}`
    }
  }

  try {
    const result = await handler(params)
    return {
      success: true,
      result
    }
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || String(err)
    }
  }
}

/**
 * Get list of registered tools
 */
export function getRegisteredTools(): string[] {
  return Array.from(toolHandlers.keys())
}

/**
 * Check if a tool is registered
 */
export function hasTool(name: string): boolean {
  return toolHandlers.has(name)
}
