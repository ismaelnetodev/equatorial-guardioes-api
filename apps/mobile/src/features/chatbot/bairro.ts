import { getNeighborhoods } from '../auth/neighborhoods.api';
import { getProfile } from '../community/community.api';

// Mesma normalização do servidor: sem espaços extras, sem acentos e em minúsculas.
export function normalizarBairro(texto: string) {
  return texto.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export type BairroResolvido = { nome: string; id?: string };

/**
 * Define o bairro do relato:
 * 1. o bairro detectado pelo GPS, quando existe no catálogo de São Luís (envia o id);
 * 2. senão, o bairro do cadastro do usuário (o servidor aceita esse texto sem catálogo).
 * Nunca devolve "Não identificado": sem resposta, o relato segue o bairro do cadastro.
 */
export async function resolverBairro(detectado: string): Promise<BairroResolvido | null> {
  const alvo = normalizarBairro(detectado);
  if (alvo && alvo !== 'nao identificado') {
    try {
      const { neighborhoods } = await getNeighborhoods();
      const achado = neighborhoods.find(item => normalizarBairro(item.name) === alvo);
      if (achado) return { nome: achado.name, id: achado.id };
    } catch {
      // Sem catálogo agora: cai para o bairro do cadastro.
    }
  }
  try {
    const perfil = await getProfile();
    return perfil.neighborhood.trim() ? { nome: perfil.neighborhood.trim() } : null;
  } catch {
    return null;
  }
}
