/**
 * BrowseRun Background Service Worker
 *
 * Entry point that initializes tools and sets up message handlers.
 */

import {
  executeTool,
  getRegisteredTools,
  registerTabTools,
  registerPageReadingTools,
  registerInteractionTools,
  registerDebuggingTools,
  registerMediaTools,
  registerUiTools,
  registerShortcutsTools,
  addConsoleMessage,
  addNetworkRequest,
  clearTabData,
  detachCDP
} from '@tools/index'
import { MessageTypes } from '@shared/messages'

// Register all tools
registerTabTools()
registerPageReadingTools()
registerInteractionTools()
registerDebuggingTools()
registerMediaTools()
registerUiTools()
registerShortcutsTools()

console.log('BrowseRun: Registered tools:', getRegisteredTools())

// Side panel handling
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('BrowseRun: Extension installed')
  } else if (details.reason === 'update') {
    console.log('BrowseRun: Extension updated')
  }
})

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message as { type: string }

  // Console message from content script
  if (type === MessageTypes.CONSOLE_MESSAGE) {
    const tabId = sender.tab?.id
    if (tabId) {
      addConsoleMessage(tabId, message.data)
    }
    return
  }

  // Tab info request from side panel
  if (type === MessageTypes.GET_TAB_INFO) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          id: tabs[0].id
        })
      }
    })
    return true
  }

  // Forward script execution to content script
  if (type === MessageTypes.EXECUTE_SCRIPT) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message, sendResponse)
      }
    })
    return true
  }

  // Tool execution request from side panel
  if (type === MessageTypes.EXECUTE_TOOL) {
    const { tool, params } = message as { tool: string; params: Record<string, unknown> }
    executeTool(tool, params).then(sendResponse)
    return true
  }

  return false
})

// Monitor network requests
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId > 0) {
      addNetworkRequest(details.tabId, {
        url: details.url,
        method: details.method,
        type: details.type,
        status: details.statusCode,
        statusText: details.statusLine || '',
        responseHeaders: details.responseHeaders
      })
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
)

// Track tab navigation for clearing data
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // Check if navigating to different domain - clear stored data
    const currentDomain = tab.url ? new URL(tab.url).hostname : ''
    const newDomain = changeInfo.url ? new URL(changeInfo.url).hostname : ''

    if (currentDomain !== newDomain) {
      clearTabData(tabId)
    }
  }

  if (changeInfo.status === 'complete') {
    console.log('BrowseRun: Tab loaded:', tab.url)
  }
})

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabData(tabId)
  // Detach CDP session if attached
  detachCDP(tabId).catch(() => {
    // Ignore errors if not attached
  })
})
