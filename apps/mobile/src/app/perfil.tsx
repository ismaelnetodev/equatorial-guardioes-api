import { LoadFailure, useLoadFailureKind } from '../components/load-failure'
import { ContentSkeleton } from '../components/content-skeleton'
import { useCallback, useState } from 'react'
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Path, Svg } from 'react-native-svg'
import { router, useFocusEffect } from 'expo-router'
import { ProfilePage } from '../components/profile-page'
import { ProfileSymbol, type ProfileSymbolName } from '../components/profile-symbol'
import { AppIcon } from '../components/app-icon'
import { colors } from '../components/ui'
import { getProfile, type Profile } from '../features/community/community.api'
import { ApiError } from '../services/api'
import { clearAccessToken } from '../services/session'

const achievementBadges = [
  { title: 'Regra de ouro', icon: require('../../assets/trail-eye.png') },
  { title: 'Fio ou cabo', icon: require('../../assets/trail-pole.png') },
  { title: 'Poste seguro', icon: require('../../assets/trail-bolt.png') },
  { title: 'Cabos soltos', icon: require('../../assets/trail-shield.png') },
  { title: 'Olhar atento', icon: require('../../assets/trail-star.png') },
  { title: 'Aviso seguro', icon: require('../../assets/trail-check.png') },
  { title: 'Trilha completa', icon: require('../../assets/trail-route.png') },
  { title: 'Guardião destaque', icon: require('../../assets/trail-trophy.png') },
] as const

function initialsFromName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean).filter(word => !/^(da|das|de|do|dos|e)$/i.test(word))
  return [words[0]?.[0], words.length > 1 ? words[words.length - 1]?.[0] : undefined].filter(Boolean).join('').toUpperCase() || 'G'
}

type ProfileDestination = {
  title: string
  icon: ProfileSymbolName
  value?: string
  route?: '/relatos' | '/pontos' | '/recompensas' | '/convidar' | '/como-funciona' | '/termos'
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { offline, recordFailure } = useLoadFailureKind()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getProfile(controller.signal)
      .then(userProfile => { if (!controller.signal.aborted) setProfile(userProfile) })
      .catch(cause => { recordFailure(cause);
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar seu perfil.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt]))

  const earnedBadges = Math.min(profile?.badges.modulesCompleted ?? 0, achievementBadges.length)

  const menu: ProfileDestination[] = [
    { title: 'Meus relatos', icon: 'report', value: profile?.reportsCount == null ? '—' : String(profile.reportsCount), route: '/relatos' },
    { title: 'Pontos de aprendizado', icon: 'book', route: '/pontos' },
    { title: 'Recompensas', icon: 'gift', value: profile ? `${profile.balance} pts` : '—', route: '/recompensas' },
    { title: 'Convidar amigos', icon: 'invite', route: '/convidar' },
    { title: 'Como funciona', icon: 'book', route: '/como-funciona' },
    { title: 'Termos e privacidade', icon: 'lock', route: '/termos' },
  ]

  async function logout() {
    if (logoutBusy) return
    setLogoutBusy(true)
    setLogoutError('')
    try {
      await clearAccessToken()
      router.replace('/entrar')
    } catch {
      setLogoutError('Não foi possível sair da conta. Tente novamente.')
    } finally {
      setLogoutBusy(false)
    }
  }

  return <>
    <ProfilePage reportUnlocked={Boolean(profile?.badges.modulesCompleted)}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroFrame}>
          <ImageBackground source={require('../../assets/profile-tile-dark.png')} resizeMode="cover" imageStyle={styles.heroImage} style={styles.hero}>
            <View style={styles.heroTint} />
            <View style={styles.identity}>
              <View style={styles.avatar}><Text style={styles.initials}>{initialsFromName(profile?.name ?? '')}</Text></View>
              <View style={styles.identityText}>
                <Text numberOfLines={1} style={styles.name}>{profile?.name ?? 'Seu perfil'}</Text>
                <Text style={styles.neighborhood}>{profile?.neighborhood ?? 'Guardiões da Energia'}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Editar perfil (indisponível)" disabled style={[styles.editButton, styles.editDisabled]}>
                <ProfileSymbol name="edit" color={colors.text} size={19} />
              </Pressable>
            </View>
          </ImageBackground>
        </View>

        {loading ? <ContentSkeleton variant="profile" label="Carregando perfil" /> :
          error ? <LoadFailure offline={offline} onRetry={() => setAttempt(value => value + 1)} /> : profile ? <>
            <View style={styles.summary}>
              <View style={styles.summaryItem}><Text numberOfLines={1} style={styles.level}>{profile.level.name}</Text><Text style={styles.summaryLabel}>nível</Text></View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}><Text style={styles.summaryValue}>{profile.accumulated}</Text><Text style={styles.summaryLabel}>acumulados</Text></View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}><Text style={styles.summaryValue}>{profile.balance}</Text><Text style={styles.summaryLabel}>saldo</Text></View>
            </View>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>SELOS</Text>
              <Text style={styles.sectionCount}>{earnedBadges} de {achievementBadges.length}</Text>
            </View>
            <ScrollView horizontal style={styles.badgeScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges}>
              {achievementBadges.map((badge, index) => (
                <Badge
                  key={badge.title}
                  icon={badge.icon}
                  title={badge.title}
                  earned={index < earnedBadges}
                  tone={index === 0 ? colors.primary : colors.blue}
                />
              ))}
            </ScrollView>

            <View style={styles.menu}>
              {menu.map((item, index) => (
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`${item.title}${item.value ? `, ${item.value}` : ''}`} onPress={() => item.route && router.push(item.route)} style={[styles.menuRow, index === menu.length - 1 && styles.lastMenuRow]}>
                  <ProfileSymbol name={item.icon} size={20} />
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {item.value ? <Text style={styles.menuValue}>{item.value}</Text> : null}
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: logoutBusy }} disabled={logoutBusy} onPress={() => { void logout() }} style={[styles.menuRow, styles.logoutRow]}>
                <ProfileSymbol name="logout" color={colors.warning} size={20} />
                <Text style={styles.logoutTitle}>{logoutBusy ? 'Saindo…' : 'Sair'}</Text>
              </Pressable>
              {logoutError ? <Text accessibilityRole="alert" style={styles.logoutError}>{logoutError}</Text> : null}
            </View>
          </> : null}
      </ScrollView>
    </ProfilePage>
  </>
}

function Badge({ icon, title, earned, tone }: { icon: number; title: string; earned: boolean; tone: string }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${title}${earned ? ', conquistado' : ', bloqueado'}`} style={styles.badge}>
      <Svg width={58} height={72} viewBox="0 0 58 72">
        <Path d="M29 3 53 11v22c0 16-9 27-24 35C14 60 5 49 5 33V11L29 3Z" fill={earned ? tone : '#1A245E'} stroke={earned ? '#D5D9F2' : '#293477'} strokeWidth={2} strokeDasharray={earned ? undefined : '2 3'} />
        {earned ? <Path d="M29 8 48 14v18c0 13-7 22-19 29-12-7-19-16-19-29V14L29 8Z" fill="none" stroke="#FFFFFF80" strokeWidth={1} /> : null}
      </Svg>
      <View style={styles.badgeArt}>{earned ? <Image source={icon} accessible={false} resizeMode="contain" style={styles.badgeAsset} /> : <AppIcon name="lock" size={18} color={colors.mutedSecondary} />}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 22 },
  heroFrame: { width: '100%', alignItems: 'center', paddingHorizontal: 18 },
  hero: { width: '100%', maxWidth: 444, minHeight: 153, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.background },
  heroImage: { opacity: 1, borderRadius: 18 },
  heroTint: { ...StyleSheet.absoluteFill, backgroundColor: '#0B124014' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  initials: { color: colors.background, fontSize: 20, fontWeight: '900' },
  identityText: { flex: 1, gap: 5 },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  neighborhood: { color: colors.success, fontSize: 12, fontWeight: '600' },
  editButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.field },
  editDisabled: { opacity: 0.72 },
  summary: { marginHorizontal: 18, marginTop: -12, minHeight: 76, flexDirection: 'row', alignItems: 'center', borderRadius: 15, backgroundColor: colors.field },
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  level: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  summaryValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryDivider: { width: 1, height: 42, backgroundColor: colors.border },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 15, marginBottom: 7 },
  sectionTitle: { color: colors.primary, fontSize: 10, letterSpacing: 1.1, fontWeight: '700' },
  sectionCount: { color: colors.muted, fontSize: 11 },
  badgeScroller: { height: 83, flexGrow: 0, flexShrink: 0 },
  badges: { flexDirection: 'row', gap: 9, paddingHorizontal: 18, paddingBottom: 7 },
  badge: { width: 72, height: 74, alignItems: 'center', justifyContent: 'flex-start', position: 'relative', paddingTop: 1 },
  badgeArt: { position: 'absolute', top: 23, width: 25, height: 25, alignItems: 'center', justifyContent: 'center' },
  badgeAsset: { width: 24, height: 24, tintColor: colors.background },
  menu: { marginHorizontal: 18, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.field },
  menuRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  lastMenuRow: { borderBottomWidth: 0 },
  menuTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  menuValue: { color: colors.muted, fontSize: 11 },
  chevron: { color: colors.mutedSecondary, fontSize: 23, lineHeight: 26 },
  logoutRow: { borderBottomWidth: 0 },
  logoutTitle: { color: colors.warning, fontSize: 13, fontWeight: '700' },
  logoutError: { color: colors.warning, fontSize: 12 },
  state: { padding: 24, gap: 12, alignItems: 'center' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  error: { color: colors.warning, fontSize: 13, textAlign: 'center' },
  retry: { color: colors.primary, fontSize: 13, fontWeight: '700' },
})
