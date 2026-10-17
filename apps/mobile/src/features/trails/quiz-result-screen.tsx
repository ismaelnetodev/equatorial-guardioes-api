import { useFonts, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import { ActivityIndicator, Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppIcon } from '../../components/app-icon'
import type { PostResult, PreResult } from './learning.api'

type Props = {
  result: PreResult | PostResult
  completed: boolean
  busy: boolean
  error: string
  onBack: () => void
  onTraining: () => void
  onComplete: () => void
  onRetry: () => void
}
const c = { background: '#0B1240', card: '#141C55', blue: '#1E2870', muted: '#B3B9D8', yellow: '#FFB81C', teal: '#19C2B5' }
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace'
const points = (value: number) => value > 0 ? `+${value}` : String(value)

export function QuizResultScreen({ result, completed, busy, error, onBack, onTraining, onComplete, onRetry }: Props) {
  const [loaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const post = 'isApproved' in result ? result : null
  const pre = 'hint' in result ? result : null
  const approved = post?.isApproved === true
  if (!loaded && !fontError) return <SafeAreaView style={styles.loading}><ActivityIndicator color={c.yellow} /></SafeAreaView>

  function action(label: string, onPress: () => void, icon?: 'book' | 'check' | 'retry', outline = false) {
    return <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress} style={({ pressed }) => [styles.button, outline && styles.outline, { opacity: busy || pressed ? 0.7 : 1 }]}>
      {busy && !outline ? <ActivityIndicator color={c.background} /> : <>
        {icon === 'book' ? <View style={styles.book}><View style={[styles.bookPage, outline && styles.bookPageLight]} /><View style={[styles.bookPage, outline && styles.bookPageLight]} /></View> : icon === 'check' ? <AppIcon name="check" size={22} color={c.background} /> : icon === 'retry' ? <View style={styles.retryIcon}><View style={styles.retryArrow} /></View> : null}
        <Text style={[styles.buttonText, outline && { color: '#fff' }]}>{label}</Text>
      </>}
    </Pressable>
  }

  if (post && !approved) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao módulo" disabled={busy} onPress={onBack} hitSlop={12} style={styles.back}><View style={styles.chevron} /></Pressable></View>
      <View style={styles.postBody}>
        <View style={styles.targetCircle} accessible={false}><View style={styles.targetOuter}><View style={styles.targetInner}><View style={styles.targetDot} /></View></View></View>
        <Text accessibilityRole="header" style={styles.retryTitle}>{post.title}</Text>
        <Text style={styles.retryMessage}>{post.correctCount} de {post.totalCount} no pós-teste. Para concluir, acerte {post.minimumCorrect}.</Text>
        <View style={[styles.comparison, styles.retryComparison]}>
          <Text style={[styles.smallEyebrow, { marginBottom: 14 }]}>ANTES E DEPOIS</Text>
          <ScoreBar label="Antes" correct={post.before.correctCount} total={post.before.totalCount} />
          <ScoreBar label="Depois" correct={post.after.correctCount} total={post.after.totalCount} after />
        </View>
        {post.reviewHint ? <View style={styles.reviewCard}><View style={styles.reviewBook}><View style={styles.reviewPage} /><View style={styles.reviewPage} /></View><Text style={styles.reviewCopy}>{post.reviewHint}</Text></View> : null}
      </View>
      <View style={[styles.footer, { gap: 8 }]}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {action('Rever treinamento', onTraining, 'book', true)}
        {action('Refazer pós-teste', onRetry, 'retry')}
      </View>
    </ScrollView>
  </SafeAreaView>

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><StatusBar style="light" />
    <ScrollView contentContainerStyle={[styles.page, approved && styles.postPage]}>
      {pre || !approved ? <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao módulo" disabled={busy} onPress={onBack} hitSlop={12} style={styles.back}><View style={styles.chevron} /></Pressable></View> : null}
      {pre ? <View style={styles.preBody}>
        <ImageBackground source={require('../../../assets/quiz-result-pattern.png')} resizeMode="cover" style={styles.scoreCard} imageStyle={styles.scoreBackground}>
          <Text style={styles.eyebrow}>SEU PONTO DE PARTIDA</Text>
          <Text style={styles.score}>{pre.correctCount}</Text>
          <Text style={styles.scoreLabel}>de {pre.totalCount} acertos</Text>
          <View style={styles.pointsPill}><AppIcon name="star" size={15} color={c.background} /><Text style={styles.pillText}>{points(pre.pointsAwarded)} pts · pré-teste</Text></View>
        </ImageBackground>
        <Text accessibilityRole="header" style={styles.preTitle}>{pre.title}</Text>
        <Text style={styles.intro}>{pre.message}</Text>
        <View style={styles.hint}><View style={styles.infoIcon}><Text style={styles.infoLetter}>i</Text></View><Text style={styles.hintText}>{pre.hint}</Text></View>
      </View> : post ? <>
        {approved ? <Image source={require('../../../assets/quiz-result-confetti.png')} resizeMode="cover" style={styles.confetti} accessible={false} /> : null}
        <View style={styles.postBody}>
          <Text accessibilityRole="header" style={styles.postTitle}>{post.title}</Text>
          <Text style={[styles.postScore, !approved && { color: '#FFB81C' }]}>{post.correctCount} de {post.totalCount} no pós-teste</Text>
          {!approved ? <Text style={styles.failure}>Para concluir, acerte pelo menos {post.minimumCorrect} de {post.totalCount} perguntas. {post.reviewHint}</Text> : null}
          <View style={styles.comparison}>
            <Text style={[styles.smallEyebrow, { marginBottom: 14 }]}>ANTES E DEPOIS</Text>
            <ScoreBar label="Antes" correct={post.before.correctCount} total={post.before.totalCount} />
            <ScoreBar label="Depois" correct={post.after.correctCount} total={post.after.totalCount} after />
          </View>
          <View style={styles.pointsCard}>
            <Text style={styles.smallEyebrow}>PONTOS GANHOS</Text>
            <PointRow label="Pré-teste" value={post.pointsBreakdown.preTest} />
            <PointRow label="Treinamento" value={post.pointsBreakdown.training} />
            <PointRow label="Melhoria no pós-teste" value={post.pointsBreakdown.postTest} />
            {post.moduleCompletion.pointsAwarded > 0 ? <PointRow label="Conclusão do módulo" value={post.moduleCompletion.pointsAwarded} /> : null}
          </View>
          {approved && !completed ? <Text style={styles.pending}>O quiz libera a conclusão. Toque em Concluir módulo para registrar os pontos do módulo, respeitando o limite diário.</Text> : null}
          <View style={styles.totalRow}><Text style={styles.total}>Total: {points(post.totalPoints)} pts</Text><View style={styles.minimumBadge}><Text style={styles.minimum}>MÍNIMO {post.minimumCorrect} DE {post.totalCount}</Text></View></View>
          {post.moduleCompletion.pendingPoints > 0 ? <Text style={styles.pending}>{post.moduleCompletion.pendingPoints} pontos de conclusão aguardando liberação pelo limite diário.</Text> : null}
        </View>
      </> : null}
      <View style={styles.footer}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {pre ? action('Ir para o treinamento', onTraining, 'book') : approved ? action(completed ? 'Voltar para a trilha' : 'Concluir módulo', completed ? onBack : onComplete, 'check') : <>
          {action('Tentar pós-teste novamente', onRetry)}
          {action('Revisar treinamento', onTraining, undefined, true)}
          {action('Voltar ao módulo', onBack, undefined, true)}
        </>}
      </View>
    </ScrollView>
  </SafeAreaView>
}

function ScoreBar({ label, correct, total, after = false }: { label: string; correct: number; total: number; after?: boolean }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, correct / total * 100)) : 0
  return <View style={[styles.barRow, after && { marginTop: 24 }]} accessible accessibilityLabel={`${label}: ${correct} de ${total} acertos`}>
    <Text style={styles.barLabel}>{label}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${percent}%`, backgroundColor: after ? c.teal : '#7C82A8' }]} /></View><Text style={[styles.barValue, after && { color: c.teal }]}>{correct} de {total}</Text>
  </View>
}
function PointRow({ label, value }: { label: string; value: number }) {
  return <View style={styles.pointRow}><Text style={styles.pointLabel}>{label}</Text><Text style={styles.pointValue}>{points(value)}</Text></View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, loading: { flex: 1, backgroundColor: c.background, justifyContent: 'center' }, page: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingTop: 20 }, postPage: { paddingTop: 12 },
  targetCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.blue, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 12 }, targetOuter: { width: 33, height: 33, borderRadius: 17, borderWidth: 3.5, borderColor: c.yellow, alignItems: 'center', justifyContent: 'center' }, targetInner: { width: 21, height: 21, borderRadius: 11, borderWidth: 3, borderColor: c.yellow, alignItems: 'center', justifyContent: 'center' }, targetDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.yellow }, retryTitle: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 33, lineHeight: 40, textAlign: 'center', marginTop: 22 }, retryMessage: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 0, width: '100%', maxWidth: 300, alignSelf: 'center' }, retryComparison: { marginTop: 22 }, reviewCard: { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: '#2A3590', minHeight: 92, padding: 19, marginTop: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 16 }, reviewCopy: { flex: 1, color: '#fff', fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 20 }, reviewBook: { flexDirection: 'row', width: 17, height: 18, marginTop: 2 }, reviewPage: { width: 9, height: 16, borderWidth: 1.8, borderColor: c.teal, borderRadius: 2 }, bookPageLight: { borderColor: '#fff' }, retryIcon: { width: 17, height: 17, borderWidth: 1.8, borderColor: c.background, borderRightColor: 'transparent', borderRadius: 9, transform: [{ rotate: '20deg' }] }, retryArrow: { width: 7, height: 7, borderRightWidth: 1.8, borderBottomWidth: 1.8, borderColor: c.background, position: 'absolute', right: -2, top: -2 },
  header: { paddingHorizontal: 20, height: 44, justifyContent: 'center' }, back: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }, chevron: { width: 11, height: 11, borderLeftWidth: 2.2, borderBottomWidth: 2.2, borderColor: '#fff', transform: [{ rotate: '45deg' }] },
  preBody: { paddingHorizontal: 20 }, scoreCard: { height: 250, marginTop: 22, borderRadius: 28, overflow: 'hidden', alignItems: 'center', paddingTop: 28 }, scoreBackground: { borderRadius: 28 }, eyebrow: { color: c.yellow, fontFamily: mono, fontSize: 12, letterSpacing: 1 }, score: { color: '#fff', fontFamily: 'Archivo_800ExtraBold', fontSize: 104, lineHeight: 115, marginTop: 8 }, scoreLabel: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 18, lineHeight: 24 }, pointsPill: { marginTop: 14, height: 26, borderRadius: 13, backgroundColor: c.yellow, flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10 }, pillText: { color: c.background, fontFamily: 'Archivo_700Bold', fontSize: 12 },
  preTitle: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 28, lineHeight: 34, marginTop: 32 }, intro: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 23, marginTop: 8 }, hint: { marginTop: 34, minHeight: 64, borderRadius: 16, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12 }, infoIcon: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#8FA2FF', justifyContent: 'center', alignItems: 'center' }, infoLetter: { color: '#8FA2FF', fontFamily: 'Archivo_700Bold', fontSize: 14, lineHeight: 16 }, hintText: { flex: 1, fontFamily: 'Archivo_400Regular', color: c.muted, fontSize: 13, lineHeight: 19 },
  confetti: { width: '100%', aspectRatio: 360 / 150 }, postBody: { paddingHorizontal: 20 }, postTitle: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 33, lineHeight: 40, textAlign: 'center', marginTop: 16 }, postScore: { color: c.teal, fontFamily: 'Archivo_700Bold', fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 0 }, failure: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 14, lineHeight: 22, marginTop: 16 },
  comparison: { marginTop: 24, borderRadius: 20, backgroundColor: c.card, padding: 20, minHeight: 150, paddingRight: 10 }, smallEyebrow: { color: c.yellow, fontFamily: mono, fontSize: 10, lineHeight: 14, letterSpacing: 1 }, barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 }, barLabel: { color: c.muted, fontFamily: 'Archivo_700Bold', fontSize: 13, width: 62 }, barTrack: { backgroundColor: c.blue, height: 14, borderRadius: 7, flex: 1, overflow: 'hidden' }, barFill: { height: 14, borderRadius: 7 }, barValue: { color: c.muted, fontFamily: 'Archivo_700Bold', fontSize: 13, width: 42, textAlign: 'right' },
  pointsCard: { marginTop: 16, borderRadius: 20, backgroundColor: c.card, padding: 20, gap: 8 }, pointRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, pointLabel: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 14, flex: 1 }, pointValue: { color: c.yellow, fontFamily: 'Archivo_700Bold', fontSize: 13, lineHeight: 14 }, totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, gap: 8, flexWrap: 'wrap' }, total: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 20, lineHeight: 26 }, minimumBadge: { backgroundColor: c.blue, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }, minimum: { color: c.muted, fontFamily: mono, fontSize: 9, letterSpacing: 0.6 }, pending: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 18, marginTop: 10 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 32, paddingTop: 24, gap: 12 }, button: { minHeight: 56, borderRadius: 16, backgroundColor: c.yellow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 10 }, outline: { borderWidth: 1, borderColor: '#2A3590', backgroundColor: 'transparent' }, buttonText: { color: c.background, fontFamily: 'Archivo_800ExtraBold', fontSize: 16, lineHeight: 21, textAlign: 'center' }, book: { flexDirection: 'row', width: 18, height: 18 }, bookPage: { borderWidth: 1.8, borderColor: c.background, borderRadius: 2, width: 9, height: 16 }, error: { color: '#ffad61', fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 20 },
})
