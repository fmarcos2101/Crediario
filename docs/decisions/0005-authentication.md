# ADR-005 — Sessão opaca em cookie

## Status

Aceito.

## Contexto

O MVP é um painel web. JWT no browser complica revogação e empurra token para o JavaScript. Mobile nativo não está no MVP.

## Decisão

Sessão opaca: cookie HttpOnly + hash no Postgres. CSRF explícito. Access/refresh JWT só se API mobile entrar no escopo.

Fluxo de empresa: Super Admin cadastra → convite → senha → **liberação manual** → login.

Super Admin: TOTP obrigatório.

## Consequências

Logout e suspensão de tenant revogam sessões no banco. Listar sessões ativas fica trivial.
