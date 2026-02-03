import { useState, useEffect } from "react"
import "./styles/App.css"

interface TabInfo {
  title: string
  url: string
  id: number
}

interface Link {
  href: string
  text: string
}

function App() {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null)
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("info")

  useEffect(() => {
    // Get current tab info on load
    chrome.runtime.sendMessage({ type: "GET_TAB_INFO" }, (response: TabInfo) => {
      if (response) {
        setTabInfo(response)
      }
    })
  }, [])

  const handleGetLinks = () => {
    setLoading(true)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "GET_LINKS" }, (response: { links?: Link[] }) => {
          if (response?.links) {
            setLinks(response.links.slice(0, 20))
          }
          setLoading(false)
        })
      }
    })
  }

  const handleHighlight = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "HIGHLIGHT_TEXT",
          color: "#ffeb3b",
        })
      }
    })
  }

  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1>BrowseRun</h1>
        <p className="subtitle">Browser Enhancement Tool</p>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          Info
        </button>
        <button
          className={`tab-btn ${activeTab === "tools" ? "active" : ""}`}
          onClick={() => setActiveTab("tools")}
        >
          Tools
        </button>
        <button
          className={`tab-btn ${activeTab === "links" ? "active" : ""}`}
          onClick={() => setActiveTab("links")}
        >
          Links
        </button>
      </nav>

      <main className="popup-content">
        {activeTab === "info" && (
          <section className="tab-panel">
            <h2>Current Page</h2>
            {tabInfo ? (
              <div className="info-card">
                <div className="info-item">
                  <span className="label">Title:</span>
                  <span className="value">{tabInfo.title || "N/A"}</span>
                </div>
                <div className="info-item">
                  <span className="label">URL:</span>
                  <span className="value url">{tabInfo.url || "N/A"}</span>
                </div>
              </div>
            ) : (
              <p className="loading-text">Loading tab info...</p>
            )}
          </section>
        )}

        {activeTab === "tools" && (
          <section className="tab-panel">
            <h2>Quick Tools</h2>
            <div className="tools-grid">
              <button className="tool-btn" onClick={handleHighlight}>
                <span className="icon">🖍️</span>
                <span>Highlight Selection</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => {
                  if (tabInfo?.url) {
                    navigator.clipboard.writeText(tabInfo.url)
                  }
                }}
              >
                <span className="icon">📋</span>
                <span>Copy URL</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                      chrome.tabs.reload(tabs[0].id)
                    }
                  })
                }}
              >
                <span className="icon">🔄</span>
                <span>Reload Page</span>
              </button>
              <button
                className="tool-btn"
                onClick={() => {
                  chrome.tabs.create({ url: "chrome://extensions" })
                }}
              >
                <span className="icon">⚙️</span>
                <span>Extensions</span>
              </button>
            </div>
          </section>
        )}

        {activeTab === "links" && (
          <section className="tab-panel">
            <h2>Page Links</h2>
            <button
              className="action-btn"
              onClick={handleGetLinks}
              disabled={loading}
            >
              {loading ? "Loading..." : "Extract Links"}
            </button>
            {links.length > 0 && (
              <ul className="links-list">
                {links.map((link, index) => (
                  <li key={index}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.text || link.href}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      <footer className="popup-footer">
        <span>BrowseRun v1.0.0</span>
      </footer>
    </div>
  )
}

export default App
