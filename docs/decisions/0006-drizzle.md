# ADR-006 — Drizzle ORM

## Status

Aceito.

## Contexto

Prioridades: RLS, SQL explícito para dinheiro, migrations revisáveis, tipagem, PostgreSQL. Prisma dificulta `SET LOCAL` na mesma transação. TypeORM foi descartado.

## Decisão

Drizzle ORM + migrations SQL versionadas em `packages/db`.

Valores monetários no domínio usam decimal (`decimal.js`), nunca `number`.

## Consequências

Time lê SQL. Menos mágica, mais controle. Schema e migrations no Git.
