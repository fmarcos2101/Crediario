# Banco de dados — CrediPlus

PostgreSQL 16. ORM: Drizzle. IDs internos: UUIDv7. Dinheiro: `NUMERIC(14,2)`. Vencimento: `DATE`. Eventos: `TIMESTAMPTZ` (UTC).

## Extensões

- `pgcrypto` — gerada no bootstrap local e na primeira migration.

## Fase 1

Nenhuma tabela de domínio ainda. O pacote `@crediplus/db` já gera e aplica migrations. Tabelas de identidade entram na Fase 2.

## Modelo previsto (não migrado nesta fase)

### Identidade e tenancy

`tenants`, `tenant_settings`, `users`, `tenant_users`, `roles`, `permissions`, `role_permissions`, `sessions`, `email_verifications`, `password_reset_tokens`, `otp_challenges`, `user_totp`, `login_attempts`, `security_events`.

`users` e `tenants` são independentes. O vínculo é `tenant_users`.

MVP de produto: um usuário opera uma empresa. O schema permanece N:N para não pintar um canto. A UI e as regras de aplicação assumem 1:1.

### `tenant_settings` (encargos opcionais)

Campos de configuração. **Não são motor de cálculo no MVP.**

| Campo                        | Semântica                                            |
| ---------------------------- | ---------------------------------------------------- |
| `late_interest_enabled`      | Multa/juros de mora opcionais. Default `false`.      |
| `late_interest_monthly_rate` | Percentual mensal, `NUMERIC(7,4)`, nullable.         |
| `late_fine_enabled`          | Multa fixa ou percentual, opcional. Default `false`. |
| `late_fine_type`             | `fixed` \| `percent` \| null                         |
| `late_fine_value`            | `NUMERIC(14,2)` ou percentual, nullable.             |

Geração de parcelas usa só valor de face. Encargos, se um dia aplicados, serão evento explícito — nunca reescrita silenciosa da parcela.

### Clientes (Fase 5)

Sem RG e sem data de nascimento no MVP. CPF: HMAC de busca + AES-256-GCM. Único por tenant.

### Vendas e dinheiro

`sales`, `sale_items`, `sale_status_history`, `installments`, `installment_status_history`, `payments` (imutável), `payment_reversals` (estorno = novo evento).

Frequência no schema: enum (`monthly`, `weekly`, `biweekly`). UI do MVP: mensal + `first_due_date`. Última parcela absorve centavos.

### Documentos, assinatura, auditoria

Versionamento imutável + SHA-256. Assinatura com evidências. `audit_logs` append-only.

## RLS

A partir da Fase 3. Role da aplicação sem `BYPASSRLS`. `SET LOCAL app.current_tenant_id` na mesma transação da query.
