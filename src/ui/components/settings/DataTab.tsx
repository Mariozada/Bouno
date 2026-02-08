import { useState, useCallback, useRef, type FC } from 'react'
import { Download, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { exportAndDownload, readImportFile, importChats, type ImportResult } from '@storage/chatExport'

interface DataTabProps {
  onRefreshThreads?: () => Promise<void>
}

export const DataTab: FC<DataTabProps> = ({ onRefreshThreads }) => {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      await exportAndDownload()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportResult(null)

    try {
      const data = await readImportFile(file)
      if (!data) {
        setImportResult({
          success: false,
          threadsImported: 0,
          messagesImported: 0,
          attachmentsImported: 0,
          error: 'Invalid file format',
        })
        return
      }

      const result = await importChats(data, 'merge')
      setImportResult(result)

      if (result.success && onRefreshThreads) {
        await onRefreshThreads()
      }
    } catch (err) {
      setImportResult({
        success: false,
        threadsImported: 0,
        messagesImported: 0,
        attachmentsImported: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [onRefreshThreads])

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h4>Export & Import</h4>

        <div className="form-group">
          <button
            type="button"
            className="button-secondary full-width"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download size={16} />
            {isExporting ? 'Exporting...' : 'Export All Chats'}
          </button>
          <span className="help-text">
            Download all conversations as a JSON file
          </span>
        </div>

        <div className="form-group">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="button-secondary full-width"
            onClick={handleImportClick}
            disabled={isImporting}
          >
            <Upload size={16} />
            {isImporting ? 'Importing...' : 'Import Chats'}
          </button>
          <span className="help-text">
            Import conversations from a backup file (merges with existing)
          </span>
        </div>

        {importResult && (
          <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
            {importResult.success ? (
              <>
                <CheckCircle size={16} />
                <span>
                  Imported {importResult.threadsImported} threads,{' '}
                  {importResult.messagesImported} messages
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                <span>{importResult.error}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
