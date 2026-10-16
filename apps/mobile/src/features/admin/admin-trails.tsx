import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as api from './admin.api'
import { Action, Card, Field, Hint, movedIds, StatusActions, Title, ui, useAction, type ReportError } from './admin.ui'

export function AdminTrails({ onError }: { onError: ReportError }) {
  const [trails, setTrails] = useState<api.AdminTrail[]>([])
  const [selected, setSelected] = useState<api.TrailDetails | null>(null)
  const [creating, setCreating] = useState(false)
  const { busy, run } = useAction(onError)
  const refresh = async () => { setTrails(await api.listTrails()) }
  useEffect(() => { void run(refresh) }, [])
  const open = (id: string) => run(async () => { setSelected(await api.getTrail(id)); setCreating(false) })
  return <View style={ui.stack}>
    <View style={ui.row}><Title>Trilhas e módulos</Title><Action title="Nova trilha" primary disabled={busy} onPress={() => { setSelected(null); setCreating(true) }} /><Action title={busy ? 'Carregando…' : 'Atualizar'} disabled={busy} onPress={() => { void run(refresh) }} /></View>
    <Hint>Cadastre os conteúdos em rascunho. Publique os módulos antes de publicar a trilha.</Hint>
    {creating || selected ? <TrailEditor key={selected?.id ?? 'new'} trail={selected} onError={onError} onClose={() => { setCreating(false); setSelected(null) }} onSaved={async id => { await refresh(); setSelected(await api.getTrail(id)); setCreating(false) }} /> : null}
    {!busy && !trails.length ? <Card><Hint>Nenhuma trilha cadastrada. Comece em “Nova trilha”.</Hint></Card> : null}
    {trails.map((trail, index) => <Card key={trail.id}>
      <Text style={ui.badge}>{String(trail.order).padStart(2, '0')} · {trail.publicationStatus === 'PUBLISHED' ? 'Publicado' : trail.publicationStatus === 'DRAFT' ? 'Rascunho' : trail.publicationStatus === 'ARCHIVED' ? 'Arquivado' : 'Desativado'}</Text>
      <Title>{trail.title}</Title><Hint>{trail.description}</Hint>
      <View style={ui.row}><Action title="Editar trilha e módulos" disabled={busy} onPress={() => { void open(trail.id) }} /><Action title="Subir" disabled={busy || index === 0} onPress={() => { void run(async () => { setTrails(await api.orderTrails(movedIds(trails, index, -1))) }) }} /><Action title="Descer" disabled={busy || index === trails.length - 1} onPress={() => { void run(async () => { setTrails(await api.orderTrails(movedIds(trails, index, 1))) }) }} /></View>
    </Card>)}
  </View>
}

function TrailEditor({ trail, onError, onSaved, onClose }: { trail: api.TrailDetails | null; onError: ReportError; onSaved: (id: string) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState(trail?.title ?? '')
  const [description, setDescription] = useState(trail?.description ?? '')
  const [module, setModule] = useState<api.AdminModule | null>(null)
  const [addingModule, setAddingModule] = useState(false)
  const { busy, run } = useAction(onError)
  return <Card>
    <Title>{trail ? 'Editar trilha' : 'Nova trilha'}</Title>
    <Field label="Título da trilha" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
    <Field label="Descrição da trilha" value={description} onChangeText={setDescription} multiline maxLength={5000} editable={!busy} />
    <View style={ui.row}><Action title={busy ? 'Salvando…' : 'Salvar trilha'} primary disabled={busy || !title.trim() || !description.trim()} onPress={() => { void run(async () => { const saved = await api.saveTrail({ title: title.trim(), description: description.trim() }, trail?.id); await onSaved(saved.id) }) }} /><Action title="Fechar edição" disabled={busy} onPress={onClose} /></View>
    {trail ? <>
      <Hint>Estado atual: {trail.publicationStatus}. Alterações de publicação são aplicadas imediatamente.</Hint>
      <StatusActions value={trail.publicationStatus} disabled={busy} onChange={status => { void run(async () => { await api.trailStatus(trail.id, status); await onSaved(trail.id) }) }} />
      <Title>Módulos desta trilha</Title>
      <Action title="Novo módulo" disabled={busy} onPress={() => { setModule(null); setAddingModule(true) }} />
      {!trail.modules.length ? <Hint>Esta trilha ainda não tem módulos.</Hint> : null}
      {trail.modules.map((item, index) => <View key={item.id} style={ui.stack}>
        <Text style={ui.label}>{item.order}. {item.title} · {item.publicationStatus}</Text>
        <View style={ui.row}><Action title={'Editar ' + item.title} disabled={busy} onPress={() => { setModule(item); setAddingModule(true) }} /><Action title="Subir módulo" disabled={busy || index === 0} onPress={() => { void run(async () => { await api.orderModules(trail.id, movedIds(trail.modules, index, -1)); await onSaved(trail.id) }) }} /><Action title="Descer módulo" disabled={busy || index === trail.modules.length - 1} onPress={() => { void run(async () => { await api.orderModules(trail.id, movedIds(trail.modules, index, 1)); await onSaved(trail.id) }) }} /></View>
      </View>)}
      {addingModule ? <ModuleEditor key={module?.id ?? 'new'} module={module} trailId={trail.id} onError={onError} onSaved={async () => { await onSaved(trail.id); setAddingModule(false); setModule(null) }} onClose={() => setAddingModule(false)} /> : null}
    </> : <Hint>Salve a trilha para cadastrar seus módulos.</Hint>}
  </Card>
}

function ModuleEditor({ module, trailId, onError, onSaved, onClose }: { module: api.AdminModule | null; trailId: string; onError: ReportError; onSaved: () => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState(module?.title ?? '')
  const [description, setDescription] = useState(module?.description ?? '')
  const [content, setContent] = useState(module?.content ?? '')
  const [duration, setDuration] = useState(module?.durationMinutes?.toString() ?? '')
  const [requiresQuiz, setRequiresQuiz] = useState(module?.requiresQuiz ?? false)
  const { busy, run } = useAction(onError)
  const durationValid = duration === '' || (/^\d+$/.test(duration) && Number(duration) >= 1 && Number(duration) <= 100000)
  return <Card><Title>{module ? 'Editar módulo' : 'Novo módulo'}</Title>
    <Field label="Título do módulo" value={title} onChangeText={setTitle} maxLength={200} editable={!busy} />
    <Field label="Descrição do módulo" value={description} onChangeText={setDescription} multiline maxLength={5000} editable={!busy} />
    <Field label="Conteúdo educativo" value={content} onChangeText={setContent} multiline maxLength={200000} editable={!busy} />
    <Field label="Duração em minutos (opcional)" value={duration} onChangeText={setDuration} keyboardType="number-pad" editable={!busy} />
    {!durationValid ? <Hint>Informe de 1 a 100.000 minutos, ou deixe vazio.</Hint> : null}
    <Action title={requiresQuiz ? 'Quiz obrigatório: sim' : 'Quiz obrigatório: não'} disabled={busy} onPress={() => setRequiresQuiz(value => !value)} />
    <Hint>A aplicação do usuário ainda depende da integração de quiz para concluir módulos com quiz obrigatório.</Hint>
    <View style={ui.row}><Action title={busy ? 'Salvando…' : 'Salvar módulo'} primary disabled={busy || !durationValid || !title.trim() || !description.trim()} onPress={() => { void run(async () => { await api.saveModule(trailId, { title: title.trim(), description: description.trim(), content, durationMinutes: duration === '' ? null : Number(duration), requiresQuiz }, module?.id); await onSaved() }) }} /><Action title="Cancelar módulo" disabled={busy} onPress={onClose} /></View>
    {module ? <StatusActions value={module.publicationStatus} disabled={busy} onChange={status => { void run(async () => { await api.moduleStatus(trailId, module.id, status); await onSaved() }) }} /> : null}
  </Card>
}
