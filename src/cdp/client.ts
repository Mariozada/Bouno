/**
 * CDP Client
 *
 * Wrapper around chrome.debugger API for making Chrome DevTools Protocol calls.
 * This enables access to the real accessibility tree, shadow DOM piercing,
 * and cross-origin iframe access.
 */

// CDP protocol version
const CDP_VERSION = '1.3'

// Command ID counter (for potential future use with async command tracking)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _commandId = 0

// Event listeners per tab
type EventListener = (params: unknown) => void
const eventListeners = new Map<number, Map<string, Set<EventListener>>>()

// Track attached tabs
const attachedTabs = new Set<number>()

/**
 * Initialize CDP event handling
 */
function initEventHandler(): void {
  // Handle CDP events from debugger
  chrome.debugger.onEvent.addListener((source, method, params) => {
    const tabId = source.tabId
    if (!tabId) return

    const listeners = eventListeners.get(tabId)?.get(method)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(params)
        } catch (err) {
          console.error(`CDP event handler error for ${method}:`, err)
        }
      }
    }
  })

  // Handle debugger detach (user closed devtools, navigation, etc.)
  chrome.debugger.onDetach.addListener((source, reason) => {
    const tabId = source.tabId
    if (tabId) {
      attachedTabs.delete(tabId)
      eventListeners.delete(tabId)
      console.log(`CDP: Detached from tab ${tabId}, reason: ${reason}`)
    }
  })
}

// Initialize on module load
initEventHandler()

/**
 * Attach debugger to a tab
 */
export async function attach(tabId: number): Promise<void> {
  if (attachedTabs.has(tabId)) {
    return // Already attached
  }

  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, CDP_VERSION, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        attachedTabs.add(tabId)
        eventListeners.set(tabId, new Map())
        console.log(`CDP: Attached to tab ${tabId}`)
        resolve()
      }
    })
  })
}

/**
 * Detach debugger from a tab
 */
export async function detach(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) {
    return // Not attached
  }

  return new Promise((resolve, reject) => {
    chrome.debugger.detach({ tabId }, () => {
      if (chrome.runtime.lastError) {
        // Ignore "not attached" errors
        if (!chrome.runtime.lastError.message?.includes('not attached')) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
      }
      attachedTabs.delete(tabId)
      eventListeners.delete(tabId)
      console.log(`CDP: Detached from tab ${tabId}`)
      resolve()
    })
  })
}

/**
 * Check if debugger is attached to a tab
 */
export function isAttached(tabId: number): boolean {
  return attachedTabs.has(tabId)
}

/**
 * Send a CDP command and wait for response
 */
export async function send<T = unknown>(
  tabId: number,
  method: string,
  params?: object
): Promise<T> {
  // Auto-attach if not attached
  if (!attachedTabs.has(tabId)) {
    await attach(tabId)
  }

  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`CDP ${method}: ${chrome.runtime.lastError.message}`))
      } else {
        resolve(result as T)
      }
    })
  })
}

/**
 * Add event listener for CDP events
 */
export function on(tabId: number, event: string, listener: EventListener): void {
  if (!eventListeners.has(tabId)) {
    eventListeners.set(tabId, new Map())
  }

  const tabListeners = eventListeners.get(tabId)!
  if (!tabListeners.has(event)) {
    tabListeners.set(event, new Set())
  }

  tabListeners.get(event)!.add(listener)
}

/**
 * Remove event listener
 */
export function off(tabId: number, event: string, listener: EventListener): void {
  const tabListeners = eventListeners.get(tabId)
  if (tabListeners) {
    tabListeners.get(event)?.delete(listener)
  }
}

/**
 * Execute multiple CDP commands in parallel
 */
export async function sendAll<T extends unknown[]>(
  tabId: number,
  commands: Array<{ method: string; params?: object }>
): Promise<T> {
  const results = await Promise.all(
    commands.map(cmd => send(tabId, cmd.method, cmd.params))
  )
  return results as T
}

// ============================================================================
// CDP Domain-Specific Helpers
// ============================================================================

/**
 * Enable a CDP domain (required before using some commands)
 */
export async function enableDomain(tabId: number, domain: string): Promise<void> {
  await send(tabId, `${domain}.enable`, {})
}

/**
 * Disable a CDP domain
 */
export async function disableDomain(tabId: number, domain: string): Promise<void> {
  await send(tabId, `${domain}.disable`, {})
}

// ============================================================================
// Convenience Types for CDP Responses
// ============================================================================

export interface CDPDOMNode {
  nodeId: number
  parentId?: number
  backendNodeId: number
  nodeType: number
  nodeName: string
  localName: string
  nodeValue: string
  childNodeCount?: number
  children?: CDPDOMNode[]
  attributes?: string[]
  documentURL?: string
  baseURL?: string
  frameId?: string
  contentDocument?: CDPDOMNode
  shadowRoots?: CDPDOMNode[]
  pseudoType?: string
  isSVG?: boolean
}

export interface CDPDOMDocument {
  root: CDPDOMNode
}

export interface CDPFrameTree {
  frame: {
    id: string
    parentId?: string
    loaderId: string
    name?: string
    url: string
    securityOrigin: string
  }
  childFrames?: CDPFrameTree[]
}

export interface CDPAXNode {
  nodeId: string
  ignored: boolean
  ignoredReasons?: Array<{ name: string; value?: { type: string; value: unknown } }>
  role?: { type: string; value: string }
  name?: { type: string; value: string; sources?: unknown[] }
  description?: { type: string; value: string }
  value?: { type: string; value: unknown }
  properties?: Array<{
    name: string
    value: { type: string; value: unknown }
  }>
  childIds?: string[]
  backendDOMNodeId?: number
}

export interface CDPAXTree {
  nodes: CDPAXNode[]
}

export interface CDPSnapshot {
  documents: Array<{
    documentURL: string
    title: string
    baseURL: string
    contentLanguage: string
    encodingName: string
    publicId: string
    systemId: string
    frameId: string
    nodes: {
      parentIndex?: number[]
      nodeType?: number[]
      nodeName?: number[]
      nodeValue?: number[]
      backendNodeId?: number[]
      attributes?: Array<{ name: number; value: number }[]>
      textValue?: { index: number[]; value: number[] }
      inputValue?: { index: number[]; value: number[] }
      inputChecked?: { index: number[] }
      optionSelected?: { index: number[] }
      contentDocumentIndex?: { index: number[]; value: number[] }
      pseudoType?: { index: number[]; value: number[] }
      isClickable?: { index: number[] }
      currentSourceURL?: { index: number[]; value: number[] }
    }
    layout: {
      nodeIndex: number[]
      bounds: number[][]
      text?: number[]
      styles?: number[][]
      stackingContexts?: { index: number[] }
      paintOrders?: number[]
      offsetRects?: number[][]
      scrollRects?: number[][]
      clientRects?: number[][]
    }
    textBoxes?: {
      layoutIndex: number[]
      bounds: number[][]
      start: number[]
      length: number[]
    }
  }>
  strings: string[]
}

export interface CDPBoxModel {
  content: number[]
  padding: number[]
  border: number[]
  margin: number[]
  width: number
  height: number
}
