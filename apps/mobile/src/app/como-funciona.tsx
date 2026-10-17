import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'react-native'
import { ProfilePage } from '../components/profile-page'
import { ProfileSymbol } from '../components/profile-symbol'
import { colors } from '../components/ui'

const steps = [
  { icon: 'eye' as const, title: 'Aprenda a reconhecer', description: 'Faça os módulos da trilha para identificar riscos elétricos no seu bairro.' },
  { icon: 'report' as const, title: 'Afaste-se e avise', description: 'Nunca toque em fios ou postes. Relate o risco somente de um local seguro.' },
  { icon: 'shield' as const, title: 'Acompanhe sua comunidade', description: 'Veja o andamento dos relatos, os pontos e a participação do seu bairro.' },
]

export default function HowItWorksScreen() {
  return (
    <ProfilePage title="Como funciona">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Pequenas atitudes ajudam a manter a comunidade mais segura.</Text>
        <Image source={require('../../assets/urban-electrical-risks.png')} resizeMode="cover" style={styles.art} accessible accessibilityLabel="Ilustração de riscos elétricos na rua" />
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepIcon}><ProfileSymbol name={step.icon} color={colors.primary} size={24} /></View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepNumber}>ETAPA {index + 1}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.description}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
        <ImageBackground source={require('../../assets/profile-tile-network.png')} resizeMode="cover" imageStyle={styles.networkPattern} style={styles.emergency}>
          <View style={styles.networkTint} />
          <ProfileSymbol name="shield" color={colors.primary} size={22} />
          <View style={styles.emergencyCopy}>
            <Text style={styles.emergencyTitle}>Em uma emergência</Text>
            <Text style={styles.description}>Afaste-se do risco e ligue 116. Nunca tente consertar ou mover fios.</Text>
          </View>
        </ImageBackground>
      </ScrollView>
    </ProfilePage>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 24, gap: 20 },
  intro: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  art: { width: '100%', height: 165, borderRadius: 16, backgroundColor: colors.field },
  steps: { gap: 11 },
  step: { flexDirection: 'row', gap: 13, padding: 15, borderRadius: 16, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border },
  stepIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.background },
  stepCopy: { flex: 1, gap: 4 },
  stepNumber: { color: colors.primary, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  emergency: { width: '100%', maxWidth: 420, alignSelf: 'center', overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.field },
  networkPattern: { opacity: 0.18, borderRadius: 16 },
  networkTint: { ...StyleSheet.absoluteFill, backgroundColor: '#0B124088' },
  emergencyCopy: { flex: 1, gap: 4 },
  emergencyTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
})
