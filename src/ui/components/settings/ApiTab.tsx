import { useState, useCallback, useEffect, type FC } from 'react'
import {
  AlertCircle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'

interface RelayConfig {
  enabled: boolean
  url: string
  token: string
}

const STORAGE_KEY = 'bouno_relay_config'

export const ApiTab: FC = () => {
  const [config, setConfig] = useState<RelayConfig>({ enabled: false, url: '', token: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [copiedMcp, setCopiedMcp] = useState(false)
  const [copiedCurl, setCopiedCurl] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      const saved = result[STORAGE_KEY] as RelayConfig | undefined
      if (saved) setConfig(saved)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = useCallback(async () => {
    if (config.enabled && !config.url.trim()) {
      setError('Server URL is required when enabled')
      return
    }
    if (config.enabled && !config.token.trim()) {
      setError('Token is required when enabled')
      return
    }

    setError(null)
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: config })
      setSuccess('Saved')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [config])

  const handleToggle = useCallback(async () => {
    const updated = { ...config, enabled: !config.enabled }
    if (updated.enabled && (!updated.url.trim() || !updated.token.trim())) {
      setError('Configure URL and token before enabling')
      return
    }
    setConfig(updated)
    setError(null)
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: updated })
      setSuccess(updated.enabled ? 'Connected' : 'Disconnected')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [config])

  const baseUrl = config.url.replace(/\/ws\/?$/, '').replace(/\/$/, '')

  const mcpJson = config.url ? JSON.stringify({
    mcpServers: {
      bouno: {
        url: baseUrl + '/mcp',
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      },
    },
  }, null, 2) : ''

  const curlSnippet = `# List tools
curl ${baseUrl}/tools \\
  -H "Authorization: Bearer ${config.token}"

# Execute a tool
curl -X POST ${baseUrl}/tools/page_read_text \\
  -H "Authorization: Bearer ${config.token}" \\
  -H "Content-Type: application/json" \\
  -d '{"tabId": 1}'`

  const handleCopy = useCallback(async (text: string, type: 'mcp' | 'curl') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'mcp') {
        setCopiedMcp(true)
        setTimeout(() => setCopiedMcp(false), 2000)
      } else {
        setCopiedCurl(true)
        setTimeout(() => setCopiedCurl(false), 2000)
      }
    } catch {
      setError('Failed to copy')
    }
  }, [])

  if (isLoading) return <div className="loading">Loading...</div>

  return (
    <div className="settings-tab-content">
      {error && (
        <div className="status-message error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
      {success && (
        <div className="status-message success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Connection toggle */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4>Relay Server</h4>
          <button
            type="button"
            className="icon-button"
            onClick={handleToggle}
            title={config.enabled ? 'Disable' : 'Enable'}
          >
            {config.enabled
              ? <ToggleRight size={24} />
              : <ToggleLeft size={24} />}
          </button>
        </div>
        <span className="skill-description">
          Connect to a relay server to expose tools via HTTP, MCP, and other integrations.
        </span>
      </div>

      {/* URL + Token */}
      <div className="settings-section">
        <div className="form-group">
          <label>Server URL</label>
          <input
            type="text"
            value={config.url}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            placeholder="ws://localhost:4821/ws"
            spellCheck={false}
          />
        </div>

        <div className="form-group">
          <label>Token</label>
          <div className="input-with-button">
            <input
              type={showToken ? 'text' : 'password'}
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              placeholder="brly_..."
              spellCheck={false}
            />
            <button
              type="button"
              className="input-icon-button"
              onClick={() => setShowToken(!showToken)}
              title={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="button-row">
          <button
            type="button"
            className="button-primary"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>

      {/* MCP config snippet */}
      {config.url && config.token && (
        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4>MCP Config</h4>
            <button
              type="button"
              className="icon-button"
              onClick={() => handleCopy(mcpJson, 'mcp')}
              title="Copy to clipboard"
            >
              {copiedMcp ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <span className="skill-description">
            Paste into Claude Desktop, Cursor, or any MCP-compatible client.
          </span>
          <pre className="api-config-block">{mcpJson}</pre>
        </div>
      )}

      {/* HTTP example */}
      {config.url && config.token && (
        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4>HTTP / cURL</h4>
            <button
              type="button"
              className="icon-button"
              onClick={() => handleCopy(curlSnippet, 'curl')}
              title="Copy to clipboard"
            >
              {copiedCurl ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <span className="skill-description">
            Use HTTP endpoints directly from scripts or apps.
          </span>
          <pre className="api-config-block">{curlSnippet}</pre>
        </div>
      )}
    </div>
  )
}
