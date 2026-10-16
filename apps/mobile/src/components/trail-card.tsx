import { StyleSheet, Text, View } from 'react-native'
import type { Trails } from '../features/trails/trails.api'

export function TrailCard({ trail }: { trail: Trails[number] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{trail.title}</Text>
      <Text style={styles.description}>{trail.description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#ffffff', padding: 22, borderRadius: 18, borderWidth: 1, borderColor: '#dce7df', gap: 8 },
  title: { fontSize: 20, fontWeight: '600', color: '#153c31' },
  description: { fontSize: 16, lineHeight: 24, color: '#52665e' },
})
