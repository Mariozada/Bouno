import { useState, useCallback } from 'react'

interface UseAxTreeOptions {
  tabId: number | undefined
  filter?: 'all' | 'interactive'
  depth?: number
}

interface UseAxTreeReturn {
  axTree: string
  isLoading: boolean
  error: string
  refresh: () => Promise<void>
}

export function useAxTree({ tabId, filter = 'all', depth = 10 }: UseAxTreeOptions): UseAxTreeReturn {
  const [axTree, setAxTree] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!tabId) {
      setError('No tab selected')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_TOOL',
        tool: 'read_page',
        params: { tabId, filter, depth },
      })

      if (response?.success && response?.result?.pageContent) {
        setAxTree(response.result.pageContent)
      } else if (response?.result?.error) {
        setError(response.result.error)
        setAxTree('')
      } else if (response?.error) {
        setError(response.error)
        setAxTree('')
      } else {
        setAxTree(JSON.stringify(response, null, 2))
      }
    } catch (err) {
      setError((err as Error).message)
      setAxTree('')
    } finally {
      setIsLoading(false)
    }
  }, [tabId, filter, depth])

  return { axTree, isLoading, error, refresh }
}
