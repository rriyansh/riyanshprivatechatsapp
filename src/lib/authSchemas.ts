import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Please enter a valid email address" })
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password is too long" });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Password is required" }).max(72),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const resetSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z.object({ password: passwordSchema });

// Friendly auth error mapping
export const friendlyAuthError = (msg: string | undefined) => {
  if (!msg) return "Something went wrong. Please try again.";
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Invalid email or password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first.";
  if (m.includes("user already registered")) return "An account with this email already exists.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("password")) return msg;
  return msg;
};
