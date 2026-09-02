import { sql, type SQL } from 'drizzle-orm';

export type RlsContext = {
  tenantId: string | null;
  isSuperAdmin: boolean;
  userId?: string | null;
  inviteTokenHash?: string | null;
};

type Executable = {
  execute(query: SQL): Promise<unknown>;
};

export async function applyRlsContext(tx: Executable, ctx: RlsContext): Promise<void> {
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${ctx.tenantId ?? ''}, true)`,
  );
  await tx.execute(
    sql`select set_config('app.is_super_admin', ${ctx.isSuperAdmin ? 'true' : 'false'}, true)`,
  );
  await tx.execute(
    sql`select set_config('app.current_user_id', ${ctx.userId ?? ''}, true)`,
  );
  await tx.execute(
    sql`select set_config('app.invite_token_hash', ${ctx.inviteTokenHash ?? ''}, true)`,
  );
}
