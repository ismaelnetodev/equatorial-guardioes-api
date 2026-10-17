import { useState } from 'react'
import * as Network from 'expo-network'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from './ui'

type RetryState = {
  networkKey: string
  isOffline: boolean
  error?: string
}

function getNetworkKey(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) {
  return `${state.isConnected ?? 'unknown'}:${state.isInternetReachable ?? 'unknown'}`
}

export function OfflineBanner() {
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

  if (!isOffline && !retryError) return null

  return <View style={styles.banner}>
    <Text style={styles.warningIcon} accessible={false}>⚠</Text>
    <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.message}>
      {retryError || 'Sem acesso à internet, tente novamente.'}
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tentar novamente"
      accessibilityState={{ disabled: retrying, busy: retrying }}
      disabled={retrying}
      onPress={() => { void retryConnection() }}
      style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
      {retrying
        ? <ActivityIndicator color={colors.text} accessibilityLabel="Verificando conexão" />
        : <Text style={styles.retryText}>Tentar novamente</Text>}
    </Pressable>
  </View>
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.warning,
  },
  warningIcon: { color: colors.background, fontSize: 20, fontWeight: '800' },
  message: { flex: 1, color: colors.background, fontSize: 13, fontWeight: '700' },
  retryButton: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  retryText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.75 },
})
