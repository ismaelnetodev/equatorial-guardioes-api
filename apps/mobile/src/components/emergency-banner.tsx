import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from './ui'

export function EmergencyBanner({ onError }: { onError: () => void }) {
  return <View style={styles.banner}>
    <Text style={styles.phone} accessible={false}>☎</Text>
    <View style={styles.copy}><Text style={styles.title}>Risco na rua agora?</Text><Text style={styles.description}>Afaste-se e ligue 116</Text></View>
    <Pressable accessibilityRole="link" accessibilityLabel="Ligar para emergência, 116" onPress={() => { void Linking.openURL('tel:116').catch(onError) }} style={styles.call}><Text style={styles.callText}>☎ Ligar</Text></Pressable>
  </View>
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderColor: colors.danger, borderRadius: 15, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  phone: { color: colors.danger, fontSize: 24 }, copy: { flex: 1 }, title: { color: colors.text, fontWeight: '700', fontSize: 12 },
  description: { color: colors.muted, fontSize: 11, marginTop: 3 }, call: { backgroundColor: colors.danger, borderRadius: 24, minHeight: 36, paddingHorizontal: 12, justifyContent: 'center' },
  callText: { color: colors.text, fontWeight: '700', fontSize: 12 },
})
