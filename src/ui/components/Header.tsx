import type { FC } from 'react'
import type { TabInfo } from '../types'

interface HeaderProps {
  currentTab: TabInfo | null
}

export const Header: FC<HeaderProps> = ({ currentTab }) => {
  return (
    <>
      <header className="panel-header">
        <h1>BrowseRun</h1>
        <div className="tab-info">
          {currentTab ? (
            <>
              <span className="tab-id">Tab {currentTab.id}</span>
              <span className="tab-title" title={currentTab.url}>
                {currentTab.title.slice(0, 20) || 'Untitled'}
              </span>
            </>
          ) : (
            <span>No tab selected</span>
          )}
        </div>
      </header>
      {currentTab && (
        <div className="tab-url">
          {currentTab.url.slice(0, 60)}
          {currentTab.url.length > 60 ? '...' : ''}
        </div>
      )}
    </>
  )
}
