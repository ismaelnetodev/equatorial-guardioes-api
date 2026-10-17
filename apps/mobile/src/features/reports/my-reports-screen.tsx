import { useFonts, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { AppIcon } from '../../components/app-icon'
import { Button } from '../../components/ui'
import { ApiError, errorMessage } from '../../services/api'
import { listReports, type Reports } from './reports.api'

type Report = Reports['reports'][number]

const statusColors = {
  SENT: { backgroundColor: '#E6EAFF', color: '#424FFF', width: 93 },
  RECEIVED: { backgroundColor: '#E6EAFF', color: '#424FFF', width: 93 },
  IN_ANALYSIS: { backgroundColor: '#FFE29A', color: '#795000', width: 103 },
  RESOLVED: { backgroundColor: '#C9F2DD', color: '#00864C', width: 97 },
  NOT_CONFIRMED: { backgroundColor: '#1E2870', color: '#A8AED0', width: 130 },
} satisfies Record<Report['status']['code'], { backgroundColor: string; color: string; width: number }>

function StatusIcon({ status, color }: { status: Report['status']['code']; color: string }) {
  return <Svg width={14} height={14} viewBox="0 0 14 14" accessible={false} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {status === 'IN_ANALYSIS' ? <><Circle cx={7} cy={7} r={5.2} /><Path d="M7 3.8V7l2.2 1.3" /></> : status === 'NOT_CONFIRMED' ? <><Circle cx={7} cy={7} r={5.2} /><Path d="M7 6.2v3.2M7 4.3h.01" /></> : <Path d="m3 7 2.5 2.5L11 4" />}
  </Svg>
}

export function ReportStatusBadge({ status }: { status: Report['status'] }) {
  const appearance = statusColors[status.code]
  return <View style={[styles.status, { backgroundColor: appearance.backgroundColor, minWidth: appearance.width }]}><StatusIcon status={status.code} color={appearance.color} /><Text style={[styles.statusLabel, { color: appearance.color }]}>{status.label}</Text></View>
}

function reportDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Hoje, ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(' de ', ' ').replace('.', '')
}

export function MyReportsScreen({ onBack }: { onBack: () => void }) {
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const [data, setData] = useState<Reports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    void listReports(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
      setError(errorMessage(cause))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])

  if (!fontsLoaded && !fontError) return <View style={styles.state}><ActivityIndicator color="#FFBB12" /></View>

  return <ScrollView style={styles.screen} contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setAttempt(value => value + 1)} tintColor="#FFBB12" />}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar à trilha" onPress={onBack} style={styles.back}><View style={styles.chevron} /></Pressable>
      <Text accessibilityRole="header" style={styles.heading}>Meus relatos</Text>
    </View>
    {loading ? <View style={styles.state}><ActivityIndicator color="#FFBB12" accessibilityLabel="Carregando seus relatos" /></View> : error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> : data?.reports.length === 0 ? <View style={styles.empty}>
      <Image source={require('../../../assets/reports-empty.png')} accessible={false} style={styles.illustration} resizeMode="contain" />
      <Text accessibilityRole="header" style={styles.title}>Nenhum relato ainda</Text>
      <Text style={styles.description}>Quando vir um risco na rua, fotografe de longe e reporte. Seu bairro agradece.</Text>
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.create, { opacity: pressed ? 0.7 : 1 }]}><AppIcon name="bolt" color="#0B1240" size={22} /><Text style={styles.createText}>Fazer meu primeiro relato</Text></Pressable>
    </View> : data ? <View style={styles.list}>
      <View style={styles.summary}>
        <View style={styles.metric}><Text style={styles.metricValue}>{data.summary.sentCount}</Text><Text style={styles.metricLabel}>enviados</Text></View>
        <View style={[styles.metric, styles.metricMiddle]}><Text style={styles.metricValue}>{data.summary.resolvedCount}</Text><Text style={styles.metricLabel}>{data.summary.resolvedCount === 1 ? 'resolvido' : 'resolvidos'}</Text></View>
        <View style={styles.metric}><Text style={[styles.metricValue, styles.pointsValue]}>+{data.summary.totalPoints}</Text><Text style={styles.metricLabel}>pontos</Text></View>
      </View>
      <Text style={styles.sectionTitle}>RECENTES</Text>
      {data.reports.map(report => {
        const location = [report.address, report.neighborhood].filter(Boolean).join(' · ')
        return <Pressable key={report.id} accessibilityRole="button" accessibilityLabel={`Ver relato: ${report.title}`} onPress={() => router.push({ pathname: '/relatos/[reportId]', params: { reportId: report.id } })} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.8 : 1 }]}>
          <Image source={report.photoUrl ? { uri: report.photoUrl } : report.status.code === 'IN_ANALYSIS' ? require('../../../assets/report-kite.png') : require('../../../assets/report-pole.png')} accessible={false} style={styles.thumbnail} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{report.title}</Text>
            <Text style={styles.address} numberOfLines={1}>{location}</Text>
            <View style={styles.cardFooter}>
              <ReportStatusBadge status={report.status} />
              <Text style={styles.date}>{reportDate(report.submittedAt)}</Text>
            </View>
          </View>
        </Pressable>
      })}
    </View> : null}
  </ScrollView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B1240' },
  page: { flexGrow: 1, width: '100%', maxWidth: 360, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, backgroundColor: '#0B1240' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 44 },
  back: { width: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 10, height: 10, borderLeftWidth: 2.2, borderBottomWidth: 2.2, borderColor: '#fff', transform: [{ rotate: '45deg' }] },
  heading: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 20, lineHeight: 26 },
  empty: { alignItems: 'center', paddingTop: 24 },
  illustration: { width: '100%', maxWidth: 240, height: 189, borderRadius: 28 },
  title: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: 20, marginBottom: 12 },
  description: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  create: { width: '100%', minHeight: 56, borderRadius: 16, backgroundColor: '#FFBB12', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12, marginTop: 28 },
  createText: { flexShrink: 1, color: '#0B1240', fontFamily: 'Archivo_800ExtraBold', fontSize: 17, lineHeight: 22, textAlign: 'center' },
  state: { flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 40 },
  list: { gap: 12, paddingTop: 20 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141C55', borderRadius: 18, minHeight: 72, paddingVertical: 12, marginBottom: 8 },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#2A3590' },
  metricValue: { color: '#fff', fontFamily: 'Archivo_800ExtraBold', fontSize: 24, lineHeight: 26 },
  metricLabel: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 18 },
  pointsValue: { color: '#FFBB12' },
  sectionTitle: { color: '#FFBB12', fontFamily: 'Archivo_400Regular', fontSize: 11, letterSpacing: 1.2, marginBottom: 2 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 104, backgroundColor: '#141C55', padding: 12, borderRadius: 18, gap: 12 },
  thumbnail: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#141C55' },
  cardContent: { flex: 1, minWidth: 0, minHeight: 80, paddingTop: 2, paddingBottom: 3 },
  cardTitle: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 15, lineHeight: 20 },
  address: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 18, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 'auto', paddingTop: 10 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12.5, minHeight: 25, paddingHorizontal: 10, paddingVertical: 4, gap: 6 },
  statusLabel: { fontFamily: 'Archivo_700Bold', fontSize: 12, lineHeight: 17 },
  date: { color: '#7C82A8', fontFamily: 'Archivo_400Regular', fontSize: 11, lineHeight: 16, textAlign: 'right' },
})
