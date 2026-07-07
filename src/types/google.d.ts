interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  error?: string
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type: string; message?: string }) => void
  }) => GoogleTokenClient
  revoke: (accessToken: string, callback?: () => void) => void
}

interface GoogleAccounts {
  oauth2: GoogleOAuth2
}

interface GoogleNamespace {
  accounts: GoogleAccounts
}

declare const google: GoogleNamespace
