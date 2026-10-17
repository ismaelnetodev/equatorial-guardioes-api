import { useEffect, useState } from 'react'
import { Switch, Text, View } from 'react-native'
import * as api from './admin.api'
import { Action, Card, Field, Hint, Title, ui, useAction, type ReportError } from './admin.ui'

const titles: Record<api.Category, string> = { rules: 'Regras de pontuação', rewards: 'Catálogo de recompensas', limits: 'Limites e parâmetros' }
export function AdminConfigurations({ category, onError }: { category: api.Category; onError: ReportError }) {
  const [rows, setRows] = useState<api.Configuration[]>([])
  const { busy, run } = useAction(onError)
  useEffect(() => { void run(async () => { setRows(await api.listConfigurations(category)) }) }, [category])
  return <View style={ui.stack}>
    <View style={ui.row}><Title>{titles[category]}</Title><Action title={busy ? 'Carregando…' : 'Atualizar'} disabled={busy} onPress={() => { void run(async () => { setRows(await api.listConfigurations(category)) }) }} /></View>
    <Hint>As alterações valem para operações futuras. Cada mudança fica registrada com sua conta no histórico.</Hint>
    {!busy && !rows.length ? <Hint>Nenhuma configuração disponível.</Hint> : null}
    {rows.map(row => <ConfigurationEditor key={row.key + ':' + row.updatedAt} row={row} category={category} onError={onError} onSaved={saved => setRows(current => current.map(item => item.key === saved.key ? saved : item))} />)}
  </View>
}

function ConfigurationEditor({ row, category, onError, onSaved }: { row: api.Configuration; category: api.Category; onError: ReportError; onSaved: (row: api.Configuration) => void }) {
  const [value, setValue] = useState(row.value?.toString() ?? '')
  const [active, setActive] = useState(row.isActive)
  const [reason, setReason] = useState('')
  const { busy, run } = useAction(onError)
  const hasPrice = row.unit !== 'trail_completion'
  const valid = !hasPrice || (value === '' ? row.value === null : /^\d+$/.test(value) && Number(value) <= (row.unit === 'percent' ? 100 : 2147483647))
  const dirty = active !== row.isActive || (hasPrice && value !== (row.value?.toString() ?? ''))
  return <Card>
    <Text style={ui.badge}>{row.isActive ? 'Ativa' : 'Desativada'} · {row.unit}</Text><Title>{row.name}</Title><Hint>{row.description}</Hint>
    <Hint>Chave: {row.key}</Hint>
    {hasPrice ? <Field label={'Valor (' + row.unit + ')'} value={value} onChangeText={setValue} keyboardType="number-pad" placeholder={row.value === null ? 'Pendente de definição' : ''} editable={!busy} /> : <Hint>Concedido pela conclusão da trilha, sem preço de resgate.</Hint>}
    {!valid ? <Hint>Informe um inteiro não negativo{row.unit === 'percent' ? ' de até 100' : ''}. Um valor já definido não pode ser apagado.</Hint> : null}
    <View style={ui.row}><Switch accessibilityLabel={'Ativar ' + row.name} value={active} onValueChange={setActive} disabled={busy} trackColor={{ true: '#ffbb12', false: '#465184' }} /><Text style={ui.label}>{active ? 'Ativa' : 'Desativada'}</Text></View>
    <Field label="Motivo da alteração (opcional)" value={reason} onChangeText={setReason} maxLength={2000} editable={!busy} />
    <Action title={busy ? 'Salvando…' : 'Salvar alteração'} primary disabled={busy || !valid || !dirty} onPress={() => { void run(async () => {
      const saved = await api.saveConfiguration(category, row.key, { ...(hasPrice && value !== '' ? { value: Number(value) } : {}), isActive: active, ...(reason.trim() ? { reason: reason.trim() } : {}) })
      onSaved(saved)
    }) }} />
  </Card>
}

export function AdminHistory({ onError }: { onError: ReportError }) {
  const [rows, setRows] = useState<api.Change[]>([])
  const [offset, setOffset] = useState(0)
  const [kind, setKind] = useState('')
  const [key, setKey] = useState('')
  const [filter, setFilter] = useState({ kind: '', key: '' })
  const { busy, run } = useAction(onError)
  useEffect(() => { void run(async () => { setRows(await api.history(offset, filter.kind, filter.key)) }) }, [offset, filter])
  return <View style={ui.stack}><Title>Histórico de alterações</Title>
    <Card><Hint>Filtre por categoria ou pela chave da configuração.</Hint>
      <View style={ui.row}>{[['', 'Todas'], ['RULE', 'Pontos'], ['REWARD', 'Recompensas'], ['LIMIT', 'Limites']].map(([value, label]) => <Action key={value} title={label!} primary={kind === value} disabled={busy} onPress={() => setKind(value!)} />)}</View>
      <Field label="Chave da configuração (opcional)" value={key} onChangeText={setKey} autoCapitalize="none" editable={!busy} />
      <Action title={busy ? 'Consultando…' : 'Consultar histórico'} disabled={busy} onPress={() => { setOffset(0); setFilter({ kind, key }) }} />
    </Card>
    {!busy && !rows.length ? <Hint>Nenhuma alteração encontrada.</Hint> : null}
    {rows.map(row => <Card key={row.id}>
      <Text style={ui.badge}>{row.kind} · {new Date(row.createdAt).toLocaleString('pt-BR')}</Text><Title>{row.after.name}</Title>
      <Hint>{row.key}</Hint>
      <Text style={ui.label}>Valor: {row.before ? row.before.value ?? 'Pendente' : 'Não cadastrado'} → {row.after.value ?? 'Pendente'}</Text>
      <Text style={ui.label}>Estado: {row.before ? row.before.isActive ? 'Ativa' : 'Desativada' : 'Não cadastrado'} → {row.after.isActive ? 'Ativa' : 'Desativada'}</Text>
      <Hint>Responsável: {row.actorId ?? 'Carga inicial do sistema'}</Hint><Hint>Motivo: {row.reason ?? 'Não informado'}</Hint>
    </Card>)}
    <View style={ui.row}><Action title="Anteriores" disabled={busy || offset === 0} onPress={() => setOffset(value => Math.max(0, value - 20))} /><Hint>Página {Math.floor(offset / 20) + 1}</Hint><Action title="Próximas" disabled={busy || rows.length < 20} onPress={() => setOffset(value => value + 20)} /></View>
  </View>
}

export function AdminAccount({ onError }: { onError: ReportError }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const { busy, run } = useAction(onError)
  return <Card><Title>Alterar minha senha</Title><Hint>Use pelo menos oito caracteres na nova senha.</Hint>
    <Field label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" maxLength={128} editable={!busy} />
    <Field label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" maxLength={128} editable={!busy} />
    <Field label="Confirme a nova senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" maxLength={128} editable={!busy} />
    {confirmation && confirmation !== newPassword ? <Hint>As novas senhas precisam ser iguais.</Hint> : null}
    <Action title={busy ? 'Alterando…' : 'Alterar senha'} primary disabled={busy || !currentPassword || newPassword.length < 8 || confirmation !== newPassword} onPress={() => { void run(async () => { setMessage(''); const response = await api.changePassword({ currentPassword, newPassword }); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setMessage(response.message) }) }} />
    {message ? <Text accessibilityLiveRegion="polite" style={ui.label}>{message}</Text> : null}
  </Card>
}
