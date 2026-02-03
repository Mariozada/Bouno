import { useState, useCallback } from 'react'
import { Header, AxTreeViewer, ToolSection, ResultViewer } from './components'
import { useCurrentTab, useAxTree, useToolExecution, useToolParams } from './hooks'
import { TOOLS } from './constants'
import type { ToolDef } from './types'
import './styles/App.css'

function App() {
  const { currentTab } = useCurrentTab()
  const [selectedTool, setSelectedTool] = useState<ToolDef>(TOOLS[0])

  const { axTree, isLoading: axTreeLoading, error: axTreeError, refresh: refreshAxTree } = useAxTree({
    tabId: currentTab?.id,
  })

  const { params, setParam } = useToolParams({
    tool: selectedTool,
    tabId: currentTab?.id,
  })

  const { result, isExecuting, error: executionError, execute } = useToolExecution()

  const handleToolChange = useCallback((tool: ToolDef) => {
    setSelectedTool(tool)
  }, [])

  const handleRefClick = useCallback((ref: string) => {
    const refParam = selectedTool.params.find(p => p.name === 'ref' || p.name === 'ref_id')
    if (refParam) {
      setParam(refParam.name, ref)
    }
  }, [selectedTool, setParam])

  const handleExecute = useCallback(() => {
    execute(selectedTool, params)
  }, [execute, selectedTool, params])

  const combinedError = axTreeError || executionError

  return (
    <div className="test-panel">
      <Header currentTab={currentTab} />

      {currentTab && (
        <AxTreeViewer
          axTree={axTree}
          isLoading={axTreeLoading}
          isDisabled={!currentTab}
          onRefresh={refreshAxTree}
          onRefClick={handleRefClick}
        />
      )}

      <ToolSection
        tools={TOOLS}
        selectedTool={selectedTool}
        params={params}
        isExecuting={isExecuting}
        onToolChange={handleToolChange}
        onParamChange={setParam}
        onExecute={handleExecute}
      />

      <ResultViewer result={result} error={combinedError} />
    </div>
  )
}

export default App
