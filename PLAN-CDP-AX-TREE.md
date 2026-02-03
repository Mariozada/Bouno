# Implementation Plan: CDP-based Accessibility Tree

## Overview

Add Chrome DevTools Protocol (CDP) support to BrowseRun to fetch the **real** accessibility tree,
matching browser-use's approach. This gives us Chrome-computed accessible names, proper shadow DOM
piercing, iframe support, and accurate state properties.

---

## Phase 1: CDP Infrastructure

### 1.1 Add Debugger Permission

**File:** `public/manifest.json`

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "sidePanel",
    "scripting",
    "webRequest",
    "debugger"  // NEW: Required for CDP access
  ]
}
```

**Note:** The `debugger` permission shows a warning bar "BrowseRun started debugging this tab".
We'll need to attach/detach strategically to minimize user disruption.

### 1.2 Create CDP Client Module

**New File:** `src/cdp/client.ts`

Purpose: Wrapper around `chrome.debugger` API for making CDP calls.

```typescript
interface CDPClient {
  attach(tabId: number): Promise<void>
  detach(tabId: number): Promise<void>
  send<T>(tabId: number, method: string, params?: object): Promise<T>
  isAttached(tabId: number): boolean
}
```

Key methods needed:
- `DOM.getDocument` - Full DOM tree with shadow DOM piercing
- `DOMSnapshot.captureSnapshot` - Layout info (bounds, visibility, paint order)
- `Accessibility.getFullAXTree` - Real AX tree per frame
- `DOM.describeNode` - Get node details by backendNodeId
- `DOM.resolveNode` - Convert backendNodeId to objectId for scripting

### 1.3 CDP Session Manager

**New File:** `src/cdp/sessionManager.ts`

Purpose: Manage debugger attachment lifecycle.

```typescript
interface SessionManager {
  // Attach with auto-detach after timeout
  withSession<T>(tabId: number, fn: (client: CDPClient) => Promise<T>): Promise<T>

  // Force detach (user closes extension, navigation, etc.)
  forceDetach(tabId: number): void
}
```

Design decisions:
- Auto-detach after 30 seconds of inactivity to remove warning bar
- Re-attach transparently when needed
- Handle tab navigation (detach on URL change to different origin)

---

## Phase 2: Three-Tree Fetch Strategy

### 2.1 Parallel Tree Fetching

**New File:** `src/cdp/treeFetcher.ts`

Browser-use fetches three trees in parallel:

```typescript
interface TreeFetchResult {
  domTree: DOMNode[]
  snapshot: DOMSnapshot
  axTree: AXNode[]
  frameAxTrees: Map<string, AXNode[]>  // Per-frame AX trees
}

async function fetchAllTrees(tabId: number): Promise<TreeFetchResult> {
  const [domResult, snapshotResult, axResult] = await Promise.all([
    cdp.send(tabId, 'DOM.getDocument', { depth: -1, pierce: true }),
    cdp.send(tabId, 'DOMSnapshot.captureSnapshot', {
      computedStyles: ['display', 'visibility', 'opacity', 'cursor', 'pointer-events'],
      includePaintOrder: true,
      includeDOMRects: true,
    }),
    fetchAllFrameAxTrees(tabId),  // Iterate all frames
  ])

  return { domTree, snapshot, axTree, frameAxTrees }
}
```

### 2.2 Frame Discovery and AX Tree Merging

**Critical:** AX tree is per-frame. Must fetch for each iframe.

```typescript
async function fetchAllFrameAxTrees(tabId: number): Promise<Map<string, AXNode[]>> {
  // 1. Get all frame IDs from Page.getFrameTree
  const frameTree = await cdp.send(tabId, 'Page.getFrameTree', {})
  const frameIds = extractAllFrameIds(frameTree)

  // 2. Fetch AX tree for each frame in parallel
  const axTrees = await Promise.all(
    frameIds.map(frameId =>
      cdp.send(tabId, 'Accessibility.getFullAXTree', { frameId })
    )
  )

  // 3. Merge into single map
  return new Map(frameIds.map((id, i) => [id, axTrees[i].nodes]))
}
```

---

## Phase 3: Tree Merging with backendNodeId

### 3.1 Enhanced Node Types

**File:** `src/shared/types.ts` (modify)

```typescript
/**
 * Raw CDP AX Node (what Chrome returns)
 */
interface CDPAXNode {
  nodeId: string
  ignored: boolean
  role?: { type: string; value: string }
  name?: { type: string; value: string; sources: AXValueSource[] }
  description?: { type: string; value: string }
  properties?: AXProperty[]
  childIds?: string[]
  backendDOMNodeId?: number  // THE KEY - links to DOM node
}

/**
 * Enhanced AX Node (our processed version)
 */
interface EnhancedAXNode {
  axNodeId: string
  ignored: boolean
  role: string              // Extracted role value
  name: string              // Computed accessible name
  description: string
  properties: AXStateProperties  // Normalized state
}

/**
 * Enhanced Element - DOM + Layout + AX merged
 */
interface EnhancedElement {
  // Identity
  backendNodeId: number     // Stable CDP node ID
  ref: string               // Our reference ID (ref_1, etc.)

  // DOM data
  tag: string
  attributes: Record<string, string>

  // Layout data (from snapshot)
  bounds: Bounds
  visible: boolean
  inViewport: boolean
  paintOrder: number        // Z-index for layering

  // AX data (from real AX tree)
  ax: EnhancedAXNode | null  // null if ignored/no AX node

  // Computed
  interactive: boolean

  // Hierarchy
  children: EnhancedElement[]
}
```

### 3.2 Merge Algorithm

**New File:** `src/cdp/treeMerger.ts`

```typescript
function mergeToEnhancedTree(
  domTree: DOMNode[],
  snapshot: DOMSnapshot,
  axTree: AXNode[]
): EnhancedElement[] {

  // Step 1: Build O(1) lookup from AX tree by backendDOMNodeId
  const axLookup = new Map<number, CDPAXNode>()
  for (const axNode of axTree) {
    if (axNode.backendDOMNodeId) {
      axLookup.set(axNode.backendDOMNodeId, axNode)
    }
  }

  // Step 2: Build layout lookup from snapshot (also keyed by backendNodeId)
  const layoutLookup = buildLayoutLookup(snapshot)

  // Step 3: Walk DOM tree, enriching each node
  return walkDOMTree(domTree, (domNode) => {
    const backendNodeId = domNode.backendNodeId

    const axNode = axLookup.get(backendNodeId)
    const layout = layoutLookup.get(backendNodeId)

    return {
      backendNodeId,
      ref: assignRef(backendNodeId),  // Map backendNodeId to ref_N
      tag: domNode.nodeName.toLowerCase(),
      attributes: domNode.attributes,
      bounds: layout?.bounds,
      visible: layout?.visible ?? false,
      inViewport: layout?.inViewport ?? false,
      paintOrder: layout?.paintOrder ?? 0,
      ax: axNode ? enhanceAXNode(axNode) : null,
      interactive: computeInteractivity(domNode, axNode, layout),
      children: [],  // Filled by recursive walk
    }
  })
}
```

### 3.3 AX Node Enhancement

Extract and normalize AX properties:

```typescript
function enhanceAXNode(cdpNode: CDPAXNode): EnhancedAXNode {
  return {
    axNodeId: cdpNode.nodeId,
    ignored: cdpNode.ignored,
    role: cdpNode.role?.value || 'generic',
    name: cdpNode.name?.value || '',
    description: cdpNode.description?.value || '',
    properties: extractStateProperties(cdpNode.properties),
  }
}

function extractStateProperties(props: AXProperty[]): AXStateProperties {
  const states: AXStateProperties = {}

  for (const prop of props || []) {
    switch (prop.name) {
      case 'focusable': states.focusable = prop.value.value; break
      case 'focused': states.focused = prop.value.value; break
      case 'editable': states.editable = prop.value.value; break
      case 'disabled': states.disabled = prop.value.value; break
      case 'checked':
        states.checked = prop.value.value === 'mixed' ? 'mixed' : prop.value.value
        break
      case 'expanded': states.expanded = prop.value.value; break
      case 'pressed': states.pressed = prop.value.value; break
      case 'selected': states.selected = prop.value.value; break
      case 'required': states.required = prop.value.value; break
      case 'invalid': states.invalid = prop.value.value; break
      // Range properties
      case 'valuemin': states.valueMin = prop.value.value; break
      case 'valuemax': states.valueMax = prop.value.value; break
      case 'valuenow': states.valueNow = prop.value.value; break
      case 'valuetext': states.valueText = prop.value.value; break
    }
  }

  return states
}
```

---

## Phase 4: Enhanced Interactivity Detection

### 4.1 CDP-aware Interactivity Cascade

**New File:** `src/cdp/interactivity.ts`

Browser-use cascade adapted for our merged data:

```typescript
function isInteractive(
  element: EnhancedElement
): boolean {
  const { tag, attributes, ax, visible } = element

  // 1. Must be visible
  if (!visible) return false

  // 2. AX property quick checks (these are authoritative)
  if (ax) {
    // Disabled/hidden = NOT interactive
    if (ax.properties.disabled) return false
    if (ax.properties.hidden) return false

    // These properties = IS interactive
    if (ax.properties.focusable) return true
    if (ax.properties.editable) return true

    // Having toggle state = IS interactive
    if (ax.properties.checked !== undefined) return true
    if (ax.properties.expanded !== undefined) return true
    if (ax.properties.pressed !== undefined) return true
    if (ax.properties.selected !== undefined) return true
  }

  // 3. Tag-based checks
  const interactiveTags = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'details', 'summary'
  ])
  if (interactiveTags.has(tag)) {
    // Links need href
    if (tag === 'a' && !attributes.href) {
      // Fall through to other checks
    } else {
      return true
    }
  }

  // 4. Attribute checks
  if (attributes.onclick) return true
  if (attributes.tabindex && attributes.tabindex !== '-1') return true
  if (attributes.contenteditable === 'true') return true

  // 5. AX role-based checks
  if (ax) {
    const interactiveRoles = new Set([
      'button', 'checkbox', 'combobox', 'link', 'listbox', 'menu',
      'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
      'radio', 'scrollbar', 'searchbox', 'slider', 'spinbutton',
      'switch', 'tab', 'textbox', 'treeitem'
    ])
    if (interactiveRoles.has(ax.role)) return true
  }

  // 6. Visual heuristics (cursor from layout snapshot)
  // Already available from snapshot.computedStyles

  return false
}
```

---

## Phase 5: Reference System Update

### 5.1 backendNodeId-based References

**Modify:** `src/content/elementRefs.ts` → `src/cdp/elementRefs.ts`

```typescript
// Map ref_N ↔ backendNodeId (stable across CDP calls)
const refToBackendId = new Map<string, number>()
const backendIdToRef = new Map<number, string>()

let refCounter = 0

function assignRef(backendNodeId: number): string {
  // Return existing ref if we've seen this node
  if (backendIdToRef.has(backendNodeId)) {
    return backendIdToRef.get(backendNodeId)!
  }

  const ref = `ref_${++refCounter}`
  refToBackendId.set(ref, backendNodeId)
  backendIdToRef.set(backendNodeId, ref)

  return ref
}

// For action execution - resolve ref to a CDP target
async function resolveRefForAction(
  tabId: number,
  ref: string
): Promise<{ objectId: string; bounds: Bounds }> {
  const backendNodeId = refToBackendId.get(ref)
  if (!backendNodeId) throw new Error(`Unknown ref: ${ref}`)

  // Use CDP to resolve to objectId (for scripting) and get current bounds
  const { object } = await cdp.send(tabId, 'DOM.resolveNode', { backendNodeId })
  const { model } = await cdp.send(tabId, 'DOM.getBoxModel', { backendNodeId })

  return {
    objectId: object.objectId,
    bounds: {
      x: model.content[0],
      y: model.content[1],
      width: model.content[2] - model.content[0],
      height: model.content[5] - model.content[1],
    }
  }
}
```

---

## Phase 6: Action Execution via CDP

### 6.1 CDP-based Click/Type/Scroll

**New File:** `src/cdp/actions.ts`

Instead of dispatching DOM events (which can be blocked), use CDP input methods:

```typescript
async function executeClick(
  tabId: number,
  ref: string,
  options: { button?: 'left' | 'right', clickCount?: number }
): Promise<void> {
  const { bounds } = await resolveRefForAction(tabId, ref)

  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2

  // CDP input dispatch (bypasses JS event handlers if needed)
  await cdp.send(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x, y,
    button: options.button || 'left',
    clickCount: options.clickCount || 1,
  })

  await cdp.send(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x, y,
    button: options.button || 'left',
  })
}

async function executeType(
  tabId: number,
  text: string
): Promise<void> {
  // CDP handles proper key events with modifiers
  await cdp.send(tabId, 'Input.insertText', { text })
}

async function executeKeyPress(
  tabId: number,
  key: string,
  modifiers: { ctrl?: boolean, shift?: boolean, alt?: boolean, meta?: boolean }
): Promise<void> {
  const modifierFlags =
    (modifiers.alt ? 1 : 0) |
    (modifiers.ctrl ? 2 : 0) |
    (modifiers.meta ? 4 : 0) |
    (modifiers.shift ? 8 : 0)

  await cdp.send(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    modifiers: modifierFlags,
  })

  await cdp.send(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    modifiers: modifierFlags,
  })
}
```

---

## Phase 7: Shadow DOM & Iframe Handling

### 7.1 Shadow DOM Piercing

CDP's `DOM.getDocument(pierce: true)` automatically flattens shadow DOM.
The nodes include a `shadowRoots` array we can traverse:

```typescript
function walkDOMTree(node: CDPDOMNode, visitor: Visitor): EnhancedElement {
  const enhanced = visitor(node)

  // Regular children
  for (const child of node.children || []) {
    enhanced.children.push(walkDOMTree(child, visitor))
  }

  // Shadow DOM children (pierced)
  for (const shadowRoot of node.shadowRoots || []) {
    for (const child of shadowRoot.children || []) {
      enhanced.children.push(walkDOMTree(child, visitor))
    }
  }

  // Content document for iframes
  if (node.contentDocument) {
    enhanced.children.push(walkDOMTree(node.contentDocument, visitor))
  }

  return enhanced
}
```

### 7.2 Cross-Origin Iframe Handling

CDP can access cross-origin iframes when attached as debugger:

```typescript
async function fetchIframeAXTree(
  tabId: number,
  frameId: string
): Promise<AXNode[]> {
  // CDP doesn't have same-origin restrictions
  const result = await cdp.send(tabId, 'Accessibility.getFullAXTree', { frameId })
  return result.nodes
}
```

---

## Phase 8: Fallback Strategy

### 8.1 Graceful Degradation

Not all situations allow CDP (user denies permission, corporate policies).
Keep content script as fallback:

```typescript
async function readPage(params: ReadPageParams): Promise<ReadPageResult> {
  const { tabId, depth, filter, ref_id } = params

  // Try CDP first
  try {
    if (await canUseCDP(tabId)) {
      return await readPageViaCDP(tabId, { depth, filter, ref_id })
    }
  } catch (err) {
    console.warn('CDP failed, falling back to content script:', err)
  }

  // Fallback to content script (current implementation)
  return await readPageViaContentScript(tabId, { depth, filter, ref_id })
}

async function canUseCDP(tabId: number): Promise<boolean> {
  try {
    // Check if we can attach debugger
    await chrome.debugger.attach({ tabId }, '1.3')
    await chrome.debugger.detach({ tabId })
    return true
  } catch {
    return false
  }
}
```

---

## Phase 9: Performance Optimizations

### 9.1 Parallel Fetching (browser-use style)

```typescript
async function fetchEnhancedTree(tabId: number): Promise<EnhancedElement[]> {
  // All three trees fetched in parallel
  const [dom, snapshot, ax] = await Promise.all([
    fetchDOMTree(tabId),
    fetchSnapshot(tabId),
    fetchAXTrees(tabId),  // All frames in parallel internally
  ])

  return mergeToEnhancedTree(dom, snapshot, ax)
}
```

### 9.2 Incremental Updates

For repeated reads, use CDP's incremental APIs:

```typescript
// Enable DOM change notifications
await cdp.send(tabId, 'DOM.enable', {})

// Listen for mutations
cdp.on('DOM.documentUpdated', () => {
  // Invalidate cached tree
  clearTreeCache(tabId)
})

cdp.on('DOM.childNodeInserted', (params) => {
  // Update cache incrementally
  insertNodeInCache(params.parentNodeId, params.node)
})
```

### 9.3 Lazy AX Node Resolution

Don't fetch full AX tree for simple operations:

```typescript
// For single element lookup, use targeted query
async function getAXNodeForElement(
  tabId: number,
  backendNodeId: number
): Promise<CDPAXNode> {
  const result = await cdp.send(tabId, 'Accessibility.queryAXTree', {
    backendNodeId,
    accessibleName: '',  // Get regardless of name
  })
  return result.nodes[0]
}
```

---

## File Structure After Implementation

```
src/
├── cdp/
│   ├── client.ts           # CDP wrapper around chrome.debugger
│   ├── sessionManager.ts   # Attach/detach lifecycle
│   ├── treeFetcher.ts      # Parallel DOM/Snapshot/AX fetch
│   ├── treeMerger.ts       # Merge three trees by backendNodeId
│   ├── interactivity.ts    # CDP-aware interactivity cascade
│   ├── elementRefs.ts      # backendNodeId-based ref system
│   ├── actions.ts          # CDP-based input simulation
│   └── index.ts            # Module exports
├── content/
│   ├── index.ts            # (existing) Content script entry
│   ├── accessibilityTree.ts # (existing) Fallback implementation
│   └── ...                 # (existing) Other content modules
├── background/
│   ├── index.ts            # (modify) Add CDP tool handlers
│   └── ...
├── tools/
│   ├── pageReading.ts      # (modify) Use CDP when available
│   ├── interaction.ts      # (modify) Use CDP actions
│   └── ...
└── shared/
    ├── types.ts            # (modify) Add CDP types
    └── ...
```

---

## Implementation Order

1. **Week 1: CDP Infrastructure**
   - [ ] Add debugger permission to manifest
   - [ ] Implement CDP client wrapper
   - [ ] Implement session manager with auto-detach
   - [ ] Test basic CDP calls work

2. **Week 2: Tree Fetching**
   - [ ] Implement parallel tree fetching
   - [ ] Handle multi-frame AX tree merging
   - [ ] Build backendNodeId lookup maps

3. **Week 3: Tree Merging**
   - [ ] Implement merge algorithm
   - [ ] Add EnhancedElement types
   - [ ] Port interactivity detection to use AX properties

4. **Week 4: Reference System**
   - [ ] Update ref system to use backendNodeId
   - [ ] Implement resolveRefForAction
   - [ ] Test ref stability across page mutations

5. **Week 5: Action Execution**
   - [ ] Port click/type/scroll to CDP input methods
   - [ ] Handle coordinate calculation from bounds
   - [ ] Test on complex pages (shadow DOM, iframes)

6. **Week 6: Fallback & Polish**
   - [ ] Implement fallback to content script
   - [ ] Add incremental update support
   - [ ] Performance testing and optimization
   - [ ] Update serialization for LLM output

---

## Testing Strategy

### Unit Tests
- CDP client mock for offline testing
- Tree merger with sample CDP responses
- Interactivity cascade with various AX property combinations

### Integration Tests
- Real CDP calls on test pages
- Shadow DOM component pages
- Cross-origin iframe scenarios
- Complex forms (date pickers, file inputs)

### Comparison Tests
- Run both CDP and content script implementations
- Compare output accuracy
- Measure performance difference

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| User annoyed by debugger bar | UX degradation | Auto-detach after 30s inactivity |
| CDP not available (policies) | Feature unavailable | Graceful fallback to content script |
| Performance regression | Slow page reads | Parallel fetching, lazy resolution |
| Stale backendNodeId after navigation | Broken refs | Clear refs on navigation, re-fetch |
| CDP API changes | Breaking changes | Pin CDP protocol version |

---

## Success Criteria

1. **Accuracy**: AX names match what Chrome's accessibility inspector shows
2. **Coverage**: Shadow DOM and iframes properly traversed
3. **Performance**: Full tree fetch < 500ms for average page
4. **Reliability**: Graceful fallback when CDP unavailable
5. **Stability**: Refs survive minor DOM mutations
