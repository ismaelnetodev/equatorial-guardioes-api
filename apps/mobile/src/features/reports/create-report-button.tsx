import { Pressable, StyleSheet, Text } from 'react-native'

export function CreateReportButton({ onPress }: { onPress: () => void }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel="Fazer relato"
    accessibilityHint="Abre o chatbot para registrar um novo relato"
    onPress={onPress}
    style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
  >
    <Text accessible={false} style={styles.plus}>+</Text>
    <Text style={styles.label}>Fazer relato</Text>
  </Pressable>
}

const styles = StyleSheet.create({
  button: { position: 'absolute', right: 20, bottom: 20, minHeight: 56, maxWidth: '90%', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFBB12', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  plus: { color: '#0B1240', fontSize: 28, lineHeight: 32, fontWeight: '600' },
  label: { flexShrink: 1, color: '#0B1240', fontSize: 16, fontWeight: '700' },
})
