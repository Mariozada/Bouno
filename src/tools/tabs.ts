/**
 * Tab Management Tools
 * Handles: tabs_context, tabs_create, navigate, resize_window, web_fetch
 */

import { registerTool } from './registry'
import type { TabInfo } from '@shared/types'

/**
 * tabs_context - Get context information about all tabs
 */
async function tabsContext(): Promise<{ tabs: TabInfo[] }> {
  const tabs = await chrome.tabs.query({})

  return {
    tabs: tabs.map(tab => ({
      id: tab.id!,
      title: tab.title || '',
      url: tab.url || '',
      active: tab.active,
      windowId: tab.windowId,
      index: tab.index,
      pinned: tab.pinned,
      audible: tab.audible
    }))
  }
}

/**
 * tabs_create - Create a new empty tab
 */
async function tabsCreate(params: { url?: string }): Promise<TabInfo> {
  const tab = await chrome.tabs.create({
    active: true,
    url: params.url || 'about:blank'
  })

  return {
    id: tab.id!,
    title: tab.title || '',
    url: tab.url || '',
    active: tab.active,
    windowId: tab.windowId
  }
}

/**
 * navigate - Navigate to a URL or go back/forward
 */
async function navigate(params: { url: string; tabId: number }): Promise<{
  id: number
  url: string
  title: string
  status?: string
}> {
  const { url, tabId } = params

  if (!tabId) {
    throw new Error('tabId is required')
  }

  if (!url) {
    throw new Error('url is required')
  }

  // Handle special navigation commands
  if (url === 'back') {
    await chrome.tabs.goBack(tabId)
    await new Promise(resolve => setTimeout(resolve, 100))
    const tab = await chrome.tabs.get(tabId)
    return { id: tab.id!, url: tab.url || '', title: tab.title || '' }
  }

  if (url === 'forward') {
    await chrome.tabs.goForward(tabId)
    await new Promise(resolve => setTimeout(resolve, 100))
    const tab = await chrome.tabs.get(tabId)
    return { id: tab.id!, url: tab.url || '', title: tab.title || '' }
  }

  // Normalize URL (add https:// if no protocol)
  let normalizedUrl = url
  if (!url.match(/^[a-zA-Z]+:\/\//)) {
    normalizedUrl = 'https://' + url
  }

  // Navigate to URL
  await chrome.tabs.update(tabId, { url: normalizedUrl })
  await new Promise(resolve => setTimeout(resolve, 100))

  const tab = await chrome.tabs.get(tabId)
  return {
    id: tab.id!,
    url: tab.url || '',
    title: tab.title || '',
    status: tab.status
  }
}

/**
 * resize_window - Resize browser window
 */
async function resizeWindow(params: {
  width: number
  height: number
  tabId: number
}): Promise<{
  windowId: number
  width: number
  height: number
  state: string
}> {
  const { width, height, tabId } = params

  if (!tabId) {
    throw new Error('tabId is required')
  }

  if (!width || !height) {
    throw new Error('width and height are required')
  }

  // Get the window ID for this tab
  const tab = await chrome.tabs.get(tabId)
  const windowId = tab.windowId

  await chrome.windows.update(windowId, {
    width: Math.round(width),
    height: Math.round(height)
  })

  const window = await chrome.windows.get(windowId)
  return {
    windowId: window.id!,
    width: window.width || 0,
    height: window.height || 0,
    state: window.state || 'normal'
  }
}

/**
 * web_fetch - Fetch content from a URL
 */
async function webFetch(params: { url: string }): Promise<{
  url: string
  status: number
  statusText: string
  contentType: string
  content: string
}> {
  const { url } = params

  if (!url) {
    throw new Error('url is required')
  }

  try {
    const response = await fetch(url)
    const contentType = response.headers.get('content-type') || ''

    let content: string
    if (contentType.includes('application/json')) {
      const json = await response.json()
      content = JSON.stringify(json, null, 2)
    } else {
      content = await response.text()
    }

    // Truncate content if too large
    const maxLength = 50000
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n...[truncated]'
    }

    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      contentType,
      content
    }
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${(err as Error).message}`)
  }
}

/**
 * Register all tab tools
 */
export function registerTabTools(): void {
  registerTool('tabs_context', tabsContext)
  registerTool('tabs_create', tabsCreate as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('navigate', navigate as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('resize_window', resizeWindow as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('web_fetch', webFetch as (params: Record<string, unknown>) => Promise<unknown>)
}
