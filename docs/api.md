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

## Próximas fases

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

## Próximas fases

`/api/v1/auth`, `/customers`, `/sales`, `/installments`, `/payments`, `/documents`, `/signatures`, `/integrations`, `/admin`.
