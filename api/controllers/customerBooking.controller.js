import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  sendBookingEmail,
  sendBookingEmailToAdmin,
} from "../lib/sendBookingEmail.js";

export const customerBookingController = {
  create: catchAsync(async (req, res, next) => {
    const { branch_id, date, services, customer, notes } = req.body;

    // ------------------------
    // 1) Basic validation
    // ------------------------
    if (
      !branch_id ||
      !date ||
      !Array.isArray(services) ||
      services.length === 0
    ) {
      return next(new AppError("Invalid booking data", 400));
    }

    for (const service of services) {
      if (!service.service_id || !service.quantity || service.quantity < 1) {
        return next(
          new AppError(
            "Each service must have a valid service_id and quantity (>= 1)",
            400,
          ),
        );
      }
    }

    if (!customer?.phone) {
      return next(new AppError("Customer phone is required", 400));
    }

    const serviceIds = services.map((s) => s.service_id);

    // helper to normalize inputs
    const norm = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    let customerId = null;
    let bookingId = null;

    // ------------------------
    // 2) Always create customer
    // ------------------------
    const { data: newCustomer, error: createCustomerError } =
      await supabaseAdmin
        .from("customers")
        .insert({
          first_name: norm(customer.first_name),
          last_name: norm(customer.last_name),
          phone: norm(customer.phone),
          email: norm(customer.email),
          gender: norm(customer.gender),
          nationality: norm(customer.nationality),
        })
        .select("id, first_name, last_name, email, phone")
        .single();

    if (createCustomerError) return next(createCustomerError);

    customerId = newCustomer.id;

    try {
      // ------------------------
      // 3) Transfer fields (stored on `bookings`)
      // ------------------------
      // If `requires_transfer` is not provided by frontend, infer it from pickup_location existence.
      const pickupLocationRaw = req.body?.pickup_location;
      const requiresTransferRaw = req.body?.requires_transfer;

      const pickupLocation = norm(pickupLocationRaw);
      const requiresTransfer =
        requiresTransferRaw === undefined ? Boolean(pickupLocation) : Boolean(requiresTransferRaw);

      if (requiresTransfer && !pickupLocation) {
        return next(
          new AppError(
            "pickup_location is required when requires_transfer is true",
            400,
          ),
        );
      }

      // ------------------------
      // 4) Fetch pricing
      // ------------------------
      const { data: pricing, error: pricingError } = await supabaseAdmin
        .from("branch_service_pricing")
        .select(
          `
          service_id,
          price_amount,
          currency,
          duration_min,
          services ( name )
        `,
        )
        .eq("branch_id", branch_id)
        .in("service_id", serviceIds)
        .eq("is_active", true);

      if (pricingError) throw pricingError;

      if (pricing.length !== serviceIds.length) {
        throw new AppError(
          "One or more services are not available for this branch",
          400,
        );
      }

      // ✅ (اختياري) هات اسم الفرع بدل ما نعرض ID في الإيميل
      const { data: branchRow, error: branchError } = await supabaseAdmin
        .from("branches")
        .select("id, name")
        .eq("id", branch_id)
        .single();

      // لو فشلنا في جلب الفرع، مش هنوقف الحجز
      const branchName = branchError ? null : branchRow?.name;

      // ------------------------
      // 5) Create booking
      // ------------------------
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .insert({
          branch_id,
          customer_id: customerId,
          status: "confirmed",
          date,
          notes: norm(notes),
          total_amount: 0,
          requires_transfer: requiresTransfer,
          pickup_location: requiresTransfer ? pickupLocation : null,
        })
        .select()
        .single();

    if (bookingError) throw bookingError;
    bookingId = booking.id;

      // ------------------------
      // 6) Create booking items
      // ------------------------
      let grandTotal = 0;

      const items = services.map((service, index) => {
        const p = pricing.find((x) => x.service_id === service.service_id);
        const quantity = service.quantity;
        const itemTotal = Number(p.price_amount) * quantity;
        grandTotal += itemTotal;

        return {
          booking_id: booking.id,
          service_id: service.service_id,
          service_name_snapshot: p.services.name,
          price_amount_snapshot: p.price_amount,
          currency_snapshot: p.currency,
          duration_min_snapshot: p.duration_min,
          quantity,
          sort_order: index + 1,
        };
      });

      // ------------------------
      // Promo code (optional): compute discount & update booking totals
      // We start by assuming `final_amount` is not required; we store the final total in `bookings.total_amount`.
      // ------------------------
      const promoCodeRaw = req.body?.promo_code;
      const promoCodeIdRaw = req.body?.promo_code_id;

      const promoCode = norm(promoCodeRaw);
      const promoCodeId =
        promoCodeIdRaw === undefined || promoCodeIdRaw === null
          ? null
          : Number(promoCodeIdRaw);

      let appliedPromo = null;
      let discountAmount = 0;
      let subtotalAmount = grandTotal;
      let totalAfterDiscount = grandTotal;

      if (promoCode || promoCodeId) {
        const now = new Date();
        const usageStatuses = ["pending", "confirmed"];

        // 1) Fetch promo code
        const { data: promo, error: promoErr } = promoCodeId
          ? await supabaseAdmin
              .from("promo_codes")
              .select(
                "id, code, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, is_active",
              )
              .eq("id", promoCodeId)
              .maybeSingle()
          : await supabaseAdmin
              .from("promo_codes")
              .select(
                "id, code, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, is_active",
              )
              .ilike("code", promoCode)
              .maybeSingle();

        if (promoErr) throw promoErr;
        if (!promo) {
          throw new AppError("Invalid promo code", 400);
        }

        // 2) Validate promo active/date
        if (promo.is_active !== true) {
          throw new AppError("Promo code is not active", 400);
        }

        if (promo.start_at) {
          const start = new Date(promo.start_at);
          if (!isNaN(start.getTime()) && now < start) {
            throw new AppError("Promo code is not started yet", 400);
          }
        }

        if (promo.end_at) {
          const end = new Date(promo.end_at);
          if (!isNaN(end.getTime()) && now > end) {
            throw new AppError("Promo code is expired", 400);
          }
        }

        // 3) Validate min amount
        if (promo.min_amount !== null && promo.min_amount !== undefined) {
          const minAmount = Number(promo.min_amount);
          if (Number.isFinite(minAmount) && subtotalAmount < minAmount) {
            throw new AppError("Subtotal does not meet promo minimum amount", 400);
          }
        }

        // 4) Usage limits (on bookings)
        if (
          promo.usage_limit_total !== null &&
          promo.usage_limit_total !== undefined
        ) {
          const { count: usedTotal } = await supabaseAdmin
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("promo_code_id", promo.id)
            .in("status", usageStatuses);

          const used = Number(usedTotal || 0);
          const limit = Number(promo.usage_limit_total);
          if (Number.isFinite(limit) && used >= limit) {
            throw new AppError("Promo code total usage limit reached", 400);
          }
        }

        // 5) Calculate discount
        const dType = String(promo.discount_type || "").toLowerCase();
        const dValue = Number(promo.discount_value || 0);
        if (!Number.isFinite(dValue) || dValue < 0) {
          throw new AppError("Invalid promo discount value", 400);
        }

        let discountRaw = 0;
        if (dType.includes("percent")) {
          discountRaw = subtotalAmount * (dValue / 100);
        } else {
          // amount / fixed
          discountRaw = dValue;
        }

        if (!Number.isFinite(discountRaw) || discountRaw < 0) discountRaw = 0;

        if (promo.max_discount_amount !== null && promo.max_discount_amount !== undefined) {
          const maxDiscount = Number(promo.max_discount_amount);
          if (Number.isFinite(maxDiscount)) {
            discountRaw = Math.min(discountRaw, maxDiscount);
          }
        }

        discountAmount = Math.min(discountRaw, subtotalAmount);
        totalAfterDiscount = subtotalAmount - discountAmount;
        appliedPromo = promo;
      }

      const { error: itemsError } = await supabaseAdmin
        .from("booking_items")
        .insert(items);
      if (itemsError) throw itemsError;

      // ------------------------
      // 7) Update totals (+ promo data)
      // ------------------------
      grandTotal = totalAfterDiscount;

      const promoSnapshot = appliedPromo
        ? JSON.stringify({
            id: appliedPromo.id,
            code: appliedPromo.code,
            discount_type: appliedPromo.discount_type,
            discount_value: appliedPromo.discount_value,
            applied_at: new Date().toISOString(),
          })
        : null;

      const { error: totalError } = await supabaseAdmin
        .from("bookings")
        .update({
          total_amount: totalAfterDiscount,
          promo_code_id: appliedPromo ? appliedPromo.id : null,
          promo_code_snapshot: promoSnapshot,
          subtotal_amount: appliedPromo ? subtotalAmount : null,
          discount_amount: appliedPromo ? discountAmount : null,
        })
        .eq("id", booking.id);

      if (totalError) throw totalError;

      // ------------------------
      // 8) Build response + send email
      // ------------------------
      const itemsBreakdown = items.map((item) => ({
        service_name: item.service_name_snapshot,
        unit_price: item.price_amount_snapshot,
        quantity: item.quantity,
        item_total: Number(item.price_amount_snapshot) * item.quantity,
        currency: item.currency_snapshot,
      }));

      const emailPayload = {
        booking: {
          id: booking.id,
          date: booking.date,
          branch_id,
          branch_name: branchName,
          notes: booking.notes,
        },
        customer: {
          first_name: newCustomer.first_name,
          last_name: newCustomer.last_name,
          email: newCustomer.email,
          phone: newCustomer.phone,
        },
        items: itemsBreakdown,
        totals: {
          grand_total: grandTotal,
          currency: itemsBreakdown?.[0]?.currency || null,
        },
      };

      if (newCustomer.email) {
        try {
          await sendBookingEmail(emailPayload);
        } catch (emailErr) {
          console.error("Failed to send booking email:", emailErr);
        }
      }

      try {
        await sendBookingEmailToAdmin(emailPayload);
      } catch (adminEmailErr) {
        console.error("Failed to send admin booking email:", adminEmailErr);
      }

      return res.status(201).json({
        success: true,
        booking_id: booking.id,
        items: itemsBreakdown,
        grand_total: grandTotal,
        requires_transfer: Boolean(booking.requires_transfer),
        pickup_location: booking.pickup_location ?? null,
      });
    } catch (err) {
      // ✅ Cleanup: remove rows created in this request to avoid orphan records
      if (bookingId) {
        await supabaseAdmin.from("booking_items").delete().eq("booking_id", bookingId);
        await supabaseAdmin.from("bookings").delete().eq("id", bookingId);
      }
      await supabaseAdmin.from("customers").delete().eq("id", customerId);
      return next(err);
    }
  }),
};
