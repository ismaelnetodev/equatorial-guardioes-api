import { useCallback, useState } from 'react'
import { ActivityIndicator, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import GiftAsset from '../../assets/icon-gift.svg'
import { Button, colors } from '../components/ui'
import { ProfilePage } from '../components/profile-page'
import { ProfileSymbol } from '../components/profile-symbol'
import { getRewards, redeemReward, type Rewards } from '../features/community/community.api'
import { ApiError } from '../services/api'

export default function RewardsScreen() {
  const [data, setData] = useState<Rewards | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedReward, setSelectedReward] = useState<Rewards['rewards'][number] | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useFocusEffect(useCallback(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getRewards(controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(cause => {
        if (controller.signal.aborted) return
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível carregar as recompensas.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt]))

  const progress = data?.level.nextLevel && data.level.pointsToNextLevel != null
    ? Math.max(0, Math.min(1, data.accumulated / Math.max(data.accumulated + data.level.pointsToNextLevel, 1)))
    : 1

  async function confirmRedemption() {
    if (!selectedReward || busy) return
    const reward = selectedReward
    setBusy(true)
    setNotice('')
    try {
      const result = await redeemReward(reward.key)
      setData(current => current ? { ...current, balance: result.balance, accumulated: result.accumulated } : current)
      setSelectedReward(null)
      setNotice(`Resgate de ${reward.cost} pts confirmado.`)
      try {
        setData(await getRewards())
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/entrar')
          return
        }
        setNotice(`Resgate confirmado. Não foi possível atualizar o saldo: ${cause instanceof ApiError ? cause.message : 'tente novamente.'}`)
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setSelectedReward(null)
        router.replace('/entrar')
        return
      }
      setNotice(cause instanceof ApiError ? cause.message : 'Não foi possível concluir o resgate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ProfilePage title="Recompensas" reportUnlocked>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.state} accessibilityLabel="Carregando recompensas" /> :
          error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.bodyText}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> :
          data ? <>
            <ImageBackground source={require('../../assets/profile-tile-amber.png')} resizeMode="cover" imageStyle={styles.balanceTile} style={styles.balanceCard}>
              <Text style={styles.balanceEyebrow}>SALDO PARA RESGATAR</Text>
              <View style={styles.balanceLine}><Text style={styles.balanceNumber}>{data.balance}</Text><Text style={styles.balanceUnit}>pts</Text></View>
              <Text style={styles.balanceDescription}>Acumulados: {data.accumulated} pts · {data.level.name}</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
              <Text style={styles.nextLevel}>{data.level.nextLevel && data.level.pointsToNextLevel != null ? `Faltam ${data.level.pointsToNextLevel} pts para a próxima faixa` : 'Você chegou ao nível máximo'}</Text>
            </ImageBackground>
            <View style={styles.notice}><ProfileSymbol name="shield" size={15} /><Text style={styles.noticeText}>Resgates dependem dos requisitos exibidos para cada recompensa.</Text></View>
            {notice ? <Text accessibilityRole="alert" style={styles.feedback}>{notice}</Text> : null}
            <View style={styles.rewardList}>
              {data.rewards.map(reward => {
                const canRedeem = reward.canRedeem && reward.cost != null
                const lockedReason = reward.pointsMissing != null && reward.pointsMissing > 0
                  ? `Faltam ${reward.pointsMissing} pts`
                  : reward.cost == null ? 'Valor em definição' : !reward.canRedeem ? 'Requer relatos validados' : ''
                return (
                  <View key={reward.key} style={[styles.rewardCard, canRedeem && styles.rewardCardAvailable, !canRedeem && styles.rewardCardLocked]}>
                    <View style={[styles.rewardIcon, !canRedeem && styles.rewardIconLocked]}>{canRedeem ? <GiftAsset width={23} height={23} /> : <ProfileSymbol name="lock" color={colors.mutedSecondary} size={22} />}</View>
                    <View style={styles.rewardCopy}>
                      <Text style={[styles.rewardCost, !canRedeem && styles.lockedText]}>{reward.cost == null ? '—' : `${reward.cost} pts`}</Text>
                      <Text style={styles.rewardDescription}>{reward.description}</Text>
                      {lockedReason ? <Text style={styles.lockedReason}>{lockedReason}</Text> : null}
                    </View>
                    {canRedeem
                      ? <Pressable accessibilityRole="button" onPress={() => setSelectedReward(reward)} style={styles.redeemButton}><Text style={styles.redeemText}>Resgatar</Text></Pressable>
                      : <View accessibilityLabel={lockedReason} style={styles.lockBadge}><ProfileSymbol name="lock" color={colors.mutedSecondary} size={17} /></View>}
                  </View>
                )
              })}
              {!data.rewards.length ? <Text style={styles.bodyText}>Ainda não há recompensas disponíveis.</Text> : null}
            </View>
          </> : null}
      </ScrollView>
      <Modal visible={!!selectedReward} transparent animationType="fade" onRequestClose={() => setSelectedReward(null)}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar resgate" onPress={() => setSelectedReward(null)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.confirmCard}>
            <View style={styles.confirmIcon}><GiftAsset width={28} height={28} /></View>
            <Text accessibilityRole="header" style={styles.confirmTitle}>Resgatar {selectedReward?.cost} pts?</Text>
            <Text style={styles.bodyText}>{selectedReward?.description}</Text>
            <View style={styles.balanceChange}>
              <View><Text style={styles.changeLabel}>Saldo</Text><Text style={styles.changeValue}>{data?.balance} → {Math.max((data?.balance ?? 0) - (selectedReward?.cost ?? 0), 0)} pts</Text></View>
              <View><Text style={styles.changeLabel}>Nível e ranking</Text><Text style={styles.changeValue}>não mudam</Text></View>
            </View>
            <View style={styles.modalButtons}>
              <Button title="Cancelar" outline onPress={() => setSelectedReward(null)} disabled={busy} />
              <Button title="Resgatar" loading={busy} onPress={() => { void confirmRedemption() }} />
            </View>
            <Text style={styles.simulationNote}>Algumas recompensas exigem relatos validados pela equipe.</Text>
          </View>
        </View>
      </Modal>
    </ProfilePage>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 12 },
  state: { paddingVertical: 30, gap: 14 },
  bodyText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  balanceCard: { overflow: 'hidden', padding: 18, borderRadius: 20, backgroundColor: colors.primary },
  balanceTile: { opacity: 0.36 },
  balanceEyebrow: { color: colors.background, fontSize: 10, letterSpacing: 1.2, fontWeight: '700' },
  balanceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 1 },
  balanceNumber: { color: colors.background, fontSize: 49, lineHeight: 58, fontWeight: '900' },
  balanceUnit: { color: colors.background, fontSize: 15, fontWeight: '800' },
  balanceDescription: { color: colors.background, fontSize: 12 },
  progressTrack: { height: 7, overflow: 'hidden', marginTop: 14, borderRadius: 5, backgroundColor: '#FFFFFF66' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.background },
  nextLevel: { color: colors.background, fontSize: 11, marginTop: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.field },
  noticeText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 14 },
  feedback: { color: colors.success, fontSize: 12, lineHeight: 18 },
  rewardList: { gap: 10 },
  rewardCard: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 17, backgroundColor: colors.field, borderWidth: 1, overflow: 'visible' },
  rewardCardAvailable: { borderColor: colors.primary },
  rewardCardLocked: { borderColor: 'transparent', opacity: 0.7 },
  rewardIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.primary },
  rewardIconLocked: { backgroundColor: '#222C70' },
  rewardCopy: { flex: 1, gap: 2 },
  rewardCost: { color: colors.text, fontSize: 16, fontWeight: '800' },
  lockedText: { color: colors.mutedSecondary },
  rewardDescription: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  lockedReason: { color: colors.mutedSecondary, fontSize: 10 },
  redeemButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.primary },
  redeemText: { color: colors.background, fontSize: 14, fontWeight: '800' },
  lockBadge: { width: 34, alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, backgroundColor: '#000000AA' },
  confirmCard: { width: '100%', maxWidth: 430, alignSelf: 'center', alignItems: 'center', gap: 12, padding: 21, borderRadius: 24, backgroundColor: colors.field },
  confirmIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 32, backgroundColor: colors.primary },
  confirmTitle: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  balanceChange: { width: '100%', gap: 12, padding: 14, borderRadius: 14, backgroundColor: '#222C70' },
  changeLabel: { color: colors.muted, fontSize: 11 },
  changeValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  modalButtons: { width: '100%', flexDirection: 'row', gap: 10 },
  simulationNote: { color: colors.mutedSecondary, fontSize: 10, textAlign: 'center' },
})
