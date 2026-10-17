import { useState } from 'react'
import { useFonts, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppIcon } from '../../components/app-icon'
import type { Training } from './learning.api'

type Props = {
  training: Training
  index: number
  busy: boolean
  error: string
  onBack: () => void
  onPrevious: () => void
  onNext: () => void
}
const c = { background: '#0B1240', card: '#141C55', blue: '#1E2870', border: '#2A3590', yellow: '#FFB81C', teal: '#19C2B5', muted: '#B3B9D8' }
const scene = require('../../../assets/training-recognize.png')

// As posições pertencem a esta ilustração; outros assuntos não recebem marcadores de poste.
function markerPosition(title: string): { left: `${number}%`; top: `${number}%` } | null {
  if (/poste inclinado/i.test(title)) return { left: '66.875%', top: '28%' }
  if (/fios baixos|fios.*esticados/i.test(title)) return { left: '81.875%', top: '16%' }
  if (/base.*rachada|base.*batida/i.test(title)) return { left: '59.375%', top: '92.8%' }
  return null
}

export function TrainingScreen({ training, index, busy, error, onBack, onPrevious, onNext }: Props) {
  const [loaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const viewport = useWindowDimensions()
  const [expanded, setExpanded] = useState(false)
  const [help, setHelp] = useState(false)
  const step = training.steps[index]
  const duration = step?.durationMinutes
  const recognize = step?.kind === 'RECOGNIZE'
  const last = index >= training.steps.length - 1
  const nextTitle = !step ? 'Voltar ao módulo' : !last ? 'Próximo' : training.completed ? 'Voltar ao módulo' : 'Concluir treinamento'
  if (!loaded && !fontError) return <SafeAreaView style={styles.loading}><ActivityIndicator color={c.yellow} /></SafeAreaView>

  function illustration(zoom = false) {
    return <View style={[styles.scene, zoom && [styles.zoomScene, { width: Math.max(160, Math.min(viewport.width - 40, (viewport.height - 160) * 320 / 250, 640)) }]]}>
      <Image source={scene} resizeMode="contain" style={styles.photo} accessibilityLabel="Ilustração de exemplo: poste inclinado, fios baixos e base danificada" />
      {step?.cards.map((card, position) => {
        const anchor = markerPosition(card.title)
        return anchor ? <View key={card.id} accessible={false} style={[styles.marker, anchor]}><Text style={styles.markerText}>{position + 1}</Text></View> : null
      })}
      {!zoom ? <View style={styles.zoomButton}><View style={styles.lens} /><View style={styles.lensHandle} /><Text style={styles.lensPlus}>+</Text></View> : null}
    </View>
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}><StatusBar style="light" />
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao módulo" disabled={busy} onPress={onBack} hitSlop={12} style={styles.headerButton}><View style={styles.chevron} /></Pressable>
          <Text style={styles.counter}>{step ? `Etapa ${index + 1} de ${training.steps.length}${duration ? ` · ${duration} min` : ''}` : 'Treinamento'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Ajuda do treinamento" hitSlop={12} onPress={() => setHelp(true)} style={styles.headerButton}><AppIcon name="help" color="#fff" size={20} /></Pressable>
        </View>
        {step ? <>
          <View accessibilityRole="progressbar" accessibilityLabel="Progresso do treinamento" accessibilityValue={{ min: 0, max: training.steps.length, now: index + 1 }} style={styles.progress}>{training.steps.map((item, position) => <View key={item.id} style={[styles.segment, position <= index && styles.segmentFilled]} />)}</View>
          <Text accessibilityRole="header" style={styles.title}>{step.title}</Text>
          {step.introText ? <Text style={styles.intro}>{step.introText}</Text> : null}
          {recognize ? <Pressable accessibilityRole="button" accessibilityLabel="Ampliar ilustração do treinamento" onPress={() => setExpanded(true)} style={styles.sceneButton}>{illustration()}</Pressable> : null}
          <View style={styles.cards}>{step.cards.map((card, position) => <View key={card.id} style={styles.card}>
            <View style={styles.number}><Text style={styles.numberText}>{position + 1}</Text></View>
            <View style={styles.cardCopy}><Text style={styles.cardTitle}>{card.title}</Text><Text style={styles.cardDescription}>{card.description}</Text></View>
          </View>)}</View>
        </> : <Text style={styles.intro}>O treinamento deste módulo ainda não tem etapas cadastradas.</Text>}
      </View>
      <View style={styles.footer}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={index > 0 ? 'Voltar à etapa anterior' : 'Voltar ao módulo'} disabled={busy} onPress={onPrevious} style={({ pressed }) => [styles.previous, { opacity: busy || pressed ? 0.7 : 1 }]}><Text style={styles.previousText}>Voltar</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={step ? onNext : onBack} style={({ pressed }) => [styles.next, { opacity: busy || pressed ? 0.7 : 1 }]}>{busy ? <ActivityIndicator color={c.background} /> : <Text style={styles.nextText}>{nextTitle}</Text>}</Pressable>
        </View>
      </View>
    </ScrollView>
    <Modal visible={expanded} animationType="fade" transparent onRequestClose={() => setExpanded(false)}><SafeAreaView style={styles.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem ampliada" onPress={() => setExpanded(false)} style={styles.close}><Text style={styles.closeText}>Fechar ×</Text></Pressable><View style={styles.zoomArea}>{illustration(true)}</View></SafeAreaView></Modal>
    <Modal visible={help} animationType="fade" transparent onRequestClose={() => setHelp(false)}><View style={styles.helpOverlay}><View style={styles.helpCard}><Text style={styles.helpTitle}>Como fazer o treinamento</Text><Text style={styles.helpCopy}>Leia as orientações e amplie a ilustração para observar os detalhes. Os números identificam cada orientação. Use Voltar e Próximo para navegar pelas etapas.</Text><Text style={styles.helpCopy}>Na rua, observe de um local seguro. Não toque em fios ou postes e não tente consertar a rede.</Text><Pressable accessibilityRole="button" onPress={() => setHelp(false)} style={styles.helpClose}><Text style={styles.nextText}>Entendi</Text></Pressable></View></View></Modal>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background }, loading: { flex: 1, backgroundColor: c.background, justifyContent: 'center' }, page: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingTop: 20 }, body: { paddingHorizontal: 20 }, header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, chevron: { width: 11, height: 11, borderLeftWidth: 2.2, borderBottomWidth: 2.2, borderColor: '#fff', transform: [{ rotate: '45deg' }] }, counter: { flex: 1, textAlign: 'center', color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 14, lineHeight: 20 }, progress: { flexDirection: 'row', gap: 6, height: 6, marginTop: 10 }, segment: { flex: 1, backgroundColor: c.blue, borderRadius: 3 }, segmentFilled: { backgroundColor: c.teal }, title: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 28, lineHeight: 34, marginTop: 16 }, intro: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 14, lineHeight: 22, marginTop: 12 },
  sceneButton: { marginTop: 16, borderRadius: 16, overflow: 'hidden' }, scene: { width: '100%', aspectRatio: 320 / 250, backgroundColor: c.card, borderRadius: 16, overflow: 'hidden' }, photo: { width: '100%', height: '100%' }, marker: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: c.background, backgroundColor: c.yellow, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -16 }, { translateY: -16 }] }, markerText: { color: c.background, fontFamily: 'Archivo_700Bold', fontSize: 16, lineHeight: 20 }, zoomButton: { position: 'absolute', bottom: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: '#0B1240D9' }, lens: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.7, borderColor: '#fff', left: 9, top: 8 }, lensHandle: { position: 'absolute', width: 7, height: 1.7, backgroundColor: '#fff', left: 18, top: 21, transform: [{ rotate: '45deg' }] }, lensPlus: { position: 'absolute', fontSize: 13, lineHeight: 14, color: '#fff', left: 11, top: 6 },
  cards: { marginTop: 18, gap: 24 }, card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, number: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.yellow, alignItems: 'center', justifyContent: 'center' }, numberText: { color: c.background, fontFamily: 'Archivo_700Bold', fontSize: 16, lineHeight: 20 }, cardCopy: { flex: 1, gap: 4 }, cardTitle: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 14, lineHeight: 18 }, cardDescription: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 12, lineHeight: 18 }, footer: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32, gap: 14 }, actions: { flexDirection: 'row', gap: 12 }, previous: { minHeight: 56, width: 110, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, previousText: { color: '#fff', fontFamily: 'Archivo_800ExtraBold', fontSize: 16 }, next: { flex: 1, minHeight: 56, borderRadius: 16, backgroundColor: c.yellow, paddingHorizontal: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }, nextText: { color: c.background, fontFamily: 'Archivo_800ExtraBold', fontSize: 16, lineHeight: 21, textAlign: 'center' }, error: { color: '#ffad61', fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: '#0B1240F5', padding: 20 }, close: { alignSelf: 'flex-end', padding: 16 }, closeText: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 17 }, zoomArea: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }, zoomScene: { borderRadius: 16 }, helpOverlay: { flex: 1, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', padding: 24 }, helpCard: { backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 18, width: '100%', maxWidth: 390 }, helpTitle: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 22 }, helpCopy: { color: c.muted, fontFamily: 'Archivo_400Regular', fontSize: 14, lineHeight: 22 }, helpClose: { backgroundColor: c.yellow, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
})
