import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cor } from './theme';
import { Analise } from './api';
import { URGENCIA } from './config';

export function Tela({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.tela}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Cabecalho({ subtitulo, onFechar, onLigar }: { subtitulo: string; onFechar: () => void; onLigar: () => void }) {
  return (
    <View style={s.cabecalho}>
      <TouchableOpacity onPress={onFechar}>
        <Ionicons name="close" size={26} color={cor.texto} />
      </TouchableOpacity>
      <View style={s.avatar}>
        <Ionicons name="flash" size={20} color={cor.amarelo} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.titulo}>Guardião IA</Text>
        <Text style={s.suave}>{subtitulo}</Text>
      </View>
      <TouchableOpacity style={s.ligar} onPress={onLigar}>
        <Ionicons name="call" size={20} color={cor.vermelho} />
      </TouchableOpacity>
    </View>
  );
}

export function Faixa() {
  return (
    <View style={s.faixa}>
      <Ionicons name="shield-outline" size={18} color="#fff" />
      <Text style={s.faixaTexto}>Fique longe. Não toque em fios nem postes.</Text>
    </View>
  );
}

export function Balao({ de, children }: { de: 'bot' | 'voce'; children: React.ReactNode }) {
  const voce = de === 'voce';
  return (
    <View style={[s.balao, voce ? s.balaoVoce : s.balaoBot]}>
      {typeof children === 'string' ? <Text style={s.texto}>{children}</Text> : children}
    </View>
  );
}

export function Chips({ opcoes, onEscolher }: { opcoes: string[]; onEscolher: (o: string) => void }) {
  return (
    <View style={s.chips}>
      {opcoes.map((o) => (
        <TouchableOpacity key={o} style={s.chip} onPress={() => onEscolher(o)}>
          <Text style={s.chipTexto}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ChipModulo({ modulo }: { modulo: string }) {
  return (
    <View style={s.modulo}>
      <Ionicons name="book-outline" size={18} color={cor.agua} />
      <Text style={s.moduloTexto}>{modulo}</Text>
    </View>
  );
}

export function BarraEntrada({ placeholder, onEnviar, onCamera }: { placeholder: string; onEnviar?: (t: string) => void; onCamera?: () => void }) {
  const [texto, setTexto] = useState('');
  function enviar() {
    if (!texto.trim() || !onEnviar) return;
    onEnviar(texto);
    setTexto('');
  }
  return (
    <View style={s.barra}>
      <TouchableOpacity style={[s.camera, !onCamera && { opacity: 0.5 }]} disabled={!onCamera} onPress={onCamera}>
        <Ionicons name="camera" size={22} color={cor.fundo} />
      </TouchableOpacity>
      <TextInput
        style={s.campo}
        value={texto}
        onChangeText={setTexto}
        placeholder={placeholder}
        placeholderTextColor={cor.suave}
        onSubmitEditing={enviar}
        editable={!!onEnviar}
        returnKeyType="send"
      />
      <View style={s.mic}>
        <Ionicons name="mic" size={22} color={cor.suave} />
      </View>
    </View>
  );
}

export function CardEmergencia({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.emergencia} onPress={onPress}>
      <Ionicons name="warning-outline" size={26} color={cor.vermelho} />
      <View style={{ flex: 1 }}>
        <Text style={s.negrito}>Fio no chão, faísca ou fumaça?</Text>
        <Text style={s.suave}>É emergência. Toque aqui.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={cor.suave} />
    </TouchableOpacity>
  );
}

export function CardAnalise({ analise, onOuvir }: { analise: Analise; onOuvir: () => void }) {
  return (
    <View style={s.card}>
      <Text style={s.rotulo}>Analisei a foto</Text>
      <View style={s.tipo}>
        <View style={s.icone}>
          <Ionicons name="alert" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.negrito}>{analise.categoria}</Text>
          <Text style={s.suave}>Prioridade {URGENCIA[analise.nivel].toLowerCase()}</Text>
        </View>
      </View>
      <Text style={s.texto}>{analise.descricao} Está certo?</Text>
      <TouchableOpacity style={s.ouvir} onPress={onOuvir}>
        <Ionicons name="volume-medium-outline" size={16} color={cor.agua} />
        <Text style={s.moduloTexto}>Ouvir explicação</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CardLocal({ local }: { local: string }) {
  return (
    <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
      <Ionicons name="location-outline" size={22} color={cor.agua} />
      <View style={{ flex: 1 }}>
        <Text style={s.negrito}>{local}</Text>
        <Text style={s.suave}>Localização automática</Text>
      </View>
    </View>
  );
}

type Linha = { icone: keyof typeof Ionicons.glyphMap; rotulo: string; valor: string };

export function CardResumo({ foto, linhas, pontos, onCorrigir, onEnviar, enviando = false }: { foto: string; linhas: Linha[]; pontos: string; onCorrigir: () => void; onEnviar: () => void; enviando?: boolean }) {
  return (
    <View>
      <View style={s.card}>
        <Image source={{ uri: foto }} style={s.foto} />
        {linhas.map((l) => (
          <View key={l.rotulo} style={s.linha}>
            <Ionicons name={l.icone} size={20} color={cor.suave} />
            <Text style={[s.suave, { flex: 1, marginLeft: 10 }]}>{l.rotulo}</Text>
            <Text style={s.negrito}>{l.valor}</Text>
          </View>
        ))}
      </View>
      <View style={s.acoes}>
        <TouchableOpacity style={s.secundario} onPress={onCorrigir} disabled={enviando}>
          <Ionicons name="pencil" size={18} color={cor.texto} />
          <Text style={s.negrito}>Corrigir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.principal} onPress={onEnviar} disabled={enviando}>
          <Ionicons name="paper-plane-outline" size={18} color={cor.fundo} />
          <Text style={s.principalTexto}>{enviando ? 'Salvando…' : 'Enviar relato'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[s.suave, { textAlign: 'center', marginTop: 10 }]}>{pontos}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cor.balao, borderWidth: 1, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  titulo: { color: cor.texto, fontSize: 17, fontWeight: '700' },
  suave: { color: cor.suave, fontSize: 13 },
  ligar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: cor.vermelho, alignItems: 'center', justifyContent: 'center' },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cor.agua, paddingHorizontal: 16, paddingVertical: 10 },
  faixaTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  conteudo: { padding: 16, gap: 10 },
  balao: { maxWidth: '82%', padding: 14, borderRadius: 18 },
  balaoBot: { alignSelf: 'flex-start', backgroundColor: cor.balao },
  balaoVoce: { alignSelf: 'flex-end', backgroundColor: cor.voce },
  texto: { color: cor.texto, fontSize: 16, lineHeight: 22 },
  negrito: { color: cor.texto, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1.5, borderColor: cor.amarelo, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  chipTexto: { color: cor.amarelo, fontWeight: '700', fontSize: 14 },
  modulo: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: cor.balao, borderRadius: 14, padding: 14 },
  moduloTexto: { color: cor.agua, fontWeight: '700', fontSize: 14 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: cor.borda },
  camera: { width: 52, height: 52, borderRadius: 26, backgroundColor: cor.amarelo, alignItems: 'center', justifyContent: 'center' },
  campo: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 16, color: cor.texto, backgroundColor: cor.fundo },
  mic: { width: 48, height: 48, borderRadius: 24, backgroundColor: cor.balao, alignItems: 'center', justifyContent: 'center' },
  emergencia: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: cor.vermelho, borderRadius: 14, padding: 14, backgroundColor: cor.balao },
  card: { backgroundColor: cor.balao, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: cor.borda },
  rotulo: { color: cor.amarelo, fontSize: 12, fontWeight: '700' },
  tipo: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cor.borda, borderRadius: 14, padding: 10 },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F26B1D', alignItems: 'center', justifyContent: 'center' },
  ouvir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  foto: { width: '100%', height: 140, borderRadius: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  acoes: { flexDirection: 'row', gap: 12, marginTop: 14 },
  secundario: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: cor.borda, borderRadius: 14, paddingVertical: 14 },
  principal: { flex: 1.4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: cor.amarelo, borderRadius: 14, paddingVertical: 14 },
  principalTexto: { color: cor.fundo, fontSize: 15, fontWeight: '800' },
});
