/**
 * CDP Module
 *
 * Chrome DevTools Protocol integration for accessing the real
 * accessibility tree, shadow DOM, and cross-origin iframes.
 */

// Client
export * from './client'

// Session management
export * as session from './sessionManager'

// Tree operations
export { fetchAllTrees, fetchAXTreeOnly, fetchAXNodeForElement, getElementBounds } from './treeFetcher'
export type { TreeFetchResult, FetchOptions } from './treeFetcher'

// Tree merging
export {
  mergeToEnhancedTree,
  toElementRef,
  assignRef,
  getBackendNodeId,
  clearRefs,
  getRefCount
} from './treeMerger'
export type { EnhancedElement, EnhancedAXNode, LayoutInfo, MergeOptions } from './treeMerger'
