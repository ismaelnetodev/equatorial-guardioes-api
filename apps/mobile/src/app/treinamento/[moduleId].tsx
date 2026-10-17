import { LoadFailure, useLoadFailureKind } from '../../components/load-failure'
import { ContentSkeleton } from '../../components/content-skeleton'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Button, colors } from '../../components/ui'
import { completeTraining, getTraining, type Training } from '../../features/learn/learn.api'
import { ApiError } from '../../services/api'

export default function TrainingScreen() {
  const { moduleId, trailId } = useLocalSearchParams<{ moduleId?: string; trailId?: string }>()
  const [training, setTraining] = useState<Training | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const { offline, recordFailure } = useLoadFailureKind()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    async function load() {
      if (!moduleId) {
        router.replace('/trilha')
        return
      }
      setLoading(true)
      setError('')
      try {
        const result = await getTraining(moduleId, controller.signal)
        if (controller.signal.aborted) return
        setTraining(result)
        setStepIndex(0)
      } catch (cause) { recordFailure(cause);
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar o treinamento.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [moduleId, attempt]))

  const steps = training?.steps ?? []
  const step = steps[stepIndex]

  async function finishTraining() {
    if (!moduleId || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await completeTraining(moduleId)
      setTraining(current => current ? { ...current, completed: result.completed, pointsAwarded: result.pointsAwarded } : current)
    } catch (cause) { recordFailure(cause);
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/entrar')
        return
      }
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível salvar a conclusão do treinamento.')
    } finally {
      setBusy(false)
    }
  }

  function returnToModule() {
    if (moduleId && trailId) {
      router.replace({ pathname: '/modulo/[moduleId]', params: { moduleId, trailId } })
      return
    }
    router.replace('/trilha')
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao módulo" onPress={returnToModule} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <Text style={styles.topTitle}>TREINAMENTO</Text>
          <View style={styles.topSpacer} />
        </View>
        {loading ? <ContentSkeleton variant="training" label="Carregando treinamento" /> :
          error && !training ? <LoadFailure offline={offline} onRetry={() => setAttempt(value => value + 1)} /> :
          training ? <>
            <Text accessibilityRole="header" style={styles.title}>{step?.title ?? 'Treinamento do módulo'}</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>{steps.length ? `Etapa ${Math.min(stepIndex + 1, steps.length)} de ${steps.length}` : 'Conteúdo do módulo'}</Text>
              <Text style={styles.progressText}>{training.completed ? 'Concluído' : step ? `${Math.round(((stepIndex + 1) / steps.length) * 100)}%` : ''}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${training.completed ? 100 : steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0}%` }]} />
            </View>
            {step ? <>
              {step.introText ? <Text style={styles.description}>{step.introText}</Text> : null}
              {step.cards.map(card => (
                <View key={card.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.description}>{card.description}</Text>
                </View>
              ))}
            </> : <Text style={styles.description}>Este módulo ainda não tem etapas de treinamento disponíveis.</Text>}
            {training.completed ? (
              <View style={styles.completed}>
                <Text style={styles.completedTitle}>Treinamento concluído</Text>
                <Text style={styles.description}>{training.pointsAwarded} pontos registrados.</Text>
                <Button title="Voltar ao módulo" onPress={returnToModule} />
              </View>
            ) : steps.length ? (
              <View style={styles.footer}>
                {stepIndex < steps.length - 1
                  ? <Button title="Próxima etapa" onPress={() => setStepIndex(index => index + 1)} />
                  : <Button title="Concluir treinamento" loading={busy} onPress={() => { void finishTraining() }} />}
              </View>
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          </> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 26 },
  topBar: { height: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  back: { width: 40, justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 35, lineHeight: 38 },
  topTitle: { color: colors.mutedSecondary, fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  topSpacer: { width: 40 },
  title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '800' },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 },
  progressText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.field },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  description: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: { gap: 8, padding: 18, marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.field },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  state: { paddingVertical: 32, gap: 14 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 24 },
  completed: { gap: 12, marginTop: 24 },
  completedTitle: { color: colors.success, fontSize: 18, fontWeight: '800' },
  error: { color: colors.warning, fontSize: 13, lineHeight: 19, marginTop: 14 },
})
