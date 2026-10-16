# AGENTS.md

## Arquitetura e fluxo

O projeto utiliza Node.js, TypeScript, Fastify, TypeBox, Prisma e PostgreSQL.

A arquitetura é um monólito modular, organizado por funcionalidade.

Fluxo padrão de uma requisição:

`Request → Route → Schema → Service → Prisma/External Service → Response`

- **Routes:** recebem requisições HTTP e chamam os serviços.
- **Schemas:** validam entradas e definem os formatos das respostas.
- **Services:** implementam as operações e regras de negócio.
- **Prisma:** realiza o acesso ao banco de dados.
- **Plugins e libs:** contêm funcionalidades compartilhadas, como autenticação e tratamento de erros.

## Organização do código

Organize os arquivos por funcionalidade:

```text
src/
├── modules/
│   └── <feature>/
│       ├── <feature>.routes.ts
│       ├── <feature>.schemas.ts
│       └── <feature>.service.ts
├── plugins/
├── lib/
├── app.ts
└── server.ts

prisma/
└── schema.prisma
```

- Mantenha cada funcionalidade isolada em seu módulo.
- Não implemente regras de negócio diretamente nas rotas.
- Não acesse o Prisma diretamente pelas rotas.
- Mantenha TypeScript em modo strict e evite `any`.
- Reutilize componentes e utilitários existentes antes de criar novas abstrações.
- Não crie camadas ou arquivos desnecessários.

## Padronização da API

- Utilize o prefixo `/api/v1`.
- Siga os princípios REST e utilize métodos HTTP e códigos de status adequados.
- Defina schemas de entrada e saída para as rotas.
- Utilize respostas de erro consistentes, contendo um código identificável e uma mensagem.
- Valide os dados no backend, sem depender exclusivamente do frontend.
- Mantenha a documentação OpenAPI gerada a partir das rotas e schemas existentes.
- Consulte as rotas e os schemas existentes antes de criar ou modificar endpoints, mantendo os padrões já estabelecidos.
- Não duplique manualmente informações que já são geradas automaticamente.

## Banco de dados

- Utilize Prisma para acessar o PostgreSQL.
- Consulte `prisma/schema.prisma` antes de criar ou modificar modelos e relacionamentos.
- Utilize migrações do Prisma para alterações no banco.
- Evite duplicar dados e operações desnecessárias.
- Utilize transações quando uma operação depender de múltiplas alterações que precisam ser consistentes.

## Verificações

Antes de concluir uma implementação, execute:

- `npm run typecheck`
- `npm test`
- `npm run build`

Corrija os erros encontrados antes de considerar a implementação concluída.