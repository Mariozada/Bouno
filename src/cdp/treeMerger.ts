/**
 * CDP Tree Merger
 *
 * Merges DOM, DOMSnapshot, and Accessibility trees into a unified
 * EnhancedElement structure using backendNodeId as the correlation key.
 *
 * This is the core of the browser-use approach.
 */

import type { CDPDOMNode, CDPAXNode, CDPSnapshot } from './client'
import type { TreeFetchResult } from './treeFetcher'
import type { Bounds, AXStateProperties, ElementRef, CompoundChild } from '@shared/types'

// ============================================================================
// Types
// ============================================================================

/**
 * Enhanced AX node - processed from CDP format
 */
export interface EnhancedAXNode {
  axNodeId: string
  ignored: boolean
  role: string
  name: string
  description: string
  properties: AXStateProperties
}

/**
 * Layout info extracted from snapshot
 */
export interface LayoutInfo {
  bounds: Bounds
  visible: boolean
  inViewport: boolean
  paintOrder: number
  computedStyles: Record<string, string>
}

/**
 * Enhanced element - merged DOM + Layout + AX
 */
export interface EnhancedElement {
  // Identity
  backendNodeId: number
  ref: string

  // DOM data
  tag: string
  nodeType: number
  attributes: Record<string, string>

  // Layout data
  bounds?: Bounds
  visible: boolean
  inViewport: boolean
  paintOrder: number

  // AX data (null if no AX node or ignored)
  ax: EnhancedAXNode | null

  // Computed
  interactive: boolean

  // Form specifics
  value?: string
  inputType?: string
  placeholder?: string

  // Link specifics
  href?: string

  // Hierarchy
  children: EnhancedElement[]
  compoundChildren?: CompoundChild[]
}

// ============================================================================
// Reference Management
// ============================================================================

// backendNodeId -> ref mapping
const backendToRef = new Map<number, string>()
const refToBackend = new Map<string, number>()
let refCounter = 0

/**
 * Assign or get existing ref for a backendNodeId
 */
export function assignRef(backendNodeId: number): string {
  const existing = backendToRef.get(backendNodeId)
  if (existing) return existing

  const ref = `ref_${++refCounter}`
  backendToRef.set(backendNodeId, ref)
  refToBackend.set(ref, backendNodeId)
  return ref
}

/**
 * Get backendNodeId for a ref
 */
export function getBackendNodeId(ref: string): number | undefined {
  return refToBackend.get(ref)
}

/**
 * Clear all refs (on page navigation)
 */
export function clearRefs(): void {
  backendToRef.clear()
  refToBackend.clear()
  refCounter = 0
}

/**
 * Get ref count
 */
export function getRefCount(): number {
  return backendToRef.size
}

// ============================================================================
// AX Node Processing
// ============================================================================

/**
 * Extract role value from CDP AX node
 */
function extractRole(axNode: CDPAXNode): string {
  if (!axNode.role) return 'generic'
  return axNode.role.value || 'generic'
}

/**
 * Extract accessible name from CDP AX node
 */
function extractName(axNode: CDPAXNode): string {
  if (!axNode.name) return ''
  return String(axNode.name.value || '')
}

/**
 * Extract description from CDP AX node
 */
function extractDescription(axNode: CDPAXNode): string {
  if (!axNode.description) return ''
  return String(axNode.description.value || '')
}

/**
 * Extract state properties from CDP AX node properties
 */
function extractStateProperties(axNode: CDPAXNode): AXStateProperties {
  const states: AXStateProperties = {}

  if (!axNode.properties) return states

  for (const prop of axNode.properties) {
    const value = prop.value?.value

    switch (prop.name) {
      case 'focusable':
        states.focusable = Boolean(value)
        break
      case 'focused':
        states.focused = Boolean(value)
        break
      case 'editable':
        states.editable = Boolean(value)
        break
      case 'readonly':
        states.readonly = Boolean(value)
        break
      case 'disabled':
        states.disabled = Boolean(value)
        break
      case 'checked':
        states.checked = value === 'mixed' ? 'mixed' : Boolean(value)
        break
      case 'pressed':
        states.pressed = value === 'mixed' ? 'mixed' : Boolean(value)
        break
      case 'selected':
        states.selected = Boolean(value)
        break
      case 'expanded':
        states.expanded = Boolean(value)
        break
      case 'required':
        states.required = Boolean(value)
        break
      case 'invalid':
        states.invalid = value === 'true' || value === true
        break
      case 'valuemin':
        states.valueMin = Number(value)
        break
      case 'valuemax':
        states.valueMax = Number(value)
        break
      case 'valuenow':
        states.valueNow = Number(value)
        break
      case 'valuetext':
        states.valueText = String(value)
        break
      case 'busy':
        states.busy = Boolean(value)
        break
      case 'hidden':
        states.hidden = Boolean(value)
        break
      case 'modal':
        states.modal = Boolean(value)
        break
    }
  }

  return states
}

/**
 * Convert CDP AX node to enhanced format
 */
function enhanceAXNode(axNode: CDPAXNode): EnhancedAXNode {
  return {
    axNodeId: axNode.nodeId,
    ignored: axNode.ignored,
    role: extractRole(axNode),
    name: extractName(axNode),
    description: extractDescription(axNode),
    properties: extractStateProperties(axNode)
  }
}

// ============================================================================
// Snapshot Processing
// ============================================================================

/**
 * Build layout lookup from snapshot
 */
function buildLayoutLookup(snapshot: CDPSnapshot): Map<number, LayoutInfo> {
  const lookup = new Map<number, LayoutInfo>()

  if (!snapshot.documents || snapshot.documents.length === 0) {
    return lookup
  }

  // Note: strings array is available at snapshot.strings for string lookups if needed

  for (const doc of snapshot.documents) {
    const nodes = doc.nodes
    const layout = doc.layout

    if (!nodes.backendNodeId || !layout.nodeIndex || !layout.bounds) {
      continue
    }

    // Build index mapping: layout index -> node index
    const layoutToNode = new Map<number, number>()
    for (let i = 0; i < layout.nodeIndex.length; i++) {
      layoutToNode.set(i, layout.nodeIndex[i])
    }

    // Extract layout info for each node that has it
    for (let layoutIdx = 0; layoutIdx < layout.bounds.length; layoutIdx++) {
      const nodeIdx = layoutToNode.get(layoutIdx)
      if (nodeIdx === undefined) continue

      const backendNodeId = nodes.backendNodeId[nodeIdx]
      if (!backendNodeId) continue

      const bounds = layout.bounds[layoutIdx]
      if (!bounds || bounds.length < 4) continue

      const [x, y, width, height] = bounds

      // Compute visibility
      const visible = width > 0 && height > 0

      // Check if in viewport (assuming standard viewport)
      const inViewport = visible &&
        x < window.innerWidth &&
        y < window.innerHeight &&
        x + width > 0 &&
        y + height > 0

      // Paint order
      const paintOrder = layout.paintOrders?.[layoutIdx] ?? 0

      // Computed styles (if available)
      const computedStyles: Record<string, string> = {}
      // TODO: Extract from layout.styles if needed

      lookup.set(backendNodeId, {
        bounds: { x, y, width, height },
        visible,
        inViewport,
        paintOrder,
        computedStyles
      })
    }
  }

  return lookup
}

// ============================================================================
// Interactivity Detection
// ============================================================================

/** Roles that are inherently interactive */
const INTERACTIVE_ROLES = new Set([
  'button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox',
  'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton',
  'switch', 'tab', 'textbox', 'treeitem'
])

/** Tags that are inherently interactive */
const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'details', 'summary'
])

/**
 * Determine if element is interactive based on AX properties
 */
function isInteractive(
  tag: string,
  attributes: Record<string, string>,
  ax: EnhancedAXNode | null,
  visible: boolean
): boolean {
  // Must be visible
  if (!visible) return false

  // AX property checks (authoritative)
  if (ax && !ax.ignored) {
    const props = ax.properties

    // Disabled/hidden = NOT interactive
    if (props.disabled) return false
    if (props.hidden) return false

    // These properties = IS interactive
    if (props.focusable) return true
    if (props.editable) return true

    // Having toggle state = IS interactive
    if (props.checked !== undefined) return true
    if (props.expanded !== undefined) return true
    if (props.pressed !== undefined) return true
    if (props.selected !== undefined) return true

    // Role-based check
    if (INTERACTIVE_ROLES.has(ax.role)) return true
  }

  // Tag-based checks
  if (INTERACTIVE_TAGS.has(tag)) {
    // Links need href
    if (tag === 'a' && !attributes.href) {
      // Fall through to other checks
    } else {
      return true
    }
  }

  // Attribute checks
  if (attributes.onclick) return true
  if (attributes.onmousedown) return true
  if (attributes.tabindex && attributes.tabindex !== '-1') return true
  if (attributes.contenteditable === 'true') return true

  return false
}

// ============================================================================
// DOM Tree Walking
// ============================================================================

/** Tags to skip when building tree */
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template'])

/**
 * Parse attributes array from CDP format to object
 */
function parseAttributes(attrArray?: string[]): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!attrArray) return attrs

  for (let i = 0; i < attrArray.length; i += 2) {
    attrs[attrArray[i]] = attrArray[i + 1]
  }
  return attrs
}

/**
 * Get compound children for special input types
 */
function getCompoundChildren(tag: string, inputType?: string, value?: string): CompoundChild[] {
  const children: CompoundChild[] = []

  if (tag === 'input') {
    switch (inputType) {
      case 'file':
        children.push({ role: 'button', name: 'Choose File' })
        children.push({ role: 'text', name: 'Selected File', valueNow: value || 'No file chosen' })
        break
      case 'date':
      case 'datetime-local':
        children.push({ role: 'spinbutton', name: 'Month' })
        children.push({ role: 'spinbutton', name: 'Day' })
        children.push({ role: 'spinbutton', name: 'Year' })
        children.push({ role: 'button', name: 'Show Calendar' })
        break
      case 'time':
        children.push({ role: 'spinbutton', name: 'Hour' })
        children.push({ role: 'spinbutton', name: 'Minute' })
        break
      case 'color':
        children.push({ role: 'button', name: 'Color Picker', valueNow: value })
        break
      case 'number':
        children.push({ role: 'textbox', name: 'Value', valueNow: value })
        children.push({ role: 'button', name: 'Increment' })
        children.push({ role: 'button', name: 'Decrement' })
        break
    }
  }

  return children
}

/**
 * Recursively build enhanced tree from DOM node
 */
function buildEnhancedTree(
  domNode: CDPDOMNode,
  axLookup: Map<number, CDPAXNode>,
  layoutLookup: Map<number, LayoutInfo>,
  depth: number,
  maxDepth: number,
  filter: 'all' | 'interactive'
): EnhancedElement | EnhancedElement[] | null {
  // Depth limit
  if (depth > maxDepth) return null

  // Skip non-element nodes
  if (domNode.nodeType !== 1) return null

  const tag = domNode.localName?.toLowerCase() || domNode.nodeName?.toLowerCase() || ''

  // Skip script/style/etc
  if (SKIP_TAGS.has(tag)) return null

  const backendNodeId = domNode.backendNodeId
  const attributes = parseAttributes(domNode.attributes)

  // Get AX and layout info
  const axNode = axLookup.get(backendNodeId)
  const layout = layoutLookup.get(backendNodeId)

  // Build enhanced AX node
  const ax = axNode ? enhanceAXNode(axNode) : null

  // Visibility
  const visible = layout?.visible ?? true
  const inViewport = layout?.inViewport ?? false

  // Interactivity
  const interactive = isInteractive(tag, attributes, ax, visible)

  // For interactive filter, bubble up children of non-interactive elements
  if (filter === 'interactive' && !interactive) {
    const childResults: EnhancedElement[] = []

    // Regular children
    if (domNode.children) {
      for (const child of domNode.children) {
        const result = buildEnhancedTree(child, axLookup, layoutLookup, depth, maxDepth, filter)
        if (result) {
          if (Array.isArray(result)) {
            childResults.push(...result)
          } else {
            childResults.push(result)
          }
        }
      }
    }

    // Shadow DOM children
    if (domNode.shadowRoots) {
      for (const shadowRoot of domNode.shadowRoots) {
        if (shadowRoot.children) {
          for (const child of shadowRoot.children) {
            const result = buildEnhancedTree(child, axLookup, layoutLookup, depth, maxDepth, filter)
            if (result) {
              if (Array.isArray(result)) {
                childResults.push(...result)
              } else {
                childResults.push(result)
              }
            }
          }
        }
      }
    }

    // Content document (iframes)
    if (domNode.contentDocument) {
      const result = buildEnhancedTree(domNode.contentDocument, axLookup, layoutLookup, depth, maxDepth, filter)
      if (result) {
        if (Array.isArray(result)) {
          childResults.push(...result)
        } else {
          childResults.push(result)
        }
      }
    }

    return childResults.length > 0 ? childResults : null
  }

  // Build the element
  const ref = assignRef(backendNodeId)
  const inputType = tag === 'input' ? (attributes.type || 'text').toLowerCase() : undefined
  const value = attributes.value
  const placeholder = attributes.placeholder

  const element: EnhancedElement = {
    backendNodeId,
    ref,
    tag,
    nodeType: domNode.nodeType,
    attributes,
    bounds: layout?.bounds,
    visible,
    inViewport,
    paintOrder: layout?.paintOrder ?? 0,
    ax,
    interactive,
    children: []
  }

  // Form-specific fields
  if (inputType) element.inputType = inputType
  if (value && inputType !== 'password') element.value = value
  if (placeholder) element.placeholder = placeholder

  // Link href
  if (tag === 'a' && attributes.href) {
    element.href = attributes.href
  }

  // Compound children
  const compoundChildren = getCompoundChildren(tag, inputType, value)
  if (compoundChildren.length > 0) {
    element.compoundChildren = compoundChildren
  }

  // Process children
  if (depth < maxDepth) {
    // Regular children
    if (domNode.children) {
      for (const child of domNode.children) {
        const result = buildEnhancedTree(child, axLookup, layoutLookup, depth + 1, maxDepth, filter)
        if (result) {
          if (Array.isArray(result)) {
            element.children.push(...result)
          } else {
            element.children.push(result)
          }
        }
      }
    }

    // Shadow DOM children (pierced)
    if (domNode.shadowRoots) {
      for (const shadowRoot of domNode.shadowRoots) {
        if (shadowRoot.children) {
          for (const child of shadowRoot.children) {
            const result = buildEnhancedTree(child, axLookup, layoutLookup, depth + 1, maxDepth, filter)
            if (result) {
              if (Array.isArray(result)) {
                element.children.push(...result)
              } else {
                element.children.push(result)
              }
            }
          }
        }
      }
    }

    // Content document (iframes)
    if (domNode.contentDocument) {
      const result = buildEnhancedTree(domNode.contentDocument, axLookup, layoutLookup, depth + 1, maxDepth, filter)
      if (result) {
        if (Array.isArray(result)) {
          element.children.push(...result)
        } else {
          element.children.push(result)
        }
      }
    }
  }

  return element
}

// ============================================================================
// Main API
// ============================================================================

export interface MergeOptions {
  depth?: number
  filter?: 'all' | 'interactive'
  clearRefsFirst?: boolean
}

/**
 * Merge all trees into enhanced element tree
 */
export function mergeToEnhancedTree(
  fetchResult: TreeFetchResult,
  options: MergeOptions = {}
): EnhancedElement | EnhancedElement[] | null {
  const { depth = 15, filter = 'all', clearRefsFirst = true } = options

  // Clear refs if starting fresh
  if (clearRefsFirst) {
    clearRefs()
  }

  // Build AX lookup by backendNodeId
  const axLookup = new Map<number, CDPAXNode>()
  for (const [_frameId, nodes] of fetchResult.axTrees) {
    for (const node of nodes) {
      if (node.backendDOMNodeId) {
        axLookup.set(node.backendDOMNodeId, node)
      }
    }
  }

  // Build layout lookup
  const layoutLookup = buildLayoutLookup(fetchResult.snapshot)

  // Find body element to start from
  let root = fetchResult.dom
  if (root.nodeName === '#document' && root.children) {
    const html = root.children.find(c => c.localName === 'html')
    if (html?.children) {
      const body = html.children.find(c => c.localName === 'body')
      if (body) root = body
    }
  }

  // Build enhanced tree
  return buildEnhancedTree(root, axLookup, layoutLookup, 0, depth, filter)
}

/**
 * Convert enhanced element to ElementRef format (for compatibility)
 */
export function toElementRef(element: EnhancedElement): ElementRef {
  const ref: ElementRef = {
    ref: element.ref,
    tag: element.tag,
    role: element.ax?.role || 'generic',
    visible: element.visible,
    inViewport: element.inViewport,
    interactive: element.interactive
  }

  if (element.ax?.name) ref.name = element.ax.name
  if (element.ax?.description) ref.description = element.ax.description
  if (element.bounds) ref.bounds = element.bounds
  if (element.ax?.ignored) ref.ignored = true

  // State properties
  if (element.ax && Object.keys(element.ax.properties).length > 0) {
    ref.states = element.ax.properties
  }

  // Form fields
  if (element.inputType) ref.inputType = element.inputType
  if (element.value) ref.value = element.value
  if (element.placeholder) ref.placeholder = element.placeholder

  // Link
  if (element.href) ref.href = element.href

  // ID and class
  if (element.attributes.id) ref.id = element.attributes.id
  if (element.attributes.class) ref.className = element.attributes.class.slice(0, 100)

  // Compound children
  if (element.compoundChildren) ref.compoundChildren = element.compoundChildren

  // Children
  if (element.children.length > 0) {
    ref.children = element.children.map(toElementRef)
  }

  return ref
}
