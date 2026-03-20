import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

function norm(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toNullableNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parsePromoId(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const promoValidateController = {
  // POST /api/customer/promo-codes/validate
  // Body: { promo_code?, promo_code_id?, subtotal_amount }
  validate: catchAsync(async (req, res, next) => {
    const promoCodeRaw = req.body?.promo_code;
    const promoCodeId = parsePromoId(req.body?.promo_code_id);
    const promoCode = norm(promoCodeRaw);

    const subtotalAmount = toNullableNumber(req.body?.subtotal_amount);

    if (!Number.isFinite(subtotalAmount)) {
      return next(new AppError("subtotal_amount is required", 400));
    }
    if (subtotalAmount < 0) {
      return next(new AppError("subtotal_amount must be >= 0", 400));
    }

    if ((!promoCode && !promoCodeId) || (promoCode && promoCodeId)) {
      return next(
        new AppError("Provide exactly one of promo_code or promo_code_id", 400),
      );
    }

    const usageStatuses = ["pending", "confirmed"];
    const now = new Date();

    // 1) Fetch promo
    const { data: promo, error: promoErr } = promoCodeId
      ? await supabaseAdmin
          .from("promo_codes")
          .select(
            "id, code, description, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, is_active",
          )
          .eq("id", promoCodeId)
          .maybeSingle()
      : await supabaseAdmin
          .from("promo_codes")
          .select(
            "id, code, description, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, is_active",
          )
          .ilike("code", promoCode)
          .maybeSingle();

    if (promoErr) throw promoErr;
    if (!promo) return next(new AppError("Invalid promo code", 400));

    // 2) Active/date checks
    if (promo.is_active !== true) {
      return next(new AppError("Promo code is not active", 400));
    }

    if (promo.start_at) {
      const start = new Date(promo.start_at);
      if (!isNaN(start.getTime()) && now < start) {
        return next(new AppError("Promo code is not started yet", 400));
      }
    }

    if (promo.end_at) {
      const end = new Date(promo.end_at);
      if (!isNaN(end.getTime()) && now > end) {
        return next(new AppError("Promo code is expired", 400));
      }
    }

    // 3) Min amount
    if (promo.min_amount !== null && promo.min_amount !== undefined) {
      const minAmount = Number(promo.min_amount);
      if (Number.isFinite(minAmount) && subtotalAmount < minAmount) {
        return next(
          new AppError("Subtotal does not meet promo minimum amount", 400),
        );
      }
    }

    // 4) Usage limits (on bookings)
    if (promo.usage_limit_total !== null && promo.usage_limit_total !== undefined) {
      const { count: usedTotal } = await supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("promo_code_id", promo.id)
        .in("status", usageStatuses);

      const used = Number(usedTotal || 0);
      const limit = Number(promo.usage_limit_total);
      if (Number.isFinite(limit) && used >= limit) {
        return next(new AppError("Promo code total usage limit reached", 400));
      }
    }

    // 5) Calculate discount
    const dType = String(promo.discount_type || "").toLowerCase();
    const dValue = Number(promo.discount_value || 0);
    if (!Number.isFinite(dValue) || dValue < 0) {
      return next(new AppError("Invalid promo discount value", 400));
    }

    let discountRaw = 0;
    if (dType.includes("percent")) {
      discountRaw = subtotalAmount * (dValue / 100);
    } else {
      discountRaw = dValue;
    }

    if (!Number.isFinite(discountRaw) || discountRaw < 0) discountRaw = 0;

    if (
      promo.max_discount_amount !== null &&
      promo.max_discount_amount !== undefined
    ) {
      const maxDiscount = Number(promo.max_discount_amount);
      if (Number.isFinite(maxDiscount)) {
        discountRaw = Math.min(discountRaw, maxDiscount);
      }
    }

    const discountAmount = Math.min(discountRaw, subtotalAmount);
    const totalAmount = subtotalAmount - discountAmount;

    const promoSnapshot = JSON.stringify({
      id: promo.id,
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      applied_at: now.toISOString(),
    });

    return res.status(200).json({
      valid: true,
      promo: {
        promo_code_id: promo.id,
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        min_amount: promo.min_amount,
        max_discount_amount: promo.max_discount_amount,
        start_at: promo.start_at,
        end_at: promo.end_at,
      },
      pricing: {
        subtotal_amount: subtotalAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
      },
      promo_code_snapshot: promoSnapshot,
    });
  }),
};

