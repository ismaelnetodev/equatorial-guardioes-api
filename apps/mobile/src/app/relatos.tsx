import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Button, colors } from '../components/ui'
import { ProfilePage } from '../components/profile-page'
import { ProfileSymbol } from '../components/profile-symbol'
import { getPendingReportImpact, listReports, markReportImpactSeen, type ReportImpact, type ReportsList } from '../features/reports/reports.api'
import { ApiError, errorMessage } from '../services/api'

export default function ReportsScreen() {
  const [data, setData] = useState<ReportsList | null>(null)
  const [impact, setImpact] = useState<ReportImpact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [impactError, setImpactError] = useState('')
  const [impactBusy, setImpactBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setImpactError('')
    listReports(controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar seus relatos.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    getPendingReportImpact(controller.signal)
      .then(result => { if (!controller.signal.aborted) setImpact(result) })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setImpactError(errorMessage(cause, 'Não foi possível carregar a atualização de impacto.'))
      })
    return () => controller.abort()
  }, [attempt]))

  async function acknowledgeImpact() {
    if (!impact || impactBusy) return
    setImpactBusy(true)
    setImpactError('')
    try {
      await markReportImpactSeen(impact.reportId)
      setImpact(null)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/entrar')
        return
      }
      setImpactError(errorMessage(cause, 'Não foi possível confirmar que você viu esta atualização.'))
    } finally {
      setImpactBusy(false)
    }
  }

  return (
    <ProfilePage title="Meus relatos">
      <ScrollView contentContainerStyle={styles.content}>
        {impactError ? <View style={styles.impactError}><Text accessibilityRole="alert" style={styles.description}>{impactError}</Text><Button title="Tentar novamente" outline onPress={() => setAttempt(value => value + 1)} /></View> : null}
        {impact ? <View style={styles.impactCard}>
          <Text style={styles.impactTitle}>{impact.title}</Text>
          <Text style={styles.description}>{impact.message}</Text>
          <Text style={styles.points}>+{impact.pointsAwarded} pts · {impact.neighborhood}</Text>
          <Button title={impactBusy ? 'Confirmando…' : 'Entendi'} disabled={impactBusy} onPress={() => { void acknowledgeImpact() }} />
        </View> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={styles.state} accessibilityLabel="Carregando relatos" /> :
          error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> :
          data ? <>
            <View style={styles.summary}>
              <Summary value={data.summary.sentCount} label="enviados" />
              <View style={styles.divider} />
              <Summary value={data.summary.resolvedCount} label="resolvidos" />
              <View style={styles.divider} />
              <Summary value={data.summary.totalPoints} label="pontos" />
            </View>
            <Text style={styles.sectionLabel}>HISTÓRICO</Text>
            <View style={styles.list}>
              {data.reports.map(report => (
                <Pressable key={report.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/relatos/[reportId]', params: { reportId: report.id } })} style={styles.report}>
                  <View style={styles.reportIcon}><ProfileSymbol name="report" color={colors.primary} size={20} /></View>
                  <View style={styles.reportCopy}>
                    <Text numberOfLines={1} style={styles.reportTitle}>{report.title}</Text>
                    <Text numberOfLines={1} style={styles.reportAddress}>{report.address}</Text>
                    <Text style={styles.reportStatus}>{report.status.label} · {new Date(report.submittedAt).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <View style={styles.trailing}>
                    {report.pointsAwarded ? <Text style={styles.points}>+{report.pointsAwarded} pts</Text> : null}
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Pressable>
              ))}
              {!data.reports.length ? <View style={styles.empty}>
                <ProfileSymbol name="report" size={30} />
                <Text style={styles.emptyTitle}>Nenhum relato ainda</Text>
                <Text style={styles.description}>Quando você enviar um risco observado no bairro, ele aparecerá aqui.</Text>
              </View> : null}
            </View>
          </> : null}
      </ScrollView>
    </ProfilePage>
  )
}

function Summary({ value, label }: { value: number; label: string }) {
  return <View style={styles.summaryItem}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 25 },
  state: { paddingVertical: 30, gap: 14 },
  impactError: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.warning },
  impactCard: { gap: 9, padding: 15, marginBottom: 14, borderRadius: 16, backgroundColor: '#171F5E', borderWidth: 1, borderColor: colors.primary },
  impactTitle: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  summary: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.field },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryValue: { color: colors.text, fontSize: 19, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 10 },
  divider: { height: 40, width: 1, backgroundColor: colors.border },
  sectionLabel: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginTop: 20, marginBottom: 10 },
  list: { gap: 9 },
  report: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 15, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border },
  reportIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.background },
  reportCopy: { flex: 1, gap: 3 },
  reportTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  reportAddress: { color: colors.muted, fontSize: 11 },
  reportStatus: { color: colors.mutedSecondary, fontSize: 10 },
  trailing: { alignItems: 'flex-end', gap: 3 },
  points: { color: colors.muted, fontSize: 10 },
  chevron: { color: colors.mutedSecondary, fontSize: 22 },
  empty: { alignItems: 'center', gap: 10, padding: 28, marginTop: 10, borderRadius: 17, backgroundColor: colors.field },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
})
