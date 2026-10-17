import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ProfilePage } from '../components/profile-page'
import { colors } from '../components/ui'

const sections = [
  {
    title: 'Sobre seus dados',
    text: 'O cadastro registra seu nome, contato e bairro para identificar sua conta, mostrar o perfil e organizar a participação da comunidade.',
  },
  {
    title: 'Aprendizado e pontos',
    text: 'Seu progresso nos módulos, respostas dos quizzes e pontos são associados à sua conta para acompanhar sua jornada.',
  },
  {
    title: 'Relatos',
    text: 'Quando você envia um relato, as informações fornecidas — como título, descrição, endereço e bairro — são usadas para acompanhar o risco reportado.',
  },
  {
    title: 'Sua senha',
    text: 'Não compartilhe sua senha. A aplicação envia a senha para autenticação; o backend é responsável por armazená-la com proteção criptográfica.',
  },
  {
    title: 'Segurança em primeiro lugar',
    text: 'O aplicativo é educativo e não substitui o atendimento de emergência. Afaste-se de fios e postes em risco e ligue 116.',
  },
]

export default function TermsScreen() {
  return (
    <ProfilePage title="Termos e privacidade">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Informações sobre o aplicativo</Text>
          <Text style={styles.noticeText}>Este resumo descreve o uso atual do app; não substitui os termos oficiais da organização.</Text>
        </View>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionText}>{section.text}</Text>
          </View>
        ))}
      </ScrollView>
    </ProfilePage>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 14 },
  notice: { padding: 14, gap: 5, borderRadius: 14, backgroundColor: '#222C70', borderWidth: 1, borderColor: colors.border },
  noticeTitle: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  noticeText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  section: { gap: 5, paddingHorizontal: 3 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  sectionText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
})
