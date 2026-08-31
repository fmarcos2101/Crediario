# Banco de dados — CrediPlus

PostgreSQL 16. ORM: Drizzle. IDs internos: UUIDv7. Dinheiro: `NUMERIC(14,2)`. Vencimento: `DATE`. Eventos: `TIMESTAMPTZ` (UTC).

## Extensões

- `pgcrypto` — gerada no bootstrap local e na primeira migration.

## Roles

- Owner (`crediplus` no Compose): migrations (`DATABASE_MIGRATE_URL`).
- App (`crediplus_app`, `NOBYPASSRLS`): runtime da API (`DATABASE_URL`). Sem `DELETE` nas tabelas de negócio.

## Fase 2

Tabelas de identidade: `users`, `sessions`, `user_totp`, `login_challenges`, `password_reset_tokens`, `login_attempts`, `security_events`.

Senha: Argon2id. Sessão: token opaco (SHA-256 no banco). TOTP do Super Admin com secret em AES-256-GCM.

`sessions.tenant_id` (Fase 3) aponta para a empresa da sessão. Super Admin fica com `null`.

## Fase 3 — Tenancy

`users` e `tenants` são independentes. O vínculo é `tenant_users`. Schema permanece N:N; a UI e as regras de aplicação assumem 1 usuário ↔ 1 empresa no MVP.

| Tabela            | Função                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `tenants`         | Empresa. Status: `pending_setup` → `pending_activation` → `active` / `suspended` / `archived`. Contador `customer_count` (metadado). |
| `tenant_settings` | Fuso, locale, encargos opcionais, prazos de cobrança, textos de mensagem, flags de pagamento/Meta.                                   |
| `tenant_secrets`  | Ciphertext AES-256-GCM das APIs (pagamento e Meta). Sem política de Super Admin.                                                     |
| `tenant_users`    | Papel e status do membro (`invited`, `pending_activation`, `active`, `revoked`).                                                     |
| `tenant_invites`  | Token opaco (hash SHA-256), 48h.                                                                                                     |

### `tenant_settings` (encargos opcionais)

Campos de configuração. **Não são motor de cálculo no MVP.**

| Campo                                   | Semântica                                                      |
| --------------------------------------- | -------------------------------------------------------------- |
| `late_interest_enabled`                 | Multa/juros de mora opcionais. Default `false`.                |
| `late_interest_monthly_rate`            | Percentual mensal, `NUMERIC(7,4)`, nullable.                   |
| `late_fine_enabled`                     | Multa fixa ou percentual, opcional. Default `false`.           |
| `late_fine_type`                        | `fixed` \| `percent` \| null                                   |
| `late_fine_value`                       | `NUMERIC(14,2)` ou percentual, nullable.                       |
| `reminder_days_before_due`              | Lembrete antes do vencimento. Default 3.                       |
| `overdue_nudge_days`                    | Cobrança após atraso. Default 1.                               |
| `protest_warning_days`                  | Aviso de protesto (dias de atraso). Default 15.                |
| `collection_response_hours`             | Prazo de resposta da cobrança. Default 24.                     |
| `msg_*`                                 | Liga/desliga e texto de cada mensagem.                         |
| `payment_provider`                      | `none` \| `pix_manual` \| `asaas` \| `mercadopago` \| `other`. |
| `payment_configured`                    | Flag. Sem chave em claro.                                      |
| `meta_phone_number_id` / `meta_waba_id` | IDs públicos da Meta.                                          |
| `meta_configured`                       | Flag. Sem token em claro.                                      |

Geração de parcelas usa só valor de face. Encargos, se um dia aplicados, serão evento explícito — nunca reescrita silenciosa da parcela.

Tudo isso é editável no painel da empresa (`/app/configuracoes`). O Super Admin não altera essas chaves.

## RLS

Role da aplicação sem `BYPASSRLS`. `SET LOCAL` via `set_config(..., true)` na mesma transação da query (`applyRlsContext`).

Tabelas com `ENABLE` + `FORCE ROW LEVEL SECURITY`: `tenants`, `tenant_settings`, `tenant_users`, `tenant_invites`, `customers`, `tenant_secrets`.

Contexto: `app.current_tenant_id`, `app.is_super_admin`, `app.current_user_id`, `app.invite_token_hash`.

- Tenant vê só a própria linha (`tenant_id` / `id`).
- Super Admin vê metadados de empresa; `tenant_settings` é só leitura para ele.
- `customers` e `tenant_secrets` **não** têm política de Super Admin. Com `app.current_tenant_id` vazio a leitura devolve zero linhas.
- Membro lê o próprio `tenants` por `app.current_user_id` (login).
- Convite é lido pelo hash do token. Aceite prova o token e grava `pending_activation` nessa transação.
- Tenant user **não** atualiza `tenants.status`.

Isolamento A→B é testado com PGlite (`packages/db/src/rls.isolation.test.ts`): leitura cruzada devolve conjunto vazio.

## Clientes (Fase 5)

Sem RG e sem data de nascimento no MVP.

| Coluna            | Função                                 |
| ----------------- | -------------------------------------- |
| `name`            | Nome.                                  |
| `phone` / `email` | Opcionais.                             |
| `cpf_hmac`        | HMAC-SHA256 do CPF normalizado. Busca. |
| `cpf_ciphertext`  | AES-256-GCM. Detalhe do tenant dono.   |
| `notes`           | Texto curto.                           |
| `status`          | `active` \| `archived`. Sem `DELETE`.  |

Único por tenant em `(tenant_id, cpf_hmac)`. Recadastro do mesmo CPF reativa o arquivo. Trigger `sync_tenant_customer_count` atualiza `tenants.customer_count` (ativos).

## Vendas e dinheiro (ainda não migrado)

`sales`, `sale_items`, `sale_status_history`, `installments`, `installment_status_history`, `payments` (imutável), `payment_reversals` (estorno = novo evento).

Frequência no schema: enum (`monthly`, `weekly`, `biweekly`). UI do MVP: mensal + `first_due_date`. Última parcela absorve centavos.

## Documentos, assinatura, auditoria

Versionamento imutável + SHA-256. Assinatura com evidências. `audit_logs` append-only.
