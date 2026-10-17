import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AppTabBar } from './app-tab-bar'
import { colors } from './ui'

export function ProfilePage({ title, children, reportUnlocked = true }: {
  title?: string
  children: ReactNode
  reportUnlocked?: boolean
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.page}>
        {title ? <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao perfil" onPress={() => router.canGoBack() ? router.back() : router.replace('/perfil')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <View style={styles.spacer} />
        </View> : null}
        <View style={styles.body}>{children}</View>
      </View>
      <AppTabBar active="profile" reportUnlocked={reportUnlocked} onReport={() => router.replace('/trilha')} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  back: { width: 42, justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 35, lineHeight: 38 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  spacer: { width: 42 },
  body: { flex: 1 },
})
