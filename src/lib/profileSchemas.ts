import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(40, "Display name must be at most 40 characters");

export const bioSchema = z
  .string()
  .trim()
  .max(180, "Bio must be at most 180 characters");

export const profileEditSchema = z.object({
  username: usernameSchema,
  display_name: displayNameSchema,
  bio: bioSchema.optional().or(z.literal("")),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;
