import { useFonts, Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold } from '@expo-google-fonts/archivo'
import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { AppIcon } from '../../components/app-icon'
import { Button } from '../../components/ui'
import { ApiError, errorMessage } from '../../services/api'
import { listReports, type Reports } from './reports.api'

export function MyReportsScreen({ onBack, onCreate }: { onBack: () => void; onCreate: () => void }) {
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  const [data, setData] = useState<Reports | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    void listReports(controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) { router.replace('/entrar'); return }
      setError(errorMessage(cause))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])

  if (!fontsLoaded && !fontError) return <View style={styles.state}><ActivityIndicator color="#FFBB12" /></View>

  return <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setAttempt(value => value + 1)} tintColor="#FFBB12" />}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar à trilha" onPress={onBack} style={styles.back}><View style={styles.chevron} /></Pressable>
      <Text accessibilityRole="header" style={styles.heading}>Meus relatos</Text>
    </View>
    {loading ? <View style={styles.state}><ActivityIndicator color="#FFBB12" accessibilityLabel="Carregando seus relatos" /></View> : error ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" onPress={() => setAttempt(value => value + 1)} /></View> : data?.reports.length === 0 ? <View style={styles.empty}>
      <Image source={require('../../../assets/reports-empty.png')} accessible={false} style={styles.illustration} resizeMode="contain" />
      <Text accessibilityRole="header" style={styles.title}>Nenhum relato ainda</Text>
      <Text style={styles.description}>Quando vir um risco na rua, fotografe de longe e reporte. Seu bairro agradece.</Text>
      <Pressable accessibilityRole="button" onPress={onCreate} style={({ pressed }) => [styles.create, { opacity: pressed ? 0.7 : 1 }]}><AppIcon name="bolt" color="#0B1240" size={22} /><Text style={styles.createText}>Fazer meu primeiro relato</Text></Pressable>
    </View> : data ? <View style={styles.list}>
      {data.reports.map(report => <View key={report.id} style={styles.card}><Text style={styles.heading}>{report.title}</Text><Text style={styles.description}>{report.address}</Text><Text style={styles.description}>{report.status.label}</Text></View>)}
      <Button title="Fazer novo relato" icon={<AppIcon name="bolt" color="#0B1240" />} onPress={onCreate} />
    </View> : null}
  </ScrollView>
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, backgroundColor: '#0B1240' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 44 },
  back: { width: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 10, height: 10, borderLeftWidth: 2.2, borderBottomWidth: 2.2, borderColor: '#fff', transform: [{ rotate: '45deg' }] },
  heading: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 20, lineHeight: 26 },
  empty: { alignItems: 'center', paddingTop: 62 },
  illustration: { width: '100%', maxWidth: 280, aspectRatio: 280 / 220, borderRadius: 28 },
  title: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: 30, marginBottom: 12 },
  description: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  create: { width: '100%', minHeight: 56, borderRadius: 16, backgroundColor: '#FFBB12', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12, marginTop: 54 },
  createText: { flexShrink: 1, color: '#0B1240', fontFamily: 'Archivo_800ExtraBold', fontSize: 17, lineHeight: 22, textAlign: 'center' },
  state: { flex: 1, justifyContent: 'center', gap: 20, paddingVertical: 40 },
  list: { gap: 16, paddingTop: 32 },
  card: { backgroundColor: '#141C55', padding: 20, borderRadius: 16, gap: 12 },
})
