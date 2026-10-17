import { useState } from 'react'
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from './ui'

type RuleId = 'observe' | 'afaste-se' | 'avise'

const rules = [
  { id: 'observe', title: 'Observe', subtitle: 'de longe', icon: '◎' },
  { id: 'afaste-se', title: 'Afaste-se', subtitle: 'mantenha distância', icon: '↖' },
  { id: 'avise', title: 'Avise', subtitle: 'pelo app ou 116', icon: '☎' },
] as const

const descriptions: Record<RuleId, string> = {
  observe: 'Caso identifique um risco, mantenha distância, observe de um local seguro e, se possível, registre a situação. Sua segurança vem sempre em primeiro lugar.',
  'afaste-se': 'Afaste-se do risco. O primeiro passo é colocar-se em segurança.',
  avise: 'Em caso de emergência envolvendo energia elétrica na sua rua, ligue 116. A ligação é gratuita e o atendimento funciona 24 horas por dia.',
}

const titles: Record<RuleId, string> = {
  observe: 'Observe',
  'afaste-se': 'Afaste-se',
  avise: 'Avise',
}

export function InteractiveSafetyRules() {
  const [activeRule, setActiveRule] = useState<RuleId>('afaste-se')

  return <View style={styles.container}>
    <View style={styles.panel}>
      <ImageBackground
        source={require('../../assets/azulejo-guardiao.png')}
        resizeMode="cover"
        style={styles.panelBackground}
        imageStyle={styles.panelImage}>
        <View style={styles.tapTargets}>
          {rules.map((rule, index) => {
            const selected = activeRule === rule.id
            return <Pressable
              accessibilityRole="button"
              accessibilityLabel={rule.title}
              accessibilityState={{ selected }}
              key={rule.id}
              onPress={() => setActiveRule(rule.id)}
              style={({ pressed }) => [
                styles.ruleButton,
                rulePositions[index],
                selected && styles.selectedRule,
                pressed && styles.pressed,
              ]}>
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>{rule.icon}</Text>
              </View>
              <View style={styles.ruleCopy}>
                <Text numberOfLines={1} style={styles.ruleTitle}>{rule.title}</Text>
                <Text numberOfLines={1} style={styles.ruleSubtitle}>{rule.subtitle}</Text>
              </View>
              <Text style={styles.ruleNumber}>{index + 1}</Text>
            </Pressable>
          })}
        </View>
      </ImageBackground>
    </View>

    <View accessibilityLabel="Introdução 2 de 3" accessible style={styles.dots}>
      <View style={styles.dot} />
      <View style={styles.activeDot} />
      <View style={styles.dot} />
    </View>

    <View style={styles.copy}>
      <Text accessibilityRole="header" style={styles.title}>Observe, afaste-se, avise.</Text>
      <View style={styles.description}>
        <Text style={styles.descriptionTitle}>{titles[activeRule]}</Text>
        <Text style={styles.descriptionText}>{descriptions[activeRule]}</Text>
      </View>
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  panel: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: colors.background,
  },
  panelBackground: { flex: 1 },
  panelImage: { width: '100%', height: '100%', opacity: 0.5, borderRadius: 22 },
  tapTargets: { ...StyleSheet.absoluteFill },
  ruleButton: {
    position: 'absolute',
    left: '7.5%',
    right: '7.5%',
    height: '24%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    backgroundColor: colors.background,
  },
  firstRule: { top: '9%' },
  secondRule: { top: '38%' },
  thirdRule: { top: '67%' },
  selectedRule: { borderColor: '#FFB81C' },
  iconCircle: {
    width: 40,
    height: 40,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#202B70',
  },
  icon: { color: '#FFB81C', fontSize: 22, fontWeight: '700' },
  ruleCopy: { flex: 1, justifyContent: 'center', gap: 2 },
  ruleTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  ruleSubtitle: { color: colors.muted, fontSize: 11 },
  ruleNumber: { alignSelf: 'flex-start', color: '#858EBA', fontSize: 11, marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  activeDot: { width: 26, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  copy: { gap: 14, paddingHorizontal: 4 },
  title: { color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.6 },
  description: { gap: 4, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.field },
  descriptionTitle: { color: '#FFB81C', fontSize: 13, fontWeight: '800' },
  descriptionText: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  pressed: { opacity: 0.8 },
})

const rulePositions = [styles.firstRule, styles.secondRule, styles.thirdRule]
