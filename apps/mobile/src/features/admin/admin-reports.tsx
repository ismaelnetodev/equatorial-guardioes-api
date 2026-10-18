import { useEffect, useMemo, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import * as api from './admin.api'
import { useAction, type ReportError } from './admin.ui'
import { art, Azulejo, InfoRow, OutlineButton, Panel, Pill, SectionTitle, SolidButton, StatCard, tone } from './admin-painel.ui'
import { ReportMap, type MapPin } from './report-map'

type Filter = api.ReportStatusCode | 'ALL'

export const reportStatusLabels: Record<api.ReportStatusCode, string> = { SENT: 'Enviado', RECEIVED: 'Recebido', IN_ANALYSIS: 'Em análise', RESOLVED: 'Resolvido', NOT_CONFIRMED: 'Não confirmado' }
export const urgencyLabels: Record<api.ReportUrgencyCode, string> = { LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto' }
export const urgencyColors: Record<api.ReportUrgencyCode, string> = { LOW: tone.blue, MEDIUM: tone.amber, HIGH: tone.red }
const urgencyInk: Record<api.ReportUrgencyCode, string> = { LOW: tone.blue, MEDIUM: '#8A6200', HIGH: tone.red }
const urgencyWash: Record<api.ReportUrgencyCode, string> = { LOW: tone.blueSoft, MEDIUM: tone.amberSoft, HIGH: tone.redSoft }
const statusInk: Record<api.ReportStatusCode, string> = { SENT: tone.blue, RECEIVED: tone.blue, IN_ANALYSIS: '#8A6200', RESOLVED: '#0E8C83', NOT_CONFIRMED: tone.inkSoft }
const statusWash: Record<api.ReportStatusCode, string> = { SENT: tone.blueSoft, RECEIVED: tone.blueSoft, IN_ANALYSIS: tone.amberSoft, RESOLVED: tone.tealSoft, NOT_CONFIRMED: '#EEEFF4' }
const openSteps: api.ReportStatusCode[] = ['SENT', 'RECEIVED', 'IN_ANALYSIS', 'RESOLVED']
const filters: Filter[] = ['ALL', 'SENT', 'RECEIVED', 'IN_ANALYSIS', 'RESOLVED', 'NOT_CONFIRMED']

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function AdminReports({ onError }: { onError: ReportError }) {
  const wide = useWindowDimensions().width >= 1180
  const [reports, setReports] = useState<api.AdminReport[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const { busy, run } = useAction(onError)
  const refresh = async () => { setReports(await api.listReports()); setLoaded(true) }
  useEffect(() => { void run(refresh) }, [])
  const visible = useMemo(() => filter === 'ALL' ? reports : reports.filter(report => report.status.code === filter), [reports, filter])
  const selected = reports.find(report => report.id === selectedId) ?? null
  const pins: MapPin[] = visible.flatMap(report => report.latitude === null || report.longitude === null ? [] : [{ id: report.id, title: report.title, latitude: report.latitude, longitude: report.longitude, color: urgencyColors[report.urgency.code] }])
  const waiting = reports.filter(report => report.status.code === 'SENT' || report.status.code === 'RECEIVED').length
  const resolved = reports.filter(report => report.status.code === 'RESOLVED').length
  const points = reports.reduce((total, report) => total + report.pointsAwarded, 0)
  const apply = (id: string, body: { status: api.ReportStatusCode; confirmedRisk?: api.ReportUrgencyCode }) => run(async () => {
    const updated = await api.reportStatus(id, body)
    setReports(current => current.map(report => report.id === updated.id ? updated : report))
  })
  const saveEmergency = async (id: string, requiresEmergencyTeam: boolean | null) => {
    let saved = false
    await run(async () => {
      const updated = await api.reportEmergency(id, { requiresEmergencyTeam })
      setReports(current => current.map(report => report.id === updated.id ? { ...report, ...updated } : report))
      saved = true
    })
    return saved
  }
  return <View style={styles.page}>
    <Azulejo />
    <View style={styles.body}>
      <SectionTitle kicker="Painel · Equatorial · São Luís" title="Fila de relatos" caption="Relatos enviados pelos moradores pelo aplicativo. Abra um relato para conferir a foto, confirmar o risco e liberar os pontos." />
      <OutlineButton title={busy ? 'Aguarde…' : 'Atualizar relatos'} disabled={busy} onPress={() => { void run(refresh) }} />
      <View style={styles.stats}>
        <StatCard label="Relatos recebidos" value={String(reports.length)} caption="Total" />
        <StatCard label="Aguardando triagem" value={String(waiting)} caption="Enviados e recebidos" />
        <StatCard label="Resolvidos" value={String(resolved)} caption="Risco confirmado" />
        <StatCard label="Pontos liberados" value={'+' + points + ' pts'} caption="Somados aos moradores" highlight />
      </View>
      <View style={styles.filters}>
        {filters.map(code => {
          const count = code === 'ALL' ? reports.length : reports.filter(report => report.status.code === code).length
          const on = filter === code
          return <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(code)} style={[styles.filter, on && { backgroundColor: tone.navy, borderColor: tone.navy }]}>
            <Text style={[styles.filterText, on && { color: '#FFFFFF' }]}>{code === 'ALL' ? 'Todos' : reportStatusLabels[code]} · {count}</Text>
          </Pressable>
        })}
      </View>
      <View style={[styles.split, wide && { flexDirection: 'row' }]}>
        <View style={styles.mapSide}><ReportMap light pins={pins} selectedId={selectedId} onSelect={setSelectedId} height={wide ? 470 : 320} /></View>
        <Panel style={styles.listPanel}>
          <Text style={styles.listTitle}>{filter === 'ALL' ? 'Todos os relatos' : reportStatusLabels[filter]}</Text>
          {!loaded && busy ? <Text style={styles.empty}>Carregando relatos…</Text> : null}
          {loaded && !reports.length ? <Image source={art.vazio} accessible={false} resizeMode="contain" style={styles.emptyArt} /> : null}
          {loaded && !visible.length ? <Text style={styles.empty}>{reports.length ? 'Nenhum relato com esse status.' : 'Nenhum relato recebido ainda. Assim que um morador enviar pelo aplicativo, ele aparece aqui.'}</Text> : null}
          <ScrollView style={{ maxHeight: wide ? 400 : undefined }} contentContainerStyle={styles.listInner}>
            {visible.map(report => {
              const on = report.id === selectedId
              return <Pressable key={report.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSelectedId(report.id)} style={[styles.item, { backgroundColor: urgencyWash[report.urgency.code] }, on && { borderColor: tone.navy }]}>
                <Pill label={urgencyLabels[report.urgency.code]} color={urgencyInk[report.urgency.code]} background="rgba(255,255,255,0.72)" />
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{report.title}</Text>
                  <Text style={styles.itemPlace} numberOfLines={1}>{report.address} · {report.neighborhood}</Text>
                  <Text style={styles.itemTime}>{formatDate(report.submittedAt)} · {report.status.label}</Text>
                  {report.requiresEmergencyTeam === true ? <Text style={[styles.itemTime, { color: tone.red }]}>Exige equipe de emergência</Text> : null}
                </View>
              </Pressable>
            })}
          </ScrollView>
        </Panel>
      </View>
    </View>
    <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelectedId(null)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar a janela do relato" style={StyleSheet.absoluteFill} onPress={() => setSelectedId(null)} />
        <View style={[styles.window, wide && { maxWidth: 1080 }]}>
          <Azulejo height={28} />
          <ScrollView contentContainerStyle={styles.windowInner}>
            {selected ? <ReportDetail key={selected.id} report={selected} busy={busy} wide={wide} onApply={apply} onSaveEmergency={saveEmergency} onClose={() => setSelectedId(null)} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>
}

function ReportDetail({ report, busy, wide, onApply, onSaveEmergency, onClose }: { report: api.AdminReport; busy: boolean; wide: boolean; onApply: (id: string, body: { status: api.ReportStatusCode; confirmedRisk?: api.ReportUrgencyCode }) => void; onSaveEmergency: (id: string, decision: boolean | null) => Promise<boolean>; onClose: () => void }) {
  const [risk, setRisk] = useState<api.ReportUrgencyCode>(report.urgency.code)
  const [emergency, setEmergency] = useState(report.requiresEmergencyTeam)
  const [emergencySaved, setEmergencySaved] = useState(false)
  useEffect(() => { setEmergency(report.requiresEmergencyTeam) }, [report.requiresEmergencyTeam])
  const closed = report.status.code === 'RESOLVED' || report.status.code === 'NOT_CONFIRMED'
  const canReceive = report.status.code === 'SENT'
  const canAnalyze = report.status.code === 'SENT' || report.status.code === 'RECEIVED'
  const steps: api.ReportStatusCode[] = report.status.code === 'NOT_CONFIRMED' ? ['SENT', 'RECEIVED', 'IN_ANALYSIS', 'NOT_CONFIRMED'] : openSteps
  const reached = steps.indexOf(report.status.code)
  return <View style={styles.detail}>
    <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.back}>← Voltar para a fila</Text></Pressable>
    <Text style={styles.detailTitle}>{report.title}</Text>
    <View style={styles.rule} />
    <View style={[styles.split, wide && { flexDirection: 'row' }]}>
      <View style={styles.photoSide}>
        {report.photoUrl
          ? <Image accessibilityLabel={'Foto enviada no relato ' + report.title} source={{ uri: report.photoUrl }} style={styles.photo} resizeMode="cover" />
          : <StreetIllustration />}
        <Text style={styles.photoCaption}>{report.address} · {report.neighborhood} · enviado em {formatDate(report.submittedAt)}</Text>
      </View>
      <Panel style={styles.actions}>
        <Text style={styles.panelKicker}>Relato {report.id.slice(0, 8)}</Text>
        <View style={styles.pills}>
          <Pill label={urgencyLabels[report.urgency.code]} color={urgencyInk[report.urgency.code]} background={urgencyWash[report.urgency.code]} />
          <Pill label={report.status.label} color={statusInk[report.status.code]} background={statusWash[report.status.code]} />
        </View>
        <Text style={styles.panelHeading}>Classificação feita pela IA</Text>
        <Text style={styles.panelBody}>{report.description}</Text>
        <Text style={styles.panelKicker}>Detalhes do relato</Text>
        <View>
          <InfoRow label="Endereço" value={report.address} />
          <InfoRow label="Bairro" value={report.neighborhood} />
          <InfoRow label="Coordenadas" value={report.latitude !== null && report.longitude !== null ? report.latitude.toFixed(5) + ', ' + report.longitude.toFixed(5) : 'Não informadas'} strong={report.latitude === null} />
          <InfoRow label="Pontos liberados" value={report.pointsAwarded ? '+' + report.pointsAwarded + ' pts' : 'Nenhum ainda'} />
        </View>
        <Text style={styles.panelKicker}>Linha do tempo</Text>
        <View style={styles.timeline}>{steps.map((step, index) => <View key={step} style={styles.step}>
          <View style={[styles.stepDot, index <= reached && { backgroundColor: tone.blue, borderColor: tone.blue }]} />
          <Text style={[styles.stepText, index <= reached && { color: tone.ink, fontWeight: '700' }]}>{reportStatusLabels[step]}</Text>
        </View>)}</View>
        <Text style={styles.panelKicker}>Risco confirmado pela equipe</Text>
        <View style={styles.grid}>
          {(Object.keys(urgencyLabels) as api.ReportUrgencyCode[]).map(code => <OutlineButton key={code} title={'Risco ' + urgencyLabels[code].toLowerCase()} active={risk === code} disabled={busy || closed} onPress={() => setRisk(code)} />)}
          <OutlineButton title="Manter o que a IA sugeriu" disabled={busy || closed} active={risk === report.urgency.code} onPress={() => setRisk(report.urgency.code)} />
        </View>
        <Text style={styles.hint}>O risco escolhido é confirmado ao validar o relato e usado no cálculo dos pontos. Receber, colocar em análise ou invalidar não altera essa classificação.</Text>
        <Text style={styles.panelKicker}>Necessidade de equipe de emergência</Text>
        <Text style={styles.hint}>Decisão salva: {report.requiresEmergencyTeam === null ? 'Não avaliado' : report.requiresEmergencyTeam ? 'Exige equipe' : 'Não exige equipe'}. Este registro não aciona equipes nem altera o status ou os pontos.</Text>
        <View style={styles.grid}>
          {([{ value: null, label: 'Não avaliado' }, { value: true, label: 'Exige equipe' }, { value: false, label: 'Não exige equipe' }] as const).map(option => <OutlineButton key={option.label} title={option.label} active={emergency === option.value} disabled={busy} onPress={() => { setEmergency(option.value); setEmergencySaved(false) }} />)}
        </View>
        <OutlineButton title={busy ? 'Salvando…' : 'Salvar avaliação de emergência'} disabled={busy || emergency === report.requiresEmergencyTeam} onPress={() => { setEmergencySaved(false); void onSaveEmergency(report.id, emergency).then(setEmergencySaved) }} />
        {emergencySaved ? <Text accessibilityRole="alert" style={styles.hint}>Avaliação de emergência salva.</Text> : null}
        <SolidButton title={'Validar e liberar pontos'} icon="✓" disabled={busy || closed} onPress={() => onApply(report.id, { status: 'RESOLVED', confirmedRisk: risk })} />
        <OutlineButton title="Marcar como inválido" disabled={busy || closed} onPress={() => onApply(report.id, { status: 'NOT_CONFIRMED' })} />
        <View style={styles.grid}>
          <OutlineButton title="Marcar como recebido" disabled={busy || !canReceive} onPress={() => onApply(report.id, { status: 'RECEIVED' })} />
          <OutlineButton title="Colocar em análise" disabled={busy || !canAnalyze} onPress={() => onApply(report.id, { status: 'IN_ANALYSIS' })} />
        </View>
        <Text style={styles.hint}>A decisão atualiza a linha do tempo que o morador vê no aplicativo.</Text>
      </Panel>
    </View>
  </View>
}

// Sem foto, mostra a rua com a pipa presa na rede, na proporção original da arte (1080 × 750).
function StreetIllustration() {
  const [width, setWidth] = useState(0)
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.photo, styles.illustration]}>
    {width ? <Image accessible={false} source={art.rua} resizeMode="contain" style={{ width, height: width * 750 / 1080 }} /> : null}
    <View style={styles.noPhoto}><Text style={styles.noPhotoText}>Sem foto · o morador não anexou imagem</Text></View>
  </View>
}

const styles = StyleSheet.create({
  page: { backgroundColor: tone.cream, borderRadius: 20, overflow: 'hidden' },
  body: { padding: 28, gap: 22 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderWidth: 1, borderColor: '#DED3B8', backgroundColor: '#FBF7EC', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15, minHeight: 40, justifyContent: 'center' },
  filterText: { color: tone.ink, fontSize: 13, fontWeight: '700' },
  split: { gap: 18, alignItems: 'stretch' },
  mapSide: { flexGrow: 2, flexBasis: 420, minWidth: 320 },
  listPanel: { flexGrow: 1, flexBasis: 320, padding: 18, gap: 12 },
  listTitle: { color: tone.inkSoft, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  listInner: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'transparent' },
  itemText: { flexShrink: 1, gap: 2 },
  itemTitle: { color: tone.ink, fontSize: 15, fontWeight: '800' },
  itemPlace: { color: tone.inkSoft, fontSize: 12 },
  itemTime: { color: tone.inkFaint, fontSize: 11 },
  empty: { color: tone.inkSoft, fontSize: 14, lineHeight: 21 },
  emptyArt: { width: '100%', height: 220, borderRadius: 14 },
  detail: { gap: 10 },
  back: { color: tone.blue, fontSize: 13, fontWeight: '700' },
  detailTitle: { color: tone.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  rule: { width: 120, height: 4, borderRadius: 2, backgroundColor: tone.blue, marginBottom: 6 },
  photoSide: { flexGrow: 2, flexBasis: 420, gap: 8 },
  photo: { width: '100%', minHeight: 380, borderRadius: 18, backgroundColor: tone.navy, overflow: 'hidden' },
  illustration: { minHeight: 0 },
  noPhoto: { position: 'absolute', left: 16, bottom: 16, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: 'rgba(11,18,64,0.82)', borderWidth: 1, borderColor: 'rgba(255,184,28,0.5)' },
  noPhotoText: { color: tone.amber, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  photoCaption: { color: tone.inkFaint, fontSize: 12 },
  actions: { flexGrow: 1, flexBasis: 340, gap: 14 },
  panelKicker: { color: tone.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  panelHeading: { color: tone.ink, fontSize: 16, fontWeight: '800' },
  panelBody: { color: tone.inkSoft, fontSize: 14, lineHeight: 22 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hint: { color: tone.inkFaint, fontSize: 12, lineHeight: 18 },
  timeline: { gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#CBD1E6', backgroundColor: 'transparent' },
  stepText: { color: tone.inkSoft, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,42,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  window: { width: '100%', maxWidth: 760, maxHeight: '92%', backgroundColor: tone.cream, borderRadius: 22, overflow: 'hidden' },
  windowInner: { padding: 26 },
})
