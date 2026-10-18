import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { Tela, Cabecalho, Faixa, Balao, Chips, BarraEntrada, CardEmergencia, CardAnalise, CardLocal, CardResumo, s } from '../components';
import Emergencia from './Emergencia';
import { Analise, Local, Nivel, Relato, analisarFoto, obterLocal, salvarRelato } from '../api';
import { montarFicha, linkWhatsApp } from '../ficha';
import { EMERGENCIA, URGENCIA } from '../config';
import { cor } from '../theme';
import { ApiError, errorMessage } from '../../../services/api';
import { router } from 'expo-router';

type Passo = 'inicio' | 'foto' | 'analisando' | 'confirmar' | 'descricao' | 'resumo' | 'enviado';
type Item = { id: number; de: 'bot' | 'voce'; texto?: string; foto?: string; analise?: Analise };

const SEGURANCA = [
  'Mantenha distância segura do local.',
  'Isole o local se puder, sem se aproximar.',
  'Não tente arrumar nada você mesmo.',
  'Avise quem estiver perto.',
  'Se houver fogo ou ferido, ligue 193.',
];
const VAZIO: Local = { rotulo: '', bairro: '', lat: 0, lng: 0 };

export default function RelatoChat({ nome, onFechar, onVerRelato }: { nome: string; onFechar: () => void; onVerRelato?: () => void }) {
  const [itens, setItens] = useState<Item[]>([
    { id: 0, de: 'bot', texto: `Oi, ${nome}! Vou te ajudar a registrar o risco em menos de 30 segundos.` },
    { id: 1, de: 'bot', texto: 'O que está acontecendo?' },
  ]);
  const [passo, setPasso] = useState<Passo>('inicio');
  const [emergencia, setEmergencia] = useState(false);
  const [foto, setFoto] = useState('');
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [comentario, setComentario] = useState('');
  const [local, setLocal] = useState<Local>(VAZIO);
  const [fichaTexto, setFichaTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const envioEmCurso = useRef(false);
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const add = (item: Omit<Item, 'id'>) => setItens((l) => [...l, { ...item, id: l.length }]);
  const confirmado = analise?.status === 'risco_detectado' && !comentario;
  const nivel: Nivel = confirmado && analise ? analise.nivel : 'N3';

  function escolherInicio(opcao: string) {
    add({ de: 'voce', texto: opcao });
    if (opcao === 'Vejo algo perigoso na rede') {
      add({ de: 'bot', texto: 'Fotografe o risco de longe, sem se aproximar. Mostre o poste e a rua inteira. A foto precisa ser tirada agora, não vale da galeria.' });
      setPasso('foto');
    } else {
      add({ de: 'bot', texto: `Falta de energia sozinha não é risco na rede. Para falta de energia, ligue ${EMERGENCIA.equatorial}. Mas se houver fio caído, faísca ou fumaça, considere o fio energizado e use o botão de emergência.` });
    }
  }

  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) return;
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (r.canceled) return;
    const asset = r.assets[0];
    if (!asset) return;
    const uri = asset.uri;
    setFoto(uri);
    setComentario('');
    add({ de: 'voce', foto: uri });
    setPasso('analisando');
    const [resultado, endereco] = await Promise.all([analisarFoto(uri), obterLocal()]);
    setAnalise(resultado);
    setLocal(endereco);
    if (resultado.status === 'risco_detectado') {
      add({ de: 'bot', analise: resultado });
      setPasso('confirmar');
    } else {
      add({ de: 'bot', texto: resultado.mensagem });
      setPasso('descricao');
    }
  }

  function confirmar(ok: boolean) {
    add({ de: 'voce', texto: ok ? 'Sim, é isso' : 'Não é isso' });
    if (ok) {
      add({ de: 'bot', texto: 'Pronto! Confere o resumo antes de enviar:' });
      setPasso('resumo');
    } else {
      add({ de: 'bot', texto: 'Sem problema. Descreva o que você vê na foto.' });
      setPasso('descricao');
    }
  }

  function descrever(texto: string) {
    add({ de: 'voce', texto });
    setComentario(texto.trim());
    add({ de: 'bot', texto: 'Pronto! Confere o resumo antes de enviar:' });
    setPasso('resumo');
  }

  function corrigir() {
    add({ de: 'bot', texto: 'Vamos corrigir. Tire uma nova foto.' });
    setPasso('foto');
  }

  async function despachar(relato: Relato) {
    if (envioEmCurso.current) return;
    envioEmCurso.current = true;
    setSalvando(true);
    setErroEnvio('');
    try {
      await salvarRelato(relato);
      setFichaTexto(montarFicha(relato));
      setEmergencia(false);
      setPasso('enviado');
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/entrar');
        return;
      }
      setErroEnvio(errorMessage(cause, 'Não foi possível salvar o relato. Tente novamente.'));
    } finally {
      envioEmCurso.current = false;
      setSalvando(false);
    }
  }

  function enviar() {
    if (!analise) return;
    void despachar({ usuario: nome, nivel, categoria: confirmado ? analise.categoria : null, descricao: confirmado ? analise.descricao : undefined, comentario, local, foto });
  }

  async function alertaEmergencia() {
    const endereco = await obterLocal();
    await despachar({ usuario: nome, nivel: 'N1', comentario: 'EMERGÊNCIA declarada pelo usuário, sem foto e não confirmada', local: endereco });
  }

  if (emergencia) {
    return (
      <Emergencia
        salvando={salvando}
        erro={erroEnvio}
        onAlerta={alertaEmergencia}
        onContinuar={() => {
          setEmergencia(false);
          if (passo === 'inicio') escolherInicio('Vejo algo perigoso na rede');
        }}
      />
    );
  }

  if (passo === 'enviado') {
    return (
      <Tela>
        <ScrollView contentContainerStyle={r.enviado}>
          <View style={r.check}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={r.titulo}>Relato enviado!</Text>
          <Text style={[s.suave, { textAlign: 'center', fontSize: 15 }]}>Seu relato foi salvo. Acompanhe a análise em Meus relatos, {nome}.</Text>
          <View style={r.pontos}>
            <Ionicons name="star-outline" size={16} color={cor.fundo} />
            <Text style={r.pontosTexto}>Pontos após a validação da equipe</Text>
          </View>
          <View style={[s.card, { width: '100%' }]}>
            <Text style={s.rotulo}>Enquanto a equipe não chega</Text>
            {SEGURANCA.map((linha) => (
              <Text key={linha} style={s.texto}>• {linha}</Text>
            ))}
          </View>
          <View style={{ width: '100%', gap: 10 }}>
            {foto ? <TouchableOpacity style={[s.principal, { flex: 0 }]} onPress={() => { void Sharing.shareAsync(foto).catch(() => setErroEnvio('Não foi possível compartilhar a foto.')); }}>
              <Text style={s.principalTexto}>Enviar a foto no WhatsApp</Text>
            </TouchableOpacity> : null}
            <TouchableOpacity style={[s.secundario, { flex: 0 }]} onPress={() => { void Linking.openURL(linkWhatsApp(fichaTexto)).catch(() => setErroEnvio('Não foi possível abrir o WhatsApp. Seu relato continua salvo.')); }}>
              <Text style={s.negrito}>Compartilhar ficha no WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.secundario, { flex: 0 }]} onPress={onVerRelato ?? onFechar}>
              <Text style={s.negrito}>{onVerRelato ? 'Ver meus relatos' : 'Voltar'}</Text>
            </TouchableOpacity>
          </View>
          {erroEnvio ? <Text accessibilityRole="alert" style={s.suave}>{erroEnvio}</Text> : null}
        </ScrollView>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho subtitulo="Relatar risco" onFechar={onFechar} onLigar={() => Linking.openURL(`tel:${EMERGENCIA.equatorial}`)} />
      <Faixa />
      <ScrollView ref={rolagem} contentContainerStyle={s.conteudo} onContentSizeChange={() => rolagem.current?.scrollToEnd()}>
        {itens.map((i) => (
          <View key={i.id} style={{ gap: 10 }}>
            {i.texto ? <Balao de={i.de}>{i.texto}</Balao> : null}
            {i.foto ? <Image source={{ uri: i.foto }} style={r.fotoChat} /> : null}
            {i.analise ? <CardAnalise analise={i.analise} onOuvir={() => Speech.speak(`${i.analise!.categoria}. ${i.analise!.descricao}`, { language: 'pt-BR' })} /> : null}
          </View>
        ))}
        {passo === 'analisando' ? <Balao de="bot">Analisando a foto...</Balao> : null}
        {passo === 'inicio' ? (
          <>
            <Chips opcoes={['Vejo algo perigoso na rede', 'Estou sem energia']} onEscolher={escolherInicio} />
            <CardEmergencia onPress={() => setEmergencia(true)} />
          </>
        ) : null}
        {passo === 'confirmar' ? (
          <>
            <Chips opcoes={['Sim, é isso', 'Não é isso']} onEscolher={(o) => confirmar(o === 'Sim, é isso')} />
            <CardLocal local={local.rotulo} />
          </>
        ) : null}
        {passo === 'resumo' && analise ? (
          <CardResumo
            foto={foto}
            linhas={[
              { icone: 'git-network-outline', rotulo: 'Risco', valor: confirmado ? analise.categoria ?? '' : 'Descrito por você' },
              ...(comentario ? [{ icone: 'chatbubble-outline' as const, rotulo: 'Comentário', valor: comentario }] : []),
              { icone: 'warning-outline', rotulo: 'Prioridade', valor: URGENCIA[nivel] },
              { icone: 'location-outline', rotulo: 'Bairro', valor: local.bairro },
            ]}
            pontos="Os pontos são concedidos depois que a equipe validar o relato"
            onCorrigir={corrigir}
            onEnviar={enviar}
            enviando={salvando}
          />
        ) : null}
        {erroEnvio ? <Text accessibilityRole="alert" style={s.suave}>{erroEnvio}</Text> : null}
      </ScrollView>
      <BarraEntrada
        placeholder={passo === 'descricao' ? 'Descreva o que você vê na foto' : 'Tire a foto com o botão da câmera'}
        onCamera={passo === 'foto' ? tirarFoto : undefined}
        onEnviar={passo === 'descricao' ? descrever : undefined}
      />
    </Tela>
  );
}

const r = StyleSheet.create({
  fotoChat: { width: 220, height: 160, borderRadius: 16, alignSelf: 'flex-end', borderWidth: 3, borderColor: cor.voce },
  enviado: { padding: 24, alignItems: 'center', gap: 16 },
  check: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#18B968', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  titulo: { color: cor.texto, fontSize: 30, fontWeight: '900' },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cor.amarelo, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pontosTexto: { color: cor.fundo, fontWeight: '800' },
});
