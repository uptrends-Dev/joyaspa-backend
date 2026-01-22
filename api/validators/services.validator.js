import { z } from "zod";

export const createServiceValidator = z.object({
  name: z.string().min(1, "Name is required"),
  categoryId: z.string().min(1, "Category ID is required"),
  description: z.string().optional(),
  duration: z.number().positive("Duration must be positive").optional(),
});

export const updateServiceValidator = z.object({
  name: z.string().min(1, "Name is required").optional(),
  categoryId: z.string().min(1, "Category ID is required").optional(),
  description: z.string().optional(),
  duration: z.number().positive("Duration must be positive").optional(),
});
