import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tela, Cabecalho, Balao, ChipModulo, BarraEntrada, s } from '../components';
import { perguntar } from '../api';
import { EMERGENCIA } from '../config';
import { cor } from '../theme';

type Msg = { de: 'bot' | 'voce'; texto: string; modulo?: string | null };

const COMUNS = [
  'Cabo de internet também é perigoso?',
  'Como tirar uma boa foto do risco?',
  'Quantos pontos vale cada tipo de relato?',
];

export default function DuvidasChat({ nome, onFechar }: { nome: string; onFechar: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(false);
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);

  async function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || carregando) return;
    setMsgs((m) => [...m, { de: 'voce', texto: pergunta }]);
    setCarregando(true);
    try {
      const r = await perguntar(pergunta);
      setMsgs((m) => [...m, { de: 'bot', texto: r.resposta, modulo: r.modulo }]);
    } catch {
      setMsgs((m) => [...m, { de: 'bot', texto: 'Não consegui responder agora. Tente de novo em instantes.' }]);
    }
    setCarregando(false);
  }

  return (
    <Tela>
      <Cabecalho subtitulo="Tirar dúvidas" onFechar={onFechar} onLigar={() => Linking.openURL(`tel:${EMERGENCIA.equatorial}`)} />
      <ScrollView ref={rolagem} contentContainerStyle={s.conteudo} onContentSizeChange={() => rolagem.current?.scrollToEnd()}>
        <Balao de="bot">{`Oi, ${nome}! Pode perguntar sobre riscos na rede ou sobre o app.`}</Balao>
        <Text style={s.rotulo}>Perguntas comuns</Text>
        {COMUNS.map((p) => (
          <TouchableOpacity key={p} style={[s.card, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => enviar(p)}>
            <Text style={[s.texto, { flex: 1, fontSize: 15 }]}>{p}</Text>
            <Ionicons name="chevron-forward" size={20} color={cor.amarelo} />
          </TouchableOpacity>
        ))}
        {msgs.map((m, i) => (
          <View key={i} style={{ gap: 10 }}>
            <Balao de={m.de}>{m.texto}</Balao>
            {m.modulo ? <ChipModulo modulo={m.modulo} /> : null}
          </View>
        ))}
        {carregando ? <Balao de="bot">Buscando...</Balao> : null}
      </ScrollView>
      <BarraEntrada placeholder="Escreva sua dúvida" onEnviar={enviar} />
    </Tela>
  );
}
