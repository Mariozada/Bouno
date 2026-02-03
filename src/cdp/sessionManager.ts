/**
 * CDP Session Manager
 *
 * Manages debugger attachment lifecycle with auto-detach after inactivity.
 * This minimizes the time the "debugging" warning bar is shown to users.
 */

import * as cdp from './client'

// Auto-detach timeout (30 seconds of inactivity)
const AUTO_DETACH_TIMEOUT = 30_000

// Activity timestamps per tab
const lastActivity = new Map<number, number>()

// Detach timers per tab
const detachTimers = new Map<number, ReturnType<typeof setTimeout>>()

// Session locks (prevent concurrent attach/detach)
const sessionLocks = new Map<number, Promise<void>>()

/**
 * Update activity timestamp and reset detach timer
 */
function touchSession(tabId: number): void {
  lastActivity.set(tabId, Date.now())

  // Clear existing timer
  const existingTimer = detachTimers.get(tabId)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // Set new auto-detach timer
  const timer = setTimeout(() => {
    autoDetach(tabId)
  }, AUTO_DETACH_TIMEOUT)

  detachTimers.set(tabId, timer)
}

/**
 * Auto-detach after inactivity
 */
async function autoDetach(tabId: number): Promise<void> {
  const lastTime = lastActivity.get(tabId) || 0
  const elapsed = Date.now() - lastTime

  if (elapsed >= AUTO_DETACH_TIMEOUT && cdp.isAttached(tabId)) {
    console.log(`CDP: Auto-detaching from tab ${tabId} after ${elapsed}ms inactivity`)
    try {
      await cdp.detach(tabId)
    } catch (err) {
      console.warn(`CDP: Auto-detach failed for tab ${tabId}:`, err)
    }
  }

  detachTimers.delete(tabId)
  lastActivity.delete(tabId)
}

/**
 * Ensure session is active (attach if needed)
 */
async function ensureSession(tabId: number): Promise<void> {
  // Wait for any pending lock
  const existingLock = sessionLocks.get(tabId)
  if (existingLock) {
    await existingLock
  }

  // Create new lock
  let resolveLock: () => void
  const lock = new Promise<void>(resolve => {
    resolveLock = resolve
  })
  sessionLocks.set(tabId, lock)

  try {
    if (!cdp.isAttached(tabId)) {
      await cdp.attach(tabId)
    }
    touchSession(tabId)
  } finally {
    sessionLocks.delete(tabId)
    resolveLock!()
  }
}

/**
 * Execute a function within a CDP session
 *
 * Automatically attaches if needed and resets the auto-detach timer.
 * Use this for all CDP operations to ensure proper session management.
 */
export async function withSession<T>(
  tabId: number,
  fn: () => Promise<T>
): Promise<T> {
  await ensureSession(tabId)

  try {
    const result = await fn()
    touchSession(tabId) // Reset timer after successful operation
    return result
  } catch (err) {
    // Don't reset timer on error - might want to detach sooner
    throw err
  }
}

/**
 * Force detach from a tab (user closes extension, navigation, etc.)
 */
export async function forceDetach(tabId: number): Promise<void> {
  // Clear timers
  const timer = detachTimers.get(tabId)
  if (timer) {
    clearTimeout(timer)
    detachTimers.delete(tabId)
  }
  lastActivity.delete(tabId)

  // Detach
  if (cdp.isAttached(tabId)) {
    await cdp.detach(tabId)
  }
}

/**
 * Force detach from all tabs
 */
export async function forceDetachAll(): Promise<void> {
  const tabs = Array.from(lastActivity.keys())
  await Promise.all(tabs.map(forceDetach))
}

/**
 * Check if a session is currently active
 */
export function isSessionActive(tabId: number): boolean {
  return cdp.isAttached(tabId)
}

/**
 * Get time until auto-detach (for debugging/UI)
 */
export function getTimeUntilDetach(tabId: number): number | null {
  const lastTime = lastActivity.get(tabId)
  if (!lastTime) return null

  const elapsed = Date.now() - lastTime
  const remaining = AUTO_DETACH_TIMEOUT - elapsed
  return remaining > 0 ? remaining : 0
}

// ============================================================================
// Convenience methods that wrap CDP calls with session management
// ============================================================================

/**
 * Send CDP command with session management
 */
export async function send<T = unknown>(
  tabId: number,
  method: string,
  params?: object
): Promise<T> {
  return withSession(tabId, () => cdp.send<T>(tabId, method, params))
}

/**
 * Send multiple CDP commands in parallel with session management
 */
export async function sendAll<T extends unknown[]>(
  tabId: number,
  commands: Array<{ method: string; params?: object }>
): Promise<T> {
  return withSession(tabId, () => cdp.sendAll<T>(tabId, commands))
}

/**
 * Enable a CDP domain with session management
 */
export async function enableDomain(tabId: number, domain: string): Promise<void> {
  return withSession(tabId, () => cdp.enableDomain(tabId, domain))
}
