import type { FC } from 'react'
import type { ToolDef, ToolParamValues } from '../types'
import { ToolSelector } from './ToolSelector'
import { ToolParams } from './ToolParams'

interface ToolSectionProps {
  tools: ToolDef[]
  selectedTool: ToolDef
  params: ToolParamValues
  isExecuting: boolean
  onToolChange: (tool: ToolDef) => void
  onParamChange: (name: string, value: string | number | boolean) => void
  onExecute: () => void
}

export const ToolSection: FC<ToolSectionProps> = ({
  tools,
  selectedTool,
  params,
  isExecuting,
  onToolChange,
  onParamChange,
  onExecute,
}) => {
  return (
    <section className="section tool-section">
      <div className="section-header">
        <h2>Tools</h2>
      </div>

      <ToolSelector
        tools={tools}
        selectedTool={selectedTool}
        onToolChange={onToolChange}
      />

      <ToolParams
        tool={selectedTool}
        params={params}
        onParamChange={onParamChange}
      />

      <button
        className="execute-btn"
        onClick={onExecute}
        disabled={isExecuting}
      >
        {isExecuting ? 'Executing...' : 'Execute'}
      </button>
    </section>
  )
}
