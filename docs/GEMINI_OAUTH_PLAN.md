# Gemini OAuth Integration Plan for Bouno

## Overview

This document outlines the plan to integrate Google Gemini OAuth into the Bouno Chrome extension, allowing users to authenticate with their Google account and use Gemini models through their existing Gemini/Google AI Studio subscription instead of API billing.

---

## Current Architecture

### Existing Auth System (Codex OAuth)
- **Location**: `src/auth/codex.ts`, `src/background/codexOAuth.ts`
- **Flow**: Device Authorization Grant (RFC 8628)
- **Storage**: `chrome.storage.local` via `ProviderSettings.codexAuth`
- **UI**: Toggle between "API Key" and "ChatGPT Login" in ProviderTab

### Provider System
- **Location**: `src/agent/providers.ts`, `src/agent/config.ts`
- **Pattern**: Factory function `createProvider()` that returns AI SDK `LanguageModel`
- **Google Provider**: Uses `@ai-sdk/google` with API key

---

## Gemini OAuth Implementation

### OAuth Configuration (from opencode-gemini-auth)

```typescript
// OAuth credentials (same as Google's Gemini CLI)
const GEMINI_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com'
const GEMINI_CLIENT_SECRET = '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'

// Endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GEMINI_API_ENDPOINT = 'https://cloudcode-pa.googleapis.com'

// Scopes
const GEMINI_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')
```

### Chrome Extension OAuth Approach

Instead of using a local HTTP server (like the CLI version), we'll use Chrome's `chrome.identity.launchWebAuthFlow` API:

```typescript
// Redirect URI for Chrome extensions
const REDIRECT_URI = chrome.identity.getRedirectURL('gemini')
// Results in: https://<extension-id>.chromiumapp.org/gemini
```

This is simpler and more secure for Chrome extensions.

---

## Files to Create/Modify

### 1. New Files

| File | Purpose |
|------|---------|
| `src/auth/gemini.ts` | Gemini OAuth core logic (PKCE, token exchange, refresh) |
| `src/background/geminiOAuth.ts` | Background script handlers for Gemini OAuth flow |

### 2. Files to Modify

| File | Changes |
|------|---------|
| `src/auth/types.ts` | Add `GeminiAuth` interface |
| `src/auth/index.ts` | Export Gemini auth functions |
| `src/shared/messages.ts` | Add `GEMINI_OAUTH_*` message types |
| `src/shared/settings.ts` | Add `geminiAuth?: GeminiAuth` to `ProviderSettings` |
| `src/background/index.ts` | Add Gemini OAuth message handlers |
| `src/agent/providers.ts` | Add `createGeminiOAuthProvider()` function |
| `src/agent/config.ts` | Add Gemini OAuth models (same models but marked as OAuth-only) |
| `src/ui/components/settings/ProviderTab.tsx` | Add Google auth mode toggle (similar to OpenAI) |

---

## Detailed Implementation Plan

### Phase 1: Auth Types & Core Logic

#### 1.1 Add GeminiAuth type (`src/auth/types.ts`)

```typescript
export interface GeminiAuth {
  type: 'gemini-oauth'
  accessToken: string
  refreshToken: string
  expiresAt: number  // Unix timestamp in milliseconds
  email?: string     // User's Google email
  projectId?: string // Resolved Google Cloud project ID
}
```

#### 1.2 Create Gemini OAuth module (`src/auth/gemini.ts`)

Key functions:
- `generatePKCE()` - Generate PKCE code verifier and challenge
- `buildGeminiAuthUrl()` - Build OAuth authorization URL
- `exchangeGeminiCodeForTokens()` - Exchange auth code for tokens
- `refreshGeminiAccessToken()` - Refresh expired access token
- `createGeminiAuth()` - Create GeminiAuth object from token response
- `isGeminiTokenExpired()` - Check if token needs refresh
- `createGeminiFetch()` - Create custom fetch with OAuth headers

### Phase 2: Background Script Integration

#### 2.1 Add message types (`src/shared/messages.ts`)

```typescript
// Gemini OAuth messages
GEMINI_OAUTH_START: 'GEMINI_OAUTH_START',
GEMINI_OAUTH_LOGOUT: 'GEMINI_OAUTH_LOGOUT',
```

#### 2.2 Create background handler (`src/background/geminiOAuth.ts`)

```typescript
export async function startGeminiOAuth(): Promise<GeminiOAuthResult> {
  // 1. Generate PKCE
  const pkce = await generatePKCE()
  const state = generateState()

  // 2. Build auth URL
  const authUrl = buildGeminiAuthUrl(pkce, state)

  // 3. Launch Chrome identity flow
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  })

  // 4. Extract code from response URL
  const code = new URL(responseUrl).searchParams.get('code')

  // 5. Exchange code for tokens
  const tokens = await exchangeGeminiCodeForTokens(code, pkce)

  // 6. Create and save auth
  const geminiAuth = createGeminiAuth(tokens)

  // 7. Save to settings
  const settings = await loadSettings()
  settings.geminiAuth = geminiAuth
  await saveSettings(settings)

  return { success: true }
}
```

### Phase 3: Provider Integration

#### 3.1 Update settings (`src/shared/settings.ts`)

```typescript
export interface ProviderSettings {
  // ... existing fields
  geminiAuth?: GeminiAuth  // Gemini OAuth authentication
}
```

#### 3.2 Create Gemini OAuth provider (`src/agent/providers.ts`)

```typescript
function createGeminiOAuthProvider(settings: ProviderSettings): LanguageModel {
  if (!settings.geminiAuth) {
    throw new ProviderError('Gemini authentication required')
  }

  const geminiFetch = createGeminiFetch(
    async () => {
      const currentSettings = await loadSettings()
      return currentSettings.geminiAuth
    },
    async (newAuth: GeminiAuth) => {
      const currentSettings = await loadSettings()
      currentSettings.geminiAuth = newAuth
      await saveSettings(currentSettings)
    }
  )

  const google = createGoogleGenerativeAI({
    apiKey: 'gemini-oauth', // Placeholder
    fetch: geminiFetch,
  })

  return wrapWithDebugMiddleware(google(settings.model))
}
```

#### 3.3 Update config (`src/agent/config.ts`)

Add `geminiOAuthOnly` flag to models that require OAuth:

```typescript
google: {
  name: 'Google Gemini',
  description: 'Gemini models - Login with Google or use API key',
  models: [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', vision: true, recommended: true },
    // ... more models
  ],
}
```

### Phase 4: UI Integration

#### 4.1 Update ProviderTab (`src/ui/components/settings/ProviderTab.tsx`)

Add auth mode toggle for Google provider (similar to OpenAI):

```tsx
{isGoogle && (
  <div className="form-group">
    <label>Authentication Method</label>
    <div className="auth-mode-toggle">
      <button
        type="button"
        className={`auth-mode-btn ${googleAuthMode === 'api-key' ? 'active' : ''}`}
        onClick={() => setGoogleAuthMode('api-key')}
      >
        <Key size={14} />
        API Key
      </button>
      <button
        type="button"
        className={`auth-mode-btn ${googleAuthMode === 'google-login' ? 'active' : ''}`}
        onClick={() => setGoogleAuthMode('google-login')}
      >
        <User size={14} />
        Google Login
      </button>
    </div>
  </div>
)}

{isGoogle && googleAuthMode === 'google-login' && (
  <div className="form-group gemini-auth-section">
    {hasGeminiAuth ? (
      <div className="gemini-logged-in">
        <span className="gemini-status">
          Logged in as {settings.geminiAuth?.email || 'Google User'}
        </span>
        <button onClick={handleGeminiLogout} disabled={geminiLoading}>
          {geminiLoading ? <Loader2 className="spinning" /> : <LogOut />}
          Logout
        </button>
      </div>
    ) : (
      <button onClick={handleGeminiLogin} disabled={geminiLoading}>
        {geminiLoading ? <Loader2 className="spinning" /> : <LogIn />}
        Login with Google
      </button>
    )}
  </div>
)}
```

---

## API Request Transformation

When making requests to Gemini with OAuth, the fetch wrapper needs to:

1. **Add Authorization header**: `Bearer ${accessToken}`
2. **Add custom headers**:
   ```typescript
   headers['x-goog-api-client'] = 'genai-js/0.9.15'
   headers['x-goog-api-key'] = accessToken // Some endpoints need this
   ```
3. **Handle project context**: If using managed project, include project ID in URL
4. **Token refresh**: Automatically refresh if token is expired

---

## Error Handling

### Token Errors
- `invalid_grant`: Token revoked, clear auth and prompt re-login
- `401 Unauthorized`: Token expired, attempt refresh
- `429 RESOURCE_EXHAUSTED`: Quota exceeded (distinguish daily limit vs rate limit)

### Retry Logic
- Retry on 429 and 503 with exponential backoff
- Respect `Retry-After` headers
- Max retries: 3

---

## Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens are stored correctly in chrome.storage
- [ ] Token refresh works when access token expires
- [ ] Logout clears all auth data
- [ ] API requests include correct headers
- [ ] Error handling for invalid/revoked tokens
- [ ] UI shows correct auth state
- [ ] Model selection shows OAuth models when logged in

---

## Security Considerations

1. **Token Storage**: Tokens stored in `chrome.storage.local` (extension-only access)
2. **PKCE**: Use PKCE for OAuth flow (prevents authorization code interception)
3. **State Parameter**: Validate state to prevent CSRF attacks
4. **Token Refresh**: Don't expose refresh token in API requests
5. **Logout**: Clear all tokens on logout

---

## Implementation Order

1. ✅ Research (done - analyzed opencode-gemini-auth)
2. 🔲 Phase 1: Auth types & core logic
3. 🔲 Phase 2: Background script integration
4. 🔲 Phase 3: Provider integration
5. 🔲 Phase 4: UI integration
6. 🔲 Testing & bug fixes

---

## References

- [opencode-gemini-auth](https://github.com/jenslys/opencode-gemini-auth) - Reference implementation
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [AI SDK Google Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai)
