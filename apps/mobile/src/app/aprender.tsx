import { useCallback, useState } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, colors } from '../components/ui'
import {
  finishPostTest,
  getPostTestQuestions,
  getPreTestQuestions,
  submitPostAnswer,
  submitPreTest,
  type PostResult,
  type PreTestResult,
  type QuizQuestions,
} from '../features/learn/learn.api'
import { completeModule } from '../features/trails/trails.api'
import { ApiError } from '../services/api'
import { getAccessToken } from '../services/session'

type Phase = 'pre' | 'pos'

export default function LearnQuizScreen() {
  const params = useLocalSearchParams<{ moduleId: string; trailId?: string; phase: string }>()
  const phase: Phase = params.phase === 'pos' ? 'pos' : 'pre'
  const [quiz, setQuiz] = useState<QuizQuestions | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preResult, setPreResult] = useState<PreTestResult | null>(null)
  const [postFeedback, setPostFeedback] = useState<{ title: string; body: string; isCorrect: boolean } | null>(null)
  const [postResult, setPostResult] = useState<PostResult | null>(null)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError(''); setPreResult(null); setPostResult(null); setPostFeedback(null); setAnswers({}); setIndex(0)
      try {
        if (!await getAccessToken()) { router.replace('/entrar'); return }
        if (typeof params.moduleId !== 'string') throw new Error('Módulo inválido.')
        const data = phase === 'pre'
          ? await getPreTestQuestions(params.moduleId, controller.signal)
          : await getPostTestQuestions(params.moduleId, controller.signal)
        if (!controller.signal.aborted) setQuiz(data)
      } catch (cause) {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar o quiz.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [params.moduleId, phase]))

  const question = quiz?.questions[index]
  const selected = question ? answers[question.id] : undefined

  function back() {
    if (router.canGoBack()) router.back()
    else if (typeof params.moduleId === 'string') {
      router.replace({ pathname: '/modulo/[moduleId]', params: { moduleId: params.moduleId, trailId: params.trailId ?? '' } })
    } else router.replace('/trilha')
  }

  async function submitPre() {
    if (!quiz || typeof params.moduleId !== 'string' || busy) return
    const payload = quiz.questions.map(item => {
      const optionId = answers[item.id]
      if (!optionId) throw new Error('Responda todas as perguntas.')
      return { questionId: item.id, optionId }
    })
    setBusy(true); setError('')
    try {
      setPreResult(await submitPreTest(params.moduleId, payload))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'Não foi possível enviar o pré-teste.')
    } finally { setBusy(false) }
  }

  async function answerPost(optionId: string) {
    if (!question || typeof params.moduleId !== 'string' || busy || postFeedback) return
    setBusy(true); setError('')
    try {
      const feedback = await submitPostAnswer(params.moduleId, question.id, optionId)
      setAnswers(current => ({ ...current, [question.id]: optionId }))
      setPostFeedback({ title: feedback.feedback.title, body: feedback.feedback.body, isCorrect: feedback.isCorrect })
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível registrar a resposta.')
    } finally { setBusy(false) }
  }

  async function nextPost() {
    if (!quiz) return
    setPostFeedback(null)
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1)
      return
    }
    if (typeof params.moduleId !== 'string') return
    setBusy(true); setError('')
    try {
      const result = await finishPostTest(params.moduleId)
      setPostResult(result)
      if (result.isApproved) {
        try { await completeModule(params.moduleId) } catch { /* complete pode falhar se já concluído */ }
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível finalizar o pós-teste.')
    } finally { setBusy(false) }
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>{phase === 'pre' ? 'Pré-teste' : 'Pós-teste'}</Text>
      <View style={styles.spacer} />
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando quiz" /> : error && !quiz ? <>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Button title="Voltar" onPress={back} />
      </> : preResult ? <>
        <Text style={styles.heading}>{preResult.title}</Text>
        <Text style={styles.description}>{preResult.message}</Text>
        <Text style={styles.meta}>+{preResult.pointsAwarded} pts · {preResult.correctCount}/{preResult.totalCount}</Text>
        <Text style={styles.description}>{preResult.hint}</Text>
        <Button title="Continuar treinamento" onPress={back} />
      </> : postResult ? <>
        <Text style={styles.heading}>{postResult.title}</Text>
        <Text style={styles.description}>{postResult.message}</Text>
        <Text style={styles.meta}>+{postResult.pointsAwarded} pts · total {postResult.totalPoints}</Text>
        {postResult.reviewHint ? <Text style={styles.description}>{postResult.reviewHint}</Text> : null}
        <Button title={postResult.isApproved ? 'Voltar ao módulo' : 'Revisar e tentar de novo'} onPress={back} />
      </> : quiz && question ? <>
        <Text style={styles.meta}>Pergunta {index + 1} de {quiz.questions.length}</Text>
        <Text style={styles.heading}>{question.statement}</Text>
        {question.options.map(option => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            disabled={busy || (phase === 'pos' && !!postFeedback)}
            onPress={() => {
              if (phase === 'pre') setAnswers(current => ({ ...current, [question.id]: option.id }))
              else void answerPost(option.id)
            }}
            style={[styles.option, selected === option.id && styles.optionSelected]}
          >
            <Text style={styles.optionText}>{option.text}</Text>
          </Pressable>
        ))}
        {postFeedback ? <>
          <Text style={[styles.description, postFeedback.isCorrect ? styles.ok : styles.error]}>{postFeedback.title}</Text>
          <Text style={styles.description}>{postFeedback.body}</Text>
          <Button title={index + 1 < quiz.questions.length ? 'Próxima' : 'Finalizar'} loading={busy} onPress={() => { void nextPost() }} />
        </> : null}
        {phase === 'pre' ? <Button title="Enviar pré-teste" loading={busy} disabled={quiz.questions.some(item => !answers[item.id])} onPress={() => { void submitPre() }} /> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  back: { fontSize: 38, color: colors.text, width: 40 },
  title: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '700' },
  spacer: { width: 40 },
  content: { padding: 20, gap: 14, width: '100%', maxWidth: 430, alignSelf: 'center' },
  heading: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  meta: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  option: { backgroundColor: colors.field, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: colors.border },
  optionSelected: { borderColor: colors.primary },
  optionText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  error: { color: '#ffad61', fontSize: 14, lineHeight: 20 },
  ok: { color: '#16bdb6' },
})
