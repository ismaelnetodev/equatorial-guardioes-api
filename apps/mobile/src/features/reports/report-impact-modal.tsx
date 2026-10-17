import { Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold, useFonts } from '@expo-google-fonts/archivo'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { ReportImpact } from './reports.api'

type ImpactActions = {
  onClose: () => void
  onViewReport: (reportId: string) => void
}

export function ReportImpactCard({ impact, onClose, onViewReport }: ImpactActions & { impact: ReportImpact }) {
  return <View style={styles.card} accessibilityViewIsModal>
    <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardContent}>
      <Image source={require('../../../assets/report-impact-celebration.png')} style={styles.celebration} resizeMode="stretch" accessible={false} />
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>{impact.title}</Text>
        <Text style={styles.message}>{impact.message}</Text>
        <View style={styles.points}>
          <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" accessible={false}><Path d="m7 1.75 1.575 3.5 3.675.35-2.8 2.45.817 3.617L7 9.8l-3.267 1.867.817-3.617-2.8-2.45 3.675-.35L7 1.75Z" stroke="#0B1240" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" /></Svg>
          <Text style={styles.pointsText}>+{impact.pointsAwarded} pts · relato confirmado</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.button, styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}><Text style={styles.closeText}>Fechar</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onViewReport(impact.reportId)} style={({ pressed }) => [styles.button, styles.viewButton, { opacity: pressed ? 0.7 : 1 }]}><Text style={styles.viewText}>Ver relato</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  </View>
}

// Prepared for the pending-impact flow; rendering remains controlled by its caller.
export function ReportImpactModal({ visible, impact, onClose, onViewReport }: ImpactActions & { visible: boolean; impact: ReportImpact | null }) {
  const [fontsLoaded, fontError] = useFonts({ Archivo_400Regular, Archivo_700Bold, Archivo_800ExtraBold })
  if (!visible || !impact || (!fontsLoaded && !fontError)) return null
  return <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <ReportImpactCard impact={impact} onClose={onClose} onViewReport={onViewReport} />
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0000009E', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 320, maxHeight: '100%', borderRadius: 28, backgroundColor: '#141C55', overflow: 'hidden' },
  cardContent: { flexGrow: 1 },
  celebration: { width: '100%', height: 172 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  title: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 24, lineHeight: 26, textAlign: 'center' },
  message: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  points: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 13.5, minWidth: 224, minHeight: 27, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#FFB81C', marginTop: 28, maxWidth: '100%' },
  pointsText: { flexShrink: 1, color: '#0B1240', fontFamily: 'Archivo_700Bold', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 23 },
  button: { flex: 1, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 10 },
  closeButton: { borderWidth: 1.5, borderColor: '#2A3590' },
  viewButton: { backgroundColor: '#FFB81C' },
  closeText: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 17, lineHeight: 22, textAlign: 'center' },
  viewText: { color: '#0B1240', fontFamily: 'Archivo_700Bold', fontSize: 17, lineHeight: 22, textAlign: 'center' },
})
