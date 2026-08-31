# API — CrediPlus

Base: `/api/v1`. REST. Versionada desde o início.

Host local: `API_ORIGIN` (default `http://localhost:4000`).

## Erros

```json
{
  "error": {
    "code": "HEALTH_DEPENDENCY_UNAVAILABLE",
    "message": "Serviço temporariamente indisponível.",
    "requestId": "…"
  }
}
```

Sem stack, SQL ou caminho de arquivo no corpo em qualquer ambiente de produção. Em development o log interno pode ter detalhe; a resposta ao client permanece estável.

Acesso cruzado de tenant responde **404** (`Recurso não encontrado.`), nunca 403 que confirme que o outro tenant existe.

## Fase 1

### `GET /api/v1/health`

Liveness. Não consulta dependências. Sempre 200 se o processo está no ar.

```json
{
  "status": "ok",
  "product": "CrediPlus",
  "version": "0.1.0"
}
```

### `GET /api/v1/health/ready`

Readiness. Verifica Postgres e Redis quando as URLs estão configuradas.

- 200 se as dependências obrigatórias respondem.
- 503 se alguma falha. Corpo sem detalhe interno de conexão.

## Fase 2 — Auth

Cookies: `crediplus_session` (HttpOnly) e `crediplus_csrf`. Credenciais com `credentials: include`. Mutações autenticadas enviam `X-CSRF-Token`.

| Método | Rota                           | Auth                |
| ------ | ------------------------------ | ------------------- |
| POST   | `/api/v1/auth/login`           | público, rate limit |
| POST   | `/api/v1/auth/totp`            | challenge de login  |
| POST   | `/api/v1/auth/logout`          | sessão + CSRF       |
| GET    | `/api/v1/auth/me`              | sessão              |
| POST   | `/api/v1/auth/password/forgot` | público, sempre 200 |
| POST   | `/api/v1/auth/password/reset`  | token opaco         |

Super Admin: senha + TOTP. Bootstrap: `pnpm bootstrap:superadmin`.

`GET /auth/me` devolve `user` com `id`, `email`, `isSuperAdmin`, `tenantId`, `tenantName`, `tenantStatus`. Super Admin fica com os campos de tenant nulos.

## Fase 3 — Tenancy

Convite e empresas. Sem cadastro público. Super Admin cria a empresa, o dono define senha no convite, o Super Admin libera.

| Método | Rota                                 | Auth                       |
| ------ | ------------------------------------ | -------------------------- |
| POST   | `/api/v1/auth/invite/accept`         | token opaco do convite     |
| GET    | `/api/v1/admin/tenants`              | Super Admin                |
| POST   | `/api/v1/admin/tenants`              | Super Admin + CSRF         |
| POST   | `/api/v1/admin/tenants/:id/activate` | Super Admin + CSRF         |
| POST   | `/api/v1/admin/tenants/:id/suspend`  | Super Admin + CSRF         |
| POST   | `/api/v1/admin/tenants/:id/archive`  | Super Admin + CSRF         |
| GET    | `/api/v1/tenants/current/settings`   | sessão de tenant           |
| GET    | `/api/v1/tenants/:tenantId/settings` | sessão de tenant; 404 se ≠ |
| PATCH  | `/api/v1/tenants/current/settings`   | sessão de tenant + CSRF    |

`POST /admin/tenants` corpo: `{ "name": "…", "ownerEmail": "…" }`. Resposta: `{ "tenantId", "inviteSentTo" }`.

Usuário de empresa só entra depois de `activate`. Suspender ou arquivar revoga as sessões daquela empresa.

`GET /admin/tenants` devolve metadados: `id`, `name`, `status`, `ownerEmail`, `createdAt`, `lastAccessAt`, `customerCount`, `paymentConfigured`, `metaConfigured`. Sem CPF, clientes, chaves ou financeiro.

## Fase 4 — Configuração no painel da empresa

Toda configuração operacional se altera em `PATCH /tenants/current/settings`. Super Admin não lê nem grava segredos.

Campos (todos opcionais no PATCH):

- Prazos: `reminderDaysBeforeDue`, `overdueNudgeDays`, `protestWarningDays`, `collectionResponseHours`
- Mensagens (ligar/desligar + texto): `msgDueReminder*`, `msgOverdue*`, `msgProtestWarning*`, `msgPaymentReceived*`
- Encargos opcionais: `lateInterestEnabled`, `lateInterestMonthlyRate`, `lateFineEnabled`, `lateFineType`, `lateFineValue`
- Assinatura OTP: `signatureOtpOnDevice`, `signatureOtpQr`
- Pagamento: `paymentProvider`, `paymentApiKey`, `paymentWebhookSecret`, `clearPaymentSecrets`
- Meta/WhatsApp: `metaPhoneNumberId`, `metaWabaId`, `metaAccessToken`, `metaAppSecret`, `clearMetaSecrets`

Chaves são write-only. A resposta só traz flags (`paymentConfigured`, `metaConfigured`) e IDs públicos. Ciphertext nunca sai da API. O envio automático das mensagens entra com as parcelas (Fase 6+).

## Fase 5 — Clientes

Sem RG e sem data de nascimento. CPF: HMAC de busca + AES-256-GCM. Sem `DELETE` — arquivar.

| Método | Rota                            | Auth                    |
| ------ | ------------------------------- | ----------------------- |
| GET    | `/api/v1/customers`             | sessão de tenant        |
| GET    | `/api/v1/customers/:id`         | sessão de tenant; 404   |
| POST   | `/api/v1/customers`             | sessão de tenant + CSRF |
| PATCH  | `/api/v1/customers/:id`         | sessão de tenant + CSRF |
| POST   | `/api/v1/customers/:id/archive` | sessão de tenant + CSRF |

Lista: `?q=` nome (`ilike`) ou CPF (HMAC). `?status=active|archived`. Lista mascara o CPF (`cpfMasked`); o detalhe devolve o CPF formatado. Tenant B pedindo id de Tenant A recebe **404**. CPF ativo duplicado no mesmo tenant: **409**.

## Próximas fases

`/sales`, `/installments`, `/payments`, `/documents`, `/signatures`.
