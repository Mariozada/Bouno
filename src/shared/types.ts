/**
 * Shared TypeScript types for BrowseRun
 * Enhanced with browser-use style AX properties
 */

// Element bounds
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * AX-style state properties
 * These track dynamic state the way Chrome's accessibility tree does
 */
export interface AXStateProperties {
  // Interaction state
  focusable?: boolean      // Can receive keyboard focus
  focused?: boolean        // Currently has focus
  editable?: boolean       // Content can be edited
  readonly?: boolean       // Can't be modified
  disabled?: boolean       // Interaction disabled

  // Toggle/selection state
  checked?: boolean | 'mixed'  // Checkbox/radio state
  pressed?: boolean | 'mixed'  // Toggle button state
  selected?: boolean       // List item selection
  expanded?: boolean       // Dropdown/accordion open state

  // Form validation state
  required?: boolean       // Must fill this field
  invalid?: boolean        // Validation failed

  // Range/slider state
  valueMin?: number        // Minimum value
  valueMax?: number        // Maximum value
  valueNow?: number        // Current value
  valueText?: string       // Human-readable value

  // Other states
  busy?: boolean           // Loading/processing
  hidden?: boolean         // Accessibility hidden
  modal?: boolean          // Modal dialog
}

/**
 * Enhanced element reference - browser-use style
 * Combines DOM data with computed accessibility info
 */
export interface ElementRef {
  // Identity
  ref: string              // Our reference ID (ref_1, ref_2, etc.)
  tag: string              // HTML tag name

  // Accessibility semantics
  role: string             // Computed ARIA role
  name?: string            // Computed accessible name (ax_name)
  description?: string     // Computed accessible description

  // Visibility & layout
  bounds?: Bounds          // Bounding rectangle
  visible?: boolean        // Is element visible
  inViewport?: boolean     // Is in current viewport

  // Interactivity
  interactive?: boolean    // Is element interactive
  ignored?: boolean        // Decorative/ignored for accessibility

  // State properties (AX-style)
  states?: AXStateProperties

  // Form-specific
  value?: string           // Current value
  placeholder?: string     // Placeholder text
  inputType?: string       // Input type for inputs

  // Link-specific
  href?: string            // Link URL

  // Additional attributes for matching
  id?: string              // Element ID
  className?: string       // Class names (truncated)
  attributes?: Record<string, string>  // Key attributes

  // Hierarchy
  children?: ElementRef[]

  // Compound control children (virtual)
  compoundChildren?: CompoundChild[]
}

/**
 * Virtual child for compound controls (date pickers, file inputs, etc.)
 */
export interface CompoundChild {
  role: string
  name: string
  valueNow?: string
}

// Tab info
export interface TabInfo {
  id: number
  title: string
  url: string
  active: boolean
  windowId: number
  index?: number
  pinned?: boolean
  audible?: boolean
}

// Tool parameters
export interface ReadPageParams {
  tabId: number
  depth?: number
  filter?: 'all' | 'interactive'
  ref_id?: string
}

export interface FindParams {
  tabId: number
  query: string
}

export interface FormInputParams {
  tabId: number
  ref: string
  value: string | boolean | number
}

export interface ComputerAction {
  action: 'left_click' | 'right_click' | 'double_click' | 'triple_click' |
          'type' | 'key' | 'scroll' | 'scroll_to' | 'hover' |
          'left_click_drag' | 'screenshot' | 'zoom' | 'wait'
  tabId: number
  coordinate?: [number, number]
  ref?: string
  text?: string
  modifiers?: string
  scroll_direction?: 'up' | 'down' | 'left' | 'right'
  scroll_amount?: number
  start_coordinate?: [number, number]
  repeat?: number
  duration?: number
  region?: [number, number, number, number]
}

export interface NavigateParams {
  tabId: number
  url: string
}

// Tool response
export interface ToolResult<T = unknown> {
  success: boolean
  result?: T
  error?: string
}

// Console message
export interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug' | 'exception'
  text: string
  timestamp: number
  source?: string
}

// Network request
export interface NetworkRequest {
  url: string
  method: string
  type: string
  status: number
  statusText: string
  timestamp: number
  responseHeaders?: chrome.webRequest.HttpHeader[]
}

// Screenshot
export interface Screenshot {
  imageId: string
  dataUrl: string
  width?: number
  height?: number
  timestamp: number
  tabId: number
}

// GIF recording state
export interface GifFrame {
  dataUrl: string
  timestamp: number
  action?: string
}

export interface GifRecordingState {
  recording: boolean
  frames: GifFrame[]
  actions: string[]
  startTime?: number
}
