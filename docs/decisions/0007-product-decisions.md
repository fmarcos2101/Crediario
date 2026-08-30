# ADR-007 — Decisões de produto confirmadas

## Status

Aceito (2026-08-30).

## Produto

- Nome: **CrediPlus**.
- Domínio público: ainda não existe. CORS/cookies/e-mail via env.
- UI do MVP: somente pt-BR.
- Sem cadastro público.

## Auth e admin

- Ativação da empresa só após Super Admin liberar.
- Um usuário, uma empresa na UI. Schema N:N.
- Sessão opaca + cookie.
- Super Admin não vê PII nem financeiro do tenant.
- Bootstrap Super Admin: script one-shot, sem senha default no Git.

## Cadastro e dinheiro

- Cliente sem RG e sem data de nascimento no MVP.
- CPF: HMAC de busca + AES-256-GCM (Fase 5).
- Parcelas: UI mensal + `first_due_date`. Enum no banco já prevê semanal/quinzenal.
- Encargos: campos opcionais em `tenant_settings` (juros e multa). **Não há motor automático no MVP.** Parcela nasce pelo valor de face. Pagamento parcial e estorno (evento) sim.
- Assinatura: on-device (8.1) depois QR (8.2). OTP opcional; default off no balcão, on no QR.
- Documentos jurídicos nascem com watermark de rascunho até parecer.

## Infra

- Storage prod: Cloudflare R2. Dev: MinIO.
- E-mail: Resend atrás de `EmailProvider`. Dev: Mailpit.
- API: processo Node longo. Next separado.
- Testes: Testcontainers desde a Fase 2. Playwright a partir da Fase 5.
