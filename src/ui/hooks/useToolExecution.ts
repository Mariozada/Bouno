import { useState, useCallback } from 'react'
import type { ToolDef, ToolParamValues } from '../types'

interface UseToolExecutionReturn {
  result: string
  isExecuting: boolean
  error: string
  execute: (tool: ToolDef, params: ToolParamValues) => Promise<void>
  clearResult: () => void
}

/**
 * Parse coordinate string "x,y" to tuple [x, y]
 */
function parseCoordinate(value: string): [number, number] | undefined {
  if (!value || !value.includes(',')) return undefined
  const parts = value.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return undefined
}

/**
 * Parse region string "x0,y0,x1,y1" to tuple
 */
function parseRegion(value: string): [number, number, number, number] | undefined {
  if (!value || !value.includes(',')) return undefined
  const parts = value.split(',').map(s => parseInt(s.trim(), 10))
  if (parts.length === 4 && parts.every(n => !isNaN(n))) {
    return [parts[0], parts[1], parts[2], parts[3]]
  }
  return undefined
}

/**
 * Parse comma-separated string to array
 */
function parseStringArray(value: string): string[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

/**
 * Transform raw param values to proper types for API call
 */
function transformParams(params: ToolParamValues): Record<string, unknown> {
  const transformed: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (value === '' || value === undefined) continue

    switch (key) {
      case 'coordinate':
      case 'start_coordinate': {
        const parsed = parseCoordinate(value as string)
        if (parsed) transformed[key] = parsed
        break
      }
      case 'region': {
        const parsed = parseRegion(value as string)
        if (parsed) transformed[key] = parsed
        break
      }
      case 'domains': {
        transformed[key] = parseStringArray(value as string)
        break
      }
      default:
        transformed[key] = value
    }
  }

  return transformed
}

export function useToolExecution(): UseToolExecutionReturn {
  const [result, setResult] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState('')

  const execute = useCallback(async (tool: ToolDef, params: ToolParamValues) => {
    setIsExecuting(true)
    setError('')
    setResult('')

    try {
      const transformedParams = transformParams(params)

      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_TOOL',
        tool: tool.name,
        params: transformedParams,
      })

      setResult(JSON.stringify(response, null, 2))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsExecuting(false)
    }
  }, [])

  const clearResult = useCallback(() => {
    setResult('')
    setError('')
  }, [])

  return { result, isExecuting, error, execute, clearResult }
}
