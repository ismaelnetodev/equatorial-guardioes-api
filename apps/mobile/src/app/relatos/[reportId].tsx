import { Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold, useFonts } from '@expo-google-fonts/archivo'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { ReportStatusBadge } from '../../features/reports/my-reports-screen'
import { getReport, type ReportDetail } from '../../features/reports/reports.api'
import { ApiError, errorMessage } from '../../services/api'

type IconName = 'pin' | 'clock' | 'document' | 'star' | 'warning' | 'back' | 'check'
function Icon({ name, color = '#B9BDD0', size = 20 }: { name: IconName; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {name === 'pin' ? <><Path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z" /><Circle cx={12} cy={10} r={2.5} /></> : name === 'clock' ? <><Circle cx={12} cy={12} r={9} /><Path d="M12 6v6l4 2" /></> : name === 'document' ? <Path d="M6 3h8l5 5v13H6ZM14 3v6h5M9 13h7M9 17h5" /> : name === 'star' ? <Path d="m12 3 2.7 6 6.3.6-4.8 4.2 1.4 6.2-5.6-3.2L6.4 20l1.4-6.2L3 9.6 9.3 9Z" /> : name === 'warning' ? <Path d="m12 3 10 18H2ZM12 9v5M12 17h.01" /> : name === 'back' ? <Path d="m15 5-7 7 7 7" /> : <Path d="m6 12 4 4 8-9" />}
  </Svg>
}

function dateLabel(value: string) {
  const date = new Date(value)
  const day = date.toDateString() === new Date().toDateString() ? 'Hoje' : date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(' de ', ' ').replace('.', '')
  return day + ', ' + date.toLocaleTimeString('pt-BR', { hour: 'numeric', minute: '2-digit' })
}

const urgencyColors = {
  LOW: { backgroundColor: '#C9F2DD', color: '#00864C' },
  MEDIUM: { backgroundColor: '#FFE29A', color: '#7A5200' },
  HIGH: { backgroundColor: '#FFD5C8', color: '#A53319' },
}

export default function ReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>()
  const insets = useSafeAreaInsets()
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mapError, setMapError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/trilha', params: { panel: 'report' } }) }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setReport(null)
    if (!reportId) { setError('Relato não encontrado.'); setLoading(false); return () => controller.abort() }
    void getReport(reportId, controller.signal).then(data => {
      if (!controller.signal.aborted) setReport(data)
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
      setError(errorMessage(cause, 'Não foi possível carregar este relato.'))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reportId, attempt])

  async function openMap() {
    if (!report) return
    setMapError('')
    const query = report.latitude !== null && report.longitude !== null ? `${report.latitude},${report.longitude}` : [report.address, report.neighborhood].filter(Boolean).join(', ')
    try { await Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)) }
    catch { setMapError('Não foi possível abrir o mapa. Tente novamente.') }
  }

  const ready = fontsLoaded || fontError
  const urgency = report ? urgencyColors[report.urgency.code] : urgencyColors.MEDIUM
  return <View style={styles.screen}>
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
      <View style={styles.hero}>
        <Image source={report?.photoUrl ? { uri: report.photoUrl } : require('../../../assets/report-detail-hero.png')} style={styles.heroImage} resizeMode="cover" accessible={false} />
        {report?.photoUrl ? <Svg style={styles.heroShade} width="100%" height={100}><Defs><LinearGradient id="photoFade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#0B1240" stopOpacity={0} /><Stop offset="1" stopColor="#0B1240" /></LinearGradient></Defs><Rect width="100%" height={100} fill="url(#photoFade)" /></Svg> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos meus relatos" onPress={goBack} style={[styles.back, { top: insets.top + 12 }]}><Icon name="back" color="#fff" size={24} /></Pressable>
        {ready && report ? <Text accessibilityRole="header" style={styles.title}>{report.title}</Text> : null}
      </View>
      {loading || !ready ? <View style={styles.state}><ActivityIndicator color="#FFB81C" accessibilityLabel="Carregando relato" /></View> : error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.mapButton}><Text style={styles.mapText}>Tentar novamente</Text></Pressable></View> : report ? <View style={styles.content}>
        <View style={styles.badges}>
          <ReportStatusBadge status={report.status} />
          <View style={[styles.urgency, { backgroundColor: urgency.backgroundColor }]}><Icon name="warning" size={14} color={urgency.color} /><Text style={[styles.urgencyText, { color: urgency.color }]}>{report.urgency.label}</Text></View>
        </View>
        <View style={styles.info}>
          <View style={styles.infoRow}><Icon name="pin" /><Text style={styles.infoText}>{[report.address, report.neighborhood].filter(Boolean).join(' · ')}</Text></View>
          <View style={styles.infoRow}><Icon name="clock" /><Text style={styles.infoText}>{dateLabel(report.submittedAt)}</Text></View>
          <View style={styles.infoRow}><Icon name="document" /><Text style={styles.infoText}>{report.description}</Text></View>
        </View>
        <Text style={styles.eyebrow}>LINHA DO TEMPO</Text>
        <View style={styles.timeline}>
          {report.timeline.map((event, index) => {
            const current = event.status.code === report.status.code
            const completed = !event.pending && !current
            return <View key={event.status.code} style={styles.timelineRow}>
              {index < report.timeline.length - 1 ? <View style={[styles.connector, { backgroundColor: completed ? '#19C2B5' : '#2A3590' }]} /> : null}
              <View style={[styles.dot, { backgroundColor: event.pending ? '#1E2870' : current && report.status.code !== 'RESOLVED' ? '#FFB81C' : '#19C2B5' }]}>{completed || (current && report.status.code === 'RESOLVED') ? <Icon name="check" size={18} color="#0B1240" /> : current ? <View style={styles.currentDot} /> : null}</View>
              <Text style={[styles.timelineTitle, event.pending && styles.pending]}>{event.status.label}</Text>
              <Text style={styles.timelineDate}>{event.occurredAt ? dateLabel(event.occurredAt) : 'aguardando'}</Text>
            </View>
          })}
        </View>
        <View style={styles.points}><Icon name="star" size={18} color="#FFB81C" /><Text style={styles.pointsText}>{report.pointsHint}</Text></View>
        <Pressable accessibilityRole="link" onPress={() => { void openMap() }} style={({ pressed }) => [styles.mapButton, { opacity: pressed ? 0.7 : 1 }]}><Icon name="pin" size={22} color="#fff" /><Text style={styles.mapText}>Ver no mapa</Text></Pressable>
        {mapError ? <Text accessibilityRole="alert" style={styles.error}>{mapError}</Text> : null}
      </View> : null}
    </ScrollView>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1240' },
  page: { width: '100%', maxWidth: 360, alignSelf: 'center', flexGrow: 1 },
  hero: { height: 250, marginBottom: 26 },
  heroImage: { width: '100%', height: 250 },
  heroShade: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  back: { position: 'absolute', left: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: '#0B1240CC', alignItems: 'center', justifyContent: 'center' },
  title: { position: 'absolute', left: 20, right: 20, bottom: -16, color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 28, lineHeight: 34 },
  content: { paddingHorizontal: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 15 },
  urgency: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12.5, minHeight: 25, paddingHorizontal: 10, paddingVertical: 4 },
  urgencyText: { fontFamily: 'Archivo_700Bold', fontSize: 12, lineHeight: 17 },
  info: { backgroundColor: '#141C55', borderRadius: 18, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { flex: 1, color: '#fff', fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 18 },
  eyebrow: { color: '#FFB81C', fontFamily: 'Archivo_400Regular', fontSize: 11, lineHeight: 16, letterSpacing: 1.2, marginTop: 18, marginBottom: 10 },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 44, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  connector: { position: 'absolute', left: 11, top: 22, bottom: -2, width: 2 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0B1240' },
  timelineTitle: { flex: 1, color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 14, lineHeight: 24 },
  pending: { color: '#7C82A8' },
  timelineDate: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 24, textAlign: 'right' },
  points: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 20 },
  pointsText: { flex: 1, color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 19 },
  mapButton: { minHeight: 56, borderWidth: 1.5, borderColor: '#2A3590', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mapText: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 17, lineHeight: 22 },
  state: { padding: 20, gap: 20 },
  error: { color: '#FFB9A4', fontFamily: 'Archivo_400Regular', fontSize: 14, lineHeight: 20, marginTop: 12 },
})
