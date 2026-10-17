import { ContentSkeleton } from '../../components/content-skeleton'
import { useFonts, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppIcon } from '../../components/app-icon'
import type { ModuleCompletion } from './completion.api'

type Props = { data: ModuleCompletion; onTrail: () => void; onReport: () => void }
const c = { background: '#0B1240', card: '#141C55', yellow: '#FFB81C', teal: '#19C2B5', muted: '#B3B9D8', blue: '#1E2870' }
const points = (value: number) => value > 0 ? `+${value}` : String(value)

export function ModuleCompletionScreen({ data, onTrail, onReport }: Props) {
  const [loaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const progress = data.totalModules > 0 ? Math.min(100, data.completedModules / data.totalModules * 100) : 0
  if (!loaded && !fontError) return <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1240' }}><ScrollView contentContainerStyle={{ padding: 20 }}><ContentSkeleton variant="result" /></ScrollView></SafeAreaView>
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.page}>
      <Image source={require('../../../assets/module-completion-hero.png')} resizeMode="contain" accessible={false} style={styles.hero} />
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>{data.firstModule ? 'Regra de ouro\nconcluída!' : 'Módulo concluído!'}</Text>
        {!data.firstModule ? <Text style={styles.moduleTitle}>{data.moduleTitle}</Text> : null}
        <View style={styles.unlocked}><View style={styles.unlockedIcon}><AppIcon name={data.reportsUnlocked ? 'bolt' : 'check'} size={25} color={c.yellow} /></View><View style={styles.unlockedCopy}><Text style={styles.unlockedTitle}>{data.reportsUnlocked ? 'Relatos liberados' : 'Progresso salvo'}</Text><Text style={styles.unlockedDescription}>{data.reportsUnlocked ? 'Você concluiu a preparação para reportar.' : 'Continue aprendendo na trilha.'}</Text></View></View>
        <View style={styles.pointsCard}>
          <Text style={styles.points}>{points(data.totalPoints)} pts</Text>
          <Text style={styles.breakdown}>pré {points(data.breakdown.preTest)} · treino {points(data.breakdown.training)} · pós {points(data.breakdown.postTest)}{data.breakdown.moduleCompletion > 0 ? ` · módulo ${points(data.breakdown.moduleCompletion)}` : ''}</Text>
          <View style={styles.progressRow}><Text style={styles.progressLabel}>Trilha</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View><Text style={styles.progressValue}>{data.completedModules}/{data.totalModules}</Text></View>
          {data.pendingPoints > 0 ? <Text style={styles.pending}>{data.pendingPoints} pontos aguardando liberação pelo limite diário.</Text> : null}
        </View>
        {data.after.totalCount > 0 ? <View style={styles.comparison}><Text style={styles.eyebrow}>ANTES E DEPOIS</Text><ScoreBar label="Antes" correct={data.before.correctCount} total={data.before.totalCount} /><ScoreBar label="Depois" correct={data.after.correctCount} total={data.after.totalCount} after /></View> : null}
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={onTrail} style={({ pressed }) => [styles.button, styles.outline, { opacity: pressed ? 0.7 : 1 }]}><Text style={styles.outlineText}>Trilha</Text></Pressable>
        {data.reportsUnlocked ? <Pressable accessibilityRole="button" onPress={onReport} style={({ pressed }) => [styles.button, styles.primary, { opacity: pressed ? 0.7 : 1 }]}><AppIcon name="bolt" color={c.background} size={22} /><Text style={styles.buttonText}>Reportar</Text></Pressable> : null}
      </View>
    </ScrollView>
  </SafeAreaView>
}

function ScoreBar({ label, correct, total, after = false }: { label: string; correct: number; total: number; after?: boolean }) {
  const percent = total > 0 ? Math.max(0, Math.min(100, correct / total * 100)) : 0
  return <View style={[styles.barRow, after && { marginTop: 24 }]} accessible accessibilityLabel={`${label}: ${correct} de ${total} acertos`}><Text style={styles.barLabel}>{label}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${percent}%`, backgroundColor: after ? c.teal : '#7C82A8' }]} /></View><Text style={[styles.barValue, after && { color: c.teal }]}>{correct} de {total}</Text></View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, loading: { flex: 1, justifyContent: 'center', backgroundColor: c.background }, page: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingTop: 12 }, hero: { width: '100%', maxWidth: 360, height: 200, alignSelf: 'center', aspectRatio: 360 / 200 }, body: { paddingHorizontal: 20 }, title: { marginTop: 24, fontFamily: 'Archivo_700Bold', fontSize: 28, lineHeight: 30, color: '#fff', textAlign: 'center' }, moduleTitle: { fontFamily: 'Archivo_400Regular', fontSize: 14, lineHeight: 21, color: c.muted, textAlign: 'center', marginTop: 8 }, unlocked: { marginTop: 14, minHeight: 92, borderRadius: 20, backgroundColor: c.teal, paddingHorizontal: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, unlockedIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }, unlockedCopy: { flex: 1, gap: 4 }, unlockedTitle: { color: c.background, fontFamily: 'Archivo_700Bold', fontSize: 20, lineHeight: 25 }, unlockedDescription: { color: c.background, fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 18 },
  pointsCard: { marginTop: 14, minHeight: 112, borderRadius: 20, backgroundColor: c.card, padding: 20 }, points: { color: c.yellow, fontFamily: 'Archivo_700Bold', fontSize: 28, lineHeight: 34 }, breakdown: { fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }, progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 14 }, progressLabel: { width: 52, color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 12 }, progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.blue, overflow: 'hidden' }, progressFill: { height: 8, borderRadius: 4, backgroundColor: c.yellow }, progressValue: { width: 42, color: c.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, textAlign: 'right' }, pending: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 18, marginTop: 8 }, comparison: { marginTop: 12, minHeight: 140, borderRadius: 20, backgroundColor: c.card, padding: 20, paddingRight: 10 }, eyebrow: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, lineHeight: 14, letterSpacing: 1, color: c.yellow, marginBottom: 14 }, barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 }, barLabel: { width: 62, fontFamily: 'Archivo_700Bold', fontSize: 13, color: c.muted }, barTrack: { height: 14, flex: 1, borderRadius: 7, backgroundColor: c.blue, overflow: 'hidden' }, barFill: { height: 14, borderRadius: 7 }, barValue: { width: 42, textAlign: 'right', fontFamily: 'Archivo_700Bold', fontSize: 13, color: c.muted }, footer: { flexGrow: 1, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, gap: 12 }, button: { flex: 1, minHeight: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12 }, outline: { borderWidth: 1.5, borderColor: '#2A3590' }, primary: { backgroundColor: c.yellow }, buttonText: { fontFamily: 'Archivo_800ExtraBold', fontSize: 16, color: c.background }, outlineText: { fontFamily: 'Archivo_800ExtraBold', fontSize: 16, color: '#fff' },
})
