/**
 * Codex OAuth background handlers
 * Opens OAuth in a new tab for better UX
 */

import {
  generatePKCE,
  generateState,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  createCodexAuth,
} from '@auth/codex'
import type { CodexAuth, PkceCodes } from '@auth/types'
import { loadSettings, saveSettings } from '@shared/settings'

const DEBUG = true
const log = (...args: unknown[]) => DEBUG && console.log('[Codex:OAuth]', ...args)
const logError = (...args: unknown[]) => console.error('[Codex:OAuth]', ...args)

// Store PKCE codes and state during OAuth flow
let pendingPkce: PkceCodes | null = null
let pendingState: string | null = null
let pendingRedirectUri: string | null = null
let pendingResolve: ((result: { success: boolean; error?: string }) => void) | null = null

// Redirect URI for OAuth callback (uses extension's callback page)
const REDIRECT_URI = chrome.identity.getRedirectURL('oauth-callback')

/**
 * Start Codex OAuth flow - opens in a new tab
 */
export async function startCodexOAuth(): Promise<{ success: boolean; error?: string }> {
  log('Starting OAuth flow...')

  try {
    // Generate PKCE codes
    pendingPkce = await generatePKCE()
    pendingState = generateState()
    pendingRedirectUri = REDIRECT_URI

    log('Redirect URI:', pendingRedirectUri)

    // Build authorization URL
    const authUrl = buildAuthorizeUrl(pendingRedirectUri, pendingPkce, pendingState)
    log('Auth URL:', authUrl)

    // Open OAuth in a new tab
    const tab = await chrome.tabs.create({ url: authUrl })
    log('Opened OAuth tab:', tab.id)

    // Return a promise that will be resolved when the callback is received
    return new Promise((resolve) => {
      pendingResolve = resolve

      // Set a timeout to clean up if user doesn't complete auth
      setTimeout(() => {
        if (pendingResolve) {
          pendingResolve({ success: false, error: 'OAuth timeout - please try again' })
          cleanupOAuthState()
        }
      }, 5 * 60 * 1000) // 5 minute timeout
    })
  } catch (error) {
    logError('OAuth flow failed:', error)
    cleanupOAuthState()
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Handle OAuth callback from redirect
 */
export async function handleOAuthCallback(url: string): Promise<void> {
  log('Handling OAuth callback:', url)

  if (!pendingPkce || !pendingState || !pendingRedirectUri || !pendingResolve) {
    logError('No pending OAuth flow')
    return
  }

  try {
    const parsedUrl = new URL(url)
    const code = parsedUrl.searchParams.get('code')
    const returnedState = parsedUrl.searchParams.get('state')

    if (!code) {
      const error = parsedUrl.searchParams.get('error')
      const errorDesc = parsedUrl.searchParams.get('error_description')
      throw new Error(errorDesc || error || 'No authorization code in response')
    }

    // Verify state to prevent CSRF
    if (returnedState !== pendingState) {
      log('State mismatch - expected:', pendingState, 'got:', returnedState)
      throw new Error('State mismatch - potential CSRF attack')
    }

    // Exchange code for tokens
    log('Exchanging code for tokens...')
    const tokens = await exchangeCodeForTokens(code, pendingRedirectUri, pendingPkce)
    log('Token exchange successful')

    // Create CodexAuth object
    const codexAuth = createCodexAuth(tokens)
    log('CodexAuth created, accountId:', codexAuth.accountId)

    // Save to settings
    const settings = await loadSettings()
    settings.codexAuth = codexAuth
    await saveSettings(settings)

    log('OAuth flow completed successfully')
    pendingResolve({ success: true })
  } catch (error) {
    logError('OAuth callback failed:', error)
    pendingResolve({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    cleanupOAuthState()
  }
}

/**
 * Clean up OAuth state
 */
function cleanupOAuthState(): void {
  pendingPkce = null
  pendingState = null
  pendingRedirectUri = null
  pendingResolve = null
}

/**
 * Check if a URL is an OAuth callback
 */
export function isOAuthCallback(url: string): boolean {
  return url.startsWith(REDIRECT_URI)
}

/**
 * Logout from Codex (clear tokens)
 */
export async function logoutCodex(): Promise<{ success: boolean }> {
  log('Logging out...')

  try {
    const settings = await loadSettings()
    delete settings.codexAuth
    await saveSettings(settings)

    log('Logout successful')
    return { success: true }
  } catch (error) {
    logError('Logout failed:', error)
    return { success: false }
  }
}

/**
 * Get current Codex auth status
 */
export async function getCodexAuth(): Promise<CodexAuth | undefined> {
  const settings = await loadSettings()
  return settings.codexAuth
}

/**
 * Update Codex auth (after token refresh)
 */
export async function updateCodexAuth(auth: CodexAuth): Promise<void> {
  const settings = await loadSettings()
  settings.codexAuth = auth
  await saveSettings(settings)
}
