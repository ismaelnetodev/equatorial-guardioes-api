import { useCallback, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Button, colors } from '../../components/ui'
import { ProfilePage } from '../../components/profile-page'
import { ProfileSymbol } from '../../components/profile-symbol'
import { getReport, type ReportDetail } from '../../features/reports/reports.api'
import { ApiError } from '../../services/api'

export default function ReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getReport(reportId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setReport(result) })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar o relato.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reportId, attempt]))

  return (
    <ProfilePage title="Detalhe do relato">
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.state} accessibilityLabel="Carregando relato" /> :
          error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> :
          report ? <>
            <View style={styles.statusCard}>
              <ProfileSymbol name="report" color={colors.primary} size={25} />
              <View style={styles.statusCopy}>
                <Text style={styles.title}>{report.title}</Text>
                <Text style={styles.status}>{report.status.label} · {report.urgency.label}</Text>
              </View>
            </View>
            {report.photoUrl ? <Image source={{ uri: report.photoUrl }} style={styles.photo} resizeMode="cover" accessibilityLabel="Foto anexada ao relato" /> : null}
            <View style={styles.infoCard}>
              <Text style={styles.description}>{report.description}</Text>
              <Text style={styles.location}>{report.address} · {report.neighborhood}</Text>
              <Text style={styles.date}>Enviado em {new Date(report.submittedAt).toLocaleString('pt-BR')}</Text>
            </View>
            <View style={styles.pointsCard}>
              <Text style={styles.points}>+{report.pointsAwarded} pts</Text>
              <Text style={styles.description}>{report.pointsHint}</Text>
            </View>
            <Text style={styles.sectionLabel}>ACOMPANHAMENTO</Text>
            <View style={styles.timeline}>
              {report.timeline.map((event, index) => (
                <View key={`${event.status.code}-${index}`} style={styles.timelineRow}>
                  <View style={styles.timelineMarkerColumn}>
                    <View style={[styles.marker, !event.pending && styles.markerDone]}><ProfileSymbol name={event.pending ? 'lock' : 'check'} color={event.pending ? colors.mutedSecondary : colors.background} size={13} /></View>
                    {index < report.timeline.length - 1 ? <View style={styles.connector} /> : null}
                  </View>
                  <View style={styles.eventCopy}>
                    <Text style={[styles.eventTitle, event.pending && styles.pending]}>{event.status.label}</Text>
                    <Text style={styles.eventDate}>{event.pending ? 'Aguardando atualização' : event.occurredAt ? new Date(event.occurredAt).toLocaleString('pt-BR') : 'Atualizado'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </> : null}
      </ScrollView>
    </ProfilePage>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 12 },
  state: { paddingVertical: 30, gap: 14 },
  statusCard: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border },
  statusCopy: { flex: 1, gap: 5 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  status: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  photo: { width: '100%', height: 180, borderRadius: 16, backgroundColor: colors.field },
  infoCard: { gap: 10, padding: 15, borderRadius: 16, backgroundColor: colors.field },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  location: { color: colors.text, fontSize: 12, fontWeight: '600' },
  date: { color: colors.mutedSecondary, fontSize: 10 },
  pointsCard: { gap: 3, padding: 14, borderRadius: 15, backgroundColor: '#171F5E' },
  points: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  sectionLabel: { color: colors.primary, fontSize: 10, letterSpacing: 1.1, fontWeight: '700', marginTop: 8 },
  timeline: { padding: 15, borderRadius: 16, backgroundColor: colors.field },
  timelineRow: { minHeight: 55, flexDirection: 'row', gap: 11 },
  timelineMarkerColumn: { width: 24, alignItems: 'center' },
  marker: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#252E68' },
  markerDone: { backgroundColor: colors.success },
  connector: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3 },
  eventCopy: { flex: 1, gap: 3, paddingTop: 2 },
  eventTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  pending: { color: colors.mutedSecondary },
  eventDate: { color: colors.muted, fontSize: 10 },
})
