import { useCallback, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../components/ui'
import { Action, Card, Hint, Title, ui, useAction } from '../features/admin/admin.ui'
import { getLearningHistory, refreshLearningSummary, type LearningHistory, type LearningSummary } from '../features/trails/progress.api'
import { ApiError, errorMessage } from '../services/api'

export default function LearningPointsScreen() {
  const [summary, setSummary] = useState<LearningSummary | null>(null)
  const [rows, setRows] = useState<LearningHistory>([])
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState('')
  const fail = (cause: unknown) => { if (cause instanceof ApiError && cause.status === 401) router.replace('/entrar'); else setError(errorMessage(cause)) }
  const { busy, run } = useAction(fail)
  const load = async (page = offset) => { setError(''); const balance = await refreshLearningSummary(); const history = await getLearningHistory(page); setSummary(balance); setRows(history); setOffset(page) }
  useFocusEffect(useCallback(() => { void run(() => load(0)) }, []))
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { void run(() => load(0)) }} tintColor={colors.primary} />} contentContainerStyle={{ padding: 20, gap: 18, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
    <Action title="‹ Voltar à trilha" onPress={() => router.replace('/trilha')} /><Title>Seus pontos de aprendizado</Title>
    {error ? <Text accessibilityRole="alert" style={{ color: '#ffbb80' }}>{error}</Text> : null}
    {summary ? <Card><Text style={{ color: colors.primary, fontSize: 40, fontWeight: '800' }}>{summary.totalPoints} pts</Text><Hint>Já liberados por módulos, melhoria no pós-teste e prova final.</Hint><Title>{summary.pendingPoints} pontos pendentes</Title>
      <Hint>{summary.modulePoints} pontos por módulo{summary.dailyModuleLimit != null ? `, até ${summary.dailyModuleLimit} módulos por dia` : ''}{summary.dailyPointsLimit != null ? ` e ${summary.dailyPointsLimit} pontos de módulos por dia` : ''}.</Hint>
      {summary.pendingPoints > 0 ? <Hint>{summary.nextReleaseAt ? `Os excedentes são liberados nos dias seguintes. Próxima liberação a partir de ${new Date(summary.nextReleaseAt).toLocaleString('pt-BR')}.` : 'Os pontos registrados aguardam liberação conforme a configuração do programa.'}</Hint> : null}
      <Hint>O quiz do módulo libera a sequência. Pontos do quiz e de conclusão são registrados separadamente.</Hint>
    </Card> : <ActivityIndicator color={colors.primary} />}
    <Title>Extrato</Title>
    {!busy && !rows.length ? <Hint>Nenhuma concessão nesta página. Conclua módulos para registrar seu aprendizado.</Hint> : null}
    {rows.map(row => <Card key={row.id}><View style={ui.row}><Title>+{row.points} pts</Title><Text style={ui.badge}>{row.status === 'GRANTED' ? 'Liberados' : 'Pendentes'}</Text></View><Text style={ui.label}>{row.description}</Text><Hint>Conclusão registrada em {new Date(row.createdAt).toLocaleString('pt-BR')}</Hint>{row.grantedAt ? <Hint>Liberação: {new Date(row.grantedAt).toLocaleString('pt-BR')}</Hint> : <Hint>Aguardando o limite de liberação.</Hint>}</Card>)}
    <View style={ui.row}><Action title="Anteriores" disabled={busy || offset === 0} onPress={() => { void run(() => load(Math.max(0, offset - 20))) }} /><Hint>Página {offset / 20 + 1}</Hint><Action title="Próximas" disabled={busy || rows.length < 20} onPress={() => { void run(() => load(offset + 20)) }} /></View>
  </ScrollView></SafeAreaView>
}
