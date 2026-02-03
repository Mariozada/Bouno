import { useState, useEffect } from 'react'
import type { TabInfo } from '../types'

export function useCurrentTab() {
  const [currentTab, setCurrentTab] = useState<TabInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCurrentTab = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tabs[0]) {
          setCurrentTab({
            id: tabs[0].id!,
            title: tabs[0].title || '',
            url: tabs[0].url || '',
          })
        }
      } catch (error) {
        console.error('Failed to get current tab:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCurrentTab()
  }, [])

  return { currentTab, isLoading }
}
