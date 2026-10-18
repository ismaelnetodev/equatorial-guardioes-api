import { useEffect, useMemo, useState } from 'react'
import { ImageBackground, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import * as api from './admin.api'
import { useAction, type ReportError } from './admin.ui'
import { art, Azulejo, DualBar, Panel, Pill, tone } from './admin-painel.ui'
import { MARANHAO_PATH, MARANHAO_VIEWBOX, SAO_LUIS_POINT } from './maranhao'

type Area = { neighborhood: string; sent: number; resolved: number; high: number }

function group(reports: api.AdminReport[]): Area[] {
  const areas = new Map<string, Area>()
  for (const report of reports) {
    const name = report.neighborhood.trim() || 'Sem bairro informado'
    const area = areas.get(name) ?? { neighborhood: name, sent: 0, resolved: 0, high: 0 }
    area.sent += 1
    if (report.status.code === 'RESOLVED') area.resolved += 1
    if (report.urgency.code === 'HIGH') area.high += 1
    areas.set(name, area)
  }
  return [...areas.values()].sort((a, b) => b.sent - a.sent || a.neighborhood.localeCompare(b.neighborhood, 'pt-BR'))
}

function level(area: Area) {
  const share = area.sent ? area.high / area.sent : 0
  if (share >= 0.5) return { label: 'Alto', ink: tone.red, wash: tone.redSoft }
  if (share > 0) return { label: 'Médio', ink: '#8A6200', wash: tone.amberSoft }
  return { label: 'Baixo', ink: tone.blue, wash: tone.blueSoft }
}

export function AdminKnowledge({ onError }: { onError: ReportError }) {
  const wide = useWindowDimensions().width >= 1180
  const [reports, setReports] = useState<api.AdminReport[]>([])
  const [loaded, setLoaded] = useState(false)
  const { busy, run } = useAction(onError)
  const refresh = async () => { setReports(await api.listReports()); setLoaded(true) }
  useEffect(() => { void run(refresh) }, [])
  const areas = useMemo(() => group(reports), [reports])
  const resolved = reports.filter(report => report.status.code === 'RESOLVED').length
  return <View style={styles.page}>
    <ImageBackground source={art.lencois} resizeMode="cover" style={styles.hero}>
      <View style={styles.heroText}>
        <Text style={styles.heroKicker}>Inteligência do programa</Text>
        <Text style={styles.heroTitle}>Mapa de conhecimento</Text>
        <Text style={styles.heroCaption}>Onde os relatos se repetem, quanto já foi resolvido e em quais bairros o risco se concentra.</Text>
      </View>
    </ImageBackground>
    <Azulejo height={32} />
    <View style={styles.body}>
      {loaded && !reports.length ? <Panel><Text style={styles.empty}>Nenhum relato recebido ainda. Este painel se preenche sozinho conforme os moradores usarem o aplicativo.</Text></Panel> : null}
      {reports.length ? <View style={[styles.split, wide && { flexDirection: 'row' }]}>
        <Panel style={styles.table}>
          <View style={styles.head}>
            <Text style={[styles.headCell, styles.colName]}>Bairro</Text>
            <Text style={[styles.headCell, styles.colCount]}>Relatos</Text>
            <Text style={[styles.headCell, styles.colBar]}>Enviados × resolvidos</Text>
            <Text style={[styles.headCell, styles.colTag]}>Risco</Text>
          </View>
          {areas.map(area => {
            const mark = level(area)
            return <View key={area.neighborhood} style={styles.row}>
              <Text style={[styles.name, styles.colName]} numberOfLines={1}>{area.neighborhood}</Text>
              <Text style={[styles.count, styles.colCount]}>{area.sent}</Text>
              <View style={styles.colBar}><DualBar sent={area.sent} resolved={area.resolved} /></View>
              <View style={styles.colTag}><Pill label={mark.label} color={mark.ink} background={mark.wash} /></View>
            </View>
          })}
          <Text style={styles.foot}>{reports.length} relatos em {areas.length} {areas.length === 1 ? 'bairro' : 'bairros'} · {resolved} já resolvidos. Azul é o que foi resolvido, verde o que ainda está em aberto.</Text>
        </Panel>
        <View style={styles.stateCard}>
          <Text style={styles.stateKicker}>Área de atuação</Text>
          <View style={styles.stateShape}>
            <Svg width="100%" height="100%" viewBox={MARANHAO_VIEWBOX}>
              <Path d={MARANHAO_PATH} fill="#FFFFFF" />
              <Circle cx={SAO_LUIS_POINT.x} cy={SAO_LUIS_POINT.y} r="6.5" fill={tone.amber} stroke="#FFFFFF" strokeWidth="2" />
            </Svg>
          </View>
          <Text style={styles.stateTitle}>São Luís · Maranhão</Text>
          <Text style={styles.stateCaption}>O piloto começa por São Luís. O conteúdo é o mesmo em qualquer cidade da concessão: muda o mapa, não muda o app.</Text>
          <Text style={styles.credit}>Contorno: @svg-maps/brazil · CC BY 4.0</Text>
        </View>
      </View> : null}
    </View>
  </View>
}

const styles = StyleSheet.create({
  page: { backgroundColor: tone.cream, borderRadius: 20, overflow: 'hidden' },
  hero: { height: 260, backgroundColor: tone.navy, justifyContent: 'flex-start' },
  heroText: { paddingHorizontal: 32, paddingTop: 40, gap: 7, maxWidth: 520 },
  heroKicker: { color: tone.amber, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: -0.8, textShadowColor: 'rgba(11,18,64,0.6)', textShadowRadius: 12 },
  heroCaption: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, textShadowColor: 'rgba(11,18,64,0.9)', textShadowRadius: 8 },
  body: { padding: 28, gap: 18 },
  empty: { color: tone.inkSoft, fontSize: 14, lineHeight: 21 },
  split: { gap: 18, alignItems: 'stretch' },
  table: { flexGrow: 3, flexBasis: 460, gap: 0, paddingVertical: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EFE7D4' },
  headCell: { color: tone.inkFaint, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F4EEDF' },
  colName: { width: 130 },
  colCount: { width: 76 },
  colBar: { flex: 1, minWidth: 110 },
  colTag: { width: 74, alignItems: 'flex-end' },
  name: { color: tone.ink, fontSize: 14, fontWeight: '800' },
  count: { color: tone.ink, fontSize: 14, fontWeight: '700' },
  foot: { color: tone.inkFaint, fontSize: 12, lineHeight: 18, paddingTop: 14 },
  stateCard: { flexGrow: 1, flexBasis: 280, backgroundColor: tone.blue, borderRadius: 20, padding: 22, gap: 12 },
  stateKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  stateShape: { height: 300, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  stateCaption: { color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 20 },
  credit: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
})
