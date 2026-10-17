import { useCallback, useState } from 'react'
import { Archivo_400Regular, Archivo_700Bold, useFonts } from '@expo-google-fonts/archivo'
import * as Network from 'expo-network'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { NetworkError } from '../services/api'

export function useLoadFailureKind() {
  const [offline, setOffline] = useState(false)
  const recordFailure = useCallback((cause: unknown) => setOffline(cause instanceof NetworkError), [])
  return { offline, recordFailure }
}

function FailureIcon({ offline }: { offline: boolean }) {
  return <Svg width={56} height={56} viewBox="0 0 56 56" fill="none" stroke={offline ? '#FF7A1A' : '#FFB81C'} strokeWidth={4.66667} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {offline ? <><Path d="M4.667 19.833C16.333 9.333 39.667 9.333 51.333 19.833M12.833 28C21 21 35 21 43.167 28M21 36.166C24.5 32.666 31.5 32.666 35 36.166M28 44.333v.467M7 7l42 42" /></> : <Path d="M28 6.167 51.333 44.667H4.667ZM28 21.333v9.333M28 38.133v.467" />}
  </Svg>
}
function RetryIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#0B1240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d="M20 4v6h-6M20 10a8 8 0 1 0 .2 5" /></Svg>
}
function PhoneIcon({ color, size = 22 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d="m6 3 3.5 4-2 2.5c1.5 3 4 5.5 7 7l2.5-2 4 3.5-2 3C11 21 3 13 3 5Z" /></Svg>
}

export function LoadFailure({ offline = false, onRetry, retrying = false, standalone = false, compact = false }: { offline?: boolean; onRetry: () => void; retrying?: boolean; standalone?: boolean; compact?: boolean }) {
  useFonts({ Archivo_400Regular, Archivo_700Bold })
  const network = Network.useNetworkState()
  const disconnected = offline || network.isConnected === false || network.isInternetReachable === false
  const [phoneError, setPhoneError] = useState(false)
  return <View style={[styles.page, standalone && styles.standalone, compact && { paddingTop: 24, minHeight: 0 }]}>
    <View style={styles.icon}><FailureIcon offline={disconnected} /></View>
    <Text accessibilityRole="header" style={styles.title}>{disconnected ? 'Sem internet' : 'Não deu para carregar'}</Text>
    <Text accessibilityRole="alert" style={styles.message}>{disconnected ? 'Verifique sua conexão e tente de novo.\nSeu progresso salvo continua seguro.' : 'Isso não é culpa sua. Tente de novo em\nalguns segundos.'}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ busy: retrying, disabled: retrying }} disabled={retrying} onPress={onRetry} style={({ pressed }) => [styles.retry, { opacity: pressed || retrying ? 0.7 : 1 }]}>
      {retrying ? <ActivityIndicator color="#0B1240" /> : <RetryIcon />}<Text style={styles.retryText}>Tentar de novo</Text>
    </Pressable>
    {disconnected ? <View style={styles.emergency}><PhoneIcon color="#E5252A" /><View style={styles.emergencyCopy}><Text style={styles.emergencyTitle}>Risco na rua agora?</Text><Text style={styles.emergencyText}>Afaste-se e ligue 116</Text></View><Pressable accessibilityRole="link" accessibilityLabel="Ligar para 116" onPress={() => { void Linking.openURL('tel:116').catch(() => setPhoneError(true)) }} style={styles.call}><PhoneIcon color="#fff" size={14} /><Text style={styles.callText}>Ligar</Text></Pressable></View> : null}
    {phoneError ? <Text accessibilityRole="alert" style={styles.message}>Não foi possível abrir a ligação. Disque 116 no telefone.</Text> : null}
  </View>
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 360, alignSelf: 'center', alignItems: 'center', paddingTop: 120, paddingBottom: 40, minHeight: 580 },
  standalone: { paddingTop: 196, minHeight: 688, paddingHorizontal: 20 },
  icon: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#141C55', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontFamily: 'Archivo_700Bold', fontSize: 24, lineHeight: 29, textAlign: 'center', marginTop: 32 },
  message: { color: '#B9BDD0', fontFamily: 'Archivo_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  retry: { width: 240, maxWidth: '100%', minHeight: 56, borderRadius: 16, backgroundColor: '#FFB81C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 36, padding: 12 },
  retryText: { fontFamily: 'Archivo_700Bold', fontSize: 17, lineHeight: 22, color: '#0B1240' },
  emergency: { width: '100%', minHeight: 52, borderWidth: 1.5, borderColor: '#E5252A', borderRadius: 14, marginTop: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16 },
  emergencyCopy: { flex: 1, gap: 3 }, emergencyTitle: { fontFamily: 'Archivo_700Bold', color: '#fff', fontSize: 13 }, emergencyText: { fontFamily: 'Archivo_400Regular', color: '#B9BDD0', fontSize: 12 },
  call: { minHeight: 28, borderRadius: 14, backgroundColor: '#E5252A', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, callText: { color: '#fff', fontSize: 12, fontFamily: 'Archivo_700Bold' },
})
