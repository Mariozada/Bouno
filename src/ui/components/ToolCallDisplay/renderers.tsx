import { useState, type FC } from 'react'
import type { ToolRendererProps } from './helpers'
import { str, obj, truncUrl } from './helpers'

// ─── Shared detail row ──────────────────────────────────────────────────────

const Row: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="tool-detail-row">
    <span className="tool-detail-label">{label}</span>
    <span className="tool-detail-value">{children}</span>
  </div>
)

// ─── Per-Tool Renderers ─────────────────────────────────────────────────────

const ComputerRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const action = input.action as string
  const ref = input.ref as string
  const text = input.text as string
  const coord = input.coordinate as number[] | undefined
  const r = obj(result)

  const isScreenshot = action === 'screenshot' || action === 'zoom'
  const dataUrl = r.dataUrl as string | undefined

  if (isScreenshot && status === 'completed' && dataUrl) {
    return (
      <div className="tool-detail">
        <img src={dataUrl} alt="Screenshot" className="tool-screenshot" />
      </div>
    )
  }

  return (
    <div className="tool-detail">
      {action === 'type' && text && <Row label="Text">{str(text, 80)}</Row>}
      {action === 'key' && text && <Row label="Key">{text}</Row>}
      {action === 'scroll' && input.scroll_direction && (
        <Row label="Direction">{input.scroll_direction as string}</Row>
      )}
      {action === 'wait' && <Row label="Duration">{input.duration || 1}s</Row>}
      {ref && <Row label="Target">{ref}</Row>}
      {coord && <Row label="Position">{coord.join(', ')}</Row>}
      {input.modifiers && <Row label="Modifiers">{input.modifiers as string}</Row>}
      {status === 'completed' && (
        <Row label="Result">{r.waited ? `Waited ${r.waited}s` : 'Done'}</Row>
      )}
    </div>
  )
}

const FormInputRenderer: FC<ToolRendererProps> = ({ input, status }) => (
  <div className="tool-detail">
    <Row label="Field">{input.ref as string}</Row>
    <Row label="Value">{str(input.value, 60)}</Row>
    {status === 'completed' && <Row label="Result">Done</Row>}
  </div>
)

const UploadImageRenderer: FC<ToolRendererProps> = ({ input, status }) => (
  <div className="tool-detail">
    <Row label="Image">{input.imageId as string}</Row>
    {input.ref && <Row label="Target">{input.ref as string}</Row>}
    {status === 'completed' && <Row label="Result">Uploaded</Row>}
  </div>
)

const NavigateRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const url = input.url as string
  const r = obj(result)

  return (
    <div className="tool-detail">
      {url === 'back' ? (
        <Row label="Direction">Back</Row>
      ) : url === 'forward' ? (
        <Row label="Direction">Forward</Row>
      ) : (
        <Row label="URL"><span className="tool-detail-url">{url}</span></Row>
      )}
      {status === 'completed' && r.title && (
        <Row label="Page">{str(r.title as string, 60)}</Row>
      )}
    </div>
  )
}

const TabsContextRenderer: FC<ToolRendererProps> = ({ result, status }) => {
  const r = obj(result)
  const tabs = (r.tabs as Array<Record<string, unknown>>) || []

  if (status !== 'completed' || tabs.length === 0) return null

  return (
    <div className="tool-detail">
      <Row label="Open tabs">{tabs.length}</Row>
      {tabs.slice(0, 6).map((tab, i) => (
        <Row key={i} label={tab.active ? 'Active' : `Tab ${i + 1}`}>
          {str(tab.title as string, 50)}
        </Row>
      ))}
      {tabs.length > 6 && <Row label="">+{tabs.length - 6} more</Row>}
    </div>
  )
}

const TabsCreateRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  return (
    <div className="tool-detail">
      {input.url && <Row label="URL"><span className="tool-detail-url">{input.url as string}</span></Row>}
      {status === 'completed' && r.title && (
        <Row label="Page">{str(r.title as string, 60)}</Row>
      )}
    </div>
  )
}

const ResizeWindowRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  return (
    <div className="tool-detail">
      <Row label="Size">{input.width} x {input.height}</Row>
      {status === 'completed' && (
        <Row label="Result">{r.width} x {r.height} ({r.state || 'normal'})</Row>
      )}
    </div>
  )
}

const WebFetchRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const [showContent, setShowContent] = useState(false)
  const r = obj(result)
  const statusCode = r.status as number | undefined

  return (
    <div className="tool-detail">
      <Row label="URL"><span className="tool-detail-url">{truncUrl(input.url as string || '', 80)}</span></Row>
      {status === 'completed' && (
        <>
          {statusCode !== undefined && <Row label="Status">{statusCode} {r.statusText as string}</Row>}
          {r.contentType && <Row label="Type">{str(r.contentType as string, 40)}</Row>}
          {r.content && (
            <>
              <div className="tool-detail-content">
                {showContent ? str(r.content as string, 2000) : str(r.content as string, 200)}
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
  const tree = r.tree as string | undefined
  const lineCount = tree ? tree.split('\n').length : 0

  return (
    <div className="tool-detail">
      <Row label="Filter">{(input.filter as string) || 'all'}</Row>
      {input.depth && <Row label="Depth">{input.depth as number}</Row>}
      {input.ref_id && <Row label="Element">{input.ref_id as string}</Row>}
      {status === 'completed' && tree && (
        <>
          <Row label="Elements">{lineCount}</Row>
          <div className="tool-detail-content">
            {showOutput ? str(tree, 3000) : str(tree, 200)}
          </div>
          {tree.length > 200 && (
            <button
              type="button"
              className="tool-call-toggle"
              onClick={() => setShowOutput(!showOutput)}
            >
              {showOutput ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}
      {status === 'completed' && !tree && (
        <div className="tool-detail-content">{str(result, 200)}</div>
      )}
    </div>
  )
}

const GetPageTextRenderer: FC<ToolRendererProps> = ({ result, status }) => {
  const [showFull, setShowFull] = useState(false)
  const r = obj(result)

  if (status !== 'completed') return null

  return (
    <div className="tool-detail">
      {r.title && <Row label="Page">{str(r.title as string, 60)}</Row>}
      {r.url && <Row label="URL"><span className="tool-detail-url">{truncUrl(r.url as string)}</span></Row>}
      {r.text && (
        <>
          <div className="tool-detail-content">
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
    <div className="tool-detail">
      <Row label="Query">{str(input.query, 60)}</Row>
      {status === 'completed' && elements && (
        <Row label="Found">{elements.length} element{elements.length !== 1 ? 's' : ''}</Row>
      )}
      {status === 'completed' && !elements && (
        <div className="tool-detail-content">{str(result, 200)}</div>
      )}
    </div>
  )
}

const ReadResultRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const [showFull, setShowFull] = useState(false)
  const r = obj(result)

  return (
    <div className="tool-detail">
      <Row label="Result ID">{input.result_id as string}</Row>
      {input.offset && <Row label="Offset">{input.offset as number}</Row>}
      {input.limit && <Row label="Limit">{input.limit as number}</Row>}
      {input.pattern && <Row label="Pattern">/{input.pattern as string}/</Row>}
      {status === 'completed' && r.content && (
        <>
          {r.totalLines && <Row label="Lines">{`${r.totalLines}`}</Row>}
          <div className="tool-detail-content tool-detail-mono">
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
      )}
      {status === 'completed' && !r.content && (
        <div className="tool-detail-content">{str(result, 200)}</div>
      )}
    </div>
  )
}

const ProcessResultRenderer: FC<ToolRendererProps> = ({ input, result, status }) => (
  <div className="tool-detail">
    <Row label="Result ID">{input.result_id as string}</Row>
    <div className="tool-detail-content tool-detail-mono">{str(input.code, 200)}</div>
    {status === 'completed' && (
      <div className="tool-detail-content tool-detail-mono">{str(result, 500)}</div>
    )}
  </div>
)

const ConsoleMessagesRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  const messages = (r.messages as Array<Record<string, unknown>>) || []

  return (
    <div className="tool-detail">
      {input.onlyErrors && <Row label="Filter">Errors only</Row>}
      {input.pattern && <Row label="Pattern">/{input.pattern as string}/</Row>}
      {status === 'completed' && (
        <>
          <Row label="Messages">{r.count || messages.length}</Row>
          {messages.slice(0, 10).map((msg, i) => (
            <Row key={i} label={(msg.type as string || 'log').toUpperCase()}>
              <span className="tool-detail-mono">{str(msg.text as string, 100)}</span>
            </Row>
          ))}
          {messages.length > 10 && <Row label="">+{messages.length - 10} more</Row>}
        </>
      )}
    </div>
  )
}

const NetworkRequestsRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  const requests = (r.requests as Array<Record<string, unknown>>) || []

  return (
    <div className="tool-detail">
      {input.pattern && <Row label="Pattern">/{input.pattern as string}/</Row>}
      {status === 'completed' && (
        <>
          <Row label="Requests">{r.count || requests.length}</Row>
          {requests.slice(0, 10).map((req, i) => (
            <Row key={i} label={`${(req.method as string) || 'GET'} ${req.status || ''}`}>
              <span className="tool-detail-url">{truncUrl(req.url as string || '', 60)}</span>
            </Row>
          ))}
          {requests.length > 10 && <Row label="">+{requests.length - 10} more</Row>}
        </>
      )}
    </div>
  )
}

const JavascriptToolRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)
  return (
    <div className="tool-detail">
      <div className="tool-detail-content tool-detail-mono">{str(input.code, 300)}</div>
      {status === 'completed' && (
        <Row label="Result">
          <span className="tool-detail-mono">
            {r.success !== undefined
              ? (r.result !== undefined ? str(r.result, 200) : 'Success')
              : str(result, 200)
            }
          </span>
        </Row>
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
    <div className="tool-detail">
      <Row label="Action">{actionLabels[input.action as string] || input.action as string}</Row>
      {status === 'completed' && (
        <>
          {r.frameCount !== undefined && <Row label="Frames">{`${r.frameCount}`}</Row>}
          {r.duration !== undefined && <Row label="Duration">{Math.round(r.duration as number / 1000 * 10) / 10}s</Row>}
          {r.message && <Row label="Result">{r.message as string}</Row>}
        </>
      )}
    </div>
  )
}

const InvokeSkillRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const r = obj(result)

  return (
    <div className="tool-detail">
      <Row label="Skill">{input.skill_name as string}</Row>
      {status === 'completed' && (
        r.status === 'error' ? (
          <Row label="Error"><span className="tool-detail-error-text">{r.error as string}</span></Row>
        ) : (
          <>
            {r.description && <Row label="Result">{str(r.description as string, 100)}</Row>}
            {r.message && <Row label="Message">{r.message as string}</Row>}
          </>
        )
      )}
    </div>
  )
}

const UpdatePlanRenderer: FC<ToolRendererProps> = ({ input, result, status }) => {
  const domains = (input.domains as string[]) || []
  const r = obj(result)

  return (
    <div className="tool-detail">
      <Row label="Approach">{str(input.approach, 120)}</Row>
      {domains.length > 0 && <Row label="Domains">{domains.join(', ')}</Row>}
      {status === 'completed' && r.status && (
        <Row label="Result">{r.message as string || 'Plan created'}</Row>
      )}
    </div>
  )
}

// ─── Renderer Registry ──────────────────────────────────────────────────────

export const TOOL_RENDERERS: Record<string, FC<ToolRendererProps>> = {
  computer: ComputerRenderer,
  form_input: FormInputRenderer,
  upload_image: UploadImageRenderer,
  navigate: NavigateRenderer,
  list_tabs: TabsContextRenderer,
  create_tab: TabsCreateRenderer,
  resize_window: ResizeWindowRenderer,
  fetch_url: WebFetchRenderer,
  read_page: ReadPageRenderer,
  get_page_text: GetPageTextRenderer,
  find: FindRenderer,
  read_result: ReadResultRenderer,
  process_result: ProcessResultRenderer,
  read_console_messages: ConsoleMessagesRenderer,
  read_network_requests: NetworkRequestsRenderer,
  run_javascript: JavascriptToolRenderer,
  record_gif: GifCreatorRenderer,
  update_plan: UpdatePlanRenderer,
  invoke_skill: InvokeSkillRenderer,
}
