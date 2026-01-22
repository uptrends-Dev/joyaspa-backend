import { z } from "zod";

export const createBookingValidator = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  serviceId: z.string().min(1, "Service ID is required"),
  branchId: z.string().min(1, "Branch ID is required"),
  bookingDate: z.string().datetime("Invalid booking date"),
  notes: z.string().optional(),
});

export const updateBookingValidator = z.object({
  bookingDate: z.string().datetime("Invalid booking date").optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});
