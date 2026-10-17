import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from './ui'
import { AppIcon } from './app-icon'
import ReportIcon from '../../assets/Reportar.svg'
import LockIcon from '../../assets/cadeado.svg'
import TabIndicator from '../../assets/Rectangle.svg'
import TrailLabel from '../../assets/Trilha.svg'

const tabs = [
  { id: 'trail', label: 'Trilha' },
  { id: 'report', label: 'Reportar' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'profile', label: 'Perfil' },
] as const

type TabId = typeof tabs[number]['id']

export function AppTabBar({ active, onReport, reportUnlocked = false }: { active: TabId; onReport: () => void; reportUnlocked?: boolean }) {
  function selectTab(tab: TabId) {
    if (tab === 'report') {
      onReport()
      return
    }
    if (tab === 'trail') {
      router.replace('/trilha')
      return
    }
    router.push(tab === 'ranking' ? '/ranking' : '/perfil')
  }

  return (
    <View style={styles.bar}>
      {tabs.map(tab => {
        const selected = active === tab.id
        return (
          <Pressable
            key={tab.id}
            accessibilityLabel={tab.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => selectTab(tab.id)}
            style={styles.tab}>
            <View style={styles.iconSlot}>
              {selected && tab.id !== 'report' ? <TabIndicator width={24} height={3} style={styles.indicator} /> : null}
              {tab.id === 'trail' ? <AppIcon name="route" color={selected ? colors.primary : colors.text} /> : null}
              {tab.id === 'report' ? (
                <View style={styles.reportIcon}>
                  <ReportIcon width={72} height={40} />
                  {!reportUnlocked ? <LockIcon width={22} height={22} style={styles.reportLock} /> : null}
                </View>
              ) : null}
              {tab.id === 'ranking' ? <AppIcon name="trophy" color={selected ? colors.primary : colors.text} /> : null}
              {tab.id === 'profile' ? <AppIcon name="user" color={selected ? colors.primary : colors.text} /> : null}
            </View>
            {tab.id === 'trail' && selected
              ? <TrailLabel width={32} height={10} />
              : <Text style={[styles.label, (selected || tab.id === 'report') && styles.selected]}>{tab.label}</Text>}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, backgroundColor: '#111943', borderTopWidth: 1, borderTopColor: colors.border },
  tab: { minWidth: 64, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 7 },
  iconSlot: { height: 40, minWidth: 72, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: 0 },
  reportIcon: { width: 72, height: 40, position: 'relative' },
  reportLock: { position: 'absolute', right: 0, top: -8 },
  label: { color: colors.mutedSecondary, fontSize: 11, fontWeight: '600' },
  selected: { color: colors.primary },
})
