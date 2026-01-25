import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set([
  "id",
  "name",
  "created_at",
  "default_duration_min",
  "is_active",
  "category_id",
]);

export const servicesController = {
  // GET /api/admin/services?page=1&limit=10&sortBy=created_at&sortOrder=desc&category_id=1&is_active=true&search=mass
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

    const categoryId = req.query.category_id
      ? Number(req.query.category_id)
      : null;
    const isActive =
      req.query.is_active === undefined
        ? null
        : req.query.is_active === "true" || req.query.is_active === true;

    const search = (req.query.search || "").toString().trim();

    let query = supabaseAdmin.from("services").select(
      `
        id,
        category_id,
        name,
        description,
        default_duration_min,
        is_active,
        created_at,
        service_categories:category_id ( id, name )
        
      `,
      { count: "exact" },
    );

    if (categoryId) query = query.eq("category_id", categoryId);
    if (isActive !== null) query = query.eq("is_active", isActive);
    if (search) query = query.ilike("name", `%${search}%`);

    const {
      data: services,
      error,
      count,
    } = await query.order(sortBy, { ascending }).range(from, to);

    if (error) return next(new AppError(`Failed to fetch services`, 500));

    return res.status(200).json({
      status: "success",
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
      data: { services },
    });
  }),

  // GET /api/admin/services/servicesList
  servicesList: catchAsync(async (req, res, next) => {
    const { data: servicesList, error: slr } = await supabaseAdmin
      .from("services")
      .select("id,name");

      if(slr){
        return next(new AppError("Failed to fetch servicesList", 500))
      }
      return res.status(200).json({
        status:"succcess",
        data:{servicesList}
      })
  }),

  // GET /api/admin/services/:id
  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: service, error } = await supabaseAdmin
      .from("services")
      .select(
        `
        id,
        category_id,
        name,
        description,
        default_duration_min,
        is_active,
        created_at,
        service_categories:category_id ( id, name )
      `,
      )
      .eq("id", id)
      .single();

    if (error || !service) return next(new AppError("Service not found", 404));

    return res.status(200).json({
      status: "success",
      data: { service },
    });
  }),

  // POST /api/admin/services
  create: catchAsync(async (req, res, next) => {
    const {
      category_id,
      name,
      description = null,
      default_duration_min = null,
      is_active = true,
    } = req.body;

    if (!category_id || !Number.isFinite(Number(category_id))) {
      return next(new AppError("category_id is required", 400));
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return next(new AppError("name is required", 400));
    }

    // تأكد إن الكاتيجوري موجودة
    const { data: cat, error: catErr } = await supabaseAdmin
      .from("service_categories")
      .select("id")
      .eq("id", category_id)
      .single();

    if (catErr || !cat) return next(new AppError("Category not found", 404));

    const payload = {
      category_id: Number(category_id),
      name: name.trim(),
      description,
      is_active: Boolean(is_active),
      default_duration_min:
        default_duration_min === null || default_duration_min === undefined
          ? null
          : Number(default_duration_min),
    };

    if (
      payload.default_duration_min !== null &&
      (!Number.isFinite(payload.default_duration_min) ||
        payload.default_duration_min <= 0)
    ) {
      return next(
        new AppError("default_duration_min must be a positive number", 400),
      );
    }

    const { data: service, error } = await supabaseAdmin
      .from("services")
      .insert([payload])
      .select(
        "id, category_id, name, description, default_duration_min, is_active, created_at",
      )
      .single();

    if (error || !service)
      return next(new AppError("Failed to create service", 500));

    return res.status(201).json({
      status: "success",
      data: { service },
    });
  }),

  // PUT /api/admin/services/:id
  update: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { category_id, name, description, default_duration_min, is_active } =
      req.body;

    const updates = {};

    if (category_id !== undefined) {
      if (!Number.isFinite(Number(category_id))) {
        return next(new AppError("category_id must be a number", 400));
      }

      // تأكد إن الكاتيجوري موجودة
      const { data: cat, error: catErr } = await supabaseAdmin
        .from("service_categories")
        .select("id")
        .eq("id", category_id)
        .single();

      if (catErr || !cat) return next(new AppError("Category not found", 404));

      updates.category_id = Number(category_id);
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return next(new AppError("name must be a non-empty string", 400));
      }
      updates.name = name.trim();
    }

    if (description !== undefined) updates.description = description;

    if (default_duration_min !== undefined) {
      if (default_duration_min === null) {
        updates.default_duration_min = null;
      } else {
        const v = Number(default_duration_min);
        if (!Number.isFinite(v) || v <= 0) {
          return next(
            new AppError("default_duration_min must be a positive number", 400),
          );
        }
        updates.default_duration_min = v;
      }
    }

    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      return next(new AppError("No fields to update", 400));
    }

    const { data: service, error } = await supabaseAdmin
      .from("services")
      .update(updates)
      .eq("id", id)
      .select(
        "id, category_id, name, description, default_duration_min, is_active, created_at",
      )
      .single();

    if (error || !service) return next(new AppError("Service not found", 404));

    return res.status(200).json({
      status: "success",
      data: { service },
    });
  }),

  // DELETE /api/admin/services/:id (hard delete)
  remove: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
      return next(new AppError("Service id is required", 400));
    }

    //check if used in branchServicePricing
    const { data: usage, error: Er1 } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id")
      .eq("service_id", id)
      .limit(1);

    if (Er1) {
      return next(new AppError("Failed to check service usage", 500));
    }
    if (usage && usage.length > 0) {
      return next(
        new AppError(
          "Service is used in branch pricing and cannot be deleted",
          409,
        ),
      );
    }

    // 3️⃣ safe to delete
    const { error: dErr } = await supabaseAdmin
      .from("services")
      .delete()
      .eq("id", id);

    if (dErr) {
      return next(new AppError("Failed to delete service", 500));
    }

    return res.status(200).json({
      status: "success",
      message: "Service deleted successfully",
    });
  }),

  // PATCH /api/admin/services/:id/toggle
  toggleActive: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: existing, error: e1 } = await supabaseAdmin
      .from("services")
      .select("id, is_active")
      .eq("id", id)
      .single();

    if (e1 || !existing) return next(new AppError("Service not found", 404));

    const { data: service, error: e2 } = await supabaseAdmin
      .from("services")
      .update({ is_active: !existing.is_active })
      .eq("id", id)
      .select(
        "id, category_id, name, description, default_duration_min, is_active, created_at",
      )
      .single();

    if (e2 || !service)
      return next(new AppError("Failed to toggle service", 500));

    return res.status(200).json({
      status: "success",
      data: { service },
    });
  }),
};
