import { type FC, useCallback } from 'react'

interface ResultViewerProps {
  result: string
  error: string
}

export const ResultViewer: FC<ResultViewerProps> = ({ result, error }) => {
  const handleCopy = useCallback(() => {
    if (result) {
      navigator.clipboard.writeText(result)
    }
  }, [result])

  return (
    <section className="section result-section">
      <div className="section-header">
        <h2>Result</h2>
        {result && (
          <button onClick={handleCopy}>Copy</button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <pre className="result">
        {result || <span className="placeholder">Execute a tool to see results</span>}
      </pre>
    </section>
  )
}
