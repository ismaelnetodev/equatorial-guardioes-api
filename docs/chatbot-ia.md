# Guardião IA: chatbot de dúvidas e relato

## O que está neste pacote

Os botões de criar relato abrem `/chat-reportar` em uma tela própria, fora da navbar. A navbar continua abrindo a lista de relatos. A confirmação do chat salva o registro pela API e oferece acesso a Meus relatos.

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

## Integração com o app

Em `apps/mobile/src/features/chatbot/adaptador.ts`:

1. `obterToken()` reutiliza `getAccessToken()` da sessão atual para autenticar as chamadas de IA.
2. `enviarRelato(relato)` converte os dados para o contrato gerado do OpenAPI e chama `createReport()`. A API associa o registro ao usuário do token, sem aceitar uma identidade escolhida pelo chat. N1/N2/N3 são convertidos para HIGH/MEDIUM/LOW.
3. O chat aguarda a gravação, bloqueia envios simultâneos e mostra os erros com possibilidade de tentar novamente. O backend mantém a exigência de concluir o módulo 0. A lista consulta novamente a API ao retornar.
4. Quando há foto, o app faz upload autenticado em `POST /api/v1/relatos/foto` antes de salvar o relato. A API recebe o campo multipart `foto`, valida e converte a imagem em JPEG e grava no bucket privado. A referência permanente retornada é enviada como `photoUrl` na criação. Sem localização, as coordenadas são enviadas como `null`.

## Armazenamento das fotos

Configure somente em `apps/api/.env`: `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` e `S3_REPORTS_BUCKET=relatos-imgs`. O bucket deve existir no endpoint configurado e pode permanecer privado. As credenciais nunca são enviadas ao aplicativo.

O upload exige sessão válida e conclusão do módulo inicial. São aceitos JPEG, PNG e WebP de até 10 MB e 25 milhões de pixels. A API remove metadados da câmera e limita a imagem a 2048 × 2048 pixels, preservando a proporção. O banco guarda uma referência `s3://bucket/chave`, sem necessidade de migration. As consultas do usuário e do admin retornam URLs assinadas válidas por uma hora, renovadas a cada consulta. Não grave esses links temporários no banco.

Se o upload falhar, o chat mantém o resumo e permite tentar novamente, sem confirmar o relato. Se a gravação do relato falhar depois do upload, a mesma foto é reaproveitada enquanto a tela/sessão estiver ativa. Fechar o aplicativo nesse intervalo pode deixar um objeto sem relato associado; a limpeza desses objetos ainda não é automática.

## Variáveis do app (`apps/mobile/.env`)

```
EXPO_PUBLIC_IA_URL=http://IP_DO_COMPUTADOR:8000
EXPO_PUBLIC_WHATSAPP_EQUATORIAL=55DDDNUMERO
```

Sem o número, o WhatsApp abre com a ficha pronta e o usuário escolhe o contato.

## Dependências do app

As dependências nativas usadas pelas telas estão declaradas em `apps/mobile/package.json` e no `package-lock.json` da raiz. Instale as dependências do monorepo com `npm ci` na raiz.

## Abrir as telas

O botão “?” no cabeçalho da tela de trilhas abre `/chat-duvidas`. Ao fechar o chat, o usuário retorna à tela anterior. As sugestões iniciais abordam o uso da plataforma, a liberação e o acompanhamento de relatos.

```
router.push('/chat-reportar')   // Fazer relato / Novo relato
router.push('/chat-duvidas')    // ajuda
```

## Fluxo do relato

Três opções (algo perigoso, sem energia ou emergência). A foto só pela câmera, nunca pela galeria. O Gemini classifica e define o nível (N1 a N3). Se não detectar, o usuário descreve a foto. Após confirmar, o relato é salvo na API; o usuário recebe orientações de segurança e pode compartilhar a ficha e a foto pelo WhatsApp, ou abrir Meus relatos. O alerta de emergência também é registrado na API.

## Ainda não incluído

- Limpeza automática de uploads que não chegaram a ser associados a um relato.
- Fila de prioridade com mover posição dentro do `/admin`. A API de relatos já exige o risco confirmado (`LOW`, `MEDIUM`, `HIGH`) ao resolver um relato; essa regra deve ser preservada na integração.

## Base de ajuda e índice

O guia `apps/ia/base_conhecimento/plataforma.md` contém os fluxos atuais do app e
é incluído integralmente no contexto de cada resposta, com prioridade sobre o PDF
antigo. Atualize esse guia quando os fluxos mudarem. O Dockerfile copia toda a pasta.

A coleção Chroma é identificada pelo hash do PDF, do guia e do modelo de embedding.
Mudanças nessas fontes geram uma nova coleção automaticamente, sem reutilizar o
índice antigo. Indexações interrompidas são retomadas pelos IDs dos trechos.
O índice é criado no primeiro acesso. Para preparar e conferir uma revisão antes
de enviar tráfego, execute dentro do container, em `/app`:

```sh
python -c "from rag import criar_banco_vetores; print(len(criar_banco_vetores().get()['ids']))"
```

`CHROMA_DB_DIR` permite apontar para um volume persistente; o padrão é `chroma_db`
ao lado de `rag.py`. Sem volume, cada container novo reconstrói o índice e usa a
API de embeddings. `/health` verifica apenas o processo HTTP, não Gemini/RAG.
Após o deploy, teste também `/duvidas` com uma sessão válida e as três sugestões
da tela. Não publique tokens de usuário nem a chave Gemini nos logs.

## Atenção

- O Gemini na camada grátis tem 20 solicitações por dia. Quando acaba, o chat avisa o usuário.
- O PDF contém informações antigas do produto. O guia atual tem prioridade para dúvidas de uso da plataforma.
