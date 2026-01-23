import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const customerBrowseController = {
  // GET /api/customer/browse/branches/:branchId/services
  getServicesByBranchId: catchAsync(async (req, res, next) => {
    const { branchId } = req.params;
    const { category_id } = req.query; // ✅ جديد

    if (!branchId || !Number.isFinite(Number(branchId))) {
      return next(
        new AppError("branchId is required and must be a number", 400),
      );
    }

    // ✅ validate category_id لو موجود
    if (category_id !== undefined && !Number.isFinite(Number(category_id))) {
      return next(new AppError("category_id must be a number", 400));
    }

    // (اختياري) اتأكد إن الفرع موجود وactive
    const { data: branch, error: bErr } = await supabaseAdmin
      .from("branches")
      .select("id, name, is_active")
      .eq("id", branchId)
      .single();

    if (bErr || !branch) return next(new AppError("Branch not found", 404));
    if (!branch.is_active)
      return next(new AppError("Branch is not active", 404));

    // ✅ ابنِ query وطبّق الفلاتر تدريجيًا
    let q = supabaseAdmin
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
      services:service_id (
        id,
        name,
        description,
        default_duration_min,
        is_active,
        category_id,
        created_at,
        service_categories:category_id (
          id,
          name
        )
      )
    `,
      )
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .filter("services.is_active", "eq", true);

    // ✅ فلتر بالكاتيجوري لو موجود
    if (category_id !== undefined) {
      q = q.filter("services.category_id", "eq", Number(category_id));
    }

    const { data: rows, error } = await q;

    if (error)
      return next(new AppError("Failed to fetch services for branch", 500));

    const services = (rows || [])
      .filter((r) => r.services)
      .map((r) => ({
        service: {
          id: r.services.id,
          name: r.services.name,
          description: r.services.description,
          price_amount: r.price_amount,
          currency: r.currency,
          duration_min: r.duration_min,
          category: r.services.service_categories
            ? {
                id: r.services.service_categories.id,
                name: r.services.service_categories.name,
              }
            : null,
        },
      }));

    return res.status(200).json({
      status: "success",
      data: {
        branch: { id: branch.id, name: branch.name },
        category_id: category_id !== undefined ? Number(category_id) : null, // اختياري
        services,
      },
    });
  }),

  getBranches: catchAsync(async (req, res, next) => {
    const { data: branches, error } = await supabaseAdmin
      .from("branches")
      .select("id, name, address, phone")
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
