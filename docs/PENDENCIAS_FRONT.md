# Pendências front/mobile (contrato da branch `melhorias`)

Escopo: só o que o app precisa consumir. Detalhes do back em `docs/MELHORIAS_BACKEND.md` seção 4.
Não altere este arquivo a partir do mobile; é handoff do back para o front.

---

## 1. Cadastro voltando para login (sem `login()`)

**Problema (testador):** após cadastrar, o app autenticava sozinho e seguia logado.

**Back já entrega**

- Rota: `POST /api/v1/cadastrar`
- Resposta 201 sem token:

```json
{
  "message": "Cadastro realizado com sucesso.",
  "user": {
    "id": "uuid",
    "name": "Ana",
    "email": "ana@exemplo.com",
    "neighborhood": "Cohama",
    "role": "USER"
  }
}
```

- Login continua exclusivo de `POST /api/v1/entrar` (aí vem `accessToken`).

**Front precisa**

- Em `cadastrar.tsx`, não chamar `login()` após 201.
- Navegar para `/entrar` e autenticar só lá.

---

## 2. Aba Reportar usando `canReport`

**Problema:** cadeado/liberação da aba Reportar não refletia a regra do servidor.

**Back já entrega**

- `GET /api/v1/perfil` e `GET /api/v1/progress/trails/:trailId` incluem `canReport: boolean`.
- Exemplo (perfil):

```json
{
  "name": "Ana",
  "neighborhood": "Cohama",
  "level": "GUARDIAO",
  "accumulated": 12,
  "balance": 12,
  "canReport": true,
  "badges": { "modulesCompleted": 1, "modulesPublished": 4 },
  "reportsCount": 0,
  "shortcuts": {
    "ranking": "/ranking",
    "rewards": "/recompensas",
    "invite": "/convidar",
    "reports": "/relatos"
  }
}
```

- `canReport: true` somente após concluir o módulo inicial da trilha (mesma regra do guard de `POST /api/v1/relatos`).

**Front precisa**

- Liberar a aba Reportar com `canReport` do perfil/progresso, não só com estado local.

---

## 3. Ícone editar perfil chama `PATCH /api/v1/perfil` (somente `name`)

**Problema:** ícone de editar não persistia o nome.

**Back já entrega**

- Rota: `PATCH /api/v1/perfil`
- Request:

```json
{ "name": "Ana Silva" }
```

- Resposta: mesmo formato de `GET /api/v1/perfil` (inclui `canReport`).
- Body com `neighborhood` / `neighborhoodId` é rejeitado (`additionalProperties: false`). Troca de bairro só no admin.

**Front precisa**

- Ligar o ícone/caneta a este PATCH só com `name`.

---

## 4. Mensagem para `pointsCapped` / `capReason` / `pendingPoints`

**Problema:** usuário atinge limite diário e não entende onde foram os pontos.

**Back já entrega**

- `POST /api/v1/modules/:moduleId/training/complete` e `POST /api/v1/progress/modules/:moduleId/complete` podem retornar:

```json
{
  "moduleId": "uuid",
  "completed": true,
  "pointsAwarded": 0,
  "pointsCapped": true,
  "capReason": "DAILY_LIMIT",
  "pendingPoints": 5
}
```

- Claim (libera o que cabe no teto do dia, `America/Sao_Paulo`):

`POST /api/v1/progress/learning-awards/claim`

```json
{ "pointsReleased": 4, "pendingPoints": 2 }
```

- Saldo: `GET /api/v1/progress/learning` (já tem `pendingPoints`).

**Front precisa**

- Se `pointsCapped` / `capReason: "DAILY_LIMIT"`, avisar que pontos entraram na fila e saem no dia seguinte (ou após claim / visita à tela de pontos).
- Opcional: mostrar `pendingPoints` na UI de pontos.

---

## 5. Bairro opcional no envio de relato

**Problema:** relato exigia bairro no formulário mesmo com cadastro preenchido; "Outro bairro" gerava 400.

**Back já entrega**

- `POST /api/v1/relatos`
- `neighborhood` e `neighborhoodId` opcionais.
- Regras:
  - `neighborhoodId` no body: sempre valida no catálogo.
  - Texto no body igual ao bairro do cadastro depois de `normalizeNeighborhoodText` (trim, colapso de espaços, remoção de acentos e minúsculas): aceito sem catálogo; grava o texto e o `neighborhoodId` do usuário (ou `null`).
  - Texto diferente do cadastro: exige catálogo (400 `INVALID_NEIGHBORHOOD` se não houver match).
  - Sem body (ou string vazia): fallback do cadastro (mesmo comportamento do match acima).
- Exemplo request (fallback):

```json
{
  "title": "Poste caído",
  "description": "Risco",
  "address": "Rua Z"
}
```

- Exemplo response 201 (usuário de "Outro bairro"):

```json
{
  "id": "uuid",
  "neighborhood": "Outro bairro",
  "status": "SENT"
}
```

**Front precisa**

- Tornar bairro opcional no formulário de relato.
- Pode omitir o campo e deixar o back usar o cadastro; se enviar texto, preferir o mesmo do perfil ou um id/nome do catálogo.

---

## 6. Ocultar o botão Google

**Problema:** botão "Entrar com Google" sem API.

**Back já entrega**

- Nenhuma rota OAuth/Google no back.

**Front precisa**

- Remover ou ocultar o botão em `entrar.tsx` até existir integração real.
