import { useEffect, useState } from 'react'
import { Link } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrailCard } from '../components/trail-card'
import { listTrails, type Trails } from '../features/trails/trails.api'

export default function HomeScreen() {
  const [trails, setTrails] = useState<Trails>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    listTrails(controller.signal)
      .then(items => { if (!controller.signal.aborted) setTrails(items) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={loading || error ? [] : trails}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TrailCard trail={item} />}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.brand}>Guardiões</Text>
            <Link href="/entrar" style={{ color: '#176b4a', fontWeight: '700', paddingVertical: 12 }}>Entrar na minha conta →</Link>
            <Text style={styles.headline}>Aprender para transformar.</Text>
            <Text style={styles.description}>Conhecimento e ação para cuidar da nossa comunidade.</Text>
            <Text style={styles.section}>Trilhas de capacitação</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? <ActivityIndicator size="large" color="#176b4a" accessibilityLabel="Carregando trilhas" /> :
          error ? <View style={styles.empty}>
            <Text style={styles.description}>Não foi possível carregar as trilhas.</Text>
            <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.button}>
              <Text style={styles.buttonText}>Tentar novamente</Text>
            </Pressable>
          </View> : <Text style={styles.description}>Novas trilhas estarão disponíveis em breve.</Text>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f7f2' },
  content: { padding: 24, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { gap: 14, marginBottom: 26, paddingTop: 16 },
  brand: { fontSize: 18, fontWeight: '700', color: '#176b4a', letterSpacing: 1 },
  headline: { fontSize: 38, lineHeight: 44, fontWeight: '700', color: '#153c31' },
  description: { fontSize: 16, lineHeight: 25, color: '#52665e' },
  section: { fontSize: 23, fontWeight: '600', color: '#153c31', marginTop: 28 },
  empty: { gap: 18, alignItems: 'flex-start' },
  button: { backgroundColor: '#176b4a', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 14 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
})
