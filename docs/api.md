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

Chaves são write-only. A resposta só traz flags (`paymentConfigured`, `metaConfigured`) e IDs públicos. Ciphertext nunca sai da API. O envio automático das mensagens é a Fase 7.

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

## Fase 6 — Vendas, parcelas e pagamentos

| Método | Rota                                            | Auth                    |
| ------ | ----------------------------------------------- | ----------------------- |
| GET    | `/api/v1/sales`                                 | sessão de tenant        |
| GET    | `/api/v1/sales/:id`                             | sessão de tenant; 404   |
| POST   | `/api/v1/sales`                                 | sessão de tenant + CSRF |
| POST   | `/api/v1/sales/:id/cancel`                      | sessão de tenant + CSRF |
| POST   | `/api/v1/sales/:id/payments`                    | sessão de tenant + CSRF |
| POST   | `/api/v1/sales/:id/payments/:paymentId/reverse` | sessão de tenant + CSRF |

`POST /sales` corpo: `{ customerId, items: [{ description, quantity, unitPrice }], downPayment?, installmentCount, frequency?, firstDueDate, notes? }`. Frequência default `monthly`. UI do MVP só oferece mensal. Total = soma dos itens. Entrada < total. Financiado é dividido; a última parcela absorve centavos.

Pagamento é evento imutável. Estorno é um evento novo (`payment_reversals`), nunca apaga o pagamento. Não há `DELETE`. Encargos configurados na empresa **não** entram no valor da parcela. Tenant B: **404**. Super Admin não lê vendas. Pagamento acima do saldo: **400**. Venda cancelada ou com baixa: **409**.

`GET /sales/:id` inclui `history` (append-only de venda e parcela) e `collectionMessages`.

## Fase 7 — Histórico, cobrança e webhook

| Método | Rota                                  | Auth                                  |
| ------ | ------------------------------------- | ------------------------------------- |
| GET    | `/api/v1/collection/messages`         | sessão de tenant                      |
| POST   | `/api/v1/collection/run`              | sessão de tenant + CSRF               |
| POST   | `/api/v1/webhooks/payments/:tenantId` | público, HMAC (`X-Webhook-Signature`) |

Jobs de cobrança usam os prazos e textos de `tenant_settings`. Planejamento: lembrete na janela `[hoje, hoje+reminderDays]`; atraso se `overdueDays >= overdueNudgeDays`; protesto de forma análoga. Não envia lembrete se já estiver atrasada. Idempotência por `(tenant_id, occurrence_key)`.

Canal de envio no MVP: **e-mail** se o cliente tiver e-mail. WhatsApp/Meta **não** é enviado (`channel=none`). Sem Redis/BullMQ neste ciclo — o worker é um `setInterval` de ~60s no processo da API (pula `NODE_ENV=test`, sem ticks sobrepostos). BullMQ pode entrar depois.

Webhook genérico HMAC-SHA256 do **corpo cru**. Header `X-Webhook-Signature` (hex ou `sha256=`). Segredo em `tenant_secrets` (AES-GCM). Sem sessão e sem CSRF. Tenant ou segredo ausente: **404**. HMAC inválido: **401**. `eventId` duplicado: **200** `{ "status": "duplicate" }`. Parcela desconhecida: **200** `{ "status": "ignored" }`. Rate limit por IP+tenant. Não é adaptador Asaas/Mercado Pago.

O worker lista empresas ativas como Super Admin (**só metadados**) e, por empresa, entra em RLS de tenant para varrer vendas/parcelas. Super Admin não lê financeiro, histórico, mensagens nem webhooks.

## Próximas fases

`/documents`, `/signatures`.
