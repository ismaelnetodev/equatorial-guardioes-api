import { StyleSheet, Text, View } from 'react-native'
import type { Trails } from '../features/trails/trails.api'
import { colors } from './ui'

export function TrailCard({ trail }: { trail: Trails[number] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{trail.title}</Text>
      <Text style={styles.description}>{trail.description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.field, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: colors.border, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  description: { fontSize: 15, lineHeight: 23, color: colors.muted },
})
