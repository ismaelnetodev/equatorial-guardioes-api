import { useEffect, useState } from 'react';
import type { Relato } from './api';
import { getAccessToken } from '../../services/session';
import { getCurrentUser } from '../auth/auth.api';
import { ApiError } from '../../services/api';
import { createReport, uploadReportPhoto, type CreateReportBody } from '../reports/reports.api';

// Reaproveita o upload ao tentar novamente após uma falha na gravação do relato.
let uploadedPhoto: { uri: string; token: string; reference: string } | null = null;

export async function obterToken(): Promise<string> {
  return (await getAccessToken()) ?? '';
}

export async function enviarRelato(relato: Relato) {
  let photoUrl: string | undefined;
  if (relato.foto) {
    const token = await obterToken();
    if (uploadedPhoto?.uri !== relato.foto || uploadedPhoto.token !== token) {
      const result = await uploadReportPhoto(relato.foto);
      uploadedPhoto = { uri: relato.foto, token, reference: result.photoUrl };
    }
    photoUrl = uploadedPhoto.reference;
  }
  const prioridades = { N1: 'HIGH', N2: 'MEDIUM', N3: 'LOW' } as const;
  const bairroTexto = relato.local.bairro.trim();
  const bairro = bairroTexto && bairroTexto !== 'Não identificado' ? bairroTexto : '';
  const body: CreateReportBody = {
    title: relato.categoria?.trim() || 'Risco na rede elétrica',
    description: relato.comentario?.trim() || relato.descricao?.trim() || 'Risco informado pelo usuário.',
    address: relato.local.rotulo.trim() || 'Local não identificado',
    // Bairro só vai quando é conhecido (catálogo ou cadastro); sem ele o servidor usa o bairro do cadastro.
    ...(bairro ? { neighborhood: bairro } : {}),
    ...(relato.local.bairroId ? { neighborhoodId: relato.local.bairroId } : {}),
    urgency: prioridades[relato.nivel],
    latitude: relato.local.lat === 0 && relato.local.lng === 0 ? null : relato.local.lat,
    longitude: relato.local.lat === 0 && relato.local.lng === 0 ? null : relato.local.lng,
    ...(photoUrl ? { photoUrl } : {}),
  };
  try {
    const result = await createReport(body);
    uploadedPhoto = null;
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_PHOTO') uploadedPhoto = null;
    throw error;
  }
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
