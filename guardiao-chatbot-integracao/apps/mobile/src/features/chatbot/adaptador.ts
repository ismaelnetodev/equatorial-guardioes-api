import { useEffect, useState } from 'react';
import type { Relato } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// LIGAR À SESSÃO DO APP: devolva o token Bearer da sessão atual, o mesmo do login.
export async function obterToken(): Promise<string> {
  return '';
}

// LIGAR À API DE RELATOS: salve o relato no backend do app. Hoje não faz nada.
export async function enviarRelato(relato: Relato): Promise<void> {}

export async function obterNome(): Promise<string> {
  try {
    const r = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${await obterToken()}` } });
    const dados = await r.json();
    const nome = dados?.name ?? dados?.nome ?? dados?.user?.name ?? dados?.user?.nome ?? 'Guardião';
    return String(nome).split(' ')[0];
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
