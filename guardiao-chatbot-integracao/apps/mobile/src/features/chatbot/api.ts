import * as Location from 'expo-location';
import { IA_URL } from './config';
import { enviarRelato, obterToken } from './adaptador';

export type Nivel = 'N1' | 'N2' | 'N3';

export type Analise = {
  status: 'risco_detectado' | 'sem_deteccao' | 'cota_esgotada';
  mensagem: string;
  descricao: string;
  categoria: string | null;
  nivel: Nivel;
};

export type Local = { rotulo: string; bairro: string; lat: number; lng: number };

export type Relato = {
  usuario: string;
  nivel: Nivel;
  categoria?: string | null;
  descricao?: string;
  comentario?: string;
  local: Local;
  foto?: string;
};

const SEM_DETECCAO: Analise = {
  status: 'sem_deteccao',
  mensagem: 'Não foi possível detectar o seu risco. Descreva o que você vê na foto.',
  descricao: '',
  categoria: null,
  nivel: 'N3',
};

async function auth() {
  return { Authorization: `Bearer ${await obterToken()}` };
}

export async function perguntar(pergunta: string) {
  const r = await fetch(`${IA_URL}/duvidas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await auth()) },
    body: JSON.stringify({ pergunta }),
  });
  if (r.status === 401) return { resposta: 'Sua sessão expirou. Entre de novo para continuar.', modulo: null };
  if (!r.ok) throw new Error('falha');
  return (await r.json()) as { resposta: string; modulo: string | null };
}

export async function analisarFoto(uri: string): Promise<Analise> {
  try {
    const dados = new FormData();
    dados.append('foto', { uri, name: 'foto.jpg', type: 'image/jpeg' } as any);
    const r = await fetch(`${IA_URL}/risco/analisar`, { method: 'POST', headers: await auth(), body: dados });
    if (!r.ok) return SEM_DETECCAO;
    return await r.json();
  } catch {
    return SEM_DETECCAO;
  }
}

export async function salvarRelato(relato: Relato) {
  await enviarRelato(relato);
}

export async function obterLocal(): Promise<Local> {
  const vazio = { rotulo: 'Local não identificado', bairro: 'Não identificado', lat: 0, lng: 0 };
  try {
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (permissao.status !== 'granted') return vazio;
    const posicao = await Location.getCurrentPositionAsync({});
    const [e] = await Location.reverseGeocodeAsync(posicao.coords);
    const bairro = e?.district || e?.subregion || 'Não identificado';
    const rotulo = [e?.street, e?.district].filter(Boolean).join(' · ') || bairro;
    return { rotulo, bairro, lat: posicao.coords.latitude, lng: posicao.coords.longitude };
  } catch {
    return vazio;
  }
}
