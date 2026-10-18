import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EMERGENCIA } from '../config';
import { cor } from '../theme';

export default function Emergencia({ onContinuar, onAlerta, salvando = false, erro = '' }: { onContinuar: () => void; onAlerta: () => void; salvando?: boolean; erro?: string }) {
  const ligar = (numero: string) => Linking.openURL(`tel:${numero}`);
  return (
    <SafeAreaView style={e.tela}>
      <View style={e.icone}>
        <Ionicons name="warning" size={44} color={cor.vermelho} />
      </View>
      <Text style={e.titulo}>Afaste-se.{'\n'}Não toque{'\n'}no fio.</Text>
      <Text style={e.texto}>Pode estar energizado, mesmo parecendo desligado. Avise quem estiver perto.</Text>
      <TouchableOpacity style={e.ligar} onPress={() => ligar(EMERGENCIA.equatorial)}>
        <Ionicons name="call-outline" size={20} color={cor.fundo} />
        <Text style={e.ligarTexto}>Ligar {EMERGENCIA.equatorial} agora</Text>
      </TouchableOpacity>
      <TouchableOpacity style={e.alerta} onPress={onAlerta} disabled={salvando}>
        <Text style={e.outroTexto}>{salvando ? 'Salvando…' : 'Registrar alerta'}</Text>
      </TouchableOpacity>
      {erro ? <Text accessibilityRole="alert" style={e.texto}>{erro}</Text> : null}
      <View style={e.linha}>
        <TouchableOpacity style={e.outro} onPress={() => ligar(EMERGENCIA.bombeiros)}>
          <Text style={e.outroTexto}>Bombeiros {EMERGENCIA.bombeiros}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={e.outro} onPress={() => ligar(EMERGENCIA.samu)}>
          <Text style={e.outroTexto}>SAMU {EMERGENCIA.samu}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onContinuar} disabled={salvando}>
        <Text style={e.continuar}>Já estou longe, continuar relato</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.vermelho, padding: 24, justifyContent: 'center', alignItems: 'center', gap: 20 },
  icone: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  titulo: { color: '#fff', fontSize: 40, fontWeight: '900', textAlign: 'center', lineHeight: 44 },
  texto: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 22 },
  ligar: { flexDirection: 'row', gap: 8, width: '100%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 16, justifyContent: 'center' },
  ligarTexto: { color: cor.fundo, fontSize: 17, fontWeight: '800' },
  linha: { flexDirection: 'row', gap: 12, width: '100%' },
  outro: { flex: 1, borderWidth: 1.5, borderColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  alerta: { width: '100%', borderWidth: 1.5, borderColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  outroTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  continuar: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 8 },
});
