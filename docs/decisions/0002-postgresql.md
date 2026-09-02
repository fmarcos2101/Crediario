# ADR-002 — PostgreSQL

## Status

Aceito.

## Contexto

Precisamos de `NUMERIC`, `DATE`, `TIMESTAMPTZ`, constraints, histórico e Row Level Security.

## Decisão

PostgreSQL 16 gerenciado em produção. UUIDv7 como PK interno. Produção sem exposição à internet.

## Consequências

RLS e migrations SQL são cidadãos de primeira classe. Sem banco de produção no desenvolvimento.
