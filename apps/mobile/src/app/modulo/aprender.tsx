import { LoadFailure, useLoadFailureKind } from '../../components/load-failure'
import { ContentSkeleton } from '../../components/content-skeleton'
import { useEffect, useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Button, colors } from '../../components/ui'
import { ApiError, errorMessage } from '../../services/api'
import { completeModule } from '../../features/trails/trails.api'
import { QuizQuestionScreen } from '../../features/trails/quiz-question-screen'
import { QuizResultScreen } from '../../features/trails/quiz-result-screen'
import { TrainingScreen } from '../../features/trails/training-screen'
import { completeTraining, finishPost, getPostResult, getPreResult, getQuestions, getTraining, submitPostAnswer, submitPre, type Feedback, type PostResult, type PreResult, type Questions, type Training } from '../../features/trails/learning.api'

export default function LearningScreen() {
  const { moduleId, trailId, phase, result: showResult, completed } = useLocalSearchParams<{ moduleId: string; trailId?: string; phase: string; result: string; completed: string }>()
  const [questions, setQuestions] = useState<Questions | null>(null)
  const [training, setTraining] = useState<Training | null>(null)
  const [result, setResult] = useState<PreResult | PostResult | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const { offline, recordFailure } = useLoadFailureKind()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const pending = useRef(false)
  const scroll = useRef<ScrollView>(null)
  const post = phase === 'pos'
  const title = phase === 'training' ? 'Treinamento' : post ? 'Avaliação do módulo' : 'Pré-teste'

  function fail(cause: unknown) { recordFailure(cause);
    if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
    setError(errorMessage(cause))
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setQuestions(null); setTraining(null); setResult(null); setFeedback(null); setAnswers({}); setIndex(0)
    async function load() {
      try {
        if (!moduleId || !['pre', 'pos', 'training'].includes(phase)) throw new Error('Etapa inválida. Volte ao módulo.')
        if (showResult === '1') {
          const data = post ? await getPostResult(moduleId, controller.signal) : await getPreResult(moduleId, controller.signal)
          if (!controller.signal.aborted) setResult(data)
        } else if (phase === 'training') {
          const data = await getTraining(moduleId, controller.signal)
          if (!controller.signal.aborted) setTraining(data)
        } else {
          const data = await getQuestions(moduleId, post ? 'pos' : 'pre', controller.signal)
          if (!controller.signal.aborted) { setQuestions(data); setIndex(post ? data.answeredCount ?? 0 : 0) }
        }
      } catch (cause) { recordFailure(cause); if (!controller.signal.aborted) fail(cause) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [moduleId, phase, post, showResult, retry])

  async function act(operation: () => Promise<void>) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await operation() } catch (cause) { recordFailure(cause); fail(cause) }
    finally { pending.current = false; setBusy(false) }
  }
  function advance() { setIndex(value => value + 1); setFeedback(null); scroll.current?.scrollTo({ y: 0, animated: false }) }
  const question = questions?.questions[index]
  const selected = question ? answers[question.id] : undefined
  async function confirm() {
    if (!questions) return
    if (post && (!question || feedback)) {
      if (question && index < questions.questions.length - 1) { advance(); return }
      if (!questions.attemptId) throw new Error('Tentativa não encontrada. Reabra a etapa.')
      setResult(await finishPost(moduleId, questions.attemptId)); return
    }
    if (!question || !selected) return
    if (post) {
      if (!questions.attemptId) throw new Error('Tentativa não encontrada. Reabra a etapa.')
      setFeedback(await submitPostAnswer(moduleId, questions.attemptId, question.id, selected))
    } else if (index < questions.questions.length - 1) advance()
    else setResult(await submitPre(moduleId, questions.questions.map(item => ({ questionId: item.id, optionId: answers[item.id]! }))))
  }
  function back() { if (!busy) { if (router.canGoBack()) router.back(); else router.replace('/trilha') } }

  async function retryPost() {
    const data = await getQuestions(moduleId, 'pos')
    setQuestions(data); setIndex(data.answeredCount ?? 0); setAnswers({}); setFeedback(null); setResult(null)
    scroll.current?.scrollTo({ y: 0, animated: false })
  }

  if (!loading && result) return <QuizResultScreen result={result} completed={completed === '1'} busy={busy} error={error} onBack={() => { if (completed === '1') router.replace('/trilha'); else back() }} onTraining={() => router.replace({ pathname: '/modulo/aprender', params: { moduleId, trailId, phase: 'training', result: '0', completed } })} onComplete={() => { void act(async () => { await completeModule(moduleId); router.replace({ pathname: '/modulo/conclusao', params: { moduleId, ...(trailId ? { trailId } : {}) } }) }) }} onRetry={() => { void act(retryPost) }} />

  if (!loading && !result && questions) return <QuizQuestionScreen key={questions.questions[index]?.id ?? 'finish'} questions={questions} index={index} selected={selected} feedback={feedback} post={post} busy={busy} error={error} onSelect={optionId => { if (question) setAnswers(current => ({ ...current, [question.id]: optionId })) }} onConfirm={() => { void act(confirm) }} onClose={back} />

  if (!loading && training) return <TrainingScreen key={training.steps[index]?.id ?? 'empty'} training={training} index={index} busy={busy} error={error} onBack={back} onPrevious={() => { if (index > 0) { setIndex(value => value - 1); setError('') } else back() }} onNext={() => { if (index < training.steps.length - 1) { advance(); setError('') } else if (training.completed) back(); else void act(async () => { await completeTraining(moduleId); backAfterSave() }) }} />

  return <SafeAreaView style={styles.screen}><StatusBar style="light" /><ScrollView ref={scroll} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao módulo" onPress={back} disabled={busy} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.title}>{title}</Text></View>
    {loading ? <ContentSkeleton variant={showResult ? 'result' : phase === 'training' ? 'training' : 'quiz'} label="Carregando conteúdo" /> : null}
    {error ? <LoadFailure offline={offline} onRetry={() => setRetry(value => value + 1)} /> : null}
  </ScrollView></SafeAreaView>

  function backAfterSave() { if (router.canGoBack()) router.back(); else router.replace('/trilha') }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 430, alignSelf: 'center', padding: 20, gap: 20, paddingBottom: 40 }, header: { flexDirection: 'row', alignItems: 'center', gap: 20 }, back: { color: colors.text, fontSize: 40 }, title: { color: colors.text, fontSize: 23, lineHeight: 29, fontWeight: '700' }, copy: { color: colors.muted, fontSize: 15, lineHeight: 23 }, card: { backgroundColor: colors.field, padding: 20, borderRadius: 20, gap: 16 }, lesson: { gap: 8, paddingVertical: 12 }, option: { borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.field, padding: 16 }, selected: { borderColor: colors.primary, backgroundColor: '#222c70' }, correct: { borderColor: '#10b978' }, optionTitle: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '600' }, image: { width: '100%', height: 200 }, score: { color: colors.primary, fontSize: 48, fontWeight: '800' }, yellow: { color: colors.primary, fontSize: 16 },
})
