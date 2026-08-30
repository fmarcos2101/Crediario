# ADR-003 — Multi-tenancy por tenant_id compartilhado

## Status

Aceito.

## Contexto

SaaS multiempresa. Isolar por login do usuário é insuficiente. Schema-por-tenant e banco-por-tenant são caros demais no início.

## Decisão

Shared database. Cada empresa é um tenant (`UUID`). Toda entidade de negócio tem `tenant_id`. O backend resolve o tenant pela sessão, nunca pelo body/header como autoridade.

MVP: um usuário opera uma empresa. O vínculo `tenant_users` permanece N:N no schema.

## Consequências

Índices compostos começam por `tenant_id`. Teste obrigatório de isolamento A→B. Super Admin não usa o mesmo caminho de leitura de PII.
