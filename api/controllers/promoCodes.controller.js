import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedDiscountTypes = new Set(["percentage", "amount", "percent", "fixed"]);

function normalizeDiscountType(type) {
  if (type === undefined || type === null) return null;
  const t = String(type).trim().toLowerCase();
  if (t === "percent") return "percentage";
  if (t === "fixed") return "amount";
  return t;
}

function toNullableNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNullableInt(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export const promoCodesController = {
  // GET /api/admin/promo-codes
  getAll: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const allowedSortFields = new Set([
      "id",
      "code",
      "is_active",
      "created_at",
      "start_at",
      "end_at",
    ]);
    const sortByRaw = (req.query.sortBy || "created_at").toString();
    const sortBy = allowedSortFields.has(sortByRaw) ? sortByRaw : "created_at";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const search = (req.query.search || "").toString().trim();
    const isActive =
      req.query.is_active === undefined
        ? null
        : req.query.is_active === "true" || req.query.is_active === true;

    let q = supabaseAdmin
      .from("promo_codes")
      .select(
        "id, code, description, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, usage_limit_per_customer, is_active, created_at",
        { count: "exact" },
      );

    if (search) q = q.ilike("code", `%${search}%`);
    if (isActive !== null) q = q.eq("is_active", isActive);

    const { data: promos, error, count } = await q
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(from, to);

    if (error) return next(new AppError(`Failed to fetch promo codes: ${error.message}`, 500));

    return res.status(200).json({
      status: "success",
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
      data: { promos },
    });
  }),

  // GET /api/admin/promo-codes/:id
  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId)) return next(new AppError("Invalid promo id", 400));

    const { data: promo, error } = await supabaseAdmin
      .from("promo_codes")
      .select(
        "id, code, description, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, usage_limit_per_customer, is_active, created_at",
      )
      .eq("id", parsedId)
      .single();

    if (error || !promo) return next(new AppError("Promo code not found", 404));

    return res.status(200).json({ status: "success", data: { promo } });
  }),

  // POST /api/admin/promo-codes
  create: catchAsync(async (req, res, next) => {
    const {
      code,
      description = null,
      discount_type,
      discount_value,
      min_amount = null,
      max_discount_amount = null,
      start_at = null,
      end_at = null,
      usage_limit_total = null,
      usage_limit_per_customer = null,
      is_active = true,
    } = req.body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return next(new AppError("code is required", 400));
    }

    const normalizedType = normalizeDiscountType(discount_type);
    if (!normalizedType || !allowedDiscountTypes.has(normalizedType)) {
      return next(new AppError("discount_type must be percentage or amount", 400));
    }

    const dv = Number(discount_value);
    if (!Number.isFinite(dv) || dv < 0) return next(new AppError("discount_value must be >= 0", 400));

    const minAmt = toNullableNumber(min_amount);
    const maxDiscAmt = toNullableNumber(max_discount_amount);
    if (minAmt !== null && minAmt < 0) return next(new AppError("min_amount must be >= 0", 400));
    if (maxDiscAmt !== null && maxDiscAmt < 0) return next(new AppError("max_discount_amount must be >= 0", 400));

    const limitTotal = toNullableInt(usage_limit_total);
    const limitPerCustomer = toNullableInt(usage_limit_per_customer);
    if (limitTotal !== null && limitTotal < 0) return next(new AppError("usage_limit_total must be >= 0", 400));
    if (limitPerCustomer !== null && limitPerCustomer < 0) return next(new AppError("usage_limit_per_customer must be >= 0", 400));

    const payload = {
      code: code.trim(),
      description,
      discount_type: normalizedType,
      discount_value: dv,
      min_amount: minAmt,
      max_discount_amount: maxDiscAmt,
      start_at: start_at === undefined ? null : start_at,
      end_at: end_at === undefined ? null : end_at,
      usage_limit_total: limitTotal,
      usage_limit_per_customer: limitPerCustomer,
      is_active: Boolean(is_active),
    };

    if (payload.start_at && payload.end_at) {
      const s = new Date(payload.start_at);
      const e = new Date(payload.end_at);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
        return next(new AppError("start_at must be <= end_at", 400));
      }
    }

    const { data: promo, error } = await supabaseAdmin
      .from("promo_codes")
      .insert([payload])
      .select(
        "id, code, description, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, usage_limit_per_customer, is_active, created_at",
      )
      .single();

    if (error) return next(new AppError(`Failed to create promo: ${error.message}`, 500));

    return res.status(201).json({ status: "success", data: { promo } });
  }),

  // PUT /api/admin/promo-codes/:id
  update: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId)) return next(new AppError("Invalid promo id", 400));

    const {
      code,
      description,
      discount_type,
      discount_value,
      min_amount,
      max_discount_amount,
      start_at,
      end_at,
      usage_limit_total,
      usage_limit_per_customer,
      is_active,
    } = req.body;

    const updates = {};

    if (code !== undefined) {
      if (!code || typeof code !== "string" || !code.trim()) {
        return next(new AppError("code must be a non-empty string", 400));
      }
      updates.code = code.trim();
    }

    if (description !== undefined) updates.description = description;

    if (discount_type !== undefined) {
      const normalizedType = normalizeDiscountType(discount_type);
      if (!normalizedType || !allowedDiscountTypes.has(normalizedType)) {
        return next(new AppError("discount_type must be percentage or amount", 400));
      }
      updates.discount_type = normalizedType;
    }

    if (discount_value !== undefined) {
      const dv = Number(discount_value);
      if (!Number.isFinite(dv) || dv < 0) return next(new AppError("discount_value must be >= 0", 400));
      updates.discount_value = dv;
    }

    if (min_amount !== undefined) updates.min_amount = toNullableNumber(min_amount);
    if (max_discount_amount !== undefined) updates.max_discount_amount = toNullableNumber(max_discount_amount);

    if (updates.min_amount !== undefined && updates.min_amount !== null && updates.min_amount < 0) {
      return next(new AppError("min_amount must be >= 0", 400));
    }
    if (
      updates.max_discount_amount !== undefined &&
      updates.max_discount_amount !== null &&
      updates.max_discount_amount < 0
    ) {
      return next(new AppError("max_discount_amount must be >= 0", 400));
    }

    if (start_at !== undefined) updates.start_at = start_at;
    if (end_at !== undefined) updates.end_at = end_at;

    if (usage_limit_total !== undefined) updates.usage_limit_total = toNullableInt(usage_limit_total);
    if (usage_limit_per_customer !== undefined)
      updates.usage_limit_per_customer = toNullableInt(usage_limit_per_customer);

    if (updates.usage_limit_total !== undefined && updates.usage_limit_total !== null && updates.usage_limit_total < 0) {
      return next(new AppError("usage_limit_total must be >= 0", 400));
    }
    if (
      updates.usage_limit_per_customer !== undefined &&
      updates.usage_limit_per_customer !== null &&
      updates.usage_limit_per_customer < 0
    ) {
      return next(new AppError("usage_limit_per_customer must be >= 0", 400));
    }

    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      return next(new AppError("No fields to update", 400));
    }

    if (updates.start_at && updates.end_at) {
      const s = new Date(updates.start_at);
      const e = new Date(updates.end_at);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
        return next(new AppError("start_at must be <= end_at", 400));
      }
    }

    const { data: promo, error } = await supabaseAdmin
      .from("promo_codes")
      .update(updates)
      .eq("id", parsedId)
      .select(
        "id, code, description, discount_type, discount_value, min_amount, max_discount_amount, start_at, end_at, usage_limit_total, usage_limit_per_customer, is_active, created_at",
      )
      .single();

    if (error || !promo) return next(new AppError("Promo code not found", 404));

    return res.status(200).json({ status: "success", data: { promo } });
  }),

  // DELETE /api/admin/promo-codes/:id
  remove: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId)) return next(new AppError("Invalid promo id", 400));

    const { data: existing, error: cErr } = await supabaseAdmin
      .from("promo_codes")
      .select("id, code")
      .eq("id", parsedId)
      .single();

    if (cErr || !existing) return next(new AppError("Promo code not found", 404));

    // Prevent deletion if already used in bookings
    const { data: used, error: uErr } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("promo_code_id", parsedId)
      .limit(1);

    if (uErr) return next(new AppError("Failed to check promo usage", 500));
    if (used && used.length > 0) {
      return next(new AppError("Promo code is used by bookings; cannot delete", 409));
    }

    const { error: dErr } = await supabaseAdmin
      .from("promo_codes")
      .delete()
      .eq("id", parsedId);

    if (dErr) return next(new AppError("Failed to delete promo code", 500));

    return res.status(200).json({ status: "success", message: "Promo code deleted successfully" });
  }),

  // PATCH /api/admin/promo-codes/:id/toggle
  toggleActive: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (!Number.isFinite(parsedId)) return next(new AppError("Invalid promo id", 400));

    const { data: existing, error: e1 } = await supabaseAdmin
      .from("promo_codes")
      .select("id, is_active")
      .eq("id", parsedId)
      .single();

    if (e1 || !existing) return next(new AppError("Promo code not found", 404));

    const { data: promo, error: e2 } = await supabaseAdmin
      .from("promo_codes")
      .update({ is_active: !existing.is_active })
      .eq("id", parsedId)
      .select(
        "id, code, is_active, created_at, start_at, end_at",
      )
      .single();

    if (e2 || !promo) return next(new AppError("Failed to toggle promo", 500));

    return res.status(200).json({ status: "success", data: { promo } });
  }),
};

