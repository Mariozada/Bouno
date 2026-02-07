import { useState, Component, type FC, type ReactNode } from 'react'
import type { ToolCallInfo } from '@agent/index'

export type { ToolCallInfo }

// ─── Types ───────────────────────────────────────────────────────────────────

interface ToolCallDisplayProps {
  toolCall: ToolCallInfo
}

interface ToolRendererProps {
  input: Record<string, unknown>
  result: unknown
  status: ToolCallInfo['status']
  error?: string
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// ─── Error Boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ToolCallDisplay] Render error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<ToolCallInfo['status'], string> = {
  pending: '○',
  running: '◐',
  completed: '●',
  error: '✕',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatToolName(name: string): string {
  if (!name) return 'Unknown Tool'
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function str(value: unknown, maxLen = 100): string {
  try {
    if (value === null) return 'null'
    if (value === undefined) return ''
    if (typeof value === 'string') {
      return value.length > maxLen ? value.slice(0, maxLen) + '...' : value
    }
    const s = JSON.stringify(value)
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s
  } catch {
    return '[Unable to display]'
  }
}

function obj(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function truncUrl(url: string, max = 60): string {
  if (url.length <= max) return url
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    if (path.length > 30) {
      return u.host + path.slice(0, 27) + '...'
    }
    return u.host + path
  } catch {
    return url.slice(0, max) + '...'
  }
}

// ─── Small UI Primitives ─────────────────────────────────────────────────────

const Badge: FC<{ variant?: string; children: ReactNode }> = ({ variant, children }) => (
  <span className={`tool-badge${variant ? ` tool-badge--${variant}` : ''}`}>{children}</span>
)

const KV: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <div className="tool-kv">
    <span className="tool-kv-label">{label}</span>
    <span className="tool-kv-value">{value}</span>
  </div>
)

const Divider: FC = () => <div className="tool-divider" />

// ─── Running State Labels ────────────────────────────────────────────────────

function getRunningLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'computer': {
      const action = input.action as string
      const ref = input.ref as string
      const text = input.text as string
      switch (action) {
        case 'screenshot': return 'Taking screenshot'
        case 'zoom': return 'Zooming into region'
        case 'wait': return `Waiting ${input.duration || 1}s`
        case 'left_click': return ref ? `Clicking ${ref}` : 'Clicking'
        case 'right_click': return ref ? `Right-clicking ${ref}` : 'Right-clicking'
        case 'double_click': return ref ? `Double-clicking ${ref}` : 'Double-clicking'
        case 'triple_click': return ref ? `Triple-clicking ${ref}` : 'Triple-clicking'
        case 'type': return text ? `Typing "${str(text, 20)}"` : 'Typing'
        case 'key': return text ? `Pressing ${text}` : 'Pressing key'
        case 'scroll': return `Scrolling ${input.scroll_direction || 'down'}`
        case 'scroll_to': return ref ? `Scrolling to ${ref}` : 'Scrolling to element'
        case 'hover': return ref ? `Hovering ${ref}` : 'Hovering'
        case 'left_click_drag': return 'Dragging'
        default: return `${action}`
      }
    }
    case 'navigate': {
      const url = input.url as string
      if (url === 'back') return 'Going back'
      if (url === 'forward') return 'Going forward'
      return `Navigating to ${truncUrl(url || '', 40)}`
    }
    case 'find': return `Searching for "${str(input.query, 30)}"`
    case 'read_page': return input.ref_id ? `Reading ${input.ref_id}` : `Reading page (${input.filter || 'all'})`
    case 'get_page_text': return 'Extracting page text'
    case 'form_input': return `Setting ${input.ref} to "${str(input.value, 20)}"`
    case 'tabs_context': return 'Listing tabs'
    case 'tabs_create': return input.url ? `Opening ${truncUrl(input.url as string, 30)}` : 'Opening new tab'
    case 'web_fetch': return `Fetching ${truncUrl(input.url as string || '', 40)}`
    case 'read_console_messages': return 'Reading console'
    case 'read_network_requests': return 'Reading network requests'
    case 'javascript_tool': return 'Executing JavaScript'
    case 'resize_window': return `Resizing to ${input.width}x${input.height}`
    case 'gif_creator': {
      const a = input.action as string
      if (a === 'start_recording') return 'Starting recording'
      if (a === 'stop_recording') return 'Stopping recording'
      if (a === 'export') return 'Exporting GIF'
      if (a === 'clear') return 'Clearing frames'
      return a
    }
    case 'update_plan': return 'Creating plan'
    case 'invoke_skill': return `Invoking skill "${str(input.skill_name, 20)}"`
    case 'upload_image': return 'Uploading image'
    case 'read_result': return `Reading ${input.result_id}`
    case 'process_result': return `Processing ${input.result_id}`
    default: {
      const entries = Object.entries(input).slice(0, 2)
      if (entries.length === 0) return 'No parameters'
      return entries.map(([k, v]) => `${k}: ${str(v, 30)}`).join(', ')
    }
  }
}

// ─── Per-Tool Renderers ──────────────────────────────────────────────────────

const ComputerRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const action = input.action as string
  const ref = input.ref as string
  const text = input.text as string
  const coord = input.coordinate as number[] | undefined
  const r = obj(result)

  const actionLabels: Record<string, string> = {
    left_click: 'Click', right_click: 'Right Click', double_click: 'Double Click',
    triple_click: 'Triple Click', type: 'Type', key: 'Key', scroll: 'Scroll',
    scroll_to: 'Scroll To', hover: 'Hover', left_click_drag: 'Drag',
    screenshot: 'Screenshot', zoom: 'Zoom', wait: 'Wait',
  }

  const isScreenshot = action === 'screenshot' || action === 'zoom'
  const dataUrl = r.dataUrl as string | undefined

  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">{actionLabels[action] || action}</Badge>
        {ref && <Badge>{ref}</Badge>}
        {coord && <Badge>[{coord.join(', ')}]</Badge>}
        {text && action === 'type' && <Badge>"{str(text, 25)}"</Badge>}
        {text && action === 'key' && <Badge>{text}</Badge>}
        {input.scroll_direction && <Badge>{input.scroll_direction as string}</Badge>}
        {action === 'wait' && <Badge>{input.duration || 1}s</Badge>}
        {input.modifiers && <Badge>{input.modifiers as string}</Badge>}
      </div>
      {status === 'completed' && isScreenshot && dataUrl && (
        <img src={dataUrl} alt="Screenshot" className="tool-screenshot" />
      )}
      {status === 'completed' && !isScreenshot && (
        <div className="tool-result-text">
          {r.waited ? `Waited ${r.waited}s` : 'Done'}
        </div>
      )}
    </div>
  )
}

const FormInputRenderer: FC<ToolRendererProps> = ({ input, status }) => (
  <div className="tool-body">
    <div className="tool-badges">
      <Badge>{input.ref as string}</Badge>
      <Badge variant="action">= "{str(input.value, 30)}"</Badge>
    </div>
    {status === 'completed' && <div className="tool-result-text">Done</div>}
  </div>
)

const UploadImageRenderer: FC<ToolRendererProps> = ({ input, status }) => (
  <div className="tool-body">
    <div className="tool-badges">
      <Badge variant="action">{input.imageId as string}</Badge>
      {input.ref && <Badge>{input.ref as string}</Badge>}
      {input.coordinate && <Badge>[{(input.coordinate as number[]).join(', ')}]</Badge>}
    </div>
    {status === 'completed' && <div className="tool-result-text">Uploaded</div>}
  </div>
)

const NavigateRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const url = input.url as string
  const r = obj(result)

  return (
    <div className="tool-body">
      {url === 'back' ? (
        <div className="tool-badges"><Badge variant="action">Back</Badge></div>
      ) : url === 'forward' ? (
        <div className="tool-badges"><Badge variant="action">Forward</Badge></div>
      ) : (
        <div className="tool-url">{url}</div>
      )}
      {status === 'completed' && r.title && (
        <>
          <Divider />
          <KV label="Title" value={str(r.title as string, 60)} />
          {r.url && <div className="tool-url">{truncUrl(r.url as string)}</div>}
        </>
      )}
    </div>
  )
}

const TabsContextRenderer: FC<ToolRendererProps> = ({ result, status }) => {
  const r = obj(result)
  const tabs = (r.tabs as Array<Record<string, unknown>>) || []

  if (status !== 'completed' || tabs.length === 0) return null

  return (
    <div className="tool-body">
      {tabs.slice(0, 10).map((tab, i) => (
        <div key={i} className={`tool-tab-item${tab.active ? ' tool-tab-item--active' : ''}`}>
          <span className="tool-tab-title">{str(tab.title as string, 40)}</span>
          <span className="tool-tab-url">{truncUrl(tab.url as string || '', 40)}</span>
        </div>
      ))}
      {tabs.length > 10 && <div className="tool-result-text">+{tabs.length - 10} more tabs</div>}
    </div>
  )
}

const TabsCreateRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  return (
    <div className="tool-body">
      {input.url && <div className="tool-url">{input.url as string}</div>}
      {status === 'completed' && r.title && (
        <>
          <Divider />
          <KV label="Title" value={str(r.title as string, 60)} />
        </>
      )}
    </div>
  )
}

const ResizeWindowRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">{input.width} x {input.height}</Badge>
      </div>
      {status === 'completed' && (
        <KV label="Result" value={`${r.width} x ${r.height} (${r.state || 'normal'})`} />
      )}
    </div>
  )
}

const WebFetchRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const [showContent, setShowContent] = useState(false)
  const r = obj(result)
  const statusCode = r.status as number | undefined
  const statusVariant = statusCode
    ? statusCode < 300 ? 'success' : statusCode < 400 ? 'warning' : 'error'
    : undefined

  return (
    <div className="tool-body">
      <div className="tool-url">{truncUrl(input.url as string || '')}</div>
      {status === 'completed' && (
        <>
          <Divider />
          <div className="tool-badges">
            {statusCode !== undefined && (
              <Badge variant={statusVariant}>{statusCode} {r.statusText as string}</Badge>
            )}
            {r.contentType && <Badge variant="muted">{str(r.contentType as string, 30)}</Badge>}
          </div>
          {r.content && (
            <>
              <div className="tool-text-preview">
                {showContent
                  ? str(r.content as string, 2000)
                  : str(r.content as string, 200)
                }
              </div>
              {(r.content as string).length > 200 && (
                <button
                  type="button"
                  className="tool-call-toggle"
                  onClick={() => setShowContent(!showContent)}
                >
                  {showContent ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

const ReadPageRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const [showOutput, setShowOutput] = useState(false)
  const r = obj(result)

  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">{(input.filter as string) || 'all'}</Badge>
        {input.depth && <Badge>depth: {input.depth as number}</Badge>}
        {input.ref_id && <Badge>{input.ref_id as string}</Badge>}
      </div>
      {status === 'completed' && (
        <>
          <Divider />
          {r.tree ? (
            <>
              <div className="tool-text-preview">
                {showOutput
                  ? str(r.tree, 3000)
                  : str(r.tree, 200)
                }
              </div>
              {String(r.tree || '').length > 200 && (
                <button
                  type="button"
                  className="tool-call-toggle"
                  onClick={() => setShowOutput(!showOutput)}
                >
                  {showOutput ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          ) : (
            <div className="tool-text-preview">{str(result, 200)}</div>
          )}
        </>
      )}
    </div>
  )
}

const GetPageTextRenderer: FC<ToolRendererProps> = ({ result, status }) => {
  const [showFull, setShowFull] = useState(false)
  const r = obj(result)

  if (status !== 'completed') return null

  return (
    <div className="tool-body">
      {r.title && <KV label="Title" value={str(r.title as string, 60)} />}
      {r.url && <div className="tool-url">{truncUrl(r.url as string)}</div>}
      {r.text && (
        <>
          <Divider />
          <div className="tool-text-preview">
            {showFull ? str(r.text as string, 2000) : str(r.text as string, 200)}
          </div>
          {(r.text as string).length > 200 && (
            <button
              type="button"
              className="tool-call-toggle"
              onClick={() => setShowFull(!showFull)}
            >
              {showFull ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

const FindRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  const elements = r.elements as Array<Record<string, unknown>> | undefined

  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">"{str(input.query, 40)}"</Badge>
      </div>
      {status === 'completed' && elements && (
        <>
          <Divider />
          <div className="tool-result-text">
            {elements.length} element{elements.length !== 1 ? 's' : ''} found
          </div>
        </>
      )}
      {status === 'completed' && !elements && (
        <div className="tool-text-preview">{str(result, 200)}</div>
      )}
    </div>
  )
}

const ReadResultRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const [showFull, setShowFull] = useState(false)
  const r = obj(result)

  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">{input.result_id as string}</Badge>
        {input.offset && <Badge>offset: {input.offset as number}</Badge>}
        {input.limit && <Badge>limit: {input.limit as number}</Badge>}
        {input.pattern && <Badge>/{input.pattern as string}/</Badge>}
      </div>
      {status === 'completed' && (
        <>
          <Divider />
          {r.content ? (
            <>
              {r.totalLines && <KV label="Lines" value={`${r.totalLines}`} />}
              <div className="tool-code">
                {showFull ? str(r.content as string, 3000) : str(r.content as string, 300)}
              </div>
              {String(r.content || '').length > 300 && (
                <button
                  type="button"
                  className="tool-call-toggle"
                  onClick={() => setShowFull(!showFull)}
                >
                  {showFull ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          ) : (
            <div className="tool-text-preview">{str(result, 200)}</div>
          )}
        </>
      )}
    </div>
  )
}

const ProcessResultRenderer: FC<ToolRendererProps> = ({ input, result, status }) => (
  <div className="tool-body">
    <div className="tool-badges">
      <Badge variant="action">{input.result_id as string}</Badge>
    </div>
    <div className="tool-code">{str(input.code, 200)}</div>
    {status === 'completed' && (
      <>
        <Divider />
        <div className="tool-code">{str(result, 500)}</div>
      </>
    )}
  </div>
)

const ConsoleMessagesRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  const messages = (r.messages as Array<Record<string, unknown>>) || []

  const severityVariant = (type: string) => {
    if (type === 'error' || type === 'exception') return 'error'
    if (type === 'warn' || type === 'warning') return 'warning'
    return 'muted'
  }

  return (
    <div className="tool-body">
      <div className="tool-badges">
        {input.onlyErrors && <Badge variant="error">errors only</Badge>}
        {input.pattern && <Badge>/{input.pattern as string}/</Badge>}
        {input.clear && <Badge variant="warning">clear</Badge>}
      </div>
      {status === 'completed' && (
        <>
          <Divider />
          <KV label="Count" value={`${r.count || messages.length}`} />
          {messages.slice(0, 15).map((msg, i) => (
            <div key={i} className="tool-console-msg">
              <Badge variant={severityVariant(msg.type as string)}>
                {(msg.type as string || 'log').toUpperCase()}
              </Badge>
              <span className="tool-console-msg-text">{str(msg.text as string, 120)}</span>
            </div>
          ))}
          {messages.length > 15 && (
            <div className="tool-result-text">+{messages.length - 15} more messages</div>
          )}
        </>
      )}
    </div>
  )
}

const NetworkRequestsRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  const requests = (r.requests as Array<Record<string, unknown>>) || []

  const statusVariant = (code: number) => {
    if (!code) return 'muted'
    if (code < 300) return 'success'
    if (code < 400) return 'warning'
    return 'error'
  }

  return (
    <div className="tool-body">
      {input.pattern && (
        <div className="tool-badges">
          <Badge>/{input.pattern as string}/</Badge>
        </div>
      )}
      {status === 'completed' && (
        <>
          <Divider />
          <KV label="Count" value={`${r.count || requests.length}`} />
          {requests.slice(0, 15).map((req, i) => (
            <div key={i} className="tool-network-row">
              <Badge variant="action">{(req.method as string) || 'GET'}</Badge>
              {req.status && (
                <Badge variant={statusVariant(req.status as number)}>{req.status as number}</Badge>
              )}
              <span className="tool-network-url">{truncUrl(req.url as string || '', 50)}</span>
            </div>
          ))}
          {requests.length > 15 && (
            <div className="tool-result-text">+{requests.length - 15} more requests</div>
          )}
        </>
      )}
    </div>
  )
}

const JavascriptToolRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  return (
    <div className="tool-body">
      <div className="tool-code">{str(input.code, 300)}</div>
      {status === 'completed' && (
        <>
          <Divider />
          {r.success !== undefined ? (
            <div className="tool-code">{r.result !== undefined ? str(r.result, 500) : 'Success'}</div>
          ) : (
            <div className="tool-code">{str(result, 500)}</div>
          )}
        </>
      )}
    </div>
  )
}

const GifCreatorRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)

  const actionLabels: Record<string, string> = {
    start_recording: 'Start Recording',
    stop_recording: 'Stop Recording',
    export: 'Export',
    clear: 'Clear',
  }

  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">{actionLabels[input.action as string] || input.action as string}</Badge>
      </div>
      {status === 'completed' && (
        <>
          <Divider />
          {r.frameCount !== undefined && <KV label="Frames" value={`${r.frameCount}`} />}
          {r.duration !== undefined && <KV label="Duration" value={`${Math.round(r.duration as number / 1000 * 10) / 10}s`} />}
          {r.message && <div className="tool-result-text">{r.message as string}</div>}
        </>
      )}
    </div>
  )
}

const InvokeSkillRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)

  return (
    <div className="tool-body">
      <div className="tool-badges">
        <Badge variant="action">{input.skill_name as string}</Badge>
      </div>
      {status === 'completed' && (
        <>
          <Divider />
          {r.status === 'error' ? (
            <div className="tool-result-text" style={{ color: 'var(--destructive)' }}>{r.error as string}</div>
          ) : (
            <>
              {r.description && <div className="tool-result-text">{str(r.description as string, 100)}</div>}
              {r.message && <div className="tool-text-preview">{r.message as string}</div>}
            </>
          )}
        </>
      )}
    </div>
  )
}

const UpdatePlanRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const domains = (input.domains as string[]) || []
  const r = obj(result)

  return (
    <div className="tool-body">
      <div className="tool-text-preview">{str(input.approach, 150)}</div>
      {domains.length > 0 && (
        <div className="tool-badges">
          {domains.map((d, i) => <Badge key={i}>{d}</Badge>)}
        </div>
      )}
      {status === 'completed' && r.status && (
        <>
          <Divider />
          <div className="tool-result-text">{r.message as string || 'Plan created'}</div>
        </>
      )}
    </div>
  )
}

// ─── Renderer Registry ───────────────────────────────────────────────────────

const TOOL_RENDERERS: Record<string, FC<ToolRendererProps>> = {
  computer: ComputerRenderer,
  form_input: FormInputRenderer,
  upload_image: UploadImageRenderer,
  navigate: NavigateRenderer,
  tabs_context: TabsContextRenderer,
  tabs_create: TabsCreateRenderer,
  resize_window: ResizeWindowRenderer,
  web_fetch: WebFetchRenderer,
  read_page: ReadPageRenderer,
  get_page_text: GetPageTextRenderer,
  find: FindRenderer,
  read_result: ReadResultRenderer,
  process_result: ProcessResultRenderer,
  read_console_messages: ConsoleMessagesRenderer,
  read_network_requests: NetworkRequestsRenderer,
  javascript_tool: JavascriptToolRenderer,
  gif_creator: GifCreatorRenderer,
  update_plan: UpdatePlanRenderer,
  invoke_skill: InvokeSkillRenderer,
}

// ─── Fallback Generic Renderer ───────────────────────────────────────────────

function formatJson(value: unknown): string {
  try {
    if (typeof value === 'string') return value
    return JSON.stringify(value, null, 2) || 'null'
  } catch {
    return '[Unable to display JSON]'
  }
}

const GenericRenderer: FC<ToolRendererProps> = ({ input, result, status, error }) => {
  const [showFull, setShowFull] = useState(false)

  const hasError = !!error
  const hasResult = result !== undefined
  const errorLines = (error || '').split('\n')
  const isLongError = errorLines.length > 3 || (error || '').length > 200
  const json = hasResult ? formatJson(result) : ''
  const lines = json.split('\n')

  return (
    <div className="tool-call-output">
      {Object.keys(input).length > 0 && (
        <div className="tool-body">
          {Object.entries(input).slice(0, 4).map(([k, v]) => (
            <KV key={k} label={k} value={str(v, 60)} />
          ))}
        </div>
      )}
      {status === 'completed' || status === 'error' ? (
        hasError ? (
          <>
            <pre className="tool-call-output-preview tool-call-error-content">
              {showFull || !isLongError
                ? error
                : errorLines.slice(0, 3).join('\n') + ((error || '').length > 200 ? '...' : '')}
            </pre>
            {isLongError && (
              <button
                type="button"
                className="tool-call-toggle"
                onClick={() => setShowFull(!showFull)}
              >
                {showFull ? 'Show less' : 'Show full error'}
              </button>
            )}
          </>
        ) : hasResult ? (
          <>
            <pre className="tool-call-output-preview">
              {showFull ? json : lines.slice(0, 8).join('\n') + (lines.length > 8 ? '\n...' : '')}
            </pre>
            {lines.length > 8 && (
              <button
                type="button"
                className="tool-call-toggle"
                onClick={() => setShowFull(!showFull)}
              >
                {showFull ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        ) : (
          <div className="tool-call-success">Completed successfully</div>
        )
      ) : null}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ToolCallContent: FC<ToolCallDisplayProps> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = STATUS_ICONS[toolCall.status] || '?'
  const isFinished = toolCall.status === 'completed' || toolCall.status === 'error'

  const Renderer = TOOL_RENDERERS[toolCall.name]
  const hasCustomRenderer = !!Renderer

  return (
    <div className={`tool-call tool-call--${toolCall.status}`}>
      <div className="tool-call-header">
        <span className="tool-call-icon" aria-hidden="true">{statusIcon}</span>
        <span className="tool-call-name">{formatToolName(toolCall.name)}</span>
        {isFinished ? (
          <button
            type="button"
            className="tool-call-show-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide' : 'Show'}
          </button>
        ) : (
          <span className="tool-call-status">
            {toolCall.status === 'running' ? 'Running' : 'Pending'}
          </span>
        )}
      </div>

      {toolCall.status === 'running' && (
        <div className="tool-call-input-summary">
          {getRunningLabel(toolCall.name, toolCall.input)}
        </div>
      )}

      {isFinished && expanded && (
        hasCustomRenderer ? (
          toolCall.error ? (
            <div className="tool-call-output">
              <pre className="tool-call-output-preview tool-call-error-content">
                {toolCall.error}
              </pre>
            </div>
          ) : (
            <Renderer
              input={toolCall.input}
              result={toolCall.result}
              status={toolCall.status}
              error={toolCall.error}
            />
          )
        ) : (
          <GenericRenderer
            input={toolCall.input}
            result={toolCall.result}
            status={toolCall.status}
            error={toolCall.error}
          />
        )
      )}
    </div>
  )
}

export const ToolCallDisplay: FC<ToolCallDisplayProps> = ({ toolCall }) => {
  const fallback = (
    <div className="tool-call tool-call--error">
      <div className="tool-call-header">
        <span className="tool-call-icon">✕</span>
        <span className="tool-call-name">{toolCall?.name || 'Unknown Tool'}</span>
        <span className="tool-call-status">Render Error</span>
      </div>
      <div className="tool-call-output">
        <div className="tool-call-error">Failed to display tool call details</div>
      </div>
    </div>
  )

  return (
    <ErrorBoundary fallback={fallback}>
      <ToolCallContent toolCall={toolCall} />
    </ErrorBoundary>
  )
}
