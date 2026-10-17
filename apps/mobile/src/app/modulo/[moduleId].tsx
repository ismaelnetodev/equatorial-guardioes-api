import { useCallback, useRef, useState } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppIcon } from '../../components/app-icon'
import { Button, colors } from '../../components/ui'
import { EmergencyBanner } from '../../components/emergency-banner'
import { completeTraining, getLearnState, type LearnState } from '../../features/learn/learn.api'
import { completeModule, getTrail, getTrailProgress, startModule, type TrailModule, type TrailProgress } from '../../features/trails/trails.api'
import { ApiError } from '../../services/api'
import { getAccessToken } from '../../services/session'

type ModuleProgress = TrailProgress['modules'][number]

function stageKind(status: 'locked' | 'available' | 'completed'): 'locked' | 'active' | 'completed' {
  if (status === 'completed') return 'completed'
  if (status === 'available') return 'active'
  return 'locked'
}

function stageLabel(status: 'locked' | 'available' | 'completed', points?: number) {
  if (status === 'completed') return points != null ? `Concluído · +${points} pts` : 'Concluído'
  if (status === 'available') return 'Disponível'
  return 'Bloqueado'
}

export default function ModuleScreen() {
  const params = useLocalSearchParams<{ moduleId: string; trailId: string }>()
  const [module, setModule] = useState<TrailModule | null>(null)
  const [progress, setProgress] = useState<ModuleProgress | null>(null)
  const [learn, setLearn] = useState<LearnState | null>(null)
  const [number, setNumber] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [reader, setReader] = useState(false)
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const scroll = useRef<{ scrollTo: (options: { y?: number; animated?: boolean }) => void } | null>(null)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setActionError(''); setReader(false)
    async function load() {
      try {
        if (!await getAccessToken()) { if (!controller.signal.aborted) router.replace('/entrar'); return }
        if (typeof params.trailId !== 'string' || typeof params.moduleId !== 'string') throw new Error('Link de módulo incompleto. Volte para a trilha e escolha um módulo.')
        const [details, states] = await Promise.all([getTrail(params.trailId, controller.signal), getTrailProgress(params.trailId, controller.signal)])
        const modules = details.modules.filter(item => item.isActive)
        const index = modules.findIndex(item => item.id === params.moduleId)
        const item = modules[index]
        const state = states.modules.find(item => item.moduleId === params.moduleId)
        if (!item || !state) throw new Error('Este módulo não está disponível nesta trilha.')
        let learnState: LearnState | null = null
        if (state.status === 'in_progress' || state.status === 'completed') {
          try { learnState = await getLearnState(params.moduleId, controller.signal) } catch { learnState = null }
        }
        if (controller.signal.aborted) return
        setModule({ ...item, status: state.status }); setProgress(state)
        setLearn(learnState); setNumber(index)
      } catch (cause) {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
        setError(cause instanceof ApiError ? cause.message : cause instanceof TypeError ? 'Não foi possível conectar. Verifique sua conexão e tente novamente.' : cause instanceof Error ? cause.message : 'Não foi possível carregar o módulo.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [params.moduleId, params.trailId, attempt]))

  const blocked = module?.status === 'blocked'
  const completed = module?.status === 'completed'
  const active = module?.status === 'in_progress'
  const requiresQuiz = progress?.requiresQuiz ?? false
  const objectives = module?.content?.split('\n').map(line => line.trim()).filter(line => /^[-*✓•]\s+/.test(line)).map(line => line.replace(/^[-*✓•]\s+/, '')).slice(0, 6) ?? []
  const pre = learn?.preTest
  const training = learn?.training
  const post = learn?.postTest

  function back() {
    if (busy) return
    if (reader) { setReader(false); setActionError(''); scroll.current?.scrollTo({ y: 0, animated: false }); return }
    if (router.canGoBack()) router.back()
    else router.replace('/trilha')
  }
  async function ensureStarted() {
    if (!module) return null
    if (module.status !== 'available') return module
    const state = await startModule(module.id)
    setProgress(state)
    const next = { ...module, status: state.status }
    setModule(next)
    setLearn(await getLearnState(module.id).catch(() => learn))
    return next
  }
  async function openQuiz(phase: 'pre' | 'pos') {
    if (typeof params.moduleId !== 'string' || pending.current) return
    pending.current = true; setBusy(true); setActionError('')
    try {
      await ensureStarted()
      router.push({ pathname: '/aprender', params: { moduleId: params.moduleId, trailId: params.trailId, phase } })
    } catch (cause) { handleActionError(cause) }
    finally { pending.current = false; setBusy(false) }
  }
  async function openTraining() {
    if (!module || blocked || pending.current) return
    if (requiresQuiz && learn && learn.preTest.status !== 'completed') {
      setActionError('Conclua o pré-teste antes do treinamento.')
      return
    }
    pending.current = true; setBusy(true); setActionError('')
    try {
      await ensureStarted()
      if (requiresQuiz && !learn) {
        const next = await getLearnState(module.id)
        setLearn(next)
        if (next.preTest.status !== 'completed') {
          setActionError('Conclua o pré-teste antes do treinamento.')
          return
        }
      }
      setReader(true); scroll.current?.scrollTo({ y: 0, animated: false })
    } catch (cause) { handleActionError(cause) }
    finally { pending.current = false; setBusy(false) }
  }
  function handleActionError(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
    setActionError(cause instanceof ApiError ? cause.message : 'Não foi possível salvar seu progresso. Tente novamente.')
  }
  async function finishTraining() {
    if (!module || pending.current) return
    pending.current = true; setBusy(true); setActionError('')
    try {
      if (requiresQuiz) {
        await completeTraining(module.id)
        const next = await getLearnState(module.id)
        setLearn(next)
        setReader(false); scroll.current?.scrollTo({ y: 0, animated: false })
        if (next.postTest.status === 'available') {
          openQuiz('pos')
          return
        }
        if (next.postTest.status === 'completed' && next.postTest.isApproved) {
          const state = await completeModule(module.id)
          setProgress(state); setModule(current => current ? { ...current, status: state.status } : null)
        }
      } else {
        const state = await completeModule(module.id)
        setProgress(state); setModule(current => current ? { ...current, status: state.status } : null)
        setReader(false); scroll.current?.scrollTo({ y: 0, animated: false })
      }
    } catch (cause) { handleActionError(cause) }
    finally { pending.current = false; setBusy(false) }
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="light" />
    <ScrollView ref={scroll as never} contentContainerStyle={styles.content}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={reader ? 'Voltar ao detalhe do módulo' : 'Voltar para trilha'} onPress={back} disabled={busy} hitSlop={12}><Text style={styles.back}>‹</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Ajuda e segurança" onPress={() => setHelp(true)} hitSlop={12}><AppIcon name="help" color={colors.text} /></Pressable></View>
      {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Carregando módulo" style={styles.loading} /> : error ? <View style={styles.section}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /><Button title="Voltar para trilha" outline onPress={() => router.replace('/trilha')} /></View> : module ? <>
        <ImageBackground source={require('../../../assets/module-pattern.png')} resizeMode="cover" style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.moduleIcon}><AppIcon name={blocked ? 'lock' : number === 0 ? 'eye' : number === 2 ? 'pole' : 'bolt'} size={40} color={colors.background} /></View><View style={styles.heroCopy}><Text style={styles.eyebrow}>MÓDULO {number}</Text><Text accessibilityRole="header" style={styles.title}>{module.title}</Text></View>
        </ImageBackground>
        {reader ? <>
          <Text accessibilityRole="header" style={styles.readerTitle}>Treinamento</Text>
          <Text selectable style={styles.reading}>{module.content || 'O conteúdo deste módulo ainda não está disponível.'}</Text>
          {requiresQuiz ? <Text style={styles.description}>Ao concluir, o treinamento registra pontos e libera o pós-teste.</Text> : null}
          <View style={styles.footer}>{completed ? <Button title="Voltar ao módulo" onPress={back} /> : <Button title="Concluir treinamento" loading={busy} disabled={!module.content} onPress={() => { void finishTraining() }} />}</View>
        </> : <>
          <Text style={styles.description}>{module.description}</Text>
          {blocked ? <View style={styles.section}><Text style={styles.description}>Conclua os módulos anteriores para liberar este conteúdo.</Text><Button title="Voltar para trilha" onPress={back} /></View> : <>
            <View style={styles.section}><Text style={styles.eyebrow}>O QUE VOCÊ VAI APRENDER</Text>{(objectives.length ? objectives : [module.description]).map((objective, index) => <View key={index} style={styles.objective}><AppIcon name="check" color="#16bdb6" size={20} /><Text style={styles.objectiveText}>{objective}</Text></View>)}</View>
            <View style={styles.section}><Text style={styles.eyebrow}>ETAPAS</Text>
              <Stage
                title="Pré-teste"
                description={requiresQuiz ? 'Quiz de conhecimentos prévios' : 'Sem teste obrigatório'}
                status={requiresQuiz ? stageLabel(pre?.status ?? 'available', pre?.pointsAwarded) : 'Não exigido'}
                kind={requiresQuiz ? stageKind(pre?.status ?? 'available') : 'locked'}
                onPress={requiresQuiz && (pre?.status ?? 'available') === 'available' ? () => { void openQuiz('pre') } : undefined}
                disabled={busy}
              />
              <Stage
                title="Treinamento"
                description={module.durationMinutes ? `Leitura · ${module.durationMinutes} min` : 'Conteúdo do módulo'}
                status={stageLabel(training?.status ?? (completed ? 'completed' : !requiresQuiz || pre?.status === 'completed' ? 'available' : 'locked'), training?.pointsAwarded)}
                kind={stageKind(training?.status ?? (completed ? 'completed' : !requiresQuiz || pre?.status === 'completed' ? 'available' : 'locked'))}
                onPress={!blocked && (!requiresQuiz || pre?.status === 'completed' || training?.status === 'completed') ? () => { void openTraining() } : undefined}
                disabled={busy || (requiresQuiz && pre?.status !== 'completed' && training?.status !== 'completed')}
              />
              <Stage
                title="Pós-teste"
                description={requiresQuiz ? 'Avaliação de aprendizagem' : 'Sem teste obrigatório'}
                status={requiresQuiz ? stageLabel(post?.status ?? 'locked', post?.pointsAwarded) : 'Não exigido'}
                kind={requiresQuiz ? stageKind(post?.status ?? 'locked') : 'locked'}
                onPress={requiresQuiz && post?.status === 'available' ? () => { void openQuiz('pos') } : undefined}
                disabled={busy}
              />
            </View>
            <View style={styles.score}><AppIcon name="star" color={colors.primary} size={20} /><Text style={styles.scoreText}>{learn ? `${learn.totalPoints} pts neste módulo` : 'Pontuação do módulo'}</Text><Text style={styles.scoreText}>{post?.correctCount != null ? `Melhor: ${post.correctCount}/${post.totalCount}` : 'Melhor: —'}</Text></View>
            {completed ? <Text accessibilityRole="alert" style={styles.success}>Módulo concluído! Seu progresso foi salvo.</Text> : null}
            <View style={styles.footer}>
              {requiresQuiz && (pre?.status ?? 'available') === 'available' ? <Button title="Começar pré-teste" loading={busy} onPress={() => { void openQuiz('pre') }} /> : null}
              <Button title={completed || training?.status === 'completed' ? 'Rever treinamento' : active || training?.status === 'available' ? 'Continuar treinamento' : 'Começar treinamento'} loading={busy} disabled={!module.content || (requiresQuiz && pre?.status !== 'completed' && training?.status !== 'completed')} onPress={() => { void openTraining() }} />
              {requiresQuiz && post?.status === 'available' ? <Button title="Fazer pós-teste" outline loading={busy} onPress={() => { void openQuiz('pos') }} /> : null}
              {completed ? <Button title="Voltar para trilha" outline onPress={back} /> : null}
            </View>
          </>}
        </>}
        {actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text> : null}
      </> : null}
    </ScrollView>
    <Modal visible={help} transparent animationType="fade" onRequestClose={() => setHelp(false)}><View style={styles.overlay}><View style={styles.helpCard}><Text style={styles.readerTitle}>Ajuda e segurança</Text><Text style={styles.description}>Observe de longe, afaste-se e avise. Nunca toque em fios ou postes. Você pode sair do treinamento e continuar depois.</Text><EmergencyBanner onError={() => setActionError('Não foi possível abrir a ligação. Ligue 116 pelo telefone.')} /><Button title="Fechar" onPress={() => setHelp(false)} /></View></View></Modal>
  </SafeAreaView>
}

function Stage({ title, description, status, kind, onPress, disabled }: { title: string; description: string; status: string; kind: 'locked' | 'active' | 'completed'; onPress?: () => void; disabled?: boolean }) {
  const content = <><View style={[styles.stageIcon, kind === 'active' && styles.activeIcon, kind === 'completed' && styles.completedIcon]}>{kind === 'active' ? <Text style={styles.stageNumber}>•</Text> : <AppIcon name={kind === 'completed' ? 'check' : 'lock'} size={22} color={kind === 'completed' ? colors.text : '#858bad'} />}</View><View style={styles.stageCopy}><Text style={[styles.stageTitle, kind === 'locked' && styles.dim]}>{title}</Text><Text style={styles.stageDescription}>{description}</Text></View><Text style={[styles.stageStatus, kind === 'active' && styles.yellow]}>{status}</Text></>
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${status}`} disabled={disabled} onPress={onPress} style={[styles.stage, kind === 'active' && styles.activeStage]}>{content}</Pressable> : <View accessibilityLabel={`${title}: ${status}`} accessible style={styles.stage}>{content}</View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, width: '100%', maxWidth: 400, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 24, gap: 20 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52, paddingHorizontal: 8 }, back: { fontSize: 38, color: colors.text }, loading: { paddingVertical: 80 }, hero: { minHeight: 150, flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, borderRadius: 24, overflow: 'hidden' }, heroImage: { borderRadius: 24 }, moduleIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1, gap: 6 }, eyebrow: { color: colors.primary, fontSize: 11, letterSpacing: 1 }, title: { fontSize: 25, lineHeight: 29, fontWeight: '800', color: colors.text }, description: { color: colors.muted, fontSize: 14, lineHeight: 22 }, section: { gap: 9 }, objective: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, objectiveText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  stage: { backgroundColor: colors.field, borderRadius: 16, minHeight: 60, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: 'transparent' }, activeStage: { borderColor: colors.primary, backgroundColor: '#222c70' }, stageIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }, activeIcon: { backgroundColor: colors.primary }, completedIcon: { backgroundColor: '#10b978' }, stageNumber: { color: colors.background, fontWeight: '800', fontSize: 18 }, stageCopy: { flex: 1, gap: 3 }, stageTitle: { fontSize: 15, fontWeight: '700', color: colors.text }, stageDescription: { fontSize: 11, lineHeight: 16, color: colors.muted }, stageStatus: { maxWidth: 110, fontSize: 11, lineHeight: 16, textAlign: 'right', color: colors.muted }, yellow: { color: colors.primary }, dim: { color: '#858bad' }, score: { flexDirection: 'row', alignItems: 'center', gap: 8 }, scoreText: { flex: 1, fontSize: 12, color: colors.muted }, footer: { marginTop: 'auto', gap: 12 }, readerTitle: { color: colors.text, fontSize: 22, fontWeight: '700' }, reading: { color: colors.text, fontSize: 16, lineHeight: 26 }, success: { color: '#16bdb6', fontSize: 14, lineHeight: 21 }, error: { color: '#ffad61', fontSize: 14, lineHeight: 21 }, overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000099', padding: 20 }, helpCard: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: colors.field, padding: 24, gap: 20 },
})
