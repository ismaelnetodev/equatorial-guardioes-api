import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Button, colors } from '../../components/ui'
import { ApiError, errorMessage } from '../../services/api'
import { getModuleCompletion, type ModuleCompletion } from '../../features/trails/completion.api'
import { ModuleCompletionScreen } from '../../features/trails/module-completion-screen'

export default function ModuleCompletionRoute() {
  const { moduleId, trailId } = useLocalSearchParams<{ moduleId: string; trailId?: string }>()
  const [data, setData] = useState<ModuleCompletion | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError('')
    async function load() {
      try {
        if (typeof moduleId !== 'string' || !moduleId) throw new ApiError(400, 'INVALID_MODULE', 'Volte à trilha e selecione um módulo.')
        const result = await getModuleCompletion(moduleId, trailId, controller.signal)
        if (!controller.signal.aborted) setData(result)
      } catch (cause) {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
        setError(errorMessage(cause, 'Não foi possível carregar o resumo. Tente novamente.'))
      }
    }
    void load()
    return () => controller.abort()
  }, [moduleId, trailId, attempt])
  if (data) return <ModuleCompletionScreen data={data} onTrail={() => router.replace({ pathname: '/trilha', params: { trailId: data.trailId } })} onReport={() => router.replace({ pathname: '/trilha', params: { trailId: data.trailId, panel: 'report' } })} />
  return <SafeAreaView style={styles.screen}><StatusBar style="light" /><View style={styles.content}>{error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /><Button title="Voltar à trilha" outline onPress={() => router.replace('/trilha')} /></> : <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando conclusão do módulo" />}</View></SafeAreaView>
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#0B1240' }, content: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: 430, alignSelf: 'center', padding: 24, gap: 18 }, error: { color: colors.muted, fontSize: 15, lineHeight: 23 } })
