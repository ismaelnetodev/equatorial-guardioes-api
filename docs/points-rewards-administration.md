# Administração de pontos e recompensas

As configurações iniciais vêm de `Guardioes_da_Energia_Recompensas_v2.md`.
A migration `20261016210000_program_configuration` cria e popula as tabelas
`ProgramConfiguration` e `ProgramConfigurationChange`. Aplique com
`npm run db:deploy` na raiz, com `apps/api/.env` configurado para PostgreSQL.
Não há seed em cada inicialização: reiniciar ou gerar o Prisma não sobrescreve
valores administrativos.

## Operações

Base: `/api/v1/admin/points-rewards`.

| Método | Caminho | Operação |
| --- | --- | --- |
| GET | `/rules` | Lista regras de pontuação, incluindo inativas. |
| PATCH | `/rules/:key` | Altera pontos e/ou ativa/desativa uma regra. |
| GET | `/rewards` | Lista recompensas, incluindo inativas. |
| PATCH | `/rewards/:key` | Altera custo em pontos e/ou ativa/desativa recompensa. |
| GET | `/limits` | Lista limites e parâmetros, incluindo os pendentes. |
| PATCH | `/limits/:key` | Define/atualiza valor e/ou ativa/desativa parâmetro. |
| GET | `/history` | Consulta auditoria de todas as categorias. |

As consultas retornam `key`, `kind`, `name`, `description`, `value`, `unit`,
`isActive` e `updatedAt`. A chave identifica o registro de forma estável.
Os critérios qualitativos do documento estão nas descrições. Valores e ativação
ficam no banco, sem constantes de pontuação nos serviços.

Exemplo de corpo de PATCH em `/rules/report_low`:

```json
{
  "value": 15,
  "isActive": true,
  "reason": "Revisão aprovada pela equipe"
}
```

`value` e `isActive` são opcionais individualmente, mas ao menos um deve ser
enviado. `reason` é opcional. Inteiros devem ser não negativos e caber em um
INTEGER PostgreSQL; percentuais ficam entre 0 e 100. Um valor definido não pode
ser apagado com `null`; para suspender sua aplicação, use `isActive: false`.
O certificado não possui preço em pontos: seu critério é concluir a trilha,
e somente sua ativação pode ser alterada.

O histórico aceita `kind` (`RULE`, `REWARD`, `LIMIT`), `key`, `offset` (padrão 0)
e `limit` (padrão 50, máximo 100). Retorna os registros mais recentes primeiro,
com desempate por ID. Paginação por offset pode deslocar páginas quando houver
novas alterações. Cada registro contém snapshots completos `before` e `after`,
`actorId`, `reason` e `createdAt`. A carga inicial tem `before: null` e
`actorId: null`, identificada pelo motivo da migração. Requisições que não mudam
o estado não criam registros de alteração.

## Permissões e consistência

Todas as rotas, inclusive consultas e histórico, exigem o Bearer token do login
existente e papel `ADMIN` consultado no banco a cada requisição. Falta de sessão
retorna 401; usuário sem permissão retorna 403. O autor da auditoria vem da
sessão, nunca do corpo enviado. Não há endpoint para promover usuários; utilize
o procedimento operacional existente de atribuição do papel `ADMIN`.

A alteração e a auditoria são gravadas na mesma transação serializável. Se a
auditoria falhar, a alteração é revertida. Conflitos concorrentes retornam 409;
consulte os valores atuais antes de tentar novamente. Chave inexistente ou de
outra categoria retorna 404; restrições semânticas retornam 422; entradas
inválidas retornam 400. Não há endpoints para editar ou excluir a auditoria.
IDs de autores são snapshots sem FK, preservando identificação mesmo após
exclusão da conta. O acesso direto ao banco deve ser restrito operacionalmente.

## Valores e dependências

- Regras: módulo 2; quiz do módulo 0; prova final 10; melhoria no pós-teste 6;
  quiz do bairro 1; relatos baixo/médio/alto 10/25/50; bônus preventivo 10;
  inválido de boa-fé e duplicado 0.
- Limites: 2 módulos e 4 pontos de treino/dia; aprovação 80%; permanência
  aproximadamente 70%; prova final após 24 horas; concessão única pela prova
  final na trilha e pela melhoria no pós-teste; 3 quizzes do bairro/dia e
  20 pontos/mês; 2 relatos validados para resgate; 2 relatos pontuados/dia,
  10/mês; 1 prêmio físico/trimestre.
- Recompensas: certificado por conclusão da trilha; cupom 200; chaveiro 350;
  camiseta/kit 700; visita 900; vale-compra 1200; bolsa/mochila 1800; ação
  coletiva 2500 pontos do bairro; crédito fixo na fatura 3500, **desativado**.
  Ventilador e créditos percentuais não são cadastrados.
- Intervalo de tentativas, orçamento por campanha, estoque de mochilas e teto
  anual de crédito não têm valores numéricos definidos na fonte: começam com
  `value: null`, que significa **pendente de definição**, nunca zero ou ilimitado.
  O teto anual do crédito também começa desativado. R$ 20 é apenas exemplo da
  fonte, sem configurar um benefício confirmado. O crédito depende de aprovação
  formal externa; o módulo não implementa um fluxo de aprovação.

O módulo admin continua responsável só pela configuração. A execução do livro de
pontos, saldo, ranking, resgates e convites do learner fica no módulo
**Community** (`/api/v1/ranking`, `/recompensas`, `/convidar`, `/perfil`), com
`PointAccount` / `PointLedgerEntry` / `RewardRedemption` / `InviteAttribution`.

Créditos (quiz, relatos, convite no módulo 0) aumentam `accumulated` e `balance`.
Resgates debitam **somente** `balance` (`affectsAccumulated: false`), sem alterar
nível nem ranking. O catálogo learner usa configs `kind=REWARD` ativas; o limite
`redemption_validated_reports` exige relatos `RESOLVED` antes do resgate. Convites
usam `invite_module0_reward` e `invite_reward_limit`; níveis usam
`level_*_threshold` sobre pontos acumulados.

Ainda não há campanhas, estoque operacional, estornos administrativos nem
ajustes manuais de saldo. Alterar configuração não recalcula concessões
históricas: cada lançamento do ledger preserva o valor aplicado no momento da
operação.

Os testes HTTP usam persistência simulada, como os demais testes do repositório;
verificam autorização, validação, snapshots, rollback e conflitos. Eles não
substituem a validação da migration em PostgreSQL antes do deploy.
