# ADR-001 — NestJS como backend

## Status

Aceito.

## Contexto

O produto precisa de auth, tenancy, filas, webhooks, RLS por transação e regras financeiras fora do browser.

## Decisão

API em NestJS 11 + Fastify 5, monólito modular. Next.js não hospeda regra de negócio.

## Consequências

Dois processos para operar. Fronteira clara. Workers BullMQ no mesmo serviço no início.
