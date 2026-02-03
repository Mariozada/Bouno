import type { FC } from 'react'
import type { ToolDef, ToolParamValues } from '../types'
import { ParamInput } from './ParamInput'

interface ToolParamsProps {
  tool: ToolDef
  params: ToolParamValues
  onParamChange: (name: string, value: string | number | boolean) => void
}

export const ToolParams: FC<ToolParamsProps> = ({ tool, params, onParamChange }) => {
  if (tool.params.length === 0) {
    return (
      <div className="tool-params">
        <span className="placeholder">No parameters required</span>
      </div>
    )
  }

  return (
    <div className="tool-params">
      {tool.params.map(param => (
        <div key={param.name} className="param-row">
          <label>
            {param.name}
            {param.required && <span className="required">*</span>}
          </label>
          <ParamInput
            param={param}
            value={params[param.name] ?? ''}
            onChange={(value) => onParamChange(param.name, value)}
          />
        </div>
      ))}
    </div>
  )
}
