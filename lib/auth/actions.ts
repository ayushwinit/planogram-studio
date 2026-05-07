"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { LoginSchema, SignupSchema, type LoginFormState, type SignupFormState } from "./schemas";
import { createSession, destroySession } from "./session";
import { getSession } from "./dal";

type TenantUserRow = {
  user_id: string;
  tenant_id: string;
  user_name: string;
  user_email: string;
  user_password: string;
};

export async function loginAction(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: { email: String(formData.get("email") ?? "") },
    };
  }

  const { email, password } = parsed.data;

  const result = await db.query<TenantUserRow>(
    `SELECT user_id, tenant_id, user_name, user_email, user_password
       FROM tenant_users
      WHERE lower(user_email) = $1
      LIMIT 1`,
    [email],
  );
  const row = result.rows[0];

  // Always run bcrypt to keep timing roughly constant whether or not the email exists.
  const dummyHash = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8pZ3SAeQ7eR8hCQB1m0F1q9p4hQ4qa";
  const ok = await bcrypt.compare(password, row?.user_password ?? dummyHash);

  if (!row || !ok) {
    return {
      errors: { form: ["Invalid email or password."] },
      values: { email },
    };
  }

  await createSession({
    userId: row.user_id,
    tenantId: row.tenant_id,
    email: row.user_email,
    name: row.user_name,
  });

  redirect("/editor");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function signupAction(_state: SignupFormState, formData: FormData): Promise<SignupFormState> {
  const session = await getSession();
  if (!session) {
    return { errors: { form: ["You must be signed in to add new users."] } };
  }

  const parsed = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
      },
    };
  }

  const { name, email, password } = parsed.data;

  const existing = await db.query<{ user_id: string }>(
    `SELECT user_id FROM tenant_users WHERE lower(user_email) = $1 LIMIT 1`,
    [email],
  );
  if (existing.rows.length > 0) {
    return {
      errors: { email: ["A user with that email already exists."] },
      values: { name, email },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.query(
    `INSERT INTO tenant_users (tenant_id, user_name, user_email, user_password)
     VALUES ($1, $2, $3, $4)`,
    [session.tenantId, name, email, passwordHash],
  );

  return { success: { name, email } };
}
