/**
 * Shortcuts Tools
 * Handles: shortcuts_list, shortcuts_execute
 */

import { registerTool } from './registry'

// Shortcut interface
interface Shortcut {
  id: string
  command: string
  description: string
  prompt?: string
}

// Storage key for shortcuts
const SHORTCUTS_STORAGE_KEY = 'browserun_shortcuts'

/**
 * shortcuts_list - List all available shortcuts/workflows
 */
async function shortcutsList(): Promise<{
  shortcuts: Shortcut[]
  count: number
}> {
  const result = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
  const shortcuts: Shortcut[] = result[SHORTCUTS_STORAGE_KEY] || []

  return {
    shortcuts: shortcuts.map(s => ({
      id: s.id,
      command: s.command,
      description: s.description
    })),
    count: shortcuts.length
  }
}

/**
 * shortcuts_execute - Execute a shortcut or workflow
 */
async function shortcutsExecute(params: {
  shortcutId?: string
  command?: string
}): Promise<{
  status: string
  shortcutId?: string
  command?: string
  message: string
}> {
  const { shortcutId, command } = params

  if (!shortcutId && !command) {
    throw new Error('Either shortcutId or command is required')
  }

  // Get shortcuts from storage
  const result = await chrome.storage.local.get(SHORTCUTS_STORAGE_KEY)
  const shortcuts: Shortcut[] = result[SHORTCUTS_STORAGE_KEY] || []

  // Find the shortcut
  let shortcut: Shortcut | undefined

  if (shortcutId) {
    shortcut = shortcuts.find(s => s.id === shortcutId)
  } else if (command) {
    // Remove leading slash if present
    const normalizedCommand = command.replace(/^\//, '')
    shortcut = shortcuts.find(s => s.command === normalizedCommand)
  }

  if (!shortcut) {
    throw new Error(
      shortcutId
        ? `Shortcut not found: ${shortcutId}`
        : `Shortcut command not found: ${command}`
    )
  }

  // Execute the shortcut by opening side panel with the prompt
  // This starts execution and returns immediately
  await chrome.runtime.sendMessage({
    type: 'EXECUTE_SHORTCUT',
    shortcut
  })

  return {
    status: 'executing',
    shortcutId: shortcut.id,
    command: shortcut.command,
    message: `Shortcut "${shortcut.command}" started execution in side panel.`
  }
}

/**
 * Register shortcuts tools
 */
export function registerShortcutsTools(): void {
  registerTool('shortcuts_list', shortcutsList)
  registerTool('shortcuts_execute', shortcutsExecute as (params: Record<string, unknown>) => Promise<unknown>)
}
