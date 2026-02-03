/**
 * Page Reading Tools
 * Handles: read_page, get_page_text, find
 *
 * Uses CDP (Chrome DevTools Protocol) for accurate accessibility tree,
 * with fallback to content script when CDP is unavailable.
 */

import { registerTool } from './registry'
import { MessageTypes } from '@shared/messages'
import { DEFAULT_TREE_DEPTH, MAX_OUTPUT_CHARS } from '@shared/constants'
import type { ElementRef } from '@shared/types'

// CDP imports
import {
  fetchAllTrees,
  mergeToEnhancedTree,
  toElementRef,
  getRefCount,
  session
} from '@cdp/index'

// ============================================================================
// Content Script Fallback
// ============================================================================

/**
 * Send message to content script and wait for response
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
 * Read page via content script (fallback)
 */
async function readPageViaContentScript(
  tabId: number,
  params: { depth?: number; filter?: 'all' | 'interactive'; ref_id?: string }
): Promise<{ tree?: ElementRef | ElementRef[] | null; refCount?: number; source: 'content_script' }> {
  const result = await sendToContentScript<{
    tree?: ElementRef | ElementRef[] | null
    refCount?: number
    error?: string
  }>(tabId, {
    type: MessageTypes.READ_PAGE,
    depth: params.depth,
    filter: params.filter,
    ref_id: params.ref_id
  })

  return {
    ...result,
    source: 'content_script'
  }
}

// ============================================================================
// CDP Implementation
// ============================================================================

/**
 * Check if CDP is available for a tab
 */
async function canUseCDP(tabId: number): Promise<boolean> {
  try {
    // Try to get tab info - some special pages (chrome://, etc.) don't allow debugging
    const tab = await chrome.tabs.get(tabId)

    // Skip chrome:// and other special URLs
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Read page via CDP (primary method)
 */
async function readPageViaCDP(
  tabId: number,
  params: { depth?: number; filter?: 'all' | 'interactive' }
): Promise<{
  tree?: ElementRef | ElementRef[] | null
  refCount?: number
  source: 'cdp'
  truncated?: boolean
  characterCount?: number
  suggestion?: string
}> {
  const { depth = DEFAULT_TREE_DEPTH, filter = 'all' } = params

  // Fetch all three trees in parallel
  const fetchResult = await fetchAllTrees(tabId, {
    depth: -1,  // Fetch full DOM, we'll limit during merge
    pierce: true,
    includeComputedStyles: true
  })

  // Merge into enhanced tree
  const enhancedTree = mergeToEnhancedTree(fetchResult, {
    depth,
    filter,
    clearRefsFirst: true
  })

  // Convert to ElementRef format for compatibility
  let tree: ElementRef | ElementRef[] | null = null
  if (enhancedTree) {
    if (Array.isArray(enhancedTree)) {
      tree = enhancedTree.map(toElementRef)
    } else {
      tree = toElementRef(enhancedTree)
    }
  }

  // Check output size
  const json = JSON.stringify(tree)
  if (json.length > MAX_OUTPUT_CHARS) {
    return {
      tree: null,
      refCount: getRefCount(),
      source: 'cdp',
      truncated: true,
      characterCount: json.length,
      suggestion: `Output exceeds ${MAX_OUTPUT_CHARS} characters. Try depth: ${Math.max(1, Math.floor(depth / 2))} or filter: 'interactive'`
    }
  }

  return {
    tree,
    refCount: getRefCount(),
    source: 'cdp'
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * read_page - Get accessibility tree representation of page elements
 *
 * Uses CDP when available for accurate AX tree, shadow DOM, and iframe support.
 * Falls back to content script when CDP is unavailable.
 */
async function readPage(params: {
  tabId: number
  depth?: number
  filter?: 'all' | 'interactive'
  ref_id?: string
  force_content_script?: boolean  // For testing/debugging
}): Promise<unknown> {
  const { tabId, depth = DEFAULT_TREE_DEPTH, filter = 'all', ref_id, force_content_script = false } = params

  if (!tabId) {
    throw new Error('tabId is required')
  }

  // If ref_id is provided, we need to use content script (CDP refs are different)
  // TODO: Support ref_id with CDP by storing backendNodeId mapping
  if (ref_id) {
    return readPageViaContentScript(tabId, { depth, filter, ref_id })
  }

  // Try CDP first (unless forced to use content script)
  if (!force_content_script) {
    const cdpAvailable = await canUseCDP(tabId)

    if (cdpAvailable) {
      try {
        const result = await readPageViaCDP(tabId, { depth, filter })
        console.log('BrowseRun: read_page via CDP succeeded')
        return result
      } catch (err) {
        console.warn('BrowseRun: CDP failed, falling back to content script:', err)
        // Fall through to content script
      }
    }
  }

  // Fallback to content script
  console.log('BrowseRun: read_page via content script')
  return readPageViaContentScript(tabId, { depth, filter })
}

/**
 * get_page_text - Extract raw text content from the page
 */
async function getPageText(params: { tabId: number }): Promise<unknown> {
  const { tabId } = params

  if (!tabId) {
    throw new Error('tabId is required')
  }

  // This always uses content script (simple text extraction)
  return sendToContentScript(tabId, {
    type: MessageTypes.GET_PAGE_TEXT
  })
}

/**
 * find - Find elements using natural language query
 */
async function find(params: { query: string; tabId: number }): Promise<unknown> {
  const { query, tabId } = params

  if (!tabId) {
    throw new Error('tabId is required')
  }

  if (!query) {
    throw new Error('query is required')
  }

  // This always uses content script (search logic is there)
  return sendToContentScript(tabId, {
    type: MessageTypes.FIND_ELEMENTS,
    query
  })
}

/**
 * Detach CDP from a tab (for cleanup)
 */
export async function detachCDP(tabId: number): Promise<void> {
  await session.forceDetach(tabId)
}

/**
 * Register page reading tools
 */
export function registerPageReadingTools(): void {
  registerTool('read_page', readPage as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('get_page_text', getPageText as (params: Record<string, unknown>) => Promise<unknown>)
  registerTool('find', find as (params: Record<string, unknown>) => Promise<unknown>)
}
