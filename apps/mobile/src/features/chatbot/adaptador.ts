import { useEffect, useState } from 'react';
import type { Relato } from './api';
import { getAccessToken } from '../../services/session';
import { getCurrentUser } from '../auth/auth.api';
import { createReport, type CreateReportBody } from '../reports/reports.api';

export async function obterToken(): Promise<string> {
  return (await getAccessToken()) ?? '';
}

export async function enviarRelato(relato: Relato) {
  const prioridades = { N1: 'HIGH', N2: 'MEDIUM', N3: 'LOW' } as const;
  const body: CreateReportBody = {
    title: relato.categoria?.trim() || 'Risco na rede elétrica',
    description: relato.comentario?.trim() || relato.descricao?.trim() || 'Risco informado pelo usuário.',
    address: relato.local.rotulo.trim() || 'Local não identificado',
    neighborhood: relato.local.bairro.trim() || 'Não identificado',
    urgency: prioridades[relato.nivel],
    latitude: relato.local.lat === 0 && relato.local.lng === 0 ? null : relato.local.lat,
    longitude: relato.local.lat === 0 && relato.local.lng === 0 ? null : relato.local.lng,
  };
  // A URI da câmera é local ao aparelho. photoUrl exige upload para um endereço público.
  return createReport(body);
}

export async function obterNome(): Promise<string> {
  try {
    const dados = await getCurrentUser();
    const nome = dados.name;
    return String(nome).split(' ')[0] ?? 'Guardião';
  } catch {
    return 'Guardião';
  }
}

export function useNomeUsuario() {
  const [nome, setNome] = useState('Guardião');
  useEffect(() => {
    obterNome().then(setNome);
  }, []);
  return nome;
}
