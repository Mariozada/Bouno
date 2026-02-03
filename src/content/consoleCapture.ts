/**
 * Console Capture
 * Intercepts console messages for debugging tools
 */

import { MAX_CONSOLE_MESSAGES } from '@shared/constants'
import type { ConsoleMessage } from '@shared/types'

// Buffer for captured messages
const consoleMessages: ConsoleMessage[] = []

// Track if capture is set up
let captureInitialized = false

/**
 * Capture a console message
 */
function captureMessage(type: ConsoleMessage['type'], args: unknown[]): void {
  const message: ConsoleMessage = {
    type,
    text: args.map(arg => {
      try {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      } catch {
        return String(arg)
      }
    }).join(' '),
    timestamp: Date.now()
  }

  consoleMessages.push(message)
  if (consoleMessages.length > MAX_CONSOLE_MESSAGES) {
    consoleMessages.shift()
  }

  // Send to background script
  chrome.runtime.sendMessage({
    type: 'CONSOLE_MESSAGE',
    data: message
  }).catch(() => {
    // Ignore errors if background isn't ready
  })
}

/**
 * Set up console capture by wrapping console methods
 */
export function setupConsoleCapture(): void {
  if (captureInitialized) return
  captureInitialized = true

  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
  }

  console.log = function(...args: unknown[]) {
    captureMessage('log', args)
    originalConsole.log.apply(console, args)
  }

  console.error = function(...args: unknown[]) {
    captureMessage('error', args)
    originalConsole.error.apply(console, args)
  }

  console.warn = function(...args: unknown[]) {
    captureMessage('warn', args)
    originalConsole.warn.apply(console, args)
  }

  console.info = function(...args: unknown[]) {
    captureMessage('info', args)
    originalConsole.info.apply(console, args)
  }

  console.debug = function(...args: unknown[]) {
    captureMessage('debug', args)
    originalConsole.debug.apply(console, args)
  }

  // Capture uncaught errors
  window.addEventListener('error', (event) => {
    captureMessage('exception', [event.message, 'at', event.filename, ':', event.lineno])
  })

  window.addEventListener('unhandledrejection', (event) => {
    captureMessage('exception', ['Unhandled Promise rejection:', event.reason])
  })
}

/**
 * Get captured console messages
 */
export function getConsoleMessages(): ConsoleMessage[] {
  return [...consoleMessages]
}

/**
 * Clear captured console messages
 */
export function clearConsoleMessages(): void {
  consoleMessages.length = 0
}
