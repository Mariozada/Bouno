/**
 * Codex OAuth authentication types
 * Based on OpenCode's implementation
 */

export interface CodexAuth {
  type: 'codex-oauth'
  accessToken: string
  refreshToken: string
  expiresAt: number  // Unix timestamp in milliseconds
  accountId?: string // ChatGPT account ID for team/org subscriptions
}

export interface TokenResponse {
  id_token: string
  access_token: string
  refresh_token: string
  expires_in?: number
}

export interface IdTokenClaims {
  chatgpt_account_id?: string
  organizations?: Array<{ id: string }>
  email?: string
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string
  }
}

export interface PkceCodes {
  verifier: string
  challenge: string
}
