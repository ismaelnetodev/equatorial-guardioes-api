import { useState, type ReactNode } from 'react'
import * as Network from 'expo-network'
import { LoadFailure } from './load-failure'

type RetryState = {
  networkKey: string
  isOffline: boolean
  error?: string
}

function getNetworkKey(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) {
  return `${state.isConnected ?? 'unknown'}:${state.isInternetReachable ?? 'unknown'}`
}

export function OfflineBanner({ children }: { children?: ReactNode }) {
  const networkState = Network.useNetworkState()
  const networkKey = getNetworkKey(networkState)
  const [retryState, setRetryState] = useState<RetryState | null>(null)
  const [retrying, setRetrying] = useState(false)
  const retryMatchesCurrentState = retryState?.networkKey === networkKey
  const isOffline = retryMatchesCurrentState
    ? retryState.isOffline
    : networkState.isConnected === false || networkState.isInternetReachable === false
  const retryError = retryMatchesCurrentState ? retryState.error : undefined

  async function retryConnection() {
    setRetrying(true)
    try {
      const state = await Network.getNetworkStateAsync()
      setRetryState({
        networkKey: getNetworkKey(state),
        isOffline: state.isConnected === false || state.isInternetReachable === false,
      })
    } catch (error) {
      console.error('Não foi possível verificar a conexão com a internet.', error)
      setRetryState({
        networkKey,
        isOffline: true,
        error: 'Não foi possível verificar a conexão. Tente novamente.',
      })
    } finally {
      setRetrying(false)
    }
  }

  if (!isOffline && !retryError) return children ?? null
  return <LoadFailure offline standalone retrying={retrying} onRetry={() => { void retryConnection() }} />
}
