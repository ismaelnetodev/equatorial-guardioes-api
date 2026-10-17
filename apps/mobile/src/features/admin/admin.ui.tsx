import { useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { Button, colors } from '../../components/ui'
import type { ContentStatus } from './admin.api'

export type ReportError = (error: unknown) => void
export const statusLabels: Record<ContentStatus, string> = { DRAFT: 'Rascunho', PUBLISHED: 'Publicado', ARCHIVED: 'Arquivado', DISABLED: 'Desativado' }
export function useAction(onError: ReportError) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const run = async (operation: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try { await operation() } catch (error) { onError(error) } finally { pending.current = false; setBusy(false) }
  }
  return { busy, run }
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={ui.field}><Text style={ui.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} autoCapitalize={props.secureTextEntry ? 'none' : props.autoCapitalize} placeholderTextColor={colors.muted} style={[ui.input, props.multiline && { minHeight: 110, textAlignVertical: 'top' }]} /></View>
}
export function Card({ children }: { children: ReactNode }) { return <View style={ui.card}>{children}</View> }
export function Title({ children }: { children: ReactNode }) { return <Text style={ui.title}>{children}</Text> }
export function Hint({ children }: { children: ReactNode }) { return <Text style={ui.hint}>{children}</Text> }
export function Action({ title, onPress, disabled, primary = false }: { title: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Button title={title} onPress={onPress} disabled={disabled} outline={!primary} />
}
export function StatusActions({ value, disabled, onChange }: { value: ContentStatus; disabled: boolean; onChange: (status: ContentStatus) => void }) {
  return <View style={ui.row}>{(Object.keys(statusLabels) as ContentStatus[]).map(status => <Action key={status} title={statusLabels[status]} disabled={disabled || status === value} onPress={() => onChange(status)} />)}</View>
}
export function movedIds(items: { id: string }[], index: number, direction: number): string[] {
  const ids = items.map(item => item.id)
  const target = index + direction
  if (ids[index] && ids[target]) [ids[index], ids[target]] = [ids[target]!, ids[index]!]
  return ids
}
export const ui = StyleSheet.create({
  card: { backgroundColor: '#151c4b', borderColor: '#303968', borderWidth: 1, borderRadius: 18, padding: 22, gap: 16 },
  title: { color: colors.text, fontSize: 21, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  stack: { gap: 18 }, field: { gap: 8 }, label: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#465184', borderRadius: 10, padding: 13, backgroundColor: '#0e143d', color: colors.text, fontSize: 15, minHeight: 48 },
  badge: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
})
