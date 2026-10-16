import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

export const colors = { background: '#0d123d', field: '#181e53', border: '#303c9b', primary: '#ffbb12', text: '#ffffff', muted: '#b6bad3', danger: '#ed1c2b' }

export function Button({ title, onPress, outline = false, loading = false, icon }: { title: string; onPress: () => void; outline?: boolean; loading?: boolean; icon?: ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={onPress} style={({ pressed }) => [styles.button, outline ? styles.outline : styles.primary, { opacity: loading || pressed ? 0.7 : 1 }]}>
    {loading ? <ActivityIndicator color={colors.background} accessibilityLabel="Entrando" /> : <>{icon}<Text style={[styles.buttonText, { color: outline ? colors.text : colors.background }]}>{title}</Text></>}
  </Pressable>
}

export function InputField({ label, icon, trailing, error, ...props }: TextInputProps & { label: string; icon: 'user' | 'lock'; trailing?: ReactNode; error?: string }) {
  const [focused, setFocused] = useState(false)
  return <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.field, { borderColor: error ? '#ff8a20' : focused ? colors.primary : colors.border }]}>
      <View style={styles.icon} accessible={false}>
        <View style={icon === 'user' ? styles.head : styles.shackle} />
        <View style={icon === 'user' ? styles.shoulders : styles.lockBody} />
      </View>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#858bad" selectionColor={colors.primary} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={[styles.input, Platform.OS === 'web' && styles.webInput]} />
      {trailing}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primary: { backgroundColor: colors.primary }, outline: { borderWidth: 1, borderColor: colors.border, minHeight: 44 },
  buttonText: { fontSize: 16, fontWeight: '800' }, fieldGroup: { gap: 8 },
  label: { color: colors.text, fontSize: 13, fontWeight: '700' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, backgroundColor: colors.field, borderRadius: 14, minHeight: 52, paddingHorizontal: 14, gap: 12 },
  icon: { width: 20, height: 24, alignItems: 'center', justifyContent: 'center' },
  head: { width: 9, height: 9, borderWidth: 1.6, borderColor: colors.muted, borderRadius: 6, marginBottom: 3 },
  shoulders: { width: 17, height: 8, borderWidth: 1.6, borderBottomWidth: 0, borderColor: colors.muted, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
  shackle: { width: 9, height: 8, borderWidth: 1.6, borderBottomWidth: 0, borderColor: colors.muted, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  lockBody: { width: 14, height: 11, borderWidth: 1.6, borderColor: colors.muted, borderRadius: 2 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12, minWidth: 0 },
  webInput: { outlineWidth: 0 },
  error: { color: '#ffad61', fontSize: 12 },
})
