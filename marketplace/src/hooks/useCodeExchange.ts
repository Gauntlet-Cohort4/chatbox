/**
 * Exchange-code auth entry point.
 *
 * On mount, checks URL for `?code=...`. If present, exchanges it for a
 * session cookie via `/auth/exchange`, strips the code from the URL, and
 * triggers the auth state refresh.
 */
import { useEffect, useRef } from 'react'
import { authExchange } from '../api/endpoints'

export function useCodeExchange(onSuccess: () => void, onError: (message: string) => void): void {
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) return

    void (async () => {
      try {
        await authExchange(code)
        // Strip the code from the URL so a refresh doesn't re-exchange
        params.delete('code')
        const newSearch = params.toString()
        const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`
        window.history.replaceState({}, '', newUrl)
        onSuccess()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Session expired. Please try again from ChatBridge.'
        onError(message)
      }
    })()
  }, [onSuccess, onError])
}
