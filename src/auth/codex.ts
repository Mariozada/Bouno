/**
 * Codex OAuth implementation for Bouno
 * Ported from OpenCode's plugin/codex.ts
 *
 * Allows users to authenticate with their ChatGPT Pro/Plus subscription
 * instead of using an API key.
 */

import type { PkceCodes, TokenResponse, IdTokenClaims, CodexAuth } from './types'

// OAuth Configuration (same as OpenCode)
export const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
export const ISSUER = 'https://auth.openai.com'
export const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses'

// Allowed Codex models
export const CODEX_MODELS = new Set([
  'gpt-5.1-codex-max',
  'gpt-5.1-codex-mini',
  'gpt-5.2',
  'gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.1-codex',
])

/**
 * Generate a random string for PKCE verifier
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

/**
 * Base64 URL encode a buffer
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<PkceCodes> {
  const verifier = generateRandomString(43)
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const challenge = base64UrlEncode(hash)
  return { verifier, challenge }
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer)
}

/**
 * Build the OAuth authorization URL
 */
export function buildAuthorizeUrl(redirectUri: string, pkce: PkceCodes, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid profile email offline_access',
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state,
    originator: 'bouno',
  })
  return `${ISSUER}/oauth/authorize?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  pkce: PkceCodes
): Promise<TokenResponse> {
  const response = await fetch(`${ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: pkce.verifier,
    }).toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${response.status} - ${text}`)
  }

  return response.json()
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(`${ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }).toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token refresh failed: ${response.status} - ${text}`)
  }

  return response.json()
}

/**
 * Parse JWT claims from token
 */
export function parseJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split('.')
  if (parts.length !== 3) return undefined

  try {
    // Decode base64url to base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    return JSON.parse(decoded)
  } catch {
    return undefined
  }
}

/**
 * Extract account ID from JWT claims
 */
export function extractAccountIdFromClaims(claims: IdTokenClaims): string | undefined {
  return (
    claims.chatgpt_account_id ||
    claims['https://api.openai.com/auth']?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

/**
 * Extract account ID from token response
 */
export function extractAccountId(tokens: TokenResponse): string | undefined {
  if (tokens.id_token) {
    const claims = parseJwtClaims(tokens.id_token)
    const accountId = claims && extractAccountIdFromClaims(claims)
    if (accountId) return accountId
  }

  if (tokens.access_token) {
    const claims = parseJwtClaims(tokens.access_token)
    return claims ? extractAccountIdFromClaims(claims) : undefined
  }

  return undefined
}

/**
 * Check if token is expired (with 5 minute buffer)
 */
export function isTokenExpired(auth: CodexAuth): boolean {
  const bufferMs = 5 * 60 * 1000 // 5 minutes
  return Date.now() >= auth.expiresAt - bufferMs
}

/**
 * Create CodexAuth object from token response
 */
export function createCodexAuth(tokens: TokenResponse): CodexAuth {
  return {
    type: 'codex-oauth',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    accountId: extractAccountId(tokens),
  }
}

/**
 * Create custom fetch function for Codex API
 * Handles OAuth headers and URL rewriting
 */
export function createCodexFetch(
  getAuth: () => Promise<CodexAuth | undefined>,
  refreshAuth: (newAuth: CodexAuth) => Promise<void>
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let auth = await getAuth()
    if (!auth) {
      throw new Error('Codex authentication required')
    }

    // Refresh token if expired
    if (isTokenExpired(auth)) {
      console.log('[Codex] Refreshing access token...')
      try {
        const tokens = await refreshAccessToken(auth.refreshToken)
        auth = createCodexAuth(tokens)
        // Preserve existing accountId if new token doesn't have one
        if (!auth.accountId && (await getAuth())?.accountId) {
          auth.accountId = (await getAuth())?.accountId
        }
        await refreshAuth(auth)
      } catch (error) {
        console.error('[Codex] Token refresh failed:', error)
        throw new Error('Failed to refresh Codex authentication. Please login again.')
      }
    }

    // Build headers
    const headers = new Headers(init?.headers)

    // Remove any existing authorization (we'll set our own)
    headers.delete('authorization')
    headers.delete('Authorization')

    // Set Codex authorization
    headers.set('Authorization', `Bearer ${auth.accessToken}`)

    // Set account ID header for team subscriptions
    if (auth.accountId) {
      headers.set('ChatGPT-Account-Id', auth.accountId)
    }

    // Set originator header
    headers.set('originator', 'bouno')

    // Rewrite URL to Codex endpoint
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const parsed = new URL(url)

    // Rewrite standard OpenAI endpoints to Codex
    let finalUrl = url
    if (parsed.pathname.includes('/v1/responses') ||
        parsed.pathname.includes('/chat/completions') ||
        parsed.pathname.includes('/v1/chat/completions')) {
      finalUrl = CODEX_API_ENDPOINT
    }

    return fetch(finalUrl, {
      ...init,
      headers,
    })
  }
}
