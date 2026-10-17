import { useCallback, useState } from 'react'
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppTabBar } from '../components/app-tab-bar'
import { ContentSkeleton } from '../components/content-skeleton'
import { LoadFailure, useLoadFailureKind } from '../components/load-failure'
import { colors } from '../components/ui'
import { getProfile, getRanking, type Profile, type Ranking } from '../features/community/community.api'
import { ApiError } from '../services/api'

type NeighborhoodRank = Ranking['neighborhoods'][number]

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
      .catch(cause => {
        recordFailure(cause)
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar o ranking.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt, recordFailure]))

  const podium = ranking ? [
    ranking.neighborhoods.find(item => item.rank === 2),
    ranking.neighborhoods.find(item => item.rank === 1),
    ranking.neighborhoods.find(item => item.rank === 3),
  ] : []
  const currentNeighborhood = ranking?.neighborhoods.find(item => item.isCurrentUserNeighborhood)
  const share = Math.round(Math.max(0, Math.min(100, ranking?.yourContribution.neighborhoodSharePercent ?? 0)))
  const remainingNeighborhoods = ranking?.neighborhoods.filter(item => item.rank > 3) ?? []

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>Ranking</Text>
            <View style={styles.infoPill}><Text style={styles.infoMark}>i</Text><Text style={styles.infoText}>Por bairro</Text></View>
          </View>
          <View style={styles.tabs}>
            <View accessibilityRole="tab" accessibilityState={{ selected: true }} style={[styles.tab, styles.selectedTab]}>
              <Text style={styles.selectedTabText}>Meu bairro</Text>
            </View>
            <View accessibilityRole="tab" accessibilityState={{ disabled: true }} style={[styles.tab, styles.cityTab]}>
              <Text style={styles.cityText}>Cidade</Text>
              <Text style={styles.phase}>FASE 2</Text>
            </View>
          </View>
          <Text style={styles.neighborhoodTitle}>{ranking?.yourContribution.neighborhood ?? 'Seu bairro'}</Text>
          {loading ? <ContentSkeleton variant="ranking" label="Carregando ranking" /> :
            error ? <LoadFailure offline={offline} onRetry={() => setAttempt(value => value + 1)} /> :
              ranking ? <>
                {podium.some(Boolean) ? <View style={styles.podium}>
                  {podium.map((item, index) => item ? (
                    <View key={item.neighborhood} style={styles.podiumColumn}>
                      {item.isCurrentUserNeighborhood
                        ? <Text style={styles.youTag}>VOCÊ</Text>
                        : <View style={styles.youTagSpacer} />}
                      <Text numberOfLines={1} style={styles.podiumName}>{item.neighborhood}</Text>
                      <Text style={styles.podiumPoints}>{item.accumulatedPoints.toLocaleString('pt-BR')} pts</Text>
                      <ImageBackground
                        source={item.rank === 1 ? require('../../assets/profile-tile-amber.png') : require('../../assets/profile-tile-dark.png')}
                        resizeMode="cover"
                        imageStyle={styles.podiumPattern}
                        style={[
                          styles.podiumTower,
                          item.rank === 1 ? styles.firstTower : item.rank === 2 ? styles.secondTower : styles.thirdTower,
                        ]}>
                        <Text style={[styles.podiumRank, item.rank === 1 && styles.firstRank]}>{item.rank}º</Text>
                      </ImageBackground>
                    </View>
                  ) : <View key={`podium-empty-${index}`} style={styles.podiumColumn} />)}
                </View> : <Text style={styles.emptyRanking}>Ainda não há bairros no ranking.</Text>}
                {remainingNeighborhoods.length ? <View style={styles.list}>
                  {remainingNeighborhoods.map(item => (
                    <View key={`${item.rank}-${item.neighborhood}`} style={[styles.row, item.isCurrentUserNeighborhood && styles.currentRow]}>
                      <View style={styles.position}><Text style={styles.positionText}>{item.rank}º</Text></View>
                      <View style={styles.person}>
                        <Text numberOfLines={1} style={styles.name}>{item.neighborhood}{item.isCurrentUserNeighborhood ? ' · Você' : ''}</Text>
                        <Text style={styles.guardians}>{item.guardiansCount} guardiões</Text>
                      </View>
                      <Text style={styles.points}>{item.accumulatedPoints.toLocaleString('pt-BR')} pts</Text>
                    </View>
                  ))}
                </View> : null}
                <View style={styles.contribution}>
                  <Text style={styles.contributionEyebrow}>SUA CONTRIBUIÇÃO PARA {ranking.yourContribution.neighborhood.toUpperCase()}</Text>
                  <Text style={styles.contributionPoints}>{ranking.yourContribution.accumulatedPoints.toLocaleString('pt-BR')} pts</Text>
                  <Text style={styles.contributionMeta}>
                    {share}% do total do bairro{currentNeighborhood ? ` · ${currentNeighborhood.guardiansCount} guardiões` : ''}
                  </Text>
                  <View style={styles.contributionTrack}><View style={[styles.contributionFill, { width: `${share}%` }]} /></View>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/convidar')} style={styles.invite}>
                    <Text style={styles.inviteText}>Convidar vizinhos →</Text>
                  </Pressable>
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
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#222C70' },
  infoMark: { width: 14, height: 14, borderRadius: 7, overflow: 'hidden', textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '800', borderWidth: 1, borderColor: colors.muted },
  infoText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginTop: 15, padding: 4, borderRadius: 20, backgroundColor: colors.field },
  tab: { minHeight: 36, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 18 },
  selectedTab: { backgroundColor: colors.primary },
  selectedTabText: { color: colors.background, fontSize: 12, fontWeight: '800' },
  cityTab: { opacity: 0.72 },
  cityText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  phase: { color: colors.mutedSecondary, fontSize: 7, letterSpacing: 0.7, fontWeight: '700' },
  neighborhoodTitle: { color: colors.primary, fontSize: 14, fontWeight: '800', marginTop: 18 },
  podium: { minHeight: 230, flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, marginBottom: 14 },
  podiumColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end' },
  youTag: { color: colors.background, backgroundColor: colors.primary, fontSize: 8, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginBottom: 4 },
  youTagSpacer: { height: 18 },
  podiumName: { width: '100%', color: colors.text, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  podiumPoints: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2, marginBottom: 6 },
  podiumTower: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopLeftRadius: 13, borderTopRightRadius: 13 },
  podiumPattern: { opacity: 0.28 },
  firstTower: { height: 122, backgroundColor: colors.primary },
  secondTower: { height: 94, backgroundColor: '#202B76' },
  thirdTower: { height: 76, backgroundColor: '#202B76' },
  podiumRank: { color: colors.text, fontSize: 21, fontWeight: '800' },
  firstRank: { color: colors.background },
  emptyRanking: { color: colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 32, marginBottom: 32 },
  list: { gap: 8, marginBottom: 14 },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.field },
  currentRow: { borderWidth: 1, borderColor: colors.primary },
  position: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#222C70', alignItems: 'center', justifyContent: 'center' },
  positionText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  person: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 12, fontWeight: '800' },
  guardians: { color: colors.mutedSecondary, fontSize: 9, fontWeight: '600' },
  points: { color: colors.text, fontSize: 11, fontWeight: '800' },
  contribution: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 18, padding: 14, backgroundColor: colors.field },
  contributionEyebrow: { color: colors.primary, fontSize: 9, letterSpacing: 0.8, fontWeight: '800' },
  contributionPoints: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 7 },
  contributionMeta: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 2 },
  contributionTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: '#222C70', marginTop: 10 },
  contributionFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  invite: { alignSelf: 'flex-start', paddingTop: 9 },
  inviteText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
})
