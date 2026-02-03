import type { FC, ChangeEvent } from 'react'
import type { ToolDef } from '../types'

interface ToolSelectorProps {
  tools: ToolDef[]
  selectedTool: ToolDef
  onToolChange: (tool: ToolDef) => void
}

export const ToolSelector: FC<ToolSelectorProps> = ({
  tools,
  selectedTool,
  onToolChange,
}) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const tool = tools.find(t => t.name === event.target.value)
    if (tool) {
      onToolChange(tool)
    }
  }

  return (
    <div className="tool-selector">
      <select value={selectedTool.name} onChange={handleChange}>
        {tools.map(tool => (
          <option key={tool.name} value={tool.name}>
            {tool.name}
          </option>
        ))}
      </select>
      <span className="tool-description">{selectedTool.description}</span>
    </div>
  )
}
