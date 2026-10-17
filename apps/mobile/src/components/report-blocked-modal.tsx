import { useState } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppIcon } from './app-icon'
import { Button, colors } from './ui'

export function ReportBlockedModal({ visible, available, minutes, onClose, onModule }: { visible: boolean; available: boolean; minutes?: number | null; onClose: () => void; onModule: () => void }) {
  const [callError, setCallError] = useState(false)
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setCallError(false)}>
    <SafeAreaView style={styles.overlay}><Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal style={styles.card}><ScrollView contentContainerStyle={styles.content}>
        <View style={styles.lock}><AppIcon name="lock" size={30} color={colors.background} /></View>
        <Text accessibilityRole="header" style={styles.title}>{available ? 'Falta só o módulo 0' : 'Prepare-se para reportar'}</Text>
        <Text style={styles.description}>{available ? `Antes de reportar, aprenda a regra de ouro: observe, afaste-se e avise.${minutes ? ` Leva uns ${minutes} minutos.` : ''}` : 'A trilha de segurança estará disponível em breve. Em caso de risco, mantenha distância.'}</Text>
        {available ? <Button title="Fazer módulo 0" icon={<AppIcon name="eye" size={20} color={colors.background} />} onPress={onModule} /> : null}
        <Button title="Agora não" outline onPress={onClose} />
        <View style={styles.emergency}><View style={styles.emergencyCopy}><Text style={styles.emergencyTitle}>É uma emergência?</Text><Text style={styles.emergencyDescription}>Afaste-se e ligue 116</Text></View><Pressable accessibilityRole="link" accessibilityLabel="Ligar para emergência, 116" onPress={() => { void Linking.openURL('tel:116').catch(() => setCallError(true)) }} style={styles.call}><Text style={styles.callText}>☎ Ligar 116</Text></Pressable></View>
        {callError ? <Text accessibilityRole="alert" style={styles.error}>Não foi possível abrir a ligação. Ligue 116 pelo telefone.</Text> : null}
      </ScrollView></View>
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', alignItems: 'center', padding: 20 }, card: { width: '100%', maxWidth: 360, maxHeight: '100%', borderRadius: 26, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border }, content: { padding: 23, gap: 12 }, lock: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginVertical: 4 },
  title: { color: colors.text, fontWeight: '800', fontSize: 24, textAlign: 'center', marginTop: 4 }, description: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 }, emergency: { marginTop: 6, paddingTop: 16, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, emergencyCopy: { flexGrow: 1, gap: 4 }, emergencyTitle: { color: colors.text, fontWeight: '700', fontSize: 14 }, emergencyDescription: { color: colors.muted, fontSize: 12 }, call: { backgroundColor: colors.danger, borderRadius: 20, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center' }, callText: { color: colors.text, fontWeight: '700', fontSize: 12 }, error: { color: '#ffad61', fontSize: 13 },
})
