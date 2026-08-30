# CrediPlus

SaaS multiempresa de crediário, cobrança, parcelas, documentos e assinatura eletrônica.

Acesso **somente por convite**. Não existe cadastro público.

## Fase atual

**Fase 1 — infraestrutura.** Monorepo, API de health, frontend inicial, Postgres/Redis/MinIO/Mailpit via Compose, Drizzle, CI.

Auth, tenants e o restante do produto entram nas fases seguintes. Ver `docs/architecture.md`.

## Requisitos

- Node.js 22+
- pnpm 10+
- Docker + Docker Compose (serviços locais)

## Desenvolvimento

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:migrate
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1/health
- Mailpit: http://localhost:8025
- MinIO: http://localhost:9001

## Scripts

| Comando                                      | Função         |
| -------------------------------------------- | -------------- |
| `pnpm dev`                                   | Sobe web e API |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Qualidade      |
| `pnpm db:generate` / `pnpm db:migrate`       | Schema Drizzle |
| `pnpm infra:up` / `pnpm infra:down`          | Compose        |

## Decisões

Registradas em `docs/decisions/`. Produto: CrediPlus. ORM: Drizzle. Sessão opaca. Super Admin sem PII do tenant. Encargos (juros/multa) são configuração opcional, sem cálculo automático no MVP.
