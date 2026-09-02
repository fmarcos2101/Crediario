# CrediPlus

SaaS multiempresa de crediário, cobrança, parcelas, documentos e assinatura eletrônica.

Acesso **somente por convite**. Não existe cadastro público.

## Fase atual

**Fase 1 — infraestrutura**, **Fase 2 — autenticação**, **Fase 3 — multiempresa**, **Fase 4 — Super Admin (metadados)**, **Fase 5 — clientes**, **Fase 6 — vendas** e **Fase 7 — histórico, cobrança e webhook**. Este recorte é o MVP de crediário. Documentos e assinatura eletrônica (Fases 8–9) ficam para um ciclo próprio: upload, bucket privado e evidência de assinatura não entram aqui.

Configurações de cobrança, mensagens, API de pagamento e API da Meta ficam no painel da empresa (`/app/configuracoes`). Super Admin não vê PII, chaves nem financeiro.

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
pnpm bootstrap:superadmin   # cria Super Admin; imprime URL otpauth
pnpm dev
```

- Web: http://localhost:3000 — `/login`, `/admin`, `/app`, `/app/clientes`, `/app/vendas`, `/app/cobranca`, `/app/configuracoes`, `/convite`
- API: http://localhost:4000/api/v1/health
- Mailpit: http://localhost:8025 (link do convite)
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
