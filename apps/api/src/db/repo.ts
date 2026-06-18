import { and, eq } from "drizzle-orm";
import type { AuthRepo } from "../auth/account.js";
import type { SessionRepo } from "../auth/session.js";
import { getDb } from "./client.js";
import { authIdentities, sessions, users } from "./schema.js";

type Db = ReturnType<typeof getDb>;

export function createDbAuthRepo(db: Db = getDb()): AuthRepo {
  return {
    async findIdentity(provider, providerUserId) {
      const [row] = await db
        .select({ userId: authIdentities.userId })
        .from(authIdentities)
        .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, providerUserId)))
        .limit(1);
      return row ?? null;
    },
    async findUserByEmail(email) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },
    async createUser(input) {
      const [row] = await db.insert(users).values(input).returning({ id: users.id });
      return row;
    },
    async createIdentity(input) {
      await db.insert(authIdentities).values({
        userId: input.userId,
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email,
        emailVerified: input.emailVerified,
        rawProfile: input.rawProfile,
      });
    },
    async getUserById(id) {
      const [row] = await db
        .select({ id: users.id, email: users.email, name: users.name, locale: users.locale })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },
  };
}

export function createDbSessionRepo(db: Db = getDb()): SessionRepo {
  return {
    async createSession(input) {
      await db.insert(sessions).values(input);
    },
    async findSession(token) {
      const [row] = await db
        .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt })
        .from(sessions)
        .where(eq(sessions.token, token))
        .limit(1);
      return row ?? null;
    },
    async revokeSession(token, revokedAt) {
      await db.update(sessions).set({ revokedAt }).where(eq(sessions.token, token));
    },
  };
}
