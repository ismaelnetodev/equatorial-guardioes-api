# Aplicativo móvel

O app usa Expo Router e acessa o backend exclusivamente por HTTP. Os contratos TypeScript são gerados a partir do OpenAPI em `src/services/api.types.ts`; os clientes ficam em `src/features`.

## Telas implementadas e integração

As rotas da API abaixo usam o prefixo `/api/v1`.

| Tela/fluxo | Implementação e integração |
| --- | --- |
| Entrar (`/entrar`) | Integrada a `POST /entrar`; guarda o token de sessão.  Sem botão de Google nem recuperação de senha (não há endpoint). |
| Criar conta (`/cadastrar`) | Integrada a `GET /neighborhoods/` e `POST /cadastrar`; envia bairro, aceite dos termos e, quando informado, código de convite. Após o cadastro, retorna a `/entrar` com uma confirmação; a sessão começa somente após o login. |
| Introdução (`/introducao`) | Conteúdo local; direciona para trilha ou login conforme a sessão. |
| Trilha (`/trilha`) | Integrada a `GET /me`, `GET /trails/`, `GET /trails/:trailId`, `GET /progress/trails/:trailId`, `GET /progress/learning`, `POST /progress/learning-awards/claim` e `GET /trails/:trailId/completion`. Mostra progresso e pontos; a imagem de Lençóis fica restrita ao cabeçalho com o cartão de progresso. |
| Detalhe do módulo (`/modulo/:moduleId`) | Integrado a progresso e conteúdo do módulo. Ao iniciar ou continuar, atualiza o estado e abre a primeira etapa pendente: pré-teste, treinamento ou pós-teste. |
| Pré-teste, treinamento e avaliação do módulo (`/modulo/aprender`) | Integrados a `GET /modules/:moduleId/learn`, rotas de quiz pré e pós, `GET /modules/:moduleId/training` e `POST /modules/:moduleId/training/complete`. O pós-teste avalia a aprendizagem e sua aprovação é necessária para concluir módulos configurados com quiz; as respostas são vinculadas à tentativa iniciada pela API. |
| Resultado e conclusão do módulo (`/modulo/aprender`, `/modulo/conclusao`) | Exibem comparação entre pré e pós-teste, pontos e estado de conclusão retornados pelo backend, com banners dimensionados para manter a proporção das referências visuais. |
| Prova final e certificado (`/modulo/prova-final`) | Integrada a `GET/POST /trails/:trailId/final-exam`, `GET /trails/:trailId/completion` e `POST /trails/:trailId/certificate`; permite compartilhar o certificado emitido. |
| Pontos de aprendizado (`/pontos`) | Integrada a `GET /progress/learning`, `GET /progress/learning/history` e `POST /progress/learning-awards/claim`; mostra pontos liberados, pendentes e extrato paginado. Acesso disponível pela trilha e pelo perfil. |
| Perfil (`/perfil`) | Integrada a `GET /perfil`; mostra nome, bairro, nível, saldo, selos e quantidade de relatos; a caneta edita o nome via `PATCH /perfil` (bairro só pelo admin). O logout remove a sessão local. |
| Ranking (`/ranking`) | Integrado a `GET /ranking` e `GET /perfil`, com pódio e contribuição do bairro atual. A aba de cidade está identificada como Fase 2 porque não há endpoint de ranking por cidade. |
| Recompensas (`/recompensas`) | Integrada a `GET /recompensas` e `POST /recompensas/:key/resgatar`; o cartão de saldo usa o asset local `assets/Frame - azulejo amarelo.png`. |
| Convites (`/convidar`) | Integrada a `GET /convidar`; compartilha o código pelo recurso nativo do aparelho. O código de atribuição é enviado no cadastro. |
| Relatos (`/relatos`) | Integrada a `GET /relatos/` e `GET /relatos/impacto`. Mensagens de impacto confirmadas são marcadas como vistas por `POST /relatos/:reportId/impacto/visto`. |
| Detalhe do relato (`/relatos/:reportId`) | Integrado a `GET /relatos/:reportId`; mostra estado, pontos, foto disponível e linha do tempo. |
| Envio de relato (ação “Reportar” na trilha) | Integrado a `POST /relatos/`; a interface envia título, descrição e endereço (o bairro vai do cadastro ou do catálogo; o back faz fallback), e atualiza lista e perfil após o envio. O backend controla validação, estado e pontos. |
| Administração (`/admin`) | Usa os endpoints administrativos para gerenciar trilhas, módulos, conteúdo, quizzes, relatos e configurações de pontos/recompensas, conforme as permissões da conta. |
| Como funciona e termos (`/como-funciona`, `/termos`) | Conteúdo informativo local; não há endpoints próprios para essas páginas. |

## Compilado do desenvolvimento local

- **Acesso e cadastro:** login e criação de conta integrados à API; validação de nome, contato, senha de pelo menos 8 caracteres, bairro, aceite dos termos e convite opcional, com erros junto aos campos.
- **Trilha e aprendizagem:** progresso e pontos carregados da API; o módulo abre a primeira etapa pendente. Pré/pós-testes, avaliação, treinamento e feedback usam as tentativas retornadas pela API. A conclusão do módulo exige aprovação no pós-teste quando há quiz; pontos que excedem os limites diários aparecem como pendentes no saldo do usuário.
- **Perfil, ranking e recompensas:** perfil e selos integrados; ranking por bairro e contribuição conectados à API; recompensas e pontos ligados aos endpoints disponíveis. Ranking por cidade permanece como Fase 2, pois não há endpoint correspondente.
- **Relatos, convites e certificado:** fluxos conectados às rotas existentes, incluindo envio e acompanhamento de relatos, compartilhamento de convites e emissão/compartilhamento de certificado.
- **Interface e navegação:** cabeçalho da trilha, banners nas proporções das referências, azulejo amarelo em recompensas, imagem do quiz não interativa, retorno entre cards da introdução, destaque correto do menu inferior e campos de texto com apenas a borda externa.
- **Validação e estados de tela:** erros de cadastro apresentados nos campos, carregamentos/falhas tratados no mobile e SVGs decorativos ajustados para evitar o aviso de acessibilidade no Expo Web.

Estas alterações são somente no frontend em `apps/mobile`; nenhum endpoint, schema ou regra do backend foi alterado.

## O que falta ou está limitado

- **Recuperação/redefinição de senha do usuário:** não há endpoint público para solicitar redefinição ou concluir a troca. O endpoint administrativo de senha não substitui esse fluxo.
- **Edição do perfil e avatar:** só o nome é editável (`PATCH /perfil`); bairro e foto não têm edição pelo app.
- **Login com Google:** ainda não está implementado no app nem integrado a um endpoint de autenticação social.
- **Mídia e localização no envio de relatos:** o formulário atual não captura foto, coordenadas ou urgência. Embora o contrato de criação aceite dados opcionais relacionados ao relato, não há fluxo de captura/envio de mídia no app.
- **Conteúdo de trilhas e quizzes:** as telas não inventam perguntas ou respostas; dependem do conteúdo publicado e configurado pela administração. A ausência de conteúdo é apresentada como estado da API.
- **Dados de termos e privacidade:** o conteúdo atual é informativo e estático; não existe endpoint de publicação/versão dos termos.

## Desenvolvimento e verificações

Na raiz do monorepo:

```sh
npm run dev:mobile
npm run typecheck --workspace apps/mobile
npm run build --workspace apps/mobile
```

Para executar a suíte definida pelo monorepo, use `npm test` na raiz. Os testes do backend dependem da configuração local de serviços e banco de dados.

Instale/restaure dependências usando apenas o `package-lock.json` da raiz (`npm ci`).
