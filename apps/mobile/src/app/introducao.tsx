import { useRef, useState } from 'react'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, colors } from '../components/ui'
import { InteractiveSafetyRules } from '../components/interactive-safety-rules'
import { getAccessToken } from '../services/session'

const steps = [
  { image: require('../../assets/intro-street.png'), ratio: 320 / 330, title: 'Você é os olhos da sua rua.', description: 'Quem mora no bairro vê primeiro o fio caído, o poste torto ou a pipa presa. O Guardião sabe reconhecer e avisar.' },
  { image: require('../../assets/intro-safety.png'), ratio: 320 / 330, title: 'Observe, afaste-se, avise.', description: 'A regra de ouro do Guardião. Nunca toque em fios ou postes e nunca tente consertar. Sua segurança vem primeiro.' },
  { image: require('../../assets/intro-rewards.png'), ratio: 320 / 250, title: 'Aprenda, reporte e ganhe pontos.', description: 'Faça a trilha, reporte riscos e ajude seu bairro a subir no ranking. Pontos viram recompensas.' },
] as const

export default function IntroductionScreen() {
  const [index, setIndex] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const scroll = useRef<{ scrollTo: (options: { y?: number; animated?: boolean }) => void } | null>(null)
  const pending = useRef(false)
  const step = steps[index]!

  async function finish() {
    if (pending.current) return
    pending.current = true
    setFinishing(true)
    setError('')
    try {
      const token = await getAccessToken()
      router.replace(token ? '/trilha' : '/entrar')
    } catch {
      setError('Não foi possível abrir sua sessão. Tente novamente.')
    } finally {
      pending.current = false
      setFinishing(false)
    }
  }

  function next() {
    if (index === steps.length - 1) { void finish(); return }
    setIndex(current => current + 1)
    scroll.current?.scrollTo({ y: 0, animated: false })
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="light" />
    <ScrollView ref={scroll as never} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pular introdução" disabled={finishing} onPress={() => { void finish() }} hitSlop={12} style={styles.skip}><Text style={styles.skipText}>Pular</Text></Pressable>
      {index === 1 ? <InteractiveSafetyRules /> : <>
        <Image source={step.image} resizeMode="contain" style={[styles.art, { aspectRatio: step.ratio }]} accessible accessibilityLabel={index === 0 ? 'Pipa presa na rede elétrica de uma rua do bairro.' : 'Selos de conquistas e recompensa de mais 10 pontos.'} />
        <View accessibilityLabel={`Introdução ${index + 1} de 3`} accessible style={styles.dots}>
          {steps.map((_, item) => <View key={item} style={[styles.dot, item === index && styles.activeDot]} />)}
        </View>
        <View accessibilityLiveRegion="polite" style={styles.copy}>
          <Text accessibilityRole="header" style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </View>
      </>}
      <View style={styles.footer}>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button title={index === 2 ? 'Começar' : 'Próximo'} loading={finishing} onPress={next} />
      </View>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 400, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  skip: { alignSelf: 'flex-end', padding: 12, marginBottom: 12 }, skipText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  art: { width: '100%', borderRadius: 28, overflow: 'hidden' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 24 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border }, activeDot: { width: 26, backgroundColor: colors.primary },
  copy: { gap: 14, paddingHorizontal: 4 }, title: { color: colors.text, fontSize: 28, lineHeight: 31, fontWeight: '800', letterSpacing: -0.6 }, description: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  footer: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 40, gap: 12 }, error: { color: '#ffad61', fontSize: 14 },
})
