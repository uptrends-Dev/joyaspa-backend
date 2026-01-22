import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set([
  "sort_order",
  "created_at",
  "name",
  "is_active",
  "id",
]);

export const categoriesController = {
  // GET /api/admin/categories?page=1&limit=10&sortBy=sort_order&sortOrder=asc
  getAll: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10", 10), 1),
      100,
    );

    const sortByRaw = (req.query.sortBy || "sort_order").toString();
    const sortBy = allowedSortFields.has(sortByRaw) ? sortByRaw : "sort_order";

    const sortOrderRaw = (req.query.sortOrder || "asc")
      .toString()
      .toLowerCase();
    const ascending = sortOrderRaw !== "desc";

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: categories,
      error,
      count,
    } = await supabaseAdmin
      .from("service_categories")
      .select("id, name, description, is_active, created_at", {
        count: "exact",
      })
      .order(sortBy, { ascending })
      .range(from, to);

    // if (error) return next(new AppError("Failed to fetch categories", 500));
    if (error) {
      return next(new AppError(`Supabase: ${error.message}`, 500));
    }

    return res.status(200).json({
      status: "success",
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
      data: { categories },
    });
  }),

  // GET /api/admin/categories/:id
  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const { data: category, error } = await supabaseAdmin
      .from("service_categories")
      .select("id, name, description, sort_order, is_active, created_at")
      .eq("id", id)
      .single();

    if (error || !category)
      return next(new AppError("Category not found", 404));

    return res.status(200).json({
      status: "success",
      data: { category },
    });
  }),

  // POST /api/admin/categories
  create: catchAsync(async (req, res, next) => {
    const { name, description = null, is_active = true } = req.body;

    if (!name || !name.trim()) {
      return next(new AppError("Name is required", 400));
    }

    // 1) get max sort_order
    const { data: last, error: maxErr } = await supabaseAdmin
      .from("service_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    if (maxErr && maxErr.code !== "PGRST116") {
      return next(new AppError("Failed to calculate sort order", 500));
    }

    const nextSortOrder = last?.sort_order ? last.sort_order + 1 : 1;

    // 2) create category
    const { data: category, error } = await supabaseAdmin
      .from("service_categories")
      .insert([
        {
          name: name.trim(),
          description,
          is_active,
          sort_order: nextSortOrder,
        },
      ])
      .select("*")
      .single();

    if (error) {
      return next(new AppError("Failed to create category", 500));
    }

    return res.status(201).json({
      status: "success",
      data: { category },
    });
  }),

  // PUT /api/admin/categories/:id
  update: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const updates = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return next(new AppError("Name must be a non-empty string", 400));
      }
      updates.name = name.trim();
    }
    if (description !== undefined) updates.description = description;
    // if (sort_order !== undefined) {
    //   updates.sort_order = Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0;
    // }
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    if (Object.keys(updates).length === 0) {
      return next(new AppError("No fields to update", 400));
    }

    const { data: category, error } = await supabaseAdmin
      .from("service_categories")
      .update(updates)
      .eq("id", id)
      .select("id, name, description, sort_order, is_active, created_at")
      .single();

    if (error || !category)
      return next(new AppError("Category not found", 404));

    return res.status(200).json({
      status: "success",
      data: { category },
    });
  }),

  // DELETE /api/admin/categories/:id
  remove: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) return next(new AppError("Category id is required", 400));

    // 1) تأكد إنها موجودة
    const { data: category, error: cErr } = await supabaseAdmin
      .from("service_categories")
      .select("id")
      .eq("id", id)
      .single();

    if (cErr || !category) {
      return next(new AppError("Category not found", 404));
    }

    // 2) هل category مستخدمة في services؟
    const { data: usage, error: uErr } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("category_id", id)
      .limit(1);

    if (uErr) {
      return next(new AppError("Failed to check category usage", 500));
    }

    if (usage && usage.length > 0) {
      return next(
        new AppError("Category is used in services and cannot be deleted", 409),
      );
    }

    // 3) safe to delete
    const { error: dErr } = await supabaseAdmin
      .from("service_categories")
      .delete()
      .eq("id", id);

    if (dErr) return next(new AppError("Failed to delete category", 500));

    return res.status(200).json({
      status: "success",
      message: "Category deleted successfully",
    });
  }),

  // PATCH /api/admin/categories/:id/toggle
  toggleActive: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) {
      return next(new AppError("Category id is required", 400));
    }

    // 1) check category exists
    const { data: existing, error: e1 } = await supabaseAdmin
      .from("service_categories")
      .select("id, is_active")
      .eq("id", id)
      .single();

    if (e1 || !existing) {
      return next(new AppError("Category not found", 404));
    }

    // 2) toggle is_active
    const { data: category, error: e2 } = await supabaseAdmin
      .from("service_categories")
      .update({ is_active: !existing.is_active })
      .eq("id", id)
      .select("id, name, description, sort_order, is_active, created_at")
      .single();

    if (e2 || !category) {
      return next(new AppError("Failed to toggle category", 500));
    }

    return res.status(200).json({
      status: "success",
      data: { category },
    });
  }),
  //GET  /api/admin/categories/categoriesList
  categoriesList: catchAsync(async (req, res, next) => {
    const { data: categoriesList, error: clr } = await supabaseAdmin
      .from("service_categories")
      .select("id , name");
    if (clr) {
      return next(new AppError("Failed to fetch categoriesList", 500));
    }
    return res.status(200).json({
      status: "success",
      data: { categoriesList },
    });
  }),
};
