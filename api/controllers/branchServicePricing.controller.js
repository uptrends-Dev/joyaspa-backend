import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set([
  "id",
  "created_at",
  "price_amount",
  "duration_min",
  "is_active",
  "branch_id",
  "service_id",
]);

const allowedCurrencies = new Set(["EGP", "USD", "EUR", "SAR", "AED"]); // عدّل زي ما تحب

export const branchServicePricingController = {
  // GET /api/admin/branch-service-pricing?page=1&limit=10&branch_id=1&service_id=2&is_active=true&sortBy=created_at&sortOrder=desc
  getAll: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);

    const sortByRaw = (req.query.sortBy || "created_at").toString();
    const sortBy = allowedSortFields.has(sortByRaw) ? sortByRaw : "created_at";

    const sortOrderRaw = (req.query.sortOrder || "desc").toString().toLowerCase();
    const ascending = sortOrderRaw !== "desc";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const serviceId = req.query.service_id ? Number(req.query.service_id) : null;

    const isActive =
      req.query.is_active === undefined
        ? null
        : req.query.is_active === "true" || req.query.is_active === true;

    let query = supabaseAdmin
      .from("branch_service_pricing")
      .select(
        `
        id,
        branch_id,
        service_id,
        price_amount,
        currency,
        duration_min,
        is_active,
        created_at,
        branches:branch_id ( id, name ),
        services:service_id ( id, name, category_id )
      `,
        { count: "exact" }
      );

    if (branchId) query = query.eq("branch_id", branchId);
    if (serviceId) query = query.eq("service_id", serviceId);
    if (isActive !== null) query = query.eq("is_active", isActive);

    const { data: pricings, error, count } = await query
      .order(sortBy, { ascending })
      .range(from, to);

    if (error) return next(new AppError("Failed to fetch branch service pricing", 500));

    return res.status(200).json({
      status: "success",
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
      data: { pricings },
    });
  }),

  // GET /api/admin/branch-service-pricing/:id
  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: pricing, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .select(
        `
        id,
        branch_id,
        service_id,
        price_amount,
        currency,
        duration_min,
        is_active,
        created_at,
        branches:branch_id ( id, name ),
        services:service_id ( id, name, category_id )
      `
      )
      .eq("id", id)
      .single();

    if (error || !pricing) return next(new AppError("Pricing not found", 404));

    return res.status(200).json({
      status: "success",
      data: { pricing },
    });
  }),

  // POST /api/admin/branch-service-pricing
  create: catchAsync(async (req, res, next) => {
    const {
      branch_id,
      service_id,
      price_amount,
      currency = "EGP",
      duration_min,
      is_active = true,
    } = req.body;

    if (!branch_id || !Number.isFinite(Number(branch_id))) {
      return next(new AppError("branch_id is required", 400));
    }
    if (!service_id || !Number.isFinite(Number(service_id))) {
      return next(new AppError("service_id is required", 400));
    }
    if (price_amount === undefined || price_amount === null || !Number.isFinite(Number(price_amount))) {
      return next(new AppError("price_amount is required and must be a number", 400));
    }
    if (Number(price_amount) < 0) {
      return next(new AppError("price_amount must be >= 0", 400));
    }
    if (duration_min === undefined || duration_min === null || !Number.isFinite(Number(duration_min))) {
      return next(new AppError("duration_min is required and must be a number", 400));
    }
    if (Number(duration_min) <= 0) {
      return next(new AppError("duration_min must be > 0", 400));
    }

    const cur = String(currency).toUpperCase();
    if (!allowedCurrencies.has(cur)) {
      return next(new AppError(`currency must be one of: ${Array.from(allowedCurrencies).join(", ")}`, 400));
    }

    // تأكد branch موجود
    const { data: br, error: brErr } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("id", branch_id)
      .single();
    if (brErr || !br) return next(new AppError("Branch not found", 404));

    // تأكد service موجود
    const { data: sv, error: svErr } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("id", service_id)
      .single();
    if (svErr || !sv) return next(new AppError("Service not found", 404));

    // (اختياري) منع تكرار نفس الخدمة في نفس الفرع
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id")
      .eq("branch_id", branch_id)
      .eq("service_id", service_id)
      .maybeSingle();

    if (exErr) return next(new AppError("Failed to validate pricing uniqueness", 500));
    if (existing) return next(new AppError("Pricing already exists for this branch and service", 409));

    const payload = {
      branch_id: Number(branch_id),
      service_id: Number(service_id),
      price_amount: Number(price_amount),
      currency: cur,
      duration_min: Number(duration_min),
      is_active: Boolean(is_active),
    };

    const { data: pricing, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .insert([payload])
      .select(
        "id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at"
      )
      .single();

    if (error || !pricing) return next(new AppError("Failed to create pricing", 500));

    return res.status(201).json({
      status: "success",
      data: { pricing },
    });
  }),

  // PUT /api/admin/branch-service-pricing/:id
  update: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { price_amount, currency, duration_min, is_active } = req.body;

    const updates = {};

    if (price_amount !== undefined) {
      const v = Number(price_amount);
      if (!Number.isFinite(v) || v < 0) return next(new AppError("price_amount must be a number >= 0", 400));
      updates.price_amount = v;
    }

    if (duration_min !== undefined) {
      const v = Number(duration_min);
      if (!Number.isFinite(v) || v <= 0) return next(new AppError("duration_min must be a number > 0", 400));
      updates.duration_min = v;
    }

    if (currency !== undefined) {
      const cur = String(currency).toUpperCase();
      if (!allowedCurrencies.has(cur)) {
        return next(new AppError(`currency must be one of: ${Array.from(allowedCurrencies).join(", ")}`, 400));
      }
      updates.currency = cur;
    }

    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      return next(new AppError("No fields to update", 400));
    }

    const { data: pricing, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .update(updates)
      .eq("id", id)
      .select("id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at")
      .single();

    if (error || !pricing) return next(new AppError("Pricing not found", 404));

    return res.status(200).json({
      status: "success",
      data: { pricing },
    });
  }),

  // DELETE /api/admin/branch-service-pricing/:id (hard delete)
  remove: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: deleted, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error || !deleted) return next(new AppError("Pricing not found", 404));

    return res.status(200).json({
      status: "success",
      message: "Pricing deleted",
    });
  }),

  // PATCH /api/admin/branch-service-pricing/:id/toggle
  toggleActive: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: existing, error: e1 } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id, is_active")
      .eq("id", id)
      .single();

    if (e1 || !existing) return next(new AppError("Pricing not found", 404));

    const { data: pricing, error: e2 } = await supabaseAdmin
      .from("branch_service_pricing")
      .update({ is_active: !existing.is_active })
      .eq("id", id)
      .select("id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at")
      .single();

    if (e2 || !pricing) return next(new AppError("Failed to toggle pricing", 500));

    return res.status(200).json({
      status: "success",
      data: { pricing },
    });
  }),
};
