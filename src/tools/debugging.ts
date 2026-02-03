/**
 * Debugging Tools
 * Handles: read_console_messages, read_network_requests, javascript_tool
 */

import { registerTool } from './registry'
import { MessageTypes } from '@shared/messages'
import type { ConsoleMessage, NetworkRequest } from '@shared/types'
import { MAX_CONSOLE_MESSAGES, MAX_NETWORK_REQUESTS } from '@shared/constants'

// In-memory storage for console messages and network requests per tab
const consoleMessagesStore = new Map<number, ConsoleMessage[]>()
const networkRequestsStore = new Map<number, NetworkRequest[]>()

/**
 * Send message to content script
 */
async function sendToContentScript<T>(tabId: number, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T & { error?: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (response && response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Add console message from content script
 */
export function addConsoleMessage(tabId: number, message: Omit<ConsoleMessage, 'timestamp'>): void {
  if (!consoleMessagesStore.has(tabId)) {
    consoleMessagesStore.set(tabId, [])
  }

  const messages = consoleMessagesStore.get(tabId)!
  messages.push({
    ...message,
    timestamp: Date.now()
  } as ConsoleMessage)

  // Keep last N messages per tab
  if (messages.length > MAX_CONSOLE_MESSAGES) {
    messages.shift()
  }
}

/**
 * Add network request
 */
export function addNetworkRequest(tabId: number, request: Omit<NetworkRequest, 'timestamp'>): void {
  if (!networkRequestsStore.has(tabId)) {
    networkRequestsStore.set(tabId, [])
  }

  const requests = networkRequestsStore.get(tabId)!
  requests.push({
    ...request,
    timestamp: Date.now()
  } as NetworkRequest)

  // Keep last N requests per tab
  if (requests.length > MAX_NETWORK_REQUESTS) {
    requests.shift()
  }
}

/**
 * Clear data for a tab (called on navigation to different domain)
 */
export function clearTabData(tabId: number): void {
  consoleMessagesStore.delete(tabId)
  networkRequestsStore.delete(tabId)
}

/**
 * read_console_messages - Read browser console messages
 */
async function readConsoleMessages(params: {
  tabId: number
  pattern?: string
  limit?: number
  onlyErrors?: boolean
  clear?: boolean
}): Promise<{ messages: Partial<ConsoleMessage>[]; count: number }> {
  const { tabId, pattern, limit = 100, onlyErrors = false, clear = false } = params

  if (!tabId) throw new Error('tabId is required')

  // Try to get messages from content script
  try {
    const response = await sendToContentScript<{ messages?: ConsoleMessage[] }>(tabId, {
      type: MessageTypes.GET_CONSOLE_MESSAGES
    })

    if (response?.messages) {
      for (const msg of response.messages) {
        addConsoleMessage(tabId, msg)
      }
    }
  } catch {
    // Content script may not be ready, continue with stored messages
  }

  let messages = consoleMessagesStore.get(tabId) || []

  // Filter by errors only
  if (onlyErrors) {
    messages = messages.filter(m => m.type === 'error' || m.type === 'exception')
  }

  // Filter by pattern
  if (pattern) {
    const regex = new RegExp(pattern, 'i')
    messages = messages.filter(m => regex.test(m.text || ''))
  }

  // Apply limit
  messages = messages.slice(-limit)

  // Clear if requested
  if (clear) {
    consoleMessagesStore.delete(tabId)
    try {
      await sendToContentScript(tabId, { type: MessageTypes.CLEAR_CONSOLE_MESSAGES })
    } catch {
      // Ignore
    }
  }

  return {
    messages: messages.map(m => ({
      type: m.type,
      text: m.text,
      timestamp: m.timestamp,
      source: m.source
    })),
    count: messages.length
  }
}

/**
 * read_network_requests - Read HTTP network requests
 */
async function readNetworkRequests(params: {
  tabId: number
  pattern?: string
  limit?: number
  clear?: boolean
}): Promise<{ requests: Partial<NetworkRequest>[]; count: number }> {
  const { tabId, pattern, limit = 100, clear = false } = params

  if (!tabId) throw new Error('tabId is required')

  let requests = networkRequestsStore.get(tabId) || []

  // Filter by URL pattern
  if (pattern) {
    requests = requests.filter(r => r.url?.includes(pattern))
  }

  // Apply limit
  requests = requests.slice(-limit)

  // Clear if requested
  if (clear) {
    networkRequestsStore.delete(tabId)
  }

  return {
    requests: requests.map(r => ({
      url: r.url,
      method: r.method,
      type: r.type,
      status: r.status,
      statusText: r.statusText,
      timestamp: r.timestamp
    })),
    count: requests.length
  }
}

/**
 * javascript_tool - Execute JavaScript in page context
 */
async function javascriptTool(params: {
  code: string
  tabId: number
}): Promise<{ success: boolean; result?: unknown }> {
  const { code, tabId } = params

  if (!tabId) throw new Error('tabId is required')
  if (!code) throw new Error('code (JavaScript code) is required')

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (jsCode: string) => {
        try {
          // Use indirect eval to execute in global scope
          const result = (0, eval)(jsCode)
          return { success: true, result }
        } catch (err) {
          return { success: false, error: (err as Error).message }
        }
      },
      args: [code],
      world: 'MAIN' // Execute in page context
    })

    if (results?.[0]) {
      const { result } = results[0]
      if ((result as { success: boolean }).success) {
        return { success: true, result: (result as { result: unknown }).result }
      } else {
        throw new Error((result as { error: string }).error)
      }
    }

    throw new Error('No result from script execution')
  } catch (err) {
    throw new Error(`JavaScript execution failed: ${(err as Error).message}`)
  }
}

/**
 * Register debugging tools
 */
export function registerDebuggingTools(): void {
  registerTool('read_console_messages', readConsoleMessages as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('read_network_requests', readNetworkRequests as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('javascript_tool', javascriptTool as (params: Record<string, unknown>) => Promise<unknown>)
}
