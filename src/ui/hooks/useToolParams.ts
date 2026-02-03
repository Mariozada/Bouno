import { useState, useEffect, useCallback } from 'react'
import type { ToolDef, ToolParamValues } from '../types'

interface UseToolParamsOptions {
  tool: ToolDef
  tabId: number | undefined
}

interface UseToolParamsReturn {
  params: ToolParamValues
  setParam: (name: string, value: string | number | boolean) => void
  resetParams: () => void
}

/**
 * Get initial param values based on tool definition
 */
function getInitialParams(tool: ToolDef, tabId: number | undefined): ToolParamValues {
  const initial: ToolParamValues = {}

  for (const param of tool.params) {
    if (param.name === 'tabId' && tabId) {
      initial[param.name] = tabId
    } else if (param.default !== undefined) {
      initial[param.name] = param.default
    } else if (param.type === 'boolean') {
      initial[param.name] = false
    } else if (param.type === 'number') {
      initial[param.name] = 0
    } else {
      initial[param.name] = ''
    }
  }

  return initial
}

export function useToolParams({ tool, tabId }: UseToolParamsOptions): UseToolParamsReturn {
  const [params, setParams] = useState<ToolParamValues>(() =>
    getInitialParams(tool, tabId)
  )

  // Reset params when tool or tabId changes
  useEffect(() => {
    setParams(getInitialParams(tool, tabId))
  }, [tool, tabId])

  const setParam = useCallback((name: string, value: string | number | boolean) => {
    setParams(prev => ({ ...prev, [name]: value }))
  }, [])

  const resetParams = useCallback(() => {
    setParams(getInitialParams(tool, tabId))
  }, [tool, tabId])

  return { params, setParam, resetParams }
}
