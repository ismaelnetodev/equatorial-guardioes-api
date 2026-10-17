import { LoadFailure, useLoadFailureKind } from '../components/load-failure'
import { ContentSkeleton } from '../components/content-skeleton'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppTabBar } from '../components/app-tab-bar'
import { Button, colors } from '../components/ui'
import { getProfile, getRanking, type Profile, type Ranking } from '../features/community/community.api'
import { ApiError } from '../services/api'

export default function RankingScreen() {
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { offline, recordFailure } = useLoadFailureKind()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    Promise.all([getRanking(controller.signal), getProfile(controller.signal)])
      .then(([rankingResult, profileResult]) => {
        if (controller.signal.aborted) return
        setRanking(rankingResult)
        setProfile(profileResult)
      })
      .catch(cause => { recordFailure(cause);
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar o ranking.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt]))

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar à trilha" onPress={() => router.replace('/trilha')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <Text accessibilityRole="header" style={styles.title}>Ranking do bairro</Text>
          <Text style={styles.description}>{ranking?.yourContribution.neighborhood ?? 'Seu bairro'}</Text>
          {loading ? <ContentSkeleton variant="ranking" label="Carregando ranking" /> :
            error ? <LoadFailure offline={offline} onRetry={() => setAttempt(value => value + 1)} /> :
            ranking ? <>
              <View style={styles.contribution}>
                <Text style={styles.contributionLabel}>Sua contribuição no bairro</Text>
                <Text style={styles.contributionPoints}>{ranking.yourContribution.accumulatedPoints} pontos</Text>
                <Text style={styles.contributionShare}>{ranking.yourContribution.neighborhoodSharePercent}% da pontuação do bairro</Text>
              </View>
              <View style={styles.list}>
                {ranking.neighborhoods.map(item => {
                  const isCurrentNeighborhood = item.isCurrentUserNeighborhood
                  return (
                    <View key={`${item.rank}-${item.neighborhood}`} style={[styles.row, isCurrentNeighborhood && styles.currentRow]}>
                      <View style={[styles.position, item.rank <= 3 && styles.topPosition]}><Text style={[styles.positionText, item.rank <= 3 && styles.topPositionText]}>{item.rank}</Text></View>
                      <View style={styles.person}>
                        <Text style={styles.name}>{item.neighborhood}{isCurrentNeighborhood ? ' · Seu bairro' : ''}</Text>
                        <Text style={styles.neighborhood}>{item.guardiansCount} guardiões</Text>
                      </View>
                      <Text style={styles.points}>{item.accumulatedPoints} pts</Text>
                    </View>
                  )
                })}
                {!ranking.neighborhoods.length ? <Text style={styles.description}>Ainda não há bairros no ranking.</Text> : null}
              </View>
            </> : null}
        </ScrollView>
      </View>
      <AppTabBar active="ranking" reportUnlocked={Boolean(profile?.badges.modulesCompleted)} onReport={() => router.replace('/trilha')} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  back: { width: 42, height: 42, justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 35, lineHeight: 38 },
  title: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 10 },
  description: { color: colors.muted, fontSize: 13, marginTop: 5 },
  state: { gap: 14, paddingVertical: 28 },
  contribution: { gap: 5, padding: 16, marginTop: 20, borderRadius: 16, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border },
  contributionLabel: { color: colors.muted, fontSize: 12 },
  contributionPoints: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  contributionShare: { color: colors.mutedSecondary, fontSize: 11 },
  list: { gap: 10, marginTop: 23 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.field },
  currentRow: { borderColor: colors.primary },
  position: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#1E2870' },
  topPosition: { backgroundColor: colors.primary },
  positionText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  topPositionText: { color: colors.background },
  person: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 13, fontWeight: '700' },
  neighborhood: { color: colors.mutedSecondary, fontSize: 11 },
  points: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  note: { color: colors.mutedSecondary, fontSize: 11, marginTop: 15 },
})
