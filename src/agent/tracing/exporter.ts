import type { TracingConfig } from './types'

const log = (...args: unknown[]) => console.log('[Tracing:Exporter]', ...args)
const logError = (...args: unknown[]) => console.error('[Tracing:Exporter]', ...args)

// Phoenix REST API span format
export interface PhoenixSpan {
  name: string
  context: {
    trace_id: string
    span_id: string
  }
  span_kind: string
  parent_id?: string | null
  start_time: string  // ISO8601
  end_time: string    // ISO8601
  status_code: string
  status_message?: string
  attributes: Record<string, unknown>
  events?: Array<{
    name: string
    timestamp: string
    attributes?: Record<string, unknown>
  }>
}

export interface CreateSpansRequest {
  data: PhoenixSpan[]
}

export class PhoenixExporter {
  private config: TracingConfig
  private buffer: PhoenixSpan[] = []
  private flushTimeout: ReturnType<typeof setTimeout> | null = null
  private flushIntervalMs = 1000

  constructor(config: TracingConfig) {
    this.config = config
  }

  updateConfig(config: TracingConfig): void {
    this.config = config
  }

  addSpan(span: PhoenixSpan): void {
    if (!this.config.enabled) return

    this.buffer.push(span)
    log('Span buffered:', span.name, `(${this.buffer.length} in buffer)`)

    // Schedule flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.flushIntervalMs)
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }

    if (this.buffer.length === 0 || !this.config.enabled) return

    const spans = [...this.buffer]
    this.buffer = []

    try {
      await this.exportSpans(spans)
      log('Flushed', spans.length, 'spans to Phoenix')
    } catch (err) {
      logError('Failed to flush spans:', err)
    }
  }

  private async exportSpans(spans: PhoenixSpan[]): Promise<void> {
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    const projectName = encodeURIComponent(this.config.projectName)
    const url = `${endpoint}/v1/projects/${projectName}/spans`

    const request: CreateSpansRequest = {
      data: spans,
    }

    log('Exporting to:', url, 'spans:', spans.length)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Phoenix export failed: ${response.status} ${text}`)
    }

    const result = await response.json()
    log('Export response:', result)
  }

  async shutdown(): Promise<void> {
    await this.flush()
  }
}

// Singleton exporter instance
let exporterInstance: PhoenixExporter | null = null

export function getExporter(config: TracingConfig): PhoenixExporter {
  if (!exporterInstance) {
    exporterInstance = new PhoenixExporter(config)
  } else {
    exporterInstance.updateConfig(config)
  }
  return exporterInstance
}
