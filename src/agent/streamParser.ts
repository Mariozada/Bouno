export const STREAM_EVENT_TYPES = {
  TEXT_DELTA: 'text_delta',
  TEXT_DONE: 'text_done',
  TOOL_CALL_START: 'tool_call_start',
  TOOL_CALL_DONE: 'tool_call_done',
  TOOL_RESULT: 'tool_result',
  STREAM_START: 'stream_start',
  STREAM_DONE: 'stream_done',
  STREAM_ERROR: 'stream_error',
} as const

export type StreamEventType = typeof STREAM_EVENT_TYPES[keyof typeof STREAM_EVENT_TYPES]

export interface ToolCallEvent {
  id: string
  name: string
  params: Record<string, unknown>
}

export interface ToolResultEvent {
  id: string
  name: string
  result: unknown
  error?: string
}

export interface StreamEvent {
  type: StreamEventType
  data?: unknown
}

type EventListener = (event: StreamEvent) => void

interface ToolCallBlockTag {
  open: string
  close: string
}

const TOOL_CALL_BLOCK_TAGS: ToolCallBlockTag[] = [
  { open: '<tool_calls>', close: '</tool_calls>' },
  { open: '<tools_call>', close: '</tools_call>' },
]
const INVOKE_CLOSE = '</invoke>'
let domParser: DOMParser | null = null
function getDOMParser(): DOMParser {
  if (!domParser) domParser = new DOMParser()
  return domParser
}

/**
 * Streaming parser for `<tool_calls>` blocks. Text outside blocks is emitted
 * as deltas. Inside a block, each `<invoke>...</invoke>` is emitted the moment
 * its close tag arrives — no waiting for `</tool_calls>`.
 */
export class XMLStreamParser {
  private buffer = ''
  private textBuffer = ''
  private inBlock = false
  private activeBlockCloseTag: string | null = null
  private invokeBuffer = ''
  private listeners: Map<StreamEventType | '*', EventListener[]> = new Map()
  private toolCallCounter = 0

  processChunk(chunk: string): void {
    this.buffer += chunk

    while (this.buffer.length > 0) {
      if (this.inBlock) {
        const blockCloseTag = this.activeBlockCloseTag || TOOL_CALL_BLOCK_TAGS[0].close
        // Check for block close first — the block may end without a pending invoke
        const blockClose = this.buffer.indexOf(blockCloseTag)
        const invokeClose = this.buffer.indexOf(INVOKE_CLOSE)

        if (invokeClose !== -1 && (blockClose === -1 || invokeClose < blockClose)) {
          // Complete invoke found — emit it
          const end = invokeClose + INVOKE_CLOSE.length
          this.invokeBuffer += this.buffer.substring(0, end)
          this.buffer = this.buffer.substring(end)
          this._emitInvoke()
        } else if (blockClose !== -1) {
          // Block closes (any trailing whitespace between last </invoke> and </tool_calls> is ignored)
          this.buffer = this.buffer.substring(blockClose + blockCloseTag.length)
          this.inBlock = false
          this.activeBlockCloseTag = null
          this.invokeBuffer = ''
        } else {
          // Neither found — keep partial data, check for split close tags
          const splitAt = getEarliestPartialIndex(this.buffer, [INVOKE_CLOSE, blockCloseTag])

          if (splitAt !== -1) {
            this.invokeBuffer += this.buffer.substring(0, splitAt)
            this.buffer = this.buffer.substring(splitAt)
          } else {
            this.invokeBuffer += this.buffer
            this.buffer = ''
          }
          break
        }
      } else {
        const nextBlock = findNextBlockOpen(this.buffer)

        if (nextBlock) {
          if (nextBlock.index > 0) {
            this._emitTextDelta(this.buffer.substring(0, nextBlock.index))
          }
          this.inBlock = true
          this.activeBlockCloseTag = nextBlock.block.close
          this.invokeBuffer = ''
          this.buffer = this.buffer.substring(nextBlock.index + nextBlock.block.open.length)
        } else {
          const partial = getEarliestPartialIndex(this.buffer, TOOL_CALL_BLOCK_TAGS.map((block) => block.open))
          if (partial !== -1) {
            if (partial > 0) {
              this._emitTextDelta(this.buffer.substring(0, partial))
            }
            this.buffer = this.buffer.substring(partial)
            break
          } else {
            this._emitTextDelta(this.buffer)
            this.buffer = ''
          }
        }
      }
    }
  }

  flush(): void {
    if (this.inBlock) {
      // Try to parse any complete pending invokes, then discard incomplete tool XML.
      this.processChunk('')
      this.buffer = ''
      this.invokeBuffer = ''
      this.inBlock = false
      this.activeBlockCloseTag = null
    }

    if (this.buffer) {
      this._emitTextDelta(this.buffer)
      this.buffer = ''
    }
    if (this.textBuffer) {
      this._emit({ type: STREAM_EVENT_TYPES.TEXT_DONE, data: this.textBuffer })
      this.textBuffer = ''
    }
  }

  on(event: StreamEventType | '*', listener: EventListener): () => void {
    const listeners = this.listeners.get(event) || []
    listeners.push(listener)
    this.listeners.set(event, listeners)
    return () => {
      const idx = listeners.indexOf(listener)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }

  reset(): void {
    this.buffer = ''
    this.textBuffer = ''
    this.inBlock = false
    this.activeBlockCloseTag = null
    this.invokeBuffer = ''
  }

  // ---------------------------------------------------------------------------

  private _emitTextDelta(text: string): void {
    if (!text) return
    this.textBuffer += text
    this._emit({ type: STREAM_EVENT_TYPES.TEXT_DELTA, data: text })
  }

  /** Parse a single `<invoke>` element from the invoke buffer and emit it. */
  private _emitInvoke(): void {
    const raw = this.invokeBuffer.trim()
    this.invokeBuffer = ''
    if (!raw) return

    // Wrap in a root so DOMParser is happy
    const doc = getDOMParser().parseFromString(`<r>${raw}</r>`, 'text/xml')
    if (doc.querySelector('parsererror')) {
      console.warn('[XMLStreamParser] Parse error, raw:', raw)
      return
    }

    const invoke = doc.querySelector('invoke')
    if (!invoke) return

    const name = invoke.getAttribute('name') || ''
    const params: Record<string, unknown> = {}

    for (const param of invoke.querySelectorAll('parameter')) {
      const paramName = param.getAttribute('name')
      if (paramName) {
        params[paramName] = parseValue((param.textContent || '').trim())
      }
    }

    const id = `tc_${++this.toolCallCounter}`
    const toolCall: ToolCallEvent = { id, name, params }
    this._emit({ type: STREAM_EVENT_TYPES.TOOL_CALL_START, data: toolCall })
    this._emit({ type: STREAM_EVENT_TYPES.TOOL_CALL_DONE, data: toolCall })
  }

  private _emit(event: StreamEvent): void {
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event)
    }
    for (const listener of this.listeners.get('*') || []) {
      listener(event)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Coerce a string value to a JS primitive or parsed JSON. */
function parseValue(value: string): unknown {
  if (value.startsWith('[') || value.startsWith('{')) {
    try { return JSON.parse(value) } catch { return value }
  }
  if (value === 'true') return true
  if (value === 'false') return false
  const num = Number(value)
  if (!isNaN(num) && value !== '') return num
  return value
}

/**
 * Return the index where `buffer` ends with a prefix of `tag`, or -1.
 * e.g. buffer="abc</inv" tag="</invoke>" → returns 3
 */
function findPartialSuffix(buffer: string, tag: string): number {
  const start = Math.max(0, buffer.length - tag.length)
  for (let i = start; i < buffer.length; i++) {
    if (tag.startsWith(buffer.substring(i))) return i
  }
  return -1
}

function findNextBlockOpen(buffer: string): { index: number; block: ToolCallBlockTag } | null {
  let match: { index: number; block: ToolCallBlockTag } | null = null

  for (const block of TOOL_CALL_BLOCK_TAGS) {
    const idx = buffer.indexOf(block.open)
    if (idx === -1) continue
    if (!match || idx < match.index) {
      match = { index: idx, block }
    }
  }

  return match
}

function getEarliestPartialIndex(buffer: string, tags: string[]): number {
  let earliest = -1

  for (const tag of tags) {
    const idx = findPartialSuffix(buffer, tag)
    if (idx === -1) continue
    if (earliest === -1 || idx < earliest) {
      earliest = idx
    }
  }

  return earliest
}
