import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Password is required." }),
});

export const SignupSchema = z.object({
  name: z.string().trim().min(2, { error: "Name must be at least 2 characters." }),
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  password: z
    .string()
    .min(8, { error: "At least 8 characters." })
    .regex(/[a-zA-Z]/, { error: "Must contain a letter." })
    .regex(/[0-9]/, { error: "Must contain a number." }),
});

export type LoginFormState =
  | {
      errors?: { email?: string[]; password?: string[]; form?: string[] };
      values?: { email?: string };
    }
  | undefined;

export type SignupFormState =
  | {
      errors?: { name?: string[]; email?: string[]; password?: string[]; form?: string[] };
      values?: { name?: string; email?: string };
      success?: { name: string; email: string };
    }
  | undefined;

export type SessionPayload = {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  exp?: number;
  iat?: number;
};
