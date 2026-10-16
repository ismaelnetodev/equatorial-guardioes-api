import { StyleSheet, View } from 'react-native'
import { colors } from './ui'

export function FormIcon({ name }: { name: 'pin' | 'gift' | 'search' | 'eye' }) {
  return <View style={styles.container} accessible={false}>
    {name === 'pin' ? <View style={styles.pin}><View style={styles.pinDot} /></View> : null}
    {name === 'search' ? <><View style={styles.search} /><View style={styles.stem} /></> : null}
    {name === 'eye' ? <View style={styles.eye}><View style={styles.pupil} /></View> : null}
    {name === 'gift' ? <><View style={styles.bowLeft} /><View style={styles.bowRight} /><View style={styles.gift}><View style={styles.ribbon} /></View><View style={styles.lid} /></> : null}
  </View>
}
const styles = StyleSheet.create({
  container: { width: 22, height: 24, alignItems: 'center', justifyContent: 'center' },
  pin: { width: 15, height: 19, borderWidth: 1.7, borderColor: colors.muted, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, alignItems: 'center', paddingTop: 3 },
  pinDot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, borderColor: colors.muted },
  search: { width: 14, height: 14, borderWidth: 1.8, borderColor: colors.muted, borderRadius: 8, position: 'absolute', top: 2, left: 1 }, stem: { width: 9, height: 2, backgroundColor: colors.muted, transform: [{ rotate: '45deg' }], position: 'absolute', left: 12, top: 16 },
  eye: { width: 20, height: 12, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, pupil: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: colors.muted },
  gift: { width: 17, height: 12, marginTop: 7, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center' }, ribbon: { height: 10, width: 1.5, backgroundColor: colors.muted }, lid: { position: 'absolute', width: 20, height: 4, borderWidth: 1.4, borderColor: colors.muted, top: 8 },
  bowLeft: { position: 'absolute', width: 8, height: 6, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 4, top: 3, left: 4, transform: [{ rotate: '35deg' }] }, bowRight: { position: 'absolute', width: 8, height: 6, borderWidth: 1.5, borderColor: colors.muted, borderRadius: 4, top: 3, right: 3, transform: [{ rotate: '-35deg' }] },
})
