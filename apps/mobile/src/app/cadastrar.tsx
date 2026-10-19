import { errorMessage } from '../services/api'
import { useRef, useState } from 'react'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, colors, InputField } from '../components/ui'
import { NeighborhoodPicker, type NeighborhoodSelection } from '../components/neighborhood-picker'
import { FormIcon } from '../components/form-icon'
import { register } from '../features/auth/auth.api'

export default function RegistrationScreen() {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [neighborhood, setNeighborhood] = useState<NeighborhoodSelection | null>(null)
  const [picker, setPicker] = useState(false)
  const [terms, setTerms] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const value = contact.trim()
  const email = value.includes('@')
  const phone = value.replace(/[\s().-]/g, '')
  const contactError = email ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Informe um e-mail válido.') : (/^\+?[1-9]\d{7,14}$/.test(phone) ? '' : 'Informe um celular com DDD ou um e-mail válido.')
  const valid = name.trim().length >= 2 && !contactError && password.length >= 8 && !!neighborhood && accepted && (!invite.trim() || invite.trim().length >= 3)
  const neighborhoodError = submitted && !neighborhood ? 'Escolha seu bairro.' : undefined
  const termsError = submitted && !accepted ? 'Aceite os termos para criar sua conta.' : undefined
  const goLogin = () => router.replace('/entrar')
  async function submit() {
    setSubmitted(true); setError('')
    if (!valid || pending.current) return
    pending.current = true; setLoading(true)
    try {
      await register({ name: name.trim(), ...(email ? { email: value.toLowerCase() } : { cellphone: phone }), password, neighborhood: neighborhood!.name, ...(neighborhood!.id ? { neighborhoodId: neighborhood!.id } : {}), ...(invite.trim() ? { inviteCode: invite.trim() } : {}), acceptedTerms: true })
      // O cadastro não cria sessão: o login é feito na tela de entrar (a introdução termina nela).
      setSubmitted(false); setPassword(''); setSuccess(true)
    } catch (cause) {
      setError(errorMessage(cause, 'Não foi possível criar sua conta. Tente novamente.'))
    } finally { pending.current = false; setLoading(false) }
  }
  return <SafeAreaView style={styles.screen}>
    <StatusBar style="light" />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.canGoBack() ? router.back() : goLogin()} hitSlop={10}><Text style={styles.back}>‹</Text></Pressable><Text accessibilityRole="header" style={styles.title}>Criar conta</Text></View>
        {success ? <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.title}>Conta criada com sucesso!</Text>
          <Text accessibilityRole="alert" style={styles.description}>Vamos conhecer o Guardiões da Energia. Depois, entre com o celular ou e-mail e a senha que você acabou de criar.</Text>
          <Button title="Continuar" loading={loading} onPress={() => router.replace('/introducao')} />
        </View> : <>
        <Text style={styles.description}>Leva menos de 1 minuto. Sem CPF.</Text>
        <InputField label="Como quer ser chamado" value={name} onChangeText={setName} placeholder="Maria" maxLength={100} autoComplete="name" textContentType="name" editable={!loading && !success} error={submitted && name.trim().length < 2 ? 'Informe pelo menos 2 caracteres.' : undefined} />
        <InputField label="Celular ou e-mail" value={contact} onChangeText={setContact} placeholder="(98) 9 8888-0000" maxLength={254} autoCapitalize="none" autoCorrect={false} autoComplete="username" editable={!loading && !success} error={submitted ? contactError : undefined} />
        <InputField label="Senha" value={password} onChangeText={setPassword} placeholder="Pelo menos 8 caracteres" maxLength={128} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" editable={!loading && !success} error={submitted && password.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined} trailing={<Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setVisible(!visible)} hitSlop={8}><FormIcon name="eye" /></Pressable>} />
        <View style={styles.group}><View style={styles.labelRow}><Text style={styles.label}>Seu bairro</Text><Text style={styles.required}>OBRIGATÓRIO</Text></View>
          <Pressable disabled={loading || success} accessibilityRole="button" accessibilityLabel={`Seu bairro: ${neighborhood?.name ?? 'Escolha seu bairro'}`} onPress={() => setPicker(true)} style={styles.selector}><FormIcon name="pin" /><Text style={[styles.selection, !neighborhood && styles.placeholder]}>{neighborhood?.name ?? 'Escolha seu bairro'}</Text><Text style={styles.chevron}>⌄</Text></Pressable>
          {neighborhoodError ? <Text accessibilityRole="alert" style={styles.error}>{neighborhoodError}</Text> : null}
        </View>
        <InputField label="Código de convite (opcional)" leading={<FormIcon name="gift" />} value={invite} onChangeText={setInvite} placeholder="Ex.: MARIA-7K2" maxLength={50} autoCapitalize="characters" autoCorrect={false} editable={!loading && !success} error={submitted && invite.trim() && invite.trim().length < 3 ? 'Use pelo menos 3 caracteres ou deixe vazio.' : undefined} />
        <View style={styles.acceptance}><Pressable accessibilityRole="checkbox" accessibilityLabel="Aceitar termos e privacidade" accessibilityState={{ checked: accepted }} disabled={loading || success} onPress={() => setAccepted(!accepted)} style={[styles.checkbox, accepted && styles.checked]}>{accepted ? <Text style={styles.check}>✓</Text> : null}</Pressable><Text style={styles.description}>Li e aceito os <Text accessibilityRole="link" onPress={() => setTerms(true)} style={styles.link}>termos e a privacidade.</Text></Text></View>
        {termsError ? <Text accessibilityRole="alert" style={styles.error}>{termsError}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button title="Criar conta" loading={loading} disabled={success} onPress={() => { void submit() }} />
        <Pressable accessibilityRole="button" onPress={goLogin} style={styles.login}><Text style={styles.description}>Já tenho conta. <Text style={styles.link}>Entrar</Text></Text></Pressable>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    <NeighborhoodPicker visible={picker} value={neighborhood} onClose={() => setPicker(false)} onConfirm={item => { setNeighborhood(item); setPicker(false) }} />
    <Modal visible={terms} transparent animationType="fade" onRequestClose={() => setTerms(false)}><View style={styles.modal}><View style={styles.terms}><Text style={styles.title}>Termos e privacidade</Text><Text style={styles.description}>Use o Guardiões da Energia para aprender a reconhecer riscos e agir com segurança. Em uma emergência, afaste-se do risco e ligue 116.</Text><Text style={styles.description}>O cadastro armazena seu nome, celular ou e-mail, bairro, código de convite quando informado e a data do aceite. Sua senha é armazenada como hash. Esses dados permitem identificar sua conta e vincular seu progresso às atividades.</Text><Text style={styles.description}>Não informe CPF nem compartilhe sua senha. O aplicativo não substitui o atendimento de emergência.</Text><Button title="Fechar" onPress={() => setTerms(false)} /></View></View></Modal>
  </SafeAreaView>
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', padding: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 2 }, back: { color: colors.text, fontSize: 36, lineHeight: 38 }, title: { color: colors.text, fontSize: 21, fontWeight: '700' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 }, group: { gap: 8 }, labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, label: { color: colors.text, fontSize: 13, fontWeight: '700' }, required: { color: colors.primary, fontSize: 10, letterSpacing: 1 },
  selector: { minHeight: 54, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }, pin: { color: colors.muted, fontSize: 25 }, selection: { color: colors.text, fontSize: 16, flex: 1 }, placeholder: { color: '#858bad' }, chevron: { color: colors.muted, fontSize: 25 }, eye: { color: colors.muted, fontSize: 25 },
  acceptance: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 4, flexWrap: 'wrap' }, checkbox: { width: 24, height: 24, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 5 }, checked: { backgroundColor: colors.primary, borderColor: colors.primary }, check: { color: colors.background, textAlign: 'center', fontWeight: '700' }, link: { color: colors.primary, fontWeight: '700' }, login: { alignItems: 'center', paddingVertical: 4 }, error: { color: '#ffad61', fontSize: 13, lineHeight: 19 },
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000099', padding: 24 }, terms: { width: '100%', maxWidth: 390, backgroundColor: colors.field, borderRadius: 20, padding: 22, gap: 18 },
})
