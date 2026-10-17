import { useCallback, useState } from 'react'
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Button, colors } from '../components/ui'
import { ProfilePage } from '../components/profile-page'
import { ProfileSymbol } from '../components/profile-symbol'
import { getInvite, type Invite } from '../features/community/community.api'
import { ApiError } from '../services/api'

export default function InviteScreen() {
  const [invite, setInvite] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [shareError, setShareError] = useState('')

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getInvite(controller.signal)
      .then(result => { if (!controller.signal.aborted) setInvite(result) })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar seu convite.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt]))

  async function shareInvite() {
    if (!invite) return
    setShareError('')
    try {
      await Share.share({
        title: 'Convite Guardiões da Energia',
        message: `Vamos cuidar juntos da nossa comunidade. Use meu código de convite ${invite.inviteCode} no Guardiões da Energia.`,
      })
    } catch {
      setShareError('Não foi possível abrir o compartilhamento. Tente novamente.')
    }
  }

  return (
    <ProfilePage title="Convidar amigos" reportUnlocked>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.state} accessibilityLabel="Carregando convite" /> :
          error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.bodyText}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> :
          invite ? <>
            <ImageBackground source={require('../../assets/invite-urban-illustration.png')} resizeMode="cover" imageStyle={styles.heroImage} style={styles.hero}>
              <View style={styles.heroShade} />
              <Text accessibilityRole="header" style={styles.heroTitle}>Mais olhos na rua,{'\n'}mais segurança.</Text>
            </ImageBackground>
            <Text style={styles.description}>Compartilhe seu código com os vizinhos. Você recebe pontos quando alguém que convidou conclui o módulo 0.</Text>
            <Text style={styles.sectionLabel}>SEU CÓDIGO</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Compartilhar código ${invite.inviteCode}`} onPress={() => { void shareInvite() }} style={styles.codeCard}>
              <View><Text style={styles.codeEyebrow}>CÓDIGO DE CONVITE</Text><Text selectable style={styles.code}>{invite.inviteCode}</Text></View>
              <View style={styles.copyButton}><ProfileSymbol name="copy" color={colors.text} size={19} /></View>
            </Pressable>
            <Button title="Compartilhar convite" icon={<ProfileSymbol name="invite" color={colors.background} size={19} />} onPress={() => { void shareInvite() }} />
            {shareError ? <Text accessibilityRole="alert" style={styles.error}>{shareError}</Text> : null}
            <Text style={[styles.sectionLabel, styles.statsHeading]}>SEUS CONVITES</Text>
            <View style={styles.statsCard}>
              <InviteStat value={invite.stats.registeredCount} label="entraram" />
              <View style={styles.divider} />
              <InviteStat value={invite.stats.module0CompletedCount} label="concluíram o módulo 0" />
              <View style={styles.divider} />
              <InviteStat value={`+${invite.stats.pointsFromInvites}`} label="pontos" highlighted />
            </View>
            <Text style={styles.limit}>Limite de {invite.inviteLimit} convites com pontos · {invite.stats.rewardedInviteCount} já pontuaram.</Text>
          </> : null}
      </ScrollView>
    </ProfilePage>
  )
}

function InviteStat({ value, label, highlighted = false }: { value: number | string; label: string; highlighted?: boolean }) {
  return <View style={styles.stat}>
    <Text style={[styles.statValue, highlighted && styles.highlighted]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 14 },
  state: { paddingVertical: 30, gap: 14 },
  bodyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  hero: { height: 196, justifyContent: 'center', overflow: 'hidden', padding: 18, borderRadius: 17, backgroundColor: colors.background },
  heroImage: { opacity: 0.9 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: '#0B124060' },
  heroTitle: { zIndex: 1, color: colors.text, fontSize: 21, lineHeight: 27, fontWeight: '800', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  sectionLabel: { color: colors.primary, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  codeCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.field },
  codeEyebrow: { color: colors.primary, fontSize: 9, letterSpacing: 1 },
  code: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 3 },
  copyButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#222C70' },
  error: { color: colors.warning, fontSize: 12 },
  statsHeading: { marginTop: 5 },
  statsCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 17, backgroundColor: colors.field },
  stat: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 3 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  highlighted: { color: colors.primary },
  statLabel: { color: colors.muted, fontSize: 9, textAlign: 'center' },
  divider: { width: 1, height: 43, backgroundColor: colors.border },
  limit: { color: colors.mutedSecondary, fontSize: 11, lineHeight: 16 },
})
