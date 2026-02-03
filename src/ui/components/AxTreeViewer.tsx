import { type FC, type MouseEvent, useCallback, useMemo } from 'react'

interface AxTreeViewerProps {
  axTree: string
  isLoading: boolean
  isDisabled: boolean
  onRefresh: () => void
  onRefClick: (ref: string) => void
}

/**
 * Renders the accessibility tree with clickable ref links
 */
function renderAxTreeContent(tree: string, onRefClick: (ref: string) => void) {
  const parts = tree.split(/(\[ref_\d+\])/)

  return parts.map((part, index) => {
    const match = part.match(/^\[(ref_\d+)\]$/)
    if (match) {
      return (
        <span
          key={index}
          className="ref-link"
          data-ref={match[1]}
          title="Click to use this ref"
          onClick={() => onRefClick(match[1])}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onRefClick(match[1])
            }
          }}
        >
          {part}
        </span>
      )
    }
    return part
  })
}

export const AxTreeViewer: FC<AxTreeViewerProps> = ({
  axTree,
  isLoading,
  isDisabled,
  onRefresh,
  onRefClick,
}) => {
  const handleTreeClick = useCallback(
    (event: MouseEvent<HTMLPreElement>) => {
      const target = event.target as HTMLElement
      if (target.classList.contains('ref-link')) {
        const ref = target.dataset.ref
        if (ref) {
          onRefClick(ref)
        }
      }
    },
    [onRefClick]
  )

  const renderedContent = useMemo(() => {
    if (!axTree) {
      return <span className="placeholder">Click Refresh to load AX tree</span>
    }
    return renderAxTreeContent(axTree, onRefClick)
  }, [axTree, onRefClick])

  return (
    <section className="section ax-tree-section">
      <div className="section-header">
        <h2>Accessibility Tree</h2>
        <button onClick={onRefresh} disabled={isLoading || isDisabled}>
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      <pre className="ax-tree" onClick={handleTreeClick}>
        {renderedContent}
      </pre>
    </section>
  )
}
