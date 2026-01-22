import { z } from "zod";

export const createPricingValidator = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  branchId: z.string().min(1, "Branch ID is required"),
  price: z.number().positive("Price must be positive"),
  currency: z.string().default("SAR"),
});

export const updatePricingValidator = z.object({
  price: z.number().positive("Price must be positive").optional(),
  currency: z.string().optional(),
});
