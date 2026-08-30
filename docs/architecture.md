# Arquitetura — CrediPlus

SaaS multiempresa de crediário, cobrança, documentos e assinatura eletrônica.

A simplicidade fica na interface. A robustez fica no servidor.

## Princípios

- Monólito modular (dois processos: Next.js + NestJS). Sem microserviços no início.
- O frontend nunca é fonte de verdade financeira, de tenant ou de autorização.
- `tenant_id` é resolvido no servidor a partir da sessão. O client não manda tenant autoritativo.
- Defesa em profundidade: guard + filtro no repositório + RLS + testes A→B.
- Dados financeiros usam `NUMERIC` / decimal. Nunca `number` IEEE-754 no domínio.
- Exclusão definitiva não é o padrão de entidades de negócio. OTP, tokens e tentativas de login têm retenção e purge.
- Super Admin vê metadados do tenant, não PII nem financeiro do cliente.

## Processos

```
Browser → apps/web (Next.js) → apps/api (NestJS + Fastify)
                                 ├─ PostgreSQL 16 (+ RLS a partir da Fase 3)
                                 ├─ Redis 7 (rate limit, filas)
                                 ├─ Object storage S3 (MinIO local / Cloudflare R2)
                                 └─ BullMQ workers (mesmo processo no início)
```

## Monorepo

| Pacote            | Responsabilidade                                                     |
| ----------------- | -------------------------------------------------------------------- |
| `apps/web`        | UI pt-BR. Tenant, Super Admin e página pública de assinatura.        |
| `apps/api`        | Única API de negócio. Auth, tenant, dinheiro, documentos, auditoria. |
| `packages/db`     | Schema Drizzle, migrations SQL, client Postgres.                     |
| `packages/shared` | Constantes do produto, enums, money, contratos Zod.                  |

## Ambientes

| Ambiente    | Uso                                                       |
| ----------- | --------------------------------------------------------- |
| development | Docker Compose local. Seed permitido.                     |
| staging     | Credenciais próprias. Restore drill.                      |
| production  | Postgres gerenciado, Redis, R2, Secret Manager. Sem seed. |

Domínio público ainda não existe. CORS, cookies e e-mail usam variáveis (`APP_ORIGIN`, `API_ORIGIN`, `CORS_ORIGINS`).

## Fases

A Fase 1 entrega só a base: monorepo, Compose, health, Drizzle, CI e documentação. Auth é a Fase 2.
