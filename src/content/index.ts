/**
 * BrowseRun Content Script
 *
 * Entry point that sets up message handlers and initializes modules.
 * This script runs in the context of web pages.
 */

import { MessageTypes } from '@shared/messages'
import { handleReadPage, handleGetPageText } from './accessibilityTree'
import { handleFindElements } from './elementFinder'
import { handleFormInput } from './formHandler'
import { handleComputerAction } from './eventSimulator'
import { setupConsoleCapture, getConsoleMessages, clearConsoleMessages } from './consoleCapture'
import { handleUploadImage } from './imageUpload'

console.log('BrowseRun: Content script loaded')

// Initialize console capture
setupConsoleCapture()

// Message handler type
type MessageHandler = (message: unknown) => unknown

// Message handlers map
const handlers: Record<string, MessageHandler> = {
  [MessageTypes.READ_PAGE]: (message) => {
    const { depth, filter, ref_id } = message as { depth?: number; filter?: 'all' | 'interactive'; ref_id?: string }
    return handleReadPage({ depth, filter, ref_id })
  },

  [MessageTypes.GET_PAGE_TEXT]: () => {
    return handleGetPageText()
  },

  [MessageTypes.FIND_ELEMENTS]: (message) => {
    const { query } = message as { query: string }
    return handleFindElements({ query })
  },

  [MessageTypes.FORM_INPUT]: (message) => {
    const { ref, value } = message as { ref: string; value: string | boolean | number }
    return handleFormInput({ ref, value })
  },

  [MessageTypes.COMPUTER_ACTION]: (message) => {
    return handleComputerAction(message as Parameters<typeof handleComputerAction>[0])
  },

  [MessageTypes.UPLOAD_IMAGE]: (message) => {
    return handleUploadImage(message as Parameters<typeof handleUploadImage>[0])
  },

  [MessageTypes.GET_CONSOLE_MESSAGES]: () => {
    return { messages: getConsoleMessages() }
  },

  [MessageTypes.CLEAR_CONSOLE_MESSAGES]: () => {
    clearConsoleMessages()
    return { success: true }
  },

  // Legacy handlers for side panel compatibility
  [MessageTypes.GET_PAGE_INFO]: () => {
    return {
      title: document.title,
      url: window.location.href,
      selection: window.getSelection()?.toString() || ''
    }
  },

  [MessageTypes.HIGHLIGHT_TEXT]: (message) => {
    const { color } = message as { color?: string }
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const highlight = document.createElement('mark')
      highlight.style.backgroundColor = color || '#ffff00'
      range.surroundContents(highlight)
      return { success: true }
    }
    return { success: false, error: 'No text selected' }
  },

  [MessageTypes.GET_LINKS]: () => {
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent?.trim() || ''
    }))
    return { links }
  },

  [MessageTypes.GET_IMAGES]: () => {
    const images = Array.from(document.querySelectorAll('img')).map(img => ({
      src: (img as HTMLImageElement).src,
      alt: (img as HTMLImageElement).alt
    }))
    return { images }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type } = message as { type: string }

  const handler = handlers[type]
  if (handler) {
    try {
      const result = handler(message)
      sendResponse(result)
    } catch (err) {
      sendResponse({ error: (err as Error).message })
    }
  } else {
    sendResponse({ error: `Unknown message type: ${type}` })
  }

  return true // Keep channel open for async response
})

// Notify background script that content script is ready
chrome.runtime.sendMessage({
  type: MessageTypes.CONTENT_SCRIPT_READY,
  url: window.location.href
}).catch(() => {
  // Ignore errors if background isn't ready yet
})
