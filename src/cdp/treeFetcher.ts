/**
 * CDP Tree Fetcher
 *
 * Fetches DOM, DOMSnapshot, and Accessibility trees in parallel.
 * This is the browser-use approach for getting comprehensive page data.
 */

import * as session from './sessionManager'
import type {
  CDPDOMNode,
  CDPDOMDocument,
  CDPFrameTree,
  CDPAXNode,
  CDPAXTree,
  CDPSnapshot
} from './client'

// ============================================================================
// Types
// ============================================================================

export interface TreeFetchResult {
  dom: CDPDOMNode
  snapshot: CDPSnapshot
  axTrees: Map<string, CDPAXNode[]>  // frameId -> AX nodes
  frameTree: CDPFrameTree
}

export interface FetchOptions {
  // Include all computed styles (slower but more complete)
  includeComputedStyles?: boolean
  // Depth limit for DOM traversal (-1 for unlimited)
  depth?: number
  // Pierce shadow DOM
  pierce?: boolean
}

const DEFAULT_OPTIONS: FetchOptions = {
  includeComputedStyles: true,
  depth: -1,
  pierce: true
}

// ============================================================================
// Frame Discovery
// ============================================================================

/**
 * Get all frame IDs from frame tree (recursive)
 */
function extractFrameIds(tree: CDPFrameTree): string[] {
  const ids = [tree.frame.id]

  if (tree.childFrames) {
    for (const child of tree.childFrames) {
      ids.push(...extractFrameIds(child))
    }
  }

  return ids
}

/**
 * Fetch frame tree from Page domain
 */
async function fetchFrameTree(tabId: number): Promise<CDPFrameTree> {
  // Enable Page domain first
  await session.enableDomain(tabId, 'Page')

  const result = await session.send<{ frameTree: CDPFrameTree }>(
    tabId,
    'Page.getFrameTree',
    {}
  )

  return result.frameTree
}

// ============================================================================
// DOM Fetching
// ============================================================================

/**
 * Fetch full DOM tree with shadow DOM piercing
 */
async function fetchDOMTree(
  tabId: number,
  options: FetchOptions
): Promise<CDPDOMNode> {
  // Enable DOM domain
  await session.enableDomain(tabId, 'DOM')

  const result = await session.send<CDPDOMDocument>(
    tabId,
    'DOM.getDocument',
    {
      depth: options.depth ?? -1,
      pierce: options.pierce ?? true
    }
  )

  return result.root
}

// ============================================================================
// Snapshot Fetching
// ============================================================================

/**
 * Fetch DOM snapshot with layout info
 */
async function fetchSnapshot(
  tabId: number,
  options: FetchOptions
): Promise<CDPSnapshot> {
  // Computed styles to capture
  const computedStyles = options.includeComputedStyles
    ? [
        'display',
        'visibility',
        'opacity',
        'cursor',
        'pointer-events',
        'position',
        'z-index',
        'overflow',
        'transform'
      ]
    : ['display', 'visibility', 'opacity', 'cursor']

  const result = await session.send<CDPSnapshot>(
    tabId,
    'DOMSnapshot.captureSnapshot',
    {
      computedStyles,
      includePaintOrder: true,
      includeDOMRects: true
    }
  )

  return result
}

// ============================================================================
// Accessibility Tree Fetching
// ============================================================================

/**
 * Fetch AX tree for a single frame
 */
async function fetchFrameAXTree(
  tabId: number,
  frameId: string
): Promise<CDPAXNode[]> {
  try {
    const result = await session.send<CDPAXTree>(
      tabId,
      'Accessibility.getFullAXTree',
      { frameId }
    )
    return result.nodes || []
  } catch (err) {
    // Some frames may not be accessible (detached, cross-origin without permission, etc.)
    console.warn(`CDP: Failed to get AX tree for frame ${frameId}:`, err)
    return []
  }
}

/**
 * Fetch AX trees for all frames in parallel
 */
async function fetchAllAXTrees(
  tabId: number,
  frameTree: CDPFrameTree
): Promise<Map<string, CDPAXNode[]>> {
  // Enable Accessibility domain
  await session.enableDomain(tabId, 'Accessibility')

  const frameIds = extractFrameIds(frameTree)

  // Fetch all frame AX trees in parallel
  const results = await Promise.all(
    frameIds.map(async frameId => {
      const nodes = await fetchFrameAXTree(tabId, frameId)
      return { frameId, nodes }
    })
  )

  // Build map
  const axTrees = new Map<string, CDPAXNode[]>()
  for (const { frameId, nodes } of results) {
    if (nodes.length > 0) {
      axTrees.set(frameId, nodes)
    }
  }

  return axTrees
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Fetch all three trees in parallel
 *
 * This is the main entry point - gets DOM, Snapshot, and AX trees
 * for the entire page including all frames.
 */
export async function fetchAllTrees(
  tabId: number,
  options: FetchOptions = {}
): Promise<TreeFetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return session.withSession(tabId, async () => {
    // First get frame tree (needed for AX tree fetching)
    const frameTree = await fetchFrameTree(tabId)

    // Then fetch DOM, Snapshot, and all AX trees in parallel
    const [dom, snapshot, axTrees] = await Promise.all([
      fetchDOMTree(tabId, opts),
      fetchSnapshot(tabId, opts),
      fetchAllAXTrees(tabId, frameTree)
    ])

    return { dom, snapshot, axTrees, frameTree }
  })
}

/**
 * Fetch only the AX tree (lighter weight for some operations)
 */
export async function fetchAXTreeOnly(
  tabId: number
): Promise<Map<string, CDPAXNode[]>> {
  return session.withSession(tabId, async () => {
    const frameTree = await fetchFrameTree(tabId)
    return fetchAllAXTrees(tabId, frameTree)
  })
}

/**
 * Fetch AX node for a specific element by backendNodeId
 *
 * This is more efficient than fetching the full tree when you
 * only need info about one element.
 */
export async function fetchAXNodeForElement(
  tabId: number,
  backendNodeId: number
): Promise<CDPAXNode | null> {
  return session.withSession(tabId, async () => {
    await session.enableDomain(tabId, 'Accessibility')

    try {
      const result = await session.send<{ nodes: CDPAXNode[] }>(
        tabId,
        'Accessibility.queryAXTree',
        {
          backendNodeId,
          accessibleName: ''  // Get regardless of name
        }
      )

      return result.nodes?.[0] || null
    } catch (err) {
      console.warn(`CDP: Failed to get AX node for backendNodeId ${backendNodeId}:`, err)
      return null
    }
  })
}

/**
 * Get current bounding box for an element
 */
export async function getElementBounds(
  tabId: number,
  backendNodeId: number
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return session.withSession(tabId, async () => {
    await session.enableDomain(tabId, 'DOM')

    try {
      const result = await session.send<{ model: { content: number[] } }>(
        tabId,
        'DOM.getBoxModel',
        { backendNodeId }
      )

      const content = result.model.content
      // content is [x1, y1, x2, y2, x3, y3, x4, y4] - quadrilateral
      // For a simple rect, we take the bounding box
      const xs = [content[0], content[2], content[4], content[6]]
      const ys = [content[1], content[3], content[5], content[7]]

      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const width = Math.max(...xs) - x
      const height = Math.max(...ys) - y

      return { x, y, width, height }
    } catch (err) {
      console.warn(`CDP: Failed to get box model for backendNodeId ${backendNodeId}:`, err)
      return null
    }
  })
}
