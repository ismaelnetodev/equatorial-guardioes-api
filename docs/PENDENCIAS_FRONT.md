# Pendencias front/mobile (contrato da branch `melhorias`)

Escopo: so o que o app precisa consumir. Detalhes do back em `docs/MELHORIAS_BACKEND.md` secao 4.
Nao altere este arquivo a partir do mobile; e handoff do back para o front.

---

## 1. Cadastro voltando para login (sem `login()`)

**Problema (testador):** apos cadastrar, o app autenticava sozinho e seguia logado.

**Back ja entrega**

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

- Login continua exclusivo de `POST /api/v1/entrar` (ai vem `accessToken`).

**Front precisa**

- Em `cadastrar.tsx`, nao chamar `login()` apos 201.
- Navegar para `/entrar` e autenticar so la.

---

## 2. Aba Reportar usando `canReport`

**Problema:** cadeado/liberacao da aba Reportar nao refletia a regra do servidor.

**Back ja entrega**

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

- `canReport: true` somente apos concluir o modulo inicial da trilha (mesma regra do guard de `POST /api/v1/relatos`).

**Front precisa**

- Liberar a aba Reportar com `canReport` do perfil/progresso, nao so com estado local.

---

## 3. Icone editar perfil -> `PATCH /api/v1/perfil` (somente `name`)

**Problema:** icone de editar nao persistia o nome.

**Back ja entrega**

- Rota: `PATCH /api/v1/perfil`
- Request:

```json
{ "name": "Ana Silva" }
```

- Resposta: mesmo formato de `GET /api/v1/perfil` (inclui `canReport`).
- Body com `neighborhood` / `neighborhoodId` e rejeitado (`additionalProperties: false`). Troca de bairro so no admin.

**Front precisa**

- Ligar o icone/caneta a este PATCH so com `name`.

---

## 4. Mensagem para `pointsCapped` / `capReason` / `pendingPoints`

**Problema:** usuario atinge limite diario e nao entende onde foram os pontos.

**Back ja entrega**

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

- Saldo: `GET /api/v1/progress/learning` (ja tem `pendingPoints`).

**Front precisa**

- Se `pointsCapped` / `capReason: "DAILY_LIMIT"`, avisar que pontos entraram na fila e saem no dia seguinte (ou apos claim / visita a tela de pontos).
- Opcional: mostrar `pendingPoints` na UI de pontos.

---

## 5. Bairro opcional no envio de relato

**Problema:** relato exigia bairro no formulário mesmo com cadastro preenchido; "Outro bairro" gerava 400.

**Back ja entrega**

- `POST /api/v1/relatos`
- `neighborhood` e `neighborhoodId` opcionais.
- Regras:
  - `neighborhoodId` no body: sempre valida no catalogo.
  - Texto no body igual ao bairro do cadastro (normalizado: espacos, maiusculas/minusculas): aceito sem catalogo; grava o texto e o `neighborhoodId` do usuario (ou `null`).
  - Texto diferente do cadastro: exige catalogo (400 `INVALID_NEIGHBORHOOD` se nao houver match).
  - Sem body (ou string vazia): fallback do cadastro (mesmo comportamento do match acima).
- Exemplo request (fallback):

```json
{
  "title": "Poste caido",
  "description": "Risco",
  "address": "Rua Z"
}
```

- Exemplo response 201 (usuario de "Outro bairro"):

```json
{
  "id": "uuid",
  "neighborhood": "Outro bairro",
  "status": "SENT"
}
```

**Front precisa**

- Tornar bairro opcional no formulario de relato.
- Pode omitir o campo e deixar o back usar o cadastro; se enviar texto, preferir o mesmo do perfil ou um id/nome do catalogo.

---

## 6. Ocultar o botao Google

**Problema:** botao "Entrar com Google" sem API.

**Back ja entrega**

- Nenhuma rota OAuth/Google no back.

**Front precisa**

- Remover ou ocultar o botao em `entrar.tsx` ate existir integracao real.
