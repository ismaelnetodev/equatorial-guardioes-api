import { useCallback, useRef, useState } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, Share, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../../components/ui'
import { Action, Card, Hint, Title, ui, useAction } from '../../features/admin/admin.ui'
import { QuizQuestionScreen } from '../../features/trails/quiz-question-screen'
import { getFinalQuestions, getTrailCompletion, issueCertificate, refreshLearningSummary, submitFinal, type FinalQuestions, type FinalResult, type TrailCompletion } from '../../features/trails/progress.api'
import { ApiError, errorMessage } from '../../services/api'

export default function FinalExamScreen() {
  const { trailId } = useLocalSearchParams<{ trailId: string }>()
  const [state, setState] = useState<TrailCompletion | null>(null)
  const [questions, setQuestions] = useState<FinalQuestions | null>(null)
  const [result, setResult] = useState<FinalResult | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const scroll = useRef<ScrollView>(null)
  const fail = (cause: unknown) => { if (cause instanceof ApiError && cause.status === 401) router.replace('/entrar'); else setError(errorMessage(cause)) }
  const { busy, run } = useAction(fail)
  const refresh = async () => { setError(''); await refreshLearningSummary(); setState(await getTrailCompletion(trailId)) }
  useFocusEffect(useCallback(() => { void run(refresh) }, [trailId]))

  const question = questions?.questions[index]
  if (questions && !result) return <QuizQuestionScreen finalExam questions={questions} index={index} selected={question ? answers[question.id] : undefined} feedback={null} post={false} busy={busy} error={error} onSelect={id => { if (question) setAnswers(values => ({ ...values, [question.id]: id })) }} onClose={() => { if (!busy) { setQuestions(null); setAnswers({}); setIndex(0) } }} onConfirm={() => { void run(async () => {
    if (!question || !answers[question.id]) return
    setError('')
    if (index < questions.questions.length - 1) { setIndex(value => value + 1); return }
    const finished = await submitFinal(trailId, questions.questions.map(item => ({ questionId: item.id, optionId: answers[item.id]! })))
    setResult(finished); setQuestions(null); await refresh()
  }) }} />

  const status = state?.finalExam.status
  const passed = status === 'APPROVED'
  const certificate = state?.certificate
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView ref={scroll} contentContainerStyle={{ maxWidth: 600, width: '100%', alignSelf: 'center', padding: 20, gap: 18 }}>
    <Action title="‹ Voltar à trilha" onPress={() => router.replace({ pathname: '/trilha', params: { trailId } })} /><Title>{state?.title ?? 'Conclusão da trilha'}</Title>
    {error ? <Text accessibilityRole="alert" style={{ color: '#ffbb80' }}>{error}</Text> : null}
    {!state ? <ActivityIndicator color={colors.primary} /> : <>
      <Card><Title>{passed ? 'Prova final aprovada!' : 'Prova final'}</Title><Hint>{state.completedModules} de {state.totalModules} módulos concluídos.</Hint><Hint>A aprovação exige {state.finalExam.minimumPercent}% de acertos. A pontuação da prova final é concedida uma única vez, conforme a regra do programa.</Hint>
        {status === 'MODULES_PENDING' ? <Hint>Conclua os módulos para liberar a prova final.</Hint> : null}
        {status === 'WAITING' ? <Hint>A prova será liberada em {new Date(state.finalExam.availableAt!).toLocaleString('pt-BR')}. O prazo começa na conclusão do último módulo.</Hint> : null}
        {status === 'RETRY_WAITING' ? <Hint>Você pode tentar novamente a partir de {new Date(state.finalExam.retryAt!).toLocaleString('pt-BR')}.</Hint> : null}
        {status === 'QUESTIONS_PENDING' ? <Hint>As perguntas da trilha ainda precisam ser configuradas pela administração.</Hint> : null}
        {state.finalExam.lastResult ? <Text style={ui.label}>Último resultado: {state.finalExam.lastResult.correctCount} de {state.finalExam.lastResult.totalCount} acertos · {state.finalExam.lastResult.isApproved ? 'Aprovado' : 'Revise o conteúdo e tente novamente'}</Text> : null}
        {result ? <Text accessibilityLiveRegion="polite" style={ui.label}>{result.isApproved ? 'Parabéns!' : 'Continue aprendendo.'} +{result.pointsAwarded} pontos nesta tentativa.</Text> : null}
        {status === 'AVAILABLE' ? <Action title={busy ? 'Carregando…' : 'Iniciar prova final'} primary disabled={busy} onPress={() => { void run(async () => { setError(''); const data = await getFinalQuestions(trailId); setQuestions(data); setIndex(0); setAnswers({}); setResult(null) }) }} /> : null}
        <Action title="Atualizar disponibilidade" disabled={busy} onPress={() => { void run(refresh) }} />
      </Card>
      {certificate ? <Card><Text style={ui.badge}>Certificado digital · selo conquistado</Text><Title>{certificate.badge}</Title><Text style={{ color: colors.primary, fontSize: 25, fontWeight: '700' }}>{certificate.holderName}</Text><Hint>Concluiu a trilha educativa “{certificate.trailTitle}”, com todos os módulos e aprovação na prova final.</Hint><Hint>Emitido em {new Date(certificate.issuedAt).toLocaleDateString('pt-BR')}</Hint><Hint>Identificação: {certificate.id}</Hint><Action title="Compartilhar certificado" onPress={() => { void run(async () => { await Share.share({ message: `${certificate.badge}\n${certificate.holderName}\nConcluiu a trilha educativa ${certificate.trailTitle}.\nEmitido em ${new Date(certificate.issuedAt).toLocaleDateString('pt-BR')}.\nCertificado: ${certificate.id}` }) }) }} /></Card> : passed ? <Card><Title>Seu certificado e selo</Title><Hint>Você concluiu os módulos e foi aprovado na prova final. A emissão não depende de um saldo mínimo de pontos.</Hint><Action title="Receber certificado e selo" primary disabled={busy || !state.canIssueCertificate} onPress={() => { void run(async () => { await issueCertificate(trailId); await refresh() }) }} />{!state.canIssueCertificate ? <Hint>A emissão está desativada no programa.</Hint> : null}</Card> : null}
    </>}
  </ScrollView></SafeAreaView>
}
