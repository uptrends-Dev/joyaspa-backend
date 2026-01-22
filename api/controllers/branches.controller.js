import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set(["id", "name", "created_at", "is_active"]);

export const branchesController = {
  // GET /api/admin/branches?page=1&limit=10&sortBy=created_at&sortOrder=desc&is_active=true&search=maadi
  getAll: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10", 10), 1),
      100,
    );

    const sortByRaw = (req.query.sortBy || "created_at").toString();
    const sortBy = allowedSortFields.has(sortByRaw) ? sortByRaw : "created_at";

    const sortOrderRaw = (req.query.sortOrder || "desc")
      .toString()
      .toLowerCase();
    const ascending = sortOrderRaw !== "desc";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const isActive =
      req.query.is_active === undefined
        ? null
        : req.query.is_active === "true" || req.query.is_active === true;

    const search = (req.query.search || "").toString().trim();

    let query = supabaseAdmin
      .from("branches")
      .select("id, name, address, phone, is_active, created_at", {
        count: "exact",
      });

    // filters
    if (isActive !== null) query = query.eq("is_active", isActive);

    // search على الاسم أو العنوان (استخدم or)
    if (search) {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
    }

    const {
      data: branches,
      error,
      count,
    } = await query.order(sortBy, { ascending }).range(from, to);

    if (error) return next(new AppError("Failed to fetch branches", 500));

    return res.status(200).json({
      status: "success",
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
      data: { branches },
    });
  }),

  // GET /api/admin/branches/:id
  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .select("id, name, address, phone, is_active, created_at")
      .eq("id", id)
      .single();

    if (error || !branch) return next(new AppError("Branch not found", 404));

    return res.status(200).json({
      status: "success",
      data: { branch },
    });
  }),

  // POST /api/admin/branches
  create: catchAsync(async (req, res, next) => {
    const { name, address = null, phone = null, is_active = true } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return next(new AppError("name is required", 400));
    }

    const payload = {
      name: name.trim(),
      address,
      phone,
      is_active: Boolean(is_active),
    };

    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .insert([payload])
      .select("id, name, address, phone, is_active, created_at")
      .single();

    if (error || !branch)
      return next(new AppError("Failed to create branch", 500));

    return res.status(201).json({
      status: "success",
      data: { branch },
    });
  }),

  // PUT /api/admin/branches/:id
  update: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, address, phone, is_active } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return next(new AppError("name must be a non-empty string", 400));
      }
      updates.name = name.trim();
    }

    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      return next(new AppError("No fields to update", 400));
    }

    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .update(updates)
      .eq("id", id)
      .select("id, name, address, phone, is_active, created_at")
      .single();

    if (error || !branch) return next(new AppError("Branch not found", 404));

    return res.status(200).json({
      status: "success",
      data: { branch },
    });
  }),

  // DELETE /api/admin/branches/:id
  remove: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) return next(new AppError("Branch id is required", 400));

    // 1) تأكد إن الفرع موجود
    const { data: branch, error: bErr } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("id", id)
      .single();

    if (bErr || !branch) {
      return next(new AppError("Branch not found", 404));
    }

    // 2) هل الفرع مستخدم في branch_service_pricing؟
    const { data: pricingUsage, error: pErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id")
      .eq("branch_id", id)
      .limit(1);

    if (pErr) {
      return next(new AppError("Failed to check branch pricing usage", 500));
    }

    if (pricingUsage && pricingUsage.length > 0) {
      return next(
        new AppError(
          "Branch is used in branch pricing and cannot be deleted",
          409,
        ),
      );
    }

    const { data: bookingUsage, error: bkErr } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("branch_id", id)
      .limit(1);

    if (bkErr) {
      return next(new AppError("Failed to check branch bookings usage", 500));
    }

    if (bookingUsage && bookingUsage.length > 0) {
      return next(
        new AppError("Branch is used in bookings and cannot be deleted", 409),
      );
    }

    // 4) safe to delete
    const { error: dErr } = await supabaseAdmin
      .from("branches")
      .delete()
      .eq("id", id);

    if (dErr) {
      return next(new AppError("Failed to delete branch", 500));
    }

    return res.status(200).json({
      status: "success",
      message: "Branch deleted successfully",
    });
  }),

  // PATCH /api/admin/branches/:id/toggle
  toggleActive: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: existing, error: e1 } = await supabaseAdmin
      .from("branches")
      .select("id, is_active")
      .eq("id", id)
      .single();

    if (e1 || !existing) return next(new AppError("Branch not found", 404));

    const { data: branch, error: e2 } = await supabaseAdmin
      .from("branches")
      .update({ is_active: !existing.is_active })
      .eq("id", id)
      .select("id, name, address, phone, is_active, created_at")
      .single();

    if (e2 || !branch)
      return next(new AppError("Failed to toggle branch", 500));

    return res.status(200).json({
      status: "success",
      data: { branch },
    });
  }),

 branchsList: catchAsync(async (req, res, next) => {
   const { data: branches, error } = await supabaseAdmin
     .from("branches")
     .select("id, name")
     .eq("is_active", true)
     .order("name", { ascending: true });
 
   if (error) {
     return next(new AppError("Failed to fetch branches", 500));
   }
 
   return res.status(200).json({
     status: "success",
     data: {
       branches,
     },
   });
 }),
 
};
