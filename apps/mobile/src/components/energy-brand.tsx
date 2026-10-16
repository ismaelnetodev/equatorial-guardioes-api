import { Image, StyleSheet, Text, View } from 'react-native'
import { colors } from './ui'

export function EnergyBrand() {
  return <View style={styles.hero}>
    <Image source={require('../../assets/lencois-login.png')} style={styles.background} resizeMode="cover" accessible={false} />
    <Image source={require('../../assets/energy-symbol.png')} style={styles.symbol} resizeMode="contain" accessibilityLabel="Símbolo Guardiões da Energia" />
    <Text style={styles.title}>Guardiões</Text>
    <Text style={styles.subtitle}>da Energia</Text>
    <Text style={styles.tagline}>Aprenda a ver o risco. Avise com segurança.</Text>
  </View>
}

const styles = StyleSheet.create({
  hero: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', aspectRatio: 360 / 300, paddingBottom: 30, overflow: 'hidden', backgroundColor: colors.background },
  background: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  symbol: { width: 110, height: 98, marginBottom: 12 },
  title: { color: '#fff', fontSize: 29, lineHeight: 31, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: '#24b5c6', fontSize: 29, lineHeight: 31, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.muted, fontSize: 13, marginTop: 14, textAlign: 'center' },
})
