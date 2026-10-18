import { type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

// Camada visual das telas de relatos, seguindo o Figma "04 · Telas Desktop":
// fundo creme, faixa de azulejo, cartões brancos e tipografia escura.
// Os elementos do Maranhão (azulejo, fitas do chapéu, Lençóis) vêm das ilustrações do app.
export const art = {
  azulejo: require('../../../assets/azulejo-guardiao.png'),
  fitas: require('../../../assets/quiz-result-confetti.png'),
  lencois: require('../../../assets/lencois-header.png'),
  rua: require('../../../assets/report-detail-hero.png'),
  vazio: require('../../../assets/reports-empty.png'),
  azulejoNoite: require('../../../assets/quiz-result-pattern.png'),
}
export const tone = {
  cream: '#F6EEDC',
  creamDark: '#E9DDBF',
  navy: '#0B1240',
  navySoft: '#141C55',
  line: '#E2D7BC',
  card: '#FFFFFF',
  ink: '#0B1240',
  inkSoft: '#5A6184',
  inkFaint: '#8A90A8',
  blue: '#2E4BFF',
  blueSoft: '#E6EAFF',
  teal: '#19C2B5',
  tealSoft: '#D6F6F2',
  amber: '#FFB81C',
  amberSoft: '#FFF2D2',
  orange: '#FF7A1A',
  orangeSoft: '#FFE8D6',
  red: '#E5252A',
  redSoft: '#FDE4E6',
}

// A arte do azulejo repete a cada 140 px; cada ladrilho mostra uma fileira de 4 flores.
export function Azulejo({ height = 40 }: { height?: number }) {
  const scale = height / 140
  return <View accessible={false} style={[styles.azulejo, { height }]}>
    {Array.from({ length: 14 }, (_, index) => <View key={index} style={{ width: 560 * scale, height, overflow: 'hidden' }}>
      <Image source={art.azulejo} style={{ width: 620 * scale, height: 420 * scale }} />
    </View>)}
  </View>
}

// Fitas do chapéu do bumba-meu-boi, penduradas sobre fundos azul-noite.
export function Fitas({ width, style }: { width: number; style?: object }) {
  return <Image accessible={false} source={art.fitas} resizeMode="contain" style={[{ width, height: width * 600 / 1440 }, style]} />
}

export function Pill({ label, color, background }: { label: string; color: string; background: string }) {
  return <View style={[styles.pill, { backgroundColor: background }]}><Text style={[styles.pillText, { color }]}>{label}</Text></View>
}

export function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>
}

export function StatCard({ label, value, caption, highlight = false }: { label: string; value: string; caption?: string; highlight?: boolean }) {
  const ink = highlight ? tone.navy : '#FFFFFF'
  return <View style={[styles.stat, { backgroundColor: highlight ? tone.teal : tone.navy }]}>
    <Text style={[styles.statLabel, { color: highlight ? 'rgba(11,18,64,0.72)' : 'rgba(255,255,255,0.68)' }]}>{label}</Text>
    <Text style={[styles.statValue, { color: ink }]}>{value}</Text>
    {caption ? <View style={[styles.statChip, { backgroundColor: highlight ? 'rgba(11,18,64,0.14)' : 'rgba(255,255,255,0.12)' }]}><Text style={[styles.statChipText, { color: highlight ? tone.navy : 'rgba(255,255,255,0.88)' }]}>{caption}</Text></View> : null}
  </View>
}

export function SectionTitle({ kicker, title, caption }: { kicker: string; title: string; caption?: string }) {
  return <View style={styles.heading}>
    <Text style={styles.kicker}>{kicker}</Text>
    <Text style={styles.title}>{title}</Text>
    {caption ? <Text style={styles.caption}>{caption}</Text> : null}
  </View>
}

export function Toggle({ value, title, caption, disabled, onChange }: { value: boolean; title: string; caption: string; disabled?: boolean; onChange: (next: boolean) => void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={[styles.toggle, { backgroundColor: value ? tone.tealSoft : '#F1F2F7' }]}>
    <View style={styles.toggleText}>
      <Text style={styles.toggleTitle}>{title}</Text>
      <Text style={styles.toggleCaption}>{caption}</Text>
    </View>
    <View style={[styles.track, { backgroundColor: value ? tone.teal : '#C9CDDC' }]}><View style={[styles.knob, value && { alignSelf: 'flex-end' }]} /></View>
  </Pressable>
}

export function SolidButton({ title, onPress, disabled, icon }: { title: string; onPress: () => void; disabled?: boolean; icon?: string }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.solid, disabled && { backgroundColor: '#B9BFD8' }, pressed && { opacity: 0.85 }]}>
    {icon ? <Text style={styles.solidIcon}>{icon}</Text> : null}
    <Text style={styles.solidText}>{title}</Text>
  </Pressable>
}

export function OutlineButton({ title, onPress, disabled, active = false }: { title: string; onPress: () => void; disabled?: boolean; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.outline, active && { backgroundColor: tone.amber, borderColor: tone.amber }, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
    <Text style={[styles.outlineText, active && { color: tone.navy }]}>{title}</Text>
  </Pressable>
}

export function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && { color: tone.orange }]}>{value}</Text></View>
}

export function DualBar({ sent, resolved }: { sent: number; resolved: number }) {
  const share = sent ? Math.round((resolved / sent) * 100) : 0
  return <View style={styles.dual}>
    <View style={styles.dualTrack}>
      <View style={{ flexGrow: Math.max(resolved, 0.001), backgroundColor: tone.blue }} />
      <View style={{ flexGrow: Math.max(sent - resolved, 0.001), backgroundColor: tone.teal }} />
      <View style={{ flexGrow: Math.max(sent ? 0.001 : 1, 0.001), backgroundColor: 'transparent' }} />
    </View>
    <Text style={styles.dualCaption}>{resolved} resolvidos de {sent} · {share}%</Text>
  </View>
}

const styles = StyleSheet.create({
  azulejo: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 3, borderBottomColor: tone.blue },
  pill: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  panel: { backgroundColor: tone.card, borderRadius: 20, padding: 24, gap: 16, borderWidth: 1, borderColor: '#EDE4CE' },
  stat: { flexGrow: 1, flexBasis: 190, borderRadius: 18, padding: 20, gap: 8, minHeight: 132, justifyContent: 'center' },
  statLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  statChip: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  statChipText: { fontSize: 11, fontWeight: '700' },
  heading: { gap: 6 },
  kicker: { color: tone.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: tone.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.6 },
  caption: { color: tone.inkSoft, fontSize: 15, lineHeight: 23 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderRadius: 14, padding: 16 },
  toggleText: { flexShrink: 1, gap: 3 },
  toggleTitle: { color: tone.ink, fontSize: 14, fontWeight: '700' },
  toggleCaption: { color: tone.inkSoft, fontSize: 12, lineHeight: 18 },
  track: { width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  solid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: tone.blue, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 22, minHeight: 56 },
  solidIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  solidText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  outline: { flexGrow: 1, flexBasis: 150, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E0D6BD', backgroundColor: '#FBF7EC', paddingVertical: 14, paddingHorizontal: 14, minHeight: 48 },
  outlineText: { color: tone.ink, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0EAD9' },
  infoLabel: { color: tone.inkSoft, fontSize: 13 },
  infoValue: { color: tone.ink, fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  dual: { gap: 5, flex: 1, minWidth: 120 },
  dualTrack: { flexDirection: 'row', height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: tone.creamDark, gap: 2 },
  dualCaption: { color: tone.inkFaint, fontSize: 11 },
})
