import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { colors } from '../components/ui'
import { login } from '../features/auth/auth.api'
import { AdminTrails } from '../features/admin/admin-trails'
import { AdminAccount, AdminConfigurations, AdminHistory } from '../features/admin/admin-configurations'
import { listTrails } from '../features/admin/admin.api'
import { Action, Card, Field, Hint, Title, ui, useAction } from '../features/admin/admin.ui'
import { ApiError, errorMessage } from '../services/api'
import { clearAccessToken, getAccessToken } from '../services/session'

type Tab = 'trails' | 'rules' | 'rewards' | 'limits' | 'history' | 'account'
const tabs: { id: Tab; title: string; mark: string }[] = [
  { id: 'trails', title: 'Trilhas e módulos', mark: '01' }, { id: 'rules', title: 'Pontuação', mark: '02' },
  { id: 'rewards', title: 'Recompensas', mark: '03' }, { id: 'limits', title: 'Limites', mark: '04' },
  { id: 'history', title: 'Histórico', mark: '05' }, { id: 'account', title: 'Minha conta', mark: '06' },
]

export default function AdminScreen() {
  const wide = useWindowDimensions().width >= 900
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<Tab>('trails')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const reportError = (cause: unknown) => {
    setError(errorMessage(cause, 'Não foi possível concluir a operação.'))
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) { setAuthorized(false); void clearAccessToken() }
  }
  const { busy, run } = useAction(reportError)
  useEffect(() => {
    let active = true
    const check = async () => {
      try { if (await getAccessToken()) { await listTrails(); if (active) setAuthorized(true) } }
      catch (cause) { if (active) reportError(cause) }
      finally { if (active) setChecking(false) }
    }
    void check()
    return () => { active = false }
  }, [])
  const signIn = () => { setError(''); void run(async () => {
    await login({ email: email.trim().toLowerCase(), password })
    await listTrails() // A autorização é confirmada pelo backend, sem confiar no e-mail.
    setPassword(''); setAuthorized(true); setTab('trails')
  }) }
  return <SafeAreaView style={styles.screen}><StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.header}><View style={styles.brand}><Text style={styles.symbol}>ϟ</Text><View><Text style={styles.brandName}>GUARDIÕES DA ENERGIA</Text><Text style={styles.brandCaption}>Administração</Text></View></View>
        {authorized ? <Action title="Sair" disabled={busy} onPress={() => { void run(async () => { await clearAccessToken(); setAuthorized(false); setEmail(''); setPassword(''); setError('') }) }} /> : <Action title="Voltar ao aplicativo" onPress={() => router.replace('/entrar')} />}
      </View>
      {error ? <View style={styles.error}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Action title="Fechar aviso" onPress={() => setError('')} /></View> : null}
      {checking ? <ActivityIndicator color={colors.primary} accessibilityLabel="Verificando permissão administrativa" /> : !authorized ? <View style={styles.login}><Card>
        <Text style={ui.badge}>Acesso restrito</Text><Title>Bem-vindo à administração</Title><Hint>Entre com sua conta de administrador para gerenciar os conteúdos e o programa de recompensas.</Hint>
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="username" keyboardType="email-address" placeholder="Seu e-mail de administrador" editable={!busy} maxLength={254} />
        <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} maxLength={128} onSubmitEditing={signIn} />
        <Action title={busy ? 'Entrando…' : 'Entrar no painel'} primary disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password} onPress={signIn} />
      </Card></View> : <View style={[styles.body, wide && { flexDirection: 'row' }]}>
        <View style={[styles.navigation, wide && { width: 230, flexDirection: 'column' }]}>{tabs.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} onPress={() => { setTab(item.id); setError('') }} style={[styles.navItem, tab === item.id && styles.navSelected]}><Text style={[styles.navMark, tab === item.id && { color: colors.primary }]}>{item.mark}</Text><Text style={[styles.navText, tab === item.id && { color: colors.primary }]}>{item.title}</Text></Pressable>)}</View>
        <View style={styles.workspace}>
          {tab === 'trails' ? <AdminTrails onError={reportError} /> : tab === 'history' ? <AdminHistory onError={reportError} /> : tab === 'account' ? <AdminAccount onError={reportError} /> : <AdminConfigurations key={tab} category={tab} onError={reportError} />}
        </View>
      </View>}
      <Text style={styles.footer}>Guardiões da Energia · Gestão de conteúdo e recompensas</Text>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 1260, alignSelf: 'center', padding: 24, gap: 28, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, paddingVertical: 12, borderBottomColor: '#303968', borderBottomWidth: 1, paddingBottom: 24 },
  brand: { flexDirection: 'row', gap: 12, alignItems: 'center' }, symbol: { color: colors.primary, fontSize: 48, fontWeight: '900' },
  brandName: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 1 }, brandCaption: { color: colors.muted, fontSize: 14, marginTop: 5 },
  body: { gap: 28, alignItems: 'stretch' }, navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  navItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 12, minHeight: 48 }, navSelected: { backgroundColor: '#242c57' },
  navMark: { color: '#7780a7', fontSize: 12 }, navText: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  workspace: { flex: 1, minWidth: 0 }, login: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingVertical: 30 },
  footer: { color: '#858bad', fontSize: 12, textAlign: 'center', marginTop: 'auto', paddingTop: 24 },
  error: { borderWidth: 1, borderColor: '#e39a54', borderRadius: 12, backgroundColor: '#3d2944', padding: 16, gap: 10 }, errorText: { color: '#ffd5ac', fontSize: 14, lineHeight: 22 },
})
