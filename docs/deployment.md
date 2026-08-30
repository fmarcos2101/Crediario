# Deploy e ambientes — CrediPlus

## Desenvolvimento

```bash
pnpm install
cp .env.example .env
pnpm infra:up          # Postgres 16, Redis 7, MinIO, Mailpit
pnpm db:migrate
pnpm dev               # API :4000 e web :3000
```

Mailpit UI: `http://localhost:8025`.  
MinIO console: `http://localhost:9001`.

## Produção (direção, ainda sem domínio)

| Peça         | Escolha                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- |
| API + worker | Um serviço Node long-running. Separar worker quando a fila pesar. Evitar serverless (RLS + jobs). |
| Web          | Vercel ou o mesmo host.                                                                           |
| Postgres     | Instância gerenciada, rede privada, TLS, PITR, sem exposição à internet.                          |
| Redis        | Gerenciado, só rede privada.                                                                      |
| Storage      | Cloudflare R2 (S3 API). Bucket privado.                                                           |
| E-mail       | Resend (trocável via `EmailProvider`).                                                            |
| Segredos     | Secret Manager / KMS. `APP_ENCRYPTION_KEY` fora do banco.                                         |

Usuário de banco da aplicação: privilégio mínimo, `NOBYPASSRLS` (Fase 3). Migrations rodam com role própria.

## Super Admin bootstrap (Fase 2)

Script one-shot lendo `BOOTSTRAP_SUPERADMIN_EMAIL` e `BOOTSTRAP_SUPERADMIN_PASSWORD` do ambiente. Sem usuário `admin/admin` no Git ou no seed de produção.

## Backup

Automático + PITR quando o provedor permitir. Criptografado. Restore ensaiado no staging (critério da Fase 11). Sem teste de restore não há backup confiável.
