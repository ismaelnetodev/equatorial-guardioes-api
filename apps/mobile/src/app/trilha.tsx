import { useCallback, useEffect, useRef, useState } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AppIcon } from '../components/app-icon'
import { Button, colors } from '../components/ui'
import { EmergencyBanner } from '../components/emergency-banner'
import { TrailPath } from '../components/trail-path'
import { ReportBlockedModal } from '../components/report-blocked-modal'
import { getCurrentUser, type CurrentUser } from '../features/auth/auth.api'
import { getTrail, getTrailProgress, listTrails, type TrailDetails, type TrailModule, type Trails } from '../features/trails/trails.api'
import { getTrailCompletion, refreshLearningSummary, type LearningSummary, type TrailCompletion } from '../features/trails/progress.api'
import { ApiError } from '../services/api'
import { clearAccessToken, getAccessToken } from '../services/session'

type Panel = 'help' | 'report' | 'ranking' | 'profile' | null

export default function TrailScreen() {
  const params = useLocalSearchParams<{ panel?: string; trailId?: string }>()
  const insets = useSafeAreaInsets()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [trails, setTrails] = useState<Trails>([])
  const [trail, setTrail] = useState<TrailDetails | null>(null)
  const [selected, setSelected] = useState<string | null>(params.trailId ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [panel, setPanel] = useState<Panel>(null)
  const [actionError, setActionError] = useState('')
  const [points, setPoints] = useState<LearningSummary | null>(null)
  const [completion, setCompletion] = useState<TrailCompletion | null>(null)
  const scroll = useRef<ScrollView>(null)

  useEffect(() => {
    if (params.panel === 'report') { setPanel('report'); router.setParams({ panel: undefined }) }
    if (params.trailId) setSelected(params.trailId)
  }, [params.panel, params.trailId])

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError(''); setTrail(null)
      try {
        if (!await getAccessToken()) { router.replace('/entrar'); return }
        const [account, catalog, balance] = await Promise.all([getCurrentUser(controller.signal), listTrails(controller.signal), refreshLearningSummary(controller.signal)])
        const id = catalog.find(item => item.id === selected)?.id ?? catalog[0]?.id
        const [details, states, finished] = id ? await Promise.all([getTrail(id, controller.signal), getTrailProgress(id, controller.signal), getTrailCompletion(id, controller.signal)]) : [null, null, null]
        if (controller.signal.aborted) return
        const visible = details && states ? { ...details, modules: states.modules.flatMap(state => {
          const module = details.modules.find(item => item.id === state.moduleId)
          return module ? [{ ...module, status: state.status }] : []
        }) } : details
        setUser(account); setTrails(catalog); setTrail(visible); setPoints(balance); setCompletion(finished)
      } catch (cause) {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
        setError('Não foi possível carregar sua trilha. Verifique sua conexão e tente novamente.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [selected, attempt]))

  const modules = trail?.modules.filter(item => item.isActive) ?? []
  const firstModule = modules[0]
  const reportsLocked = !firstModule || firstModule.status !== 'completed'
  const currentModule = modules.find(item => item.status === 'in_progress') ?? modules.find(item => item.status === 'available')
  const currentNumber = currentModule ? modules.findIndex(item => item.id === currentModule.id) : -1
  const completedCount = modules.filter(item => item.status === 'completed').length
  const firstName = user?.name.trim().split(/\s+/)[0] ?? 'Guardião'
  const initials = user?.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() ?? 'G'

  function openPanel(value: Panel) { setActionError(''); setPanel(value) }
  function openModule(value: TrailModule) {
    if (!trail) return
    setPanel(null)
    router.push({ pathname: '/modulo/[moduleId]', params: { moduleId: value.id, trailId: trail.id } })
  }
  async function logout() {
    try { await clearAccessToken(); router.replace('/entrar') }
    catch { setActionError('Não foi possível sair. Tente novamente.') }
  }

  return <View style={styles.screen}>
    <StatusBar style="light" />
    <SafeAreaView edges={['top']} style={styles.main}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setAttempt(value => value + 1)} tintColor={colors.primary} />}>
        <ImageBackground source={require('../../assets/lencois-login.png')} resizeMode="cover" style={styles.hero}>
          <View style={styles.greeting}>
            <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
            <View style={styles.nameGroup}><Text accessibilityRole="header" style={styles.name}>Olá, {firstName}</Text><View style={styles.badge}><AppIcon name="shield" size={13} color={colors.primary} /><Text style={styles.badgeText}>Guardião</Text></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajuda e segurança" onPress={() => openPanel('help')} style={styles.help}><AppIcon name="help" color={colors.text} /></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver extrato de pontos do aprendizado" onPress={() => router.push('/pontos')} style={styles.points}><View style={styles.pointsLine}><Text style={styles.pointsValue}>{points?.totalPoints ?? '—'} <Text style={styles.pointsLabel}>pontos</Text></Text><Text style={styles.pointsLabel}>Ver extrato ›</Text></View><Text style={styles.pointsNote}>Pontos do aprendizado · {points?.modulePoints ?? '—'} por módulo{points?.dailyPointsLimit != null ? ` · até ${points.dailyPointsLimit}/dia em módulos` : ''}</Text>{points && points.pendingPoints > 0 ? <Text style={styles.pointsLabel}>{points.pendingPoints} pontos pendentes{points.nextReleaseAt ? ` · próxima liberação a partir de ${new Date(points.nextReleaseAt).toLocaleDateString('pt-BR')}` : ' · aguardando liberação do programa'}</Text> : null}</Pressable>
        </ImageBackground>
        <View style={styles.body}>
          {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} accessibilityLabel="Carregando trilha" /></View> : error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> : <>
            {currentModule && (currentModule.status === 'in_progress' || completedCount > 0) ? <View style={styles.continueCard}>
              <View style={styles.continueCopy}><Text style={styles.continueEyebrow}>CONTINUE · MÓDULO {currentNumber}</Text><Text style={styles.noticeText}>{currentModule.title}</Text><Text style={styles.pointsLabel}>{currentModule.status === 'in_progress' ? 'Treinamento em andamento' : 'Próximo módulo disponível'}</Text><View style={styles.progressTrack}><View style={[styles.trailProgress, { width: `${modules.length ? completedCount / modules.length * 100 : 0}%` }]} /></View><Text style={styles.pointsNote}>{completedCount} de {modules.length} módulos concluídos</Text></View><Button title="Continuar" onPress={() => openModule(currentModule)} />
            </View> : <Pressable accessibilityRole="button" onPress={() => reportsLocked && firstModule ? openModule(firstModule) : openPanel('report')} style={styles.notice}>
              <View style={styles.noticeIcon}><AppIcon name={reportsLocked ? 'lock' : 'check'} color={colors.background} size={20} /></View><Text style={styles.noticeText}>{!firstModule ? 'As trilhas estarão disponíveis em breve.' : reportsLocked ? 'Conclua o módulo 0 para liberar os relatos.' : 'Primeiro módulo concluído! Continue sua trilha.'}</Text>
            </Pressable>}
            {trails.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trailSelector}>{trails.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === trail?.id }} onPress={() => setSelected(item.id)} style={[styles.trailChip, item.id === trail?.id && styles.selectedChip]}><Text style={[styles.chipText, item.id === trail?.id && styles.yellow]}>{item.title}</Text></Pressable>)}</ScrollView> : null}
            {trail ? <>
              <Text accessibilityRole="header" style={styles.trailHeading}>{trail.title}</Text>
              {completion ? <View style={styles.continueCard}><View style={styles.continueCopy}><Text style={styles.noticeText}>{completion.finalExam.status === 'APPROVED' ? 'Trilha aprovada!' : 'Prova final e certificado'}</Text><Text style={styles.pointsLabel}>{completion.completedModules} de {completion.totalModules} módulos concluídos{completion.certificate ? ' · selo conquistado' : ''}</Text></View><Button title={completion.certificate ? 'Ver certificado' : 'Ver conclusão'} outline onPress={() => router.push({ pathname: '/modulo/prova-final', params: { trailId: trail.id } })} /></View> : null}
              {modules.length ? <TrailPath modules={modules} onSelect={openModule} /> : <Text style={[styles.description, styles.state]}>Esta trilha ainda não tem módulos disponíveis.</Text>}
            </> : <Text style={[styles.description, styles.state]}>Novas trilhas estarão disponíveis em breve. Puxe para atualizar.</Text>}
          </>}
        </View>
      </ScrollView>
      <View style={[styles.navContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}><View style={styles.nav}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} accessibilityLabel="Trilha" onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })} style={styles.navItem}><View style={styles.activeMark} /><AppIcon name="route" color={colors.primary} /><Text style={[styles.navLabel, styles.yellow]}>Trilha</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityLabel={`Reportar${reportsLocked ? ', conclua o primeiro módulo' : ''}`} onPress={() => openPanel('report')} style={styles.navItem}><View style={styles.reportIcon}><AppIcon name="bolt" color={colors.background} />{reportsLocked ? <View style={styles.tinyLock}><AppIcon name="lock" size={12} color={colors.primary} /></View> : null}</View><Text style={[styles.navLabel, styles.yellow]}>Reportar</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityLabel="Ranking" onPress={() => openPanel('ranking')} style={styles.navItem}><AppIcon name="trophy" /><Text style={styles.navLabel}>Ranking</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityLabel="Perfil" onPress={() => openPanel('profile')} style={styles.navItem}><AppIcon name="user" /><Text style={styles.navLabel}>Perfil</Text></Pressable>
      </View></View>
    </SafeAreaView>
    <ReportBlockedModal visible={panel === 'report' && !loading && reportsLocked} available={!!firstModule} minutes={firstModule?.durationMinutes} onClose={() => setPanel(null)} onModule={() => { if (firstModule) openModule(firstModule) }} />
    <Modal visible={panel !== null && !(panel === 'report' && (reportsLocked || loading))} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
      <View style={styles.overlay}><SafeAreaView edges={['bottom']} style={styles.sheet}><ScrollView contentContainerStyle={styles.sheetContent}>
        <View style={styles.sheetHeader}><Text accessibilityRole="header" style={styles.sheetTitle}>{panel === 'help' ? 'Ajuda e segurança' : panel === 'profile' ? 'Seu perfil' : panel === 'ranking' ? 'Ranking' : 'Reportar risco'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setPanel(null)} hitSlop={12}><Text style={styles.close}>×</Text></Pressable></View>
        {panel === 'help' ? <><Text style={styles.description}>Observe de longe, afaste-se e avise. Nunca toque em fios ou postes e nunca tente consertar.</Text><Text style={styles.description}>Toque no módulo disponível para ler o conteúdo. Os próximos são liberados conforme você conclui os anteriores.</Text><EmergencyBanner onError={() => setActionError('Não foi possível abrir a ligação. Ligue 116 pelo telefone.')} /></> : null}
        {panel === 'report' ? <><Text style={styles.description}>{reportsLocked ? 'Conclua o módulo 0 da trilha para liberar os relatos. Em caso de risco agora, afaste-se e ligue 116.' : 'O envio de relatos estará disponível em breve. Em caso de risco agora, afaste-se e ligue 116.'}</Text><EmergencyBanner onError={() => setActionError('Não foi possível abrir a ligação. Ligue 116 pelo telefone.')} /></> : null}
        {panel === 'ranking' ? <Text style={styles.description}>O ranking estará disponível quando a pontuação estiver integrada.</Text> : null}
        {panel === 'profile' ? <><Text style={styles.description}>{user?.name}</Text><Text style={styles.description}>{user?.email ?? user?.cellphone}</Text><Text style={styles.description}>Bairro: {user?.neighborhood}</Text><Button title="Sair da conta" outline onPress={() => { void logout() }} /></> : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
      </ScrollView></SafeAreaView></View>
    </Modal>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, main: { flex: 1 }, content: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingBottom: 12 },
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }, greeting: { flexDirection: 'row', gap: 12, alignItems: 'center' }, avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }, initials: { fontSize: 20, fontWeight: '800', color: colors.background }, nameGroup: { flex: 1, gap: 6 }, name: { color: colors.text, fontSize: 23, fontWeight: '800' }, badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#222c70', alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 16 }, badgeText: { color: colors.primary, fontSize: 11, fontWeight: '700' }, help: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.field, justifyContent: 'center', alignItems: 'center' },
  points: { marginTop: 16, backgroundColor: colors.field, borderRadius: 18, padding: 16, gap: 8 }, pointsLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, pointsValue: { color: colors.text, fontSize: 23, fontWeight: '800' }, pointsLabel: { color: colors.muted, fontSize: 13, fontWeight: '400' }, progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#222c70' }, pointsNote: { color: colors.muted, fontSize: 11 },
  body: { paddingHorizontal: 20 }, notice: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.field, borderRadius: 18, minHeight: 60, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }, noticeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }, noticeText: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.text }, trailHeading: { color: colors.muted, fontSize: 12, marginTop: 18 },
  continueCard: { backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }, continueCopy: { flex: 1, minWidth: 150, gap: 6 }, continueEyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1 }, trailProgress: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  trailSelector: { gap: 8, paddingVertical: 16 }, trailChip: { padding: 10, borderRadius: 16, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border }, selectedChip: { borderColor: colors.primary }, chipText: { color: colors.muted, fontSize: 12 }, yellow: { color: colors.primary },
  state: { paddingVertical: 32, gap: 18 }, description: { fontSize: 15, lineHeight: 23, color: colors.muted },
  navContainer: { backgroundColor: colors.field }, nav: { flexDirection: 'row', width: '100%', maxWidth: 430, alignSelf: 'center', paddingTop: 8 }, navItem: { flex: 1, gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 66 }, navLabel: { color: colors.muted, fontSize: 12 }, activeMark: { position: 'absolute', top: -4, width: 24, height: 3, borderRadius: 2, backgroundColor: colors.primary }, reportIcon: { backgroundColor: colors.primary, width: 70, height: 40, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, tinyLock: { position: 'absolute', right: 0, top: -10, width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'flex-end', alignItems: 'center' }, sheet: { maxHeight: '90%', width: '100%', maxWidth: 430, backgroundColor: colors.field, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, sheetContent: { padding: 24, gap: 20 }, sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 }, sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '700', flex: 1 }, close: { color: colors.muted, fontSize: 32 }, actionError: { color: '#ffad61', fontSize: 14, lineHeight: 20 }, moduleContent: { color: colors.text, fontSize: 16, lineHeight: 26 },
})
