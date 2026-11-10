/**
 * Idempotently imports the active legacy CRM users into Supabase Auth.
 *
 * Safety properties:
 * - requires --apply before performing any write;
 * - expects exactly 10 active users by default;
 * - preserves the legacy UUID and bcrypt password_hash;
 * - never prints emails, password hashes, secrets or user payloads;
 * - can be rerun after a partial failure.
 *
 * Dry-run validation (Node 22+ / 24+):
 *   node --env-file=backend/.env supabase/scripts/import-auth-users.ts
 *
 * Apply after reviewing the dry run:
 *   node --env-file=backend/.env supabase/scripts/import-auth-users.ts --apply
 */

import process from "node:process";
import { createClient, type User } from "@supabase/supabase-js";

type LegacyUser = {
  id: string;
  email: string;
  senha: string;
  authUserId: string | null;
};

class SafeImportError extends Error {
  status?: number;
  constructor(code: string, status?: number) {
    super(status ? `${code} (status ${status})` : code);
    this.name = "SafeImportError";
    this.status = status;
  }
}

const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bcryptPattern = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim();
}

function requiredEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new SafeImportError(`MISSING_${name}`);
  return value;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function fail(code: string, error?: unknown): never {
  throw new SafeImportError(code, statusOf(error));
}

async function listAllAuthUsers(
  supabase: ReturnType<typeof createClient>,
): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) fail("AUTH_LIST_FAILED", error);

    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

async function main(): Promise<void> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const secretKey = requiredEnv("SUPABASE_SECRET_KEY");
  const expectedCountText = getEnv("EXPECTED_USER_COUNT") || "10";
  const expectedCount = Number(expectedCountText);
  const apply = process.argv.includes("--apply");

  if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0) {
    throw new SafeImportError("INVALID_EXPECTED_USER_COUNT");
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from("User")
    .select("id,email,senha,authUserId")
    .is("deletedAt", null)
    .order("id", { ascending: true });

  if (error) fail("LEGACY_USER_READ_FAILED", error);

  const legacyUsers = (data ?? []) as LegacyUser[];
  if (legacyUsers.length !== expectedCount) {
    throw new SafeImportError(
      `ACTIVE_USER_COUNT_MISMATCH expected=${expectedCount} actual=${legacyUsers.length}`,
    );
  }

  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (const user of legacyUsers) {
    const normalizedEmail = user.email?.trim().toLowerCase();

    if (!uuidV4Pattern.test(user.id)) {
      throw new SafeImportError("INVALID_LEGACY_UUID");
    }
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new SafeImportError("INVALID_LEGACY_EMAIL");
    }
    if (!bcryptPattern.test(user.senha)) {
      throw new SafeImportError("INVALID_BCRYPT_HASH");
    }
    if (user.authUserId !== null && user.authUserId !== user.id) {
      throw new SafeImportError("AUTH_LINK_ID_MISMATCH");
    }
    if (seenIds.has(user.id)) {
      throw new SafeImportError("DUPLICATE_LEGACY_ID");
    }
    if (seenEmails.has(normalizedEmail)) {
      throw new SafeImportError("DUPLICATE_LEGACY_EMAIL");
    }

    seenIds.add(user.id);
    seenEmails.add(normalizedEmail);
  }

  const authUsers = await listAllAuthUsers(supabase);
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const authByEmail = new Map(
    authUsers
      .filter((user) => typeof user.email === "string")
      .map((user) => [user.email!.trim().toLowerCase(), user]),
  );

  for (const legacyUser of legacyUsers) {
    const normalizedEmail = legacyUser.email.trim().toLowerCase();
    const existingById = authById.get(legacyUser.id);
    const existingByEmail = authByEmail.get(normalizedEmail);

    if (existingById && existingById.email?.trim().toLowerCase() !== normalizedEmail) {
      throw new SafeImportError("AUTH_ID_EMAIL_CONFLICT");
    }
    if (existingByEmail && existingByEmail.id !== legacyUser.id) {
      throw new SafeImportError("AUTH_EMAIL_ID_CONFLICT");
    }
  }

  const alreadyPresent = legacyUsers.filter((user) => authById.has(user.id)).length;
  const toCreate = legacyUsers.length - alreadyPresent;

  console.log(
    `Validation passed: active=${legacyUsers.length} existing=${alreadyPresent} create=${toCreate}`,
  );

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to import and link users.");
    return;
  }

  let created = 0;
  let linked = 0;
  let reused = 0;

  for (const legacyUser of legacyUsers) {
    if (authById.has(legacyUser.id)) {
      reused += 1;
    } else {
      const attributes = {
        id: legacyUser.id,
        email: legacyUser.email.trim(),
        password_hash: legacyUser.senha,
        email_confirm: true,
        app_metadata: {
          source: "gc-crm-legacy",
          legacy_profile_id: legacyUser.id,
        },
      };

      const { data: createdData, error: createError } =
        await supabase.auth.admin.createUser(attributes);

      if (createError || createdData.user.id !== legacyUser.id) {
        fail("AUTH_CREATE_FAILED", createError);
      }

      authById.set(createdData.user.id, createdData.user);
      created += 1;
    }

    if (legacyUser.authUserId !== legacyUser.id) {
      const { data: linkedRows, error: linkError } = await supabase
        .from("User")
        .update({ authUserId: legacyUser.id })
        .eq("id", legacyUser.id)
        .is("deletedAt", null)
        .select("id");

      if (linkError || linkedRows?.length !== 1) {
        fail("PROFILE_LINK_FAILED", linkError);
      }

      linked += 1;
    }
  }

  console.log(
    `Import complete: created=${created} reused=${reused} linked=${linked} total=${legacyUsers.length}`,
  );
}

try {
  await main();
} catch (error) {
  if (error instanceof SafeImportError) {
    console.error(`Import aborted: ${error.message}`);
  } else {
    console.error("Import aborted: UNEXPECTED_FAILURE");
  }
  process.exit(1);
}
