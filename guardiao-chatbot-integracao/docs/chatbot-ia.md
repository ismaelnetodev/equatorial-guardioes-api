# Guardião IA: chatbot de dúvidas e relato

## O que está neste pacote

- `apps/ia`: serviço Python (FastAPI + Gemini). Rotas `POST /duvidas` (RAG sobre o PDF do programa) e `POST /risco/analisar` (o Gemini classifica a foto em uma das 7 categorias). Não tem login nem banco próprio: cada chamada repassa o token Bearer para `GET {API_BASE_URL}/me` e só aceita se a API do app responder 200.
- `apps/mobile/src/features/chatbot`: telas e serviços do chat, no visual do Figma.
- `apps/mobile/src/app/chat-duvidas.tsx` e `chat-reportar.tsx`: rotas do Expo Router que abrem as duas telas.

## Rodar o serviço de IA

```
cd apps/ia
python -m venv .venv && source .venv/bin/activate   # no Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # e preencha GEMINI_API_KEY
uvicorn main:app --host 0.0.0.0 --reload
```

O `.env` não é versionado. O repositório é público, então nunca suba a chave do Gemini.

## Ligar ao app (duas funções)

Em `apps/mobile/src/features/chatbot/adaptador.ts`:

1. `obterToken()`: devolver o token Bearer da sessão atual, o mesmo do login. Hoje devolve vazio, e o chat avisa que a sessão expirou até isso ser ligado.
2. `enviarRelato(relato)`: salvar o relato pela API de relatos do app. Hoje não faz nada; a ficha continua indo para o WhatsApp.

## Variáveis do app (`apps/mobile/.env`)

```
EXPO_PUBLIC_IA_URL=http://IP_DO_COMPUTADOR:8000
EXPO_PUBLIC_WHATSAPP_EQUATORIAL=55DDDNUMERO
```

Sem o número, o WhatsApp abre com a ficha pronta e o usuário escolhe o contato.

## Dependências do app

```
cd apps/mobile
npx expo install expo-image-picker expo-location expo-speech expo-sharing react-native-safe-area-context
```

## Abrir as telas

```
router.push('/chat-reportar')   // botão Reportar
router.push('/chat-duvidas')    // ajuda
```

## Fluxo do relato

Três opções (algo perigoso, sem energia ou emergência). A foto só pela câmera, nunca pela galeria. O Gemini classifica e define o nível (N1 a N3). Se não detectar, o usuário descreve a foto. A ficha vai para o WhatsApp da Equatorial e o usuário recebe a mensagem de segurança.

## Ainda não incluído

- Salvar o relato pela API de relatos (função `enviarRelato`).
- Fila de prioridade com mover posição, dentro do `/admin`, e o botão Resolvido pedindo o risco confirmado (`LOW`, `MEDIUM`, `HIGH`). Isso muda o `schema.prisma` e as rotas de relatos da API, e eu ainda não vi esses arquivos.

## Atenção

- O Gemini na camada grátis tem 20 solicitações por dia. Quando acaba, o chat avisa o usuário.
- O PDF do RAG diz que o app é um PWA. Corrija o PDF e apague `apps/ia/chroma_db` para refazer a base.
