# Integração das telas da trilha

## Entregue

| Tela ou comportamento | Fonte real |
| --- | --- |
| Trilha e estados dos módulos | `GET /api/v1/trails/`, `GET /api/v1/trails/{trailId}` e progresso autenticado |
| Detalhe, sequência das etapas, notas e pontos do módulo | `GET /api/v1/modules/{moduleId}/learn` |
| Iniciar e concluir módulo | `POST /api/v1/progress/modules/{moduleId}/start` e `/complete` |
| Pré-teste e resultado | `GET/POST /api/v1/modules/{moduleId}/quiz/pre`, `GET .../pre/resultado` |
| Conteúdo estruturado e conclusão do treinamento | `GET /api/v1/modules/{moduleId}/training`, `POST .../training/complete` |
| Pós-teste, feedback e resultado | `GET .../quiz/pos`, `POST .../pos/answers`, `POST .../pos/finish`, `GET .../pos/resultado` |
| Reportar bloqueado | Primeiro módulo da trilha selecionada ainda não concluído; validação efetiva permanece no backend |

Erros da API, incluindo configuração pendente, conteúdo vazio, tempo mínimo e intervalo entre tentativas, são exibidos sem conceder progresso local. Erros de autenticação levam ao login. Etapas concluídas podem ser consultadas novamente. Perguntas e alternativas usam os IDs da API, sem gabarito local.

## Pendências para próximas entregas

| Prioridade | Dado ou recurso faltante | Implementação posterior e critério de aceite |
| --- | --- | --- |
| Alta | Retomada inequívoca do pós-teste | Hoje o contrato retorna `answeredCount` e todas as perguntas, sem IDs respondidos. A interface percorre as perguntas em ordem e retoma pelo contador. Expor `answeredQuestionIds` ou apenas perguntas pendentes; validar retomada após respostas por outro cliente e após falha de rede. |
| Alta | Conteúdo cadastrado | Popular perguntas, alternativas, explicações e etapas/cards dos módulos reais, além das regras exigidas pelo serviço. Validar o fluxo completo com um usuário comum e conteúdo publicado. Sem isso a UI mostra a mensagem de ausência/configuração da API; não fabrica perguntas. |
| Média | Saldo global, patente e próxima meta | Expor saldo agregado autenticado, patente e limiar da próxima patente. A trilha ainda usa “Em breve”; `learn.totalPoints` é pontuação do módulo, não saldo da conta. |
| Média | Pontuação possível e melhor nota histórica | Expor máximo configurado por módulo e melhor tentativa explicitamente. A UI mostra pontos recebidos/pendentes e resultado retornado; não calcula o máximo nem chama a última nota de “melhor”. |
| Média | Progresso de leitura persistente | Não há etapa/card atual salvo. O treinamento reinicia a leitura ao reabrir; somente a conclusão inteira é persistida. Expor posição por usuário/módulo para retomada e percentual reais. |
| Média | Objetivos e ilustração próprios do módulo | Expor objetivos e identificação/URL de arte no catálogo. Hoje são usados bullets do conteúdo ou descrição e ícones locais conforme posição, compatíveis com as referências fornecidas. |
| Próxima tela | Relatos, ranking e perfil completo | Relatos já possuem API, mas o formulário não integra o escopo das três referências atuais. Ranking segue sem endpoint integrado. Perfil exibe os dados de `/me` e logout. Criar telas e contratos conforme suas referências, sem tratar existência de relato como ausência de API. |

## Verificação manual com dados reais

1. Entrar com usuário comum e abrir módulo disponível; iniciar o pré-teste.
2. Responder e consultar resultado; voltar ao detalhe e confirmar desbloqueio do treinamento.
3. Ler as etapas, concluir e confirmar desbloqueio do pós-teste.
4. Responder ao pós-teste, conferir feedback, resultado e pontos da API.
5. Concluir módulo aprovado; retornar à trilha e confirmar liberação do próximo módulo.
6. Verificar mensagens de configuração ausente, falta de perguntas, tempo mínimo e intervalo de repetição.
7. Conferir layout no Expo Go, inclusive tamanho de fonte ampliado e áreas seguras do iPhone.

Build e TypeScript verificam a integração estática. Testes da API usam banco simulado; não substituem os passos acima em um banco populado ou a inspeção física no celular.
