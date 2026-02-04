import { type FC, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isValidElement } from 'react'

interface MarkdownMessageProps {
  content: string
  isStreaming?: boolean
}

const normalizeMarkdown = (value: string) => {
  const fenceMatches = value.match(/```/g)?.length ?? 0
  const tildeMatches = value.match(/~~~/g)?.length ?? 0
  let suffix = ''
  if (fenceMatches % 2 === 1) {
    suffix += '\n```'
  }
  if (tildeMatches % 2 === 1) {
    suffix += '\n~~~'
  }
  return value + suffix
}

const getTextFromChildren = (children: unknown) => {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) {
    return children.map((child) => getTextFromChildren(child)).join('')
  }
  if (isValidElement(children) && typeof children.props?.children !== 'undefined') {
    return getTextFromChildren(children.props.children)
  }
  return ''
}

const CodeBlock: FC<{ language: string; code: string; className?: string }> = ({
  language,
  code,
  className
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), 2000)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-language">{language || 'text'}</span>
        <button
          type="button"
          className="code-block-copy"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  )
}

export const MarkdownMessage: FC<MarkdownMessageProps> = ({ content, isStreaming }) => {
  const processed = useMemo(() => normalizeMarkdown(content), [content])

  return (
    <ReactMarkdown
      className="message-markdown aui-md"
      remarkPlugins={[remarkGfm]}
      skipHtml
      data-status={isStreaming ? 'running' : undefined}
      components={{
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noreferrer" />
        ),
        pre: ({ node: _node, children }) => {
          const child = Array.isArray(children) ? children[0] : children
          if (isValidElement(child)) {
            const className = child.props?.className || ''
            const languageMatch = /language-([a-z0-9_-]+)/i.exec(className)
            const language = languageMatch ? languageMatch[1] : 'text'
            const code = getTextFromChildren(child.props?.children).replace(/\n$/, '')
            return <CodeBlock language={language} code={code} className={className} />
          }
          return <pre>{children}</pre>
        },
        code: ({ node: _node, inline, className, children, ...props }) => {
          if (inline) {
            return (
              <code className={`inline-code ${className || ''}`} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  )
}
