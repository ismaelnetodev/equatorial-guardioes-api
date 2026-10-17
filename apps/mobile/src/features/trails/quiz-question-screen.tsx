import { useState } from 'react'
import { useFonts, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import type { Feedback, Questions } from './learning.api'

type Props = {
  questions: Pick<Questions, 'questions' | 'totalCount'>
  index: number
  selected?: string
  feedback: Feedback | null
  post: boolean
  finalExam?: boolean
  busy: boolean
  error: string
  onSelect: (id: string) => void
  onConfirm: () => void
  onClose: () => void
}
const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace'
const palette = { background: '#0B1240', field: '#141C55', selected: '#1E2870', border: '#2A3590', yellow: '#FFB81C', muted: '#B3B9D8', radio: '#7C86B5', green: '#14B86A', orange: '#FF7A1A' }

export function QuizQuestionScreen({ questions, index, selected, feedback, post, finalExam = false, busy, error, onSelect, onConfirm, onClose }: Props) {
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const [expanded, setExpanded] = useState(false)
  const question = questions.questions[index]
  const revealed = post && !!feedback
  const illustration = question?.imageUrl ? { uri: question.imageUrl } : revealed ? require('../../../assets/quiz-street-post.png') : require('../../../assets/quiz-street-pre.png')
  const buttonTitle = finalExam && index === questions.totalCount - 1 ? 'Enviar prova final' : revealed ? index === questions.totalCount - 1 ? 'Ver resultado' : 'Próxima pergunta' : !question ? 'Finalizar pós-teste' : 'Confirmar resposta'
  const action = <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !!question && !selected, busy }} disabled={busy || !!question && !selected} onPress={onConfirm} style={({ pressed }) => [styles.button, { opacity: busy || pressed ? 0.7 : 1 }, !!question && !selected && styles.buttonDisabled]}>{busy ? <ActivityIndicator color={palette.background} /> : <Text style={styles.buttonText}>{buttonTitle}</Text>}</Pressable>

  if (!fontsLoaded && !fontError) return <SafeAreaView style={[styles.screen, { justifyContent: 'center' }]}><ActivityIndicator color={palette.yellow} /></SafeAreaView>

  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}><StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar quiz e voltar ao módulo" hitSlop={12} disabled={busy} onPress={onClose} style={styles.close}><View style={[styles.cross, styles.crossA]} /><View style={[styles.cross, styles.crossB]} /></Pressable>
          <Text accessibilityRole="header" style={styles.counter}>Pergunta {Math.min(index + 1, questions.totalCount)} de {questions.totalCount}</Text>
          <View style={[styles.badge, post && styles.postBadge]}><Text style={[styles.badgeText, post && styles.postBadgeText]}>{finalExam ? 'PROVA FINAL' : post ? 'PÓS-TESTE' : 'PRÉ-TESTE'}</Text></View>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel="Progresso do quiz" accessibilityValue={{ min: 0, max: questions.totalCount, now: Math.min(index + 1, questions.totalCount) }} style={styles.progress}>{questions.questions.map((item, position) => <View key={item.id} style={[styles.segment, position <= index && styles.segmentFilled]} />)}</View>
        {question ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Ampliar imagem ilustrativa da pergunta" onPress={() => setExpanded(true)} style={[styles.picture, revealed && styles.pictureShort]}>
            <Image source={illustration} resizeMode="cover" style={styles.photo} />
            {!revealed ? <View style={styles.photoHint}><View style={styles.magnifier}><View style={styles.lens} /><View style={styles.handle} /><Text style={styles.plus}>+</Text></View><Text style={styles.photoHintText}>Foto ilustrativa · toque para ampliar</Text></View> : null}
          </Pressable>
          <Text style={[styles.question, revealed && styles.questionShort]}>{question.statement}</Text>
          <View accessibilityRole="radiogroup" style={[styles.options, revealed && styles.optionsShort]}>{question.options.map(option => {
            const correct = revealed && feedback.correctOptionId === option.id
            const wrong = revealed && !feedback.isCorrect && feedback.selectedOptionId === option.id
            const checked = selected === option.id
            return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.text} aria-checked={checked} accessibilityState={{ checked, disabled: busy || revealed }} disabled={busy || revealed} onPress={() => onSelect(option.id)} style={[styles.option, revealed && styles.optionShort, checked && !revealed && styles.optionSelected, correct && styles.optionCorrect, wrong && styles.optionWrong, revealed && !correct && !wrong && styles.optionDim]}>
              <View style={[styles.radio, checked && !revealed && styles.radioSelected, correct && styles.radioCorrect, wrong && styles.radioWrong]}>{correct ? <Text style={styles.check}>✓</Text> : wrong ? <Text style={styles.check}>×</Text> : checked && !revealed ? <View style={styles.dot} /> : null}</View>
              <View style={styles.optionCopy}><Text style={[styles.optionText, (checked || correct || wrong) && styles.optionStrong, revealed && !correct && !wrong && styles.dimText]}>{option.text}</Text>{correct || wrong ? <Text style={[styles.optionCaption, { color: correct ? palette.green : palette.orange }]}>{correct ? 'RESPOSTA SEGURA' : 'SUA RESPOSTA'}</Text> : null}</View>
            </Pressable>
          })}</View>
        </> : <Text style={styles.question}>Todas as respostas foram registradas. Finalize para consultar seu resultado.</Text>}
        {!revealed && error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
      {revealed ? <View style={styles.feedbackSheet}>
        <View accessibilityRole="alert" style={styles.explanation}><View style={[styles.infoIcon, feedback.isCorrect && { backgroundColor: palette.green }]}>{feedback.isCorrect ? <Text style={styles.infoText}>✓</Text> : <View style={styles.infoCircle}><Text style={styles.infoLetter}>i</Text></View>}</View><View style={styles.explanationCopy}><Text style={styles.explanationTitle}>{feedback.feedback.title}</Text><Text style={styles.explanationBody}>{feedback.feedback.body}</Text></View></View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {action}
      </View> : <View style={styles.footer}>{action}</View>}
    </ScrollView>
    <Modal visible={expanded} animationType="fade" transparent onRequestClose={() => setExpanded(false)}><SafeAreaView style={styles.viewer}><Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem ampliada" onPress={() => setExpanded(false)} style={styles.viewerClose}><Text style={styles.viewerCloseText}>Fechar ×</Text></Pressable><Image source={illustration} resizeMode="contain" accessibilityLabel="Imagem ilustrativa ampliada" style={styles.viewerImage} /></SafeAreaView></Modal>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background }, page: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingTop: 20 }, body: { paddingHorizontal: 20 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, cross: { position: 'absolute', width: 18, height: 2.2, borderRadius: 2, backgroundColor: '#fff' }, crossA: { transform: [{ rotate: '45deg' }] }, crossB: { transform: [{ rotate: '-45deg' }] }, counter: { color: '#fff', fontSize: 15, fontFamily: 'Archivo_700Bold', textAlign: 'center', flex: 1, paddingLeft: 14 }, badge: { width: 79, height: 23, borderRadius: 12, backgroundColor: palette.selected, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#8FA2FF', fontSize: 10, letterSpacing: 1, fontFamily: mono }, postBadge: { backgroundColor: '#19C2B5' }, postBadgeText: { color: palette.background },
  progress: { flexDirection: 'row', gap: 6, marginTop: 10, height: 6 }, segment: { flex: 1, borderRadius: 3, backgroundColor: palette.selected }, segmentFilled: { backgroundColor: palette.yellow },
  picture: { height: 170, borderRadius: 16, overflow: 'hidden', marginTop: 16, backgroundColor: palette.field }, pictureShort: { height: 130 }, photo: { width: '100%', height: '100%' }, photoHint: { position: 'absolute', bottom: 10, left: 10, height: 24, borderRadius: 12, backgroundColor: palette.background, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }, photoHintText: { color: palette.muted, fontSize: 10, fontFamily: 'Archivo_700Bold' }, magnifier: { width: 14, height: 14 }, lens: { borderRadius: 5, width: 9, height: 9, borderWidth: 1.4, borderColor: palette.muted, position: 'absolute', left: 1, top: 1 }, handle: { width: 5, height: 1.4, position: 'absolute', left: 8, top: 10, backgroundColor: palette.muted, transform: [{ rotate: '45deg' }] }, plus: { fontSize: 9, color: palette.muted, position: 'absolute', top: -1, left: 3 },
  question: { marginTop: 16, color: '#fff', fontSize: 20, lineHeight: 23, fontFamily: 'Archivo_700Bold' }, questionShort: { marginTop: 12, fontSize: 18, lineHeight: 20 }, options: { marginTop: 6, gap: 12 }, optionsShort: { marginTop: 0, gap: 8 }, option: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.field, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 12, gap: 12 }, optionShort: { minHeight: 56, paddingVertical: 8 }, optionSelected: { borderWidth: 2, borderColor: palette.yellow, backgroundColor: palette.selected, paddingHorizontal: 12 }, optionCorrect: { borderWidth: 2, borderColor: palette.green, backgroundColor: palette.selected, paddingHorizontal: 12 }, optionWrong: { borderWidth: 2, borderColor: palette.orange, backgroundColor: palette.selected, paddingHorizontal: 12 }, optionDim: { opacity: 0.65 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.radio, alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: palette.yellow, backgroundColor: palette.yellow }, radioCorrect: { borderColor: palette.green, backgroundColor: palette.green }, radioWrong: { borderColor: palette.orange, backgroundColor: palette.orange }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.background }, check: { color: '#fff', fontSize: 17, lineHeight: 19, fontFamily: 'Archivo_700Bold' }, optionCopy: { flex: 1, gap: 7 }, optionText: { fontFamily: 'Archivo_400Regular', fontSize: 14, lineHeight: 18, color: '#fff' }, optionStrong: { fontFamily: 'Archivo_700Bold' }, dimText: { color: palette.muted }, optionCaption: { fontSize: 9, lineHeight: 11, letterSpacing: 1, fontFamily: mono },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 }, button: { backgroundColor: palette.yellow, borderRadius: 16, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, buttonDisabled: { opacity: 0.5 }, buttonText: { color: palette.background, fontSize: 16, fontFamily: 'Archivo_800ExtraBold' },
  feedbackSheet: { marginTop: 10, flexGrow: 1, justifyContent: 'space-between', backgroundColor: palette.field, borderColor: palette.border, borderWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 19, paddingBottom: 31, gap: 26 }, explanation: { flexDirection: 'row', gap: 10 }, infoIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.orange, alignItems: 'center', justifyContent: 'center' }, infoCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: palette.background, alignItems: 'center', justifyContent: 'center' }, infoLetter: { fontFamily: 'Archivo_700Bold', color: palette.background, fontSize: 13, lineHeight: 15 }, infoText: { color: palette.background, fontSize: 22, fontFamily: 'Archivo_700Bold' }, explanationCopy: { flex: 1, gap: 6 }, explanationTitle: { color: '#fff', fontSize: 18, lineHeight: 23, fontFamily: 'Archivo_700Bold' }, explanationBody: { fontFamily: 'Archivo_400Regular', color: palette.muted, fontSize: 13, lineHeight: 20 }, error: { fontFamily: 'Archivo_400Regular', color: '#ffad61', fontSize: 13, lineHeight: 19, marginTop: 12 }, viewer: { flex: 1, backgroundColor: '#0B1240F5', padding: 20 }, viewerClose: { alignSelf: 'flex-end', padding: 16 }, viewerCloseText: { color: '#fff', fontSize: 17, fontFamily: 'Archivo_700Bold' }, viewerImage: { flex: 1, width: '100%' },
})
