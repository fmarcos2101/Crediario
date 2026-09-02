# Segurança — CrediPlus

Nenhum sistema na internet tem risco zero. A meta é reduzir superfície, empilhar barreiras, detectar e recuperar.

## Já na Fase 1

- TypeScript strict em todos os pacotes.
- Segredos só em ambiente. `.env` fora do Git. `.env.example` sem valores reais de produção.
- Compose de desenvolvimento usa senhas explícitas **só locais**, nunca reutilizadas em produção.
- Health liveness não revela SQL, paths ou stack.
- CORS por allowlist (`CORS_ORIGINS`). Sem `*` em API privada.
- Headers básicos no Fastify (helmet).
- Bucket MinIO criado sem acesso anônimo.

## A partir da Fase 2

- Senha: Argon2id.
- Sessão opaca em cookie HttpOnly, Secure (prod), SameSite=Lax, prefixo `__Host-` em produção.
- CSRF além de SameSite.
- Rate limit agressivo em login, OTP e reset.
- Super Admin: TOTP obrigatório, idle curto, step-up em ação sensível.
- Sem senha default no repositório. Bootstrap one-shot por env.

## Webhook de pagamento (Fase 7)

HMAC-SHA256 do corpo cru com o segredo da empresa. Sem cookie, sem CSRF. Comparação constante sobre os bytes hex. Rate limit por IP+tenant. Segredo só em ciphertext. Tenant ou segredo ausente: 404. HMAC inválido: 401.

## Produção

A API recusa subir sem `COOKIE_SECURE=true`, `APP_ENCRYPTION_KEY` de 32 bytes, `DATABASE_URL` e CORS sem `*`. Cookie de sessão e CSRF usam prefixo `__Host-` (sem `Domain`). Corpo de e-mail não vai para o log.

## Multi-tenant (Fase 3)

Frontend não isola dados. Backend resolve tenant. Query filtra `tenant_id`. RLS impede leitura cruzada. Teste obrigatório: Tenant A não lê recurso do Tenant B (404 uniforme).

## Super Admin

Metadados da empresa (status, uso, último acesso, flags de integração). Sem CPF, vendas, parcelas, documentos ou chaves de API. `tenant_secrets` e `customers` não têm política de Super Admin. Break-glass, se existir no futuro, exige reautenticação, motivo e auditoria.

## Arquivos (Fases 8–9)

Bucket privado. Presigned URL curta. Magic bytes. Sem HTML/SVG/JS/EXE. Nome gerado pelo servidor.

## Logs

JSON com `request_id`. Sem senha, token, OTP, API key, CPF completo.
