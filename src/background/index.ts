import {
  executeTool,
  getRegisteredTools,
  registerTabTools,
  registerPageReadingTools,
  registerInteractionTools,
  registerDebuggingTools,
  registerMediaTools,
  registerUiTools,
  addConsoleMessage,
  addNetworkRequest,
  clearTabData
} from '@tools/index'
import { MessageTypes } from '@shared/messages'

registerTabTools()
registerPageReadingTools()
registerInteractionTools()
registerDebuggingTools()
registerMediaTools()
registerUiTools()

console.log('BrowseRun: Registered tools:', getRegisteredTools())

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('BrowseRun: Extension installed')
  } else if (details.reason === 'update') {
    console.log('BrowseRun: Extension updated')
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type } = message as { type: string }

  if (type === MessageTypes.CONSOLE_MESSAGE) {
    const tabId = sender.tab?.id
    if (tabId) {
      addConsoleMessage(tabId, message.data)
    }
    return
  }

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

  if (type === MessageTypes.EXECUTE_SCRIPT) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message, sendResponse)
      }
    })
    return true
  }

  if (type === MessageTypes.EXECUTE_TOOL) {
    const { tool, params } = message as { tool: string; params: Record<string, unknown> }
    console.log(`[BrowseRun:background] EXECUTE_TOOL received: tool=${tool}, params=`, params)
    console.log(`[BrowseRun:background] Sender:`, sender.tab?.id, sender.url)

    executeTool(tool, params).then((result) => {
      console.log(`[BrowseRun:background] EXECUTE_TOOL result:`, result)
      sendResponse(result)
    }).catch((err) => {
      console.log(`[BrowseRun:background] EXECUTE_TOOL error:`, err)
      sendResponse({ success: false, error: err.message })
    })
    return true
  }

  return false
})

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
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

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabData(tabId)
})
