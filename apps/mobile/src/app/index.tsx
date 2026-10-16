import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Button, colors } from '../components/ui'
import { getAccessToken } from '../services/session'

export default function IndexScreen() {
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setError(false)
    getAccessToken().then(token => { if (active) router.replace(token ? '/trilha' : '/entrar') })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [attempt])
  return <View style={styles.screen}>{error ? <><Text style={styles.text}>Não foi possível abrir sua sessão.</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></> : <ActivityIndicator color={colors.primary} accessibilityLabel="Abrindo sua sessão" />}</View>
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: 24, gap: 20 }, text: { color: colors.text, textAlign: 'center' } })
