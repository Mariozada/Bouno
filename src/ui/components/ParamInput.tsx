import type { FC, ChangeEvent } from 'react'
import type { ToolParam } from '../types'

interface ParamInputProps {
  param: ToolParam
  value: string | number | boolean
  onChange: (value: string | number | boolean) => void
}

export const ParamInput: FC<ParamInputProps> = ({ param, value, onChange }) => {
  if (param.type === 'select' && param.options) {
    return (
      <select
        value={String(value)}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      >
        <option value="">-- Select --</option>
        {param.options.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  if (param.type === 'boolean') {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
    )
  }

  if (param.type === 'number') {
    return (
      <input
        type="number"
        value={String(value)}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
      />
    )
  }

  return (
    <input
      type="text"
      value={String(value)}
      placeholder={param.description}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  )
}
