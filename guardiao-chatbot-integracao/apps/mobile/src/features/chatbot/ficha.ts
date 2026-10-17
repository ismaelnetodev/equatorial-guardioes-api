import { URGENCIA, WHATSAPP_EQUATORIAL } from './config';
import { Relato } from './api';

export function montarFicha(r: Relato) {
  const risco = r.comentario
    ? `Comentário do usuário: ${r.comentario}`
    : `Risco detectado pela IA: ${r.categoria}. ${r.descricao}`;
  const mapa = r.local.lat ? `https://maps.google.com/?q=${r.local.lat},${r.local.lng}` : 'não disponível';
  return [
    `GUARDIÕES DA ENERGIA · Prioridade ${r.nivel} (${URGENCIA[r.nivel]})`,
    `Usuário: ${r.usuario}`,
    risco,
    `Bairro: ${r.local.bairro}`,
    `Localização: ${mapa}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    r.foto ? 'Foto: enviada em seguida' : 'Sem foto',
  ].join('\n');
}

export const linkWhatsApp = (texto: string) => `https://wa.me/${WHATSAPP_EQUATORIAL}?text=${encodeURIComponent(texto)}`;
