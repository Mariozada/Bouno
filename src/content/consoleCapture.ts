import { MAX_CONSOLE_MESSAGES } from '@shared/constants'
import type { ConsoleMessage } from '@shared/types'

const consoleMessages: ConsoleMessage[] = []

let captureInitialized = false

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

  chrome.runtime.sendMessage({
    type: 'CONSOLE_MESSAGE',
    data: message
  }).catch(() => {})
}

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

  window.addEventListener('error', (event) => {
    captureMessage('exception', [event.message, 'at', event.filename, ':', event.lineno])
  })

  window.addEventListener('unhandledrejection', (event) => {
    captureMessage('exception', ['Unhandled Promise rejection:', event.reason])
  })
}

export function getConsoleMessages(): ConsoleMessage[] {
  return [...consoleMessages]
}

export function clearConsoleMessages(): void {
  consoleMessages.length = 0
}
