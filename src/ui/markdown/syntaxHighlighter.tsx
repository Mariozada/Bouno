import { type FC } from 'react'
import ShikiHighlighter, { type ShikiHighlighterProps } from 'react-shiki'
import type { SyntaxHighlighterProps as AUIProps } from './types'

type HighlighterProps = Omit<ShikiHighlighterProps, 'children' | 'theme'> & {
  theme?: ShikiHighlighterProps['theme']
} & Pick<AUIProps, 'node' | 'components' | 'language' | 'code'>

const mergeClassNames = (...parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(' ')

export const SyntaxHighlighter: FC<HighlighterProps> = ({
  code,
  language,
  theme = { dark: 'kanagawa-wave', light: 'kanagawa-lotus' },
  className,
  addDefaultStyles = false,
  showLanguage = false,
  node: _node,
  components: _components,
  ...props
}) => {
  return (
    <ShikiHighlighter
      {...props}
      language={language}
      theme={theme}
      addDefaultStyles={addDefaultStyles}
      showLanguage={showLanguage}
      defaultColor="light-dark()"
      className={mergeClassNames('aui-shiki-base', className)}
    >
      {code.trim()}
    </ShikiHighlighter>
  )
}
