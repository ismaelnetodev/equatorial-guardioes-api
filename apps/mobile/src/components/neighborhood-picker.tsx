import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, colors, InputField } from './ui'
import { FormIcon } from './form-icon'
import { getNeighborhoods, type Neighborhood } from '../features/auth/neighborhoods.api'

export type NeighborhoodSelection = { id?: string; name: string }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function NeighborhoodPicker({ visible, value, onClose, onConfirm }: {
  visible: boolean; value: NeighborhoodSelection | null; onClose: () => void; onConfirm: (value: NeighborhoodSelection) => void
}) {
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<Neighborhood[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selection, setSelection] = useState<NeighborhoodSelection | null>(value)
  const [other, setOther] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!visible) return
    setQuery(''); setSelection(value); setOther(!!value && !value.id); setOtherName(value && !value.id ? value.name : '')
  }, [visible, value])
  useEffect(() => {
    if (!visible) return
    let active = true
    setLoading(true); setError('')
    getNeighborhoods().then(response => { if (active) setItems(response.neighborhoods) })
      .catch(() => { if (active) setError('Não foi possível carregar os bairros. Tente novamente.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [visible, retry])
  const chosen = other ? { name: otherName.trim() } : selection
  const filtered = items.filter(item => normalize(item.name).includes(normalize(query.trim())))
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Fechar seleção de bairro" onPress={onClose} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.handle} />
        <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Seu bairro</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
        <Text style={styles.description}>O ranking é por bairro. Você pode trocar uma vez por mês.</Text>
        <InputField label="Buscar bairro" leading={<FormIcon name="search" />} value={query} onChangeText={setQuery} placeholder="Buscar bairro" autoCorrect={false} />
        {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} accessibilityLabel="Carregando bairros" /> : error ? <View style={styles.loading}><Text accessibilityRole="alert" style={styles.description}>{error}</Text><Button title="Tentar novamente" outline onPress={() => setRetry(v => v + 1)} /></View> : <FlatList
          keyboardShouldPersistTaps="handled" data={filtered} keyExtractor={item => item.id} style={styles.list}
          ListEmptyComponent={<Text style={styles.description}>{items.length ? 'Nenhum bairro encontrado.' : 'Nenhum bairro disponível no momento.'}</Text>}
          renderItem={({ item }) => {
            const selected = !other && selection?.id === item.id
            return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setOther(false); setSelection(item) }} style={[styles.row, selected && styles.selected]}>
              <Text style={[styles.name, selected && styles.highlight]}>{item.name}</Text><View style={[styles.radio, selected && styles.checked]}>{selected ? <View style={styles.dot} /> : null}</View>
            </Pressable>
          }} />}
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: other }} onPress={() => setOther(true)} style={styles.row}><Text style={styles.highlight}>＋  Outro bairro</Text><View style={[styles.radio, other && styles.checked]}>{other ? <View style={styles.dot} /> : null}</View></Pressable>
        {other ? <InputField label="Nome do seu bairro" placeholder="Informe seu bairro em São Luís" value={otherName} onChangeText={setOtherName} maxLength={100} /> : null}
        <Button title={chosen?.name ? `Confirmar ${chosen.name}` : 'Confirmar bairro'} disabled={!chosen || chosen.name.length < 2} onPress={() => { if (chosen && chosen.name.length >= 2) onConfirm(chosen) }} />
      </View>
    </KeyboardAvoidingView>
  </Modal>
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  sheet: { width: '100%', maxWidth: 430, alignSelf: 'center', maxHeight: '85%', backgroundColor: colors.field, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, gap: 12 },
  handle: { width: 44, height: 5, borderRadius: 4, backgroundColor: '#858bad', alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' }, close: { color: colors.muted, fontSize: 28 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 19 }, list: { flexGrow: 0, flexShrink: 1, minHeight: 80 },
  loading: { paddingVertical: 20, gap: 12 }, row: { minHeight: 43, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, gap: 12 },
  selected: { backgroundColor: '#222c70', borderRadius: 12, borderBottomWidth: 0, paddingHorizontal: 12 }, name: { color: colors.text, fontSize: 15, flex: 1 },
  highlight: { color: colors.primary, fontWeight: '700', fontSize: 15 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#858bad', alignItems: 'center', justifyContent: 'center' },
  checked: { borderColor: colors.primary, backgroundColor: colors.primary }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.field },
})
