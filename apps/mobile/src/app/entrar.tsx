import { useRef, useState } from 'react'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, colors, InputField } from '../components/ui'
import { EnergyBrand } from '../components/energy-brand'
import { EmergencyBanner } from '../components/emergency-banner'
import { OfflineBanner } from '../components/offline-banner'
import { login } from '../features/auth/auth.api'
import { errorMessage } from '../services/api'

export default function LoginScreen() {
  const [contact, setContact] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invalidCredentials, setInvalidCredentials] = useState(false)
  const [notice, setNotice] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const pending = useRef(false)
  const value = contact.trim()
  const phone = value.replace(/[\s().-]/g, '')
  const email = value.includes('@')
  const contactError = !value ? 'Informe seu celular ou e-mail.' : email ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? '' : 'Informe um e-mail válido.') : (/^\+?[1-9]\d{7,14}$/.test(phone) ? '' : 'Informe o celular com DDD, apenas números.')
  const passwordError = password.length < 8 ? 'A senha deve ter pelo menos 8 caracteres.' : ''

  async function submit() {
    if (pending.current) return
    setSubmitted(true)
    setError('')
    setInvalidCredentials(false)
    setNotice('')
    if (contactError || passwordError) return
    pending.current = true
    setLoading(true)
    try {
      await login({ ...(email ? { email: value.toLowerCase() } : { cellphone: phone }), password })
      router.replace('/trilha')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401 && cause.code === 'INVALID_CREDENTIALS') {
        setInvalidCredentials(true)
        setError('E-mail ou senha incorretos, tente novamente.')
      } else {
        setError(cause instanceof TypeError ? 'Sem acesso à internet, tente novamente.' : cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.')
      }
    } finally { pending.current = false; setLoading(false) }
  }

  function updateContact(text: string) {
    setContact(text)
    setError('')
    setInvalidCredentials(false)
  }

  function updatePassword(text: string) {
    setPassword(text)
    setError('')
    setInvalidCredentials(false)
  }

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="light" />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <OfflineBanner />
        <EnergyBrand />
        <View style={styles.form}>
          <InputField label="Celular ou e-mail" icon="user" value={contact} onChangeText={updateContact} placeholder="(98) 9 8888-0000" autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" editable={!loading} maxLength={254} error={submitted ? contactError : undefined} invalid={invalidCredentials} returnKeyType="next" />
          <InputField label="Senha" icon="lock" value={password} onChangeText={updatePassword} placeholder="Sua senha" secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" maxLength={128} editable={!loading} error={submitted ? passwordError : undefined} invalid={invalidCredentials} returnKeyType="go" onSubmitEditing={() => { void submit() }} trailing={<Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'} onPress={() => setVisible(!visible)} hitSlop={8} style={styles.eye}><Text style={styles.eyeText}>{visible ? '◉' : '◎'}</Text></Pressable>} />
          <Pressable accessibilityRole="button" onPress={() => setNotice('A recuperação de senha ainda não está disponível.')} style={styles.forgot}><Text style={styles.link}>Esqueci minha senha</Text></Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button title="Entrar" loading={loading} onPress={() => { void submit() }} />
          <Pressable accessibilityRole="button" onPress={() => router.push('/cadastrar')} style={styles.signup}><Text style={styles.muted}>Ainda não é Guardião? <Text style={styles.link}>Criar conta</Text></Text></Pressable>
          <Text style={styles.or}>ou</Text>
          <Button title="Entrar com Google" outline icon={<Image source={require('../../assets/google.png')} style={{ width: 20, height: 20 }} accessible={false} />} onPress={() => setNotice('O login com Google ainda não está disponível. Use seu celular ou e-mail e senha.')} />
          <Pressable accessibilityRole="button" onPress={() => router.push('/admin')} style={styles.signup}><Text style={styles.link}>Acesso administrativo</Text></Pressable>
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
          <View style={styles.emergency}><EmergencyBanner onError={() => setNotice('Não foi possível abrir o telefone. Ligue 116 pelo seu celular.')} /></View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingBottom: 22 },
  form: { gap: 14, paddingHorizontal: 20 }, forgot: { alignSelf: 'flex-end', paddingVertical: 2, minHeight: 30 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 }, muted: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  signup: { alignItems: 'center', paddingVertical: 7 }, or: { color: '#858bad', textAlign: 'center', fontSize: 12 },
  eye: { minWidth: 30, minHeight: 36, justifyContent: 'center', alignItems: 'center' }, eyeText: { color: colors.muted, fontSize: 25 },
  error: { color: colors.warning, fontSize: 13, lineHeight: 19 }, notice: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' }, emergency: { marginTop: 16 },
})
