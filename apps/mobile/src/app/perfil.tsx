import { LoadFailure, useLoadFailureKind } from '../components/load-failure'
import { ContentSkeleton } from '../components/content-skeleton'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppTabBar } from '../components/app-tab-bar'
import { Button, colors } from '../components/ui'
import { getProfile, type Profile } from '../features/community/community.api'
import { ApiError } from '../services/api'

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { offline, recordFailure } = useLoadFailureKind()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getProfile(controller.signal)
      .then(result => { if (!controller.signal.aborted) setProfile(result) })
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

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar à trilha" onPress={() => router.replace('/trilha')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <Text accessibilityRole="header" style={styles.title}>Perfil</Text>
          <View style={styles.spacer} />
        </View>
        {loading ? <ContentSkeleton variant="profile" label="Carregando perfil" /> :
          error ? <ScrollView><LoadFailure offline={offline} onRetry={() => setAttempt(value => value + 1)} /></ScrollView> :
          profile ? <>
            <View style={styles.profileCard}>
              <View style={styles.avatar}><Text style={styles.initials}>{profile.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</Text></View>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.neighborhood}>{profile.neighborhood}</Text>
              <View style={styles.tier}><Text style={styles.tierIcon}>♢</Text><Text style={styles.tierText}>{profile.level.name}</Text></View>
              <View style={styles.divider} />
              <View style={styles.pointsRow}><Text style={styles.points}>{profile.accumulated}</Text><Text style={styles.pointsLabel}>pontos acumulados</Text></View>
              <View style={styles.pointsRow}><Text style={styles.balance}>{profile.balance}</Text><Text style={styles.pointsLabel}>pontos disponíveis</Text></View>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>Sua participação</Text>
              <View style={styles.stat}><Text style={styles.statValue}>{profile.badges.modulesCompleted}</Text><Text style={styles.statLabel}>módulos concluídos</Text></View>
              <View style={styles.stat}><Text style={styles.statValue}>{profile.reportsCount}</Text><Text style={styles.statLabel}>relatos enviados</Text></View>
            </View>
          </> : <Text style={styles.description}>Nenhum perfil disponível.</Text>}
      </View>
      <AppTabBar active="profile" reportUnlocked={Boolean(profile?.badges.modulesCompleted)} onReport={() => router.replace('/trilha')} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 35, lineHeight: 38 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  spacer: { width: 42 },
  state: { paddingVertical: 32, gap: 14 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  profileCard: { alignItems: 'center', gap: 10, marginTop: 23, padding: 22, borderRadius: 22, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: colors.primary },
  initials: { color: colors.background, fontSize: 22, fontWeight: '900' },
  name: { color: colors.text, fontSize: 21, fontWeight: '800' },
  neighborhood: { color: colors.muted, fontSize: 13 },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, backgroundColor: colors.background },
  tierIcon: { color: colors.primary },
  tierText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  divider: { width: '100%', height: 1, backgroundColor: colors.border, marginTop: 5 },
  pointsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  points: { color: colors.text, fontSize: 24, fontWeight: '800' },
  balance: { color: colors.primary, fontSize: 19, fontWeight: '800' },
  pointsLabel: { color: colors.muted, fontSize: 13 },
  statsCard: { gap: 14, padding: 18, marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.field },
  statsTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statValue: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 13 },
})
