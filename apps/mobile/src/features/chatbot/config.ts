export const IA_URL = process.env.EXPO_PUBLIC_IA_URL ?? 'http://localhost:8000';

export const WHATSAPP_EQUATORIAL = process.env.EXPO_PUBLIC_WHATSAPP_EQUATORIAL ?? '';

export const EMERGENCIA = { equatorial: '116', bombeiros: '193', samu: '192' };

export const URGENCIA = { N1: 'Alta', N2: 'Média', N3: 'Baixa' } as const;
