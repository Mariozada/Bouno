import type { ButtonHTMLAttributes, FC, ReactNode } from 'react'

interface TooltipIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string
  children: ReactNode
}

export const TooltipIconButton: FC<TooltipIconButtonProps> = ({
  tooltip,
  className,
  children,
  ...rest
}) => {
  return (
    <button
      type="button"
      title={tooltip}
      className={`aui-button-icon ${className || ''}`}
      {...rest}
    >
      {children}
      <span className="aui-sr-only">{tooltip}</span>
    </button>
  )
}
