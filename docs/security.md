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

## Multi-tenant (Fase 3)

Frontend não isola dados. Backend resolve tenant. Query filtra `tenant_id`. RLS impede leitura cruzada. Teste obrigatório: Tenant A não lê recurso do Tenant B (404 uniforme).

## Super Admin

Metadados da empresa (status, uso, último acesso, integrações mascaradas). Sem CPF, vendas, parcelas ou documentos do cliente. Break-glass, se existir no futuro, exige reautenticação, motivo e auditoria.

## Arquivos (Fases 8–9)

Bucket privado. Presigned URL curta. Magic bytes. Sem HTML/SVG/JS/EXE. Nome gerado pelo servidor.

## Logs

JSON com `request_id`. Sem senha, token, OTP, API key, CPF completo.
