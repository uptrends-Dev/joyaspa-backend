import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set([
  "id",
  "name",
  "created_at",
  "is_active",
  "slug",
]);
const BRANCH_SELECT =
  "id, name, address, phone, is_active, created_at, country, city, region, slug, description, hotel_id, image_url_1, image_url_2, image_url_3, image_url_4, image_url_5";

/** Resolve branch by id (numeric) or slug (string). Returns { id } or null. */
async function resolveBranchByIdOrSlug(idOrSlug) {
  if (!idOrSlug || String(idOrSlug).trim() === "") return null;
  const val = String(idOrSlug).trim();
  const isNumeric = /^\d+$/.test(val);
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("id")
    .or(isNumeric ? `id.eq.${val}` : `slug.eq.${val}`)
    .single();
  if (error || !data) return null;
  return data;
}

/** Generate slug from name: lowercase, spaces to hyphens, alphanumeric + hyphens only */
function slugify(name) {
  return (
    String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "branch"
  );
}

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
      .select(BRANCH_SELECT, { count: "exact" });

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

  // GET /api/admin/branches/:id (id can be numeric id or slug)
  getById: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .select(BRANCH_SELECT)
      .eq("id", resolved.id)
      .single();

    if (error || !branch) return next(new AppError("Branch not found", 404));

    let hotel = null;
    if (branch.hotel_id != null) {
      const { data: hotelData } = await supabaseAdmin
        .from("hotels")
        .select("id, name, title, description, image_url_1")
        .eq("id", branch.hotel_id)
        .single();
      hotel = hotelData;
    }

    return res.status(200).json({
      status: "success",
      data: { branch, ...(hotel ? { hotel } : {}) },
    });
  }),

  // POST /api/admin/branches
  create: catchAsync(async (req, res, next) => {
    const {
      name,
      address = null,
      phone = null,
      is_active = true,
      country = null,
      city = null,
      region = null,
      slug = null,
      description = null,
      image_url_1 = null,
      image_url_2 = null,
      image_url_3 = null,
      image_url_4 = null,
      image_url_5 = null,
      hotel_name = null,
      hotel_title = null,
      hotel_description = null,
      hotel_image_url_1 = null,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return next(new AppError("name is required", 400));
    }

    const hotel_payload = {
      name: (hotel_name ?? "").toString().trim() || "Hotel",
      title: (hotel_title ?? "").toString().trim() || "",
      description: (hotel_description ?? "").toString().trim() || null,
      image_url_1: (hotel_image_url_1 ?? "").toString().trim() || null,
    };

    const finalSlug =
      slug && typeof slug === "string" && slug.trim()
        ? slug
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        : slugify(name);

    const { data: hotel, error: hotelError } = await supabaseAdmin
      .from("hotels")
      .insert([hotel_payload])
      .select("id, name, title, description, image_url_1")
      .single();
    if (hotelError || !hotel) {
      return next(new AppError("Failed to create hotel", 500));
    }
    const payload = {
      name: name.trim(),
      address,
      phone,
      is_active: Boolean(is_active),
      country,
      city,
      region,
      slug: finalSlug || "branch",
      image_url_1,
      image_url_2,
      image_url_3,
      image_url_4,
      image_url_5,
      description,
    };

    payload.hotel_id = hotel.id;
    const { data: branch, error } = await supabaseAdmin
      .from("branches")
      .insert([payload])
      .select(BRANCH_SELECT)
      .single();

    if (error || !branch)
      return next(new AppError("Failed to create branch", 500));

    return res.status(201).json({
      status: "success",
      data: { branch, hotel },
    });
  }),

  // PUT /api/admin/branches/:id
  update: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const {
      name,
      address,
      phone,
      is_active,
      country,
      city,
      region,
      slug,
      image_url_1,
      image_url_2,
      image_url_3,
      image_url_4,
      image_url_5,
      description,
      hotel_name,
      hotel_title,
      hotel_description,
      hotel_image_url_1,
    } = req.body;

    const branchUpdates = {};
    const hotelUpdates = {};

    // Branch fields
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim())
        return next(new AppError("name must be a non-empty string", 400));
      branchUpdates.name = name.trim();
    }

    if (address !== undefined) branchUpdates.address = address;
    if (phone !== undefined) branchUpdates.phone = phone;
    if (is_active !== undefined) branchUpdates.is_active = Boolean(is_active);
    if (country !== undefined) branchUpdates.country = country;
    if (city !== undefined) branchUpdates.city = city;
    if (region !== undefined) branchUpdates.region = region;
    if (description !== undefined) branchUpdates.description = description;

    // slug
    if (slug !== undefined && typeof slug === "string" && slug.trim()) {
      branchUpdates.slug = slug
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    } else if (name !== undefined) {
      branchUpdates.slug = slugify(name.trim());
    }

    if (image_url_1 !== undefined) branchUpdates.image_url_1 = image_url_1;
    if (image_url_2 !== undefined) branchUpdates.image_url_2 = image_url_2;
    if (image_url_3 !== undefined) branchUpdates.image_url_3 = image_url_3;
    if (image_url_4 !== undefined) branchUpdates.image_url_4 = image_url_4;
    if (image_url_5 !== undefined) branchUpdates.image_url_5 = image_url_5;

    // Hotel fields (mapping to hotels columns)
    if (hotel_name !== undefined) {
      if (typeof hotel_name !== "string" || !hotel_name.trim())
        return next(new AppError("hotel_name must be a non-empty string", 400));
      hotelUpdates.name = hotel_name.trim();
    }

    if (hotel_title !== undefined) {
      if (typeof hotel_title !== "string" || !hotel_title.trim())
        return next(
          new AppError("hotel_title must be a non-empty string", 400),
        );
      hotelUpdates.title = hotel_title.trim();
    }

    if (hotel_description !== undefined) {
      if (typeof hotel_description !== "string" || !hotel_description.trim())
        return next(
          new AppError("hotel_description must be a non-empty string", 400),
        );
      hotelUpdates.description = hotel_description.trim();
    }

    if (hotel_image_url_1 !== undefined) {
      if (typeof hotel_image_url_1 !== "string" || !hotel_image_url_1.trim())
        return next(
          new AppError("hotel_image_url_1 must be a non-empty string", 400),
        );
      hotelUpdates.image_url_1 = hotel_image_url_1.trim();
    }

    if (
      Object.keys(branchUpdates).length === 0 &&
      Object.keys(hotelUpdates).length === 0
    ) {
      return next(new AppError("No fields to update", 400));
    }

    // Update branch (only if needed)
    let branch = null;
    if (Object.keys(branchUpdates).length) {
      const { data, error } = await supabaseAdmin
        .from("branches")
        .update(branchUpdates)
        .eq("id", resolved.id)
        .select(BRANCH_SELECT)
        .single();

      if (error || !data)
        return next(new AppError("Failed to update branch", 500));
      branch = data;
    } else {
      // لو ماحدّثتش الفرع، هات بياناته عشان نعرف hotel_id
      const { data, error } = await supabaseAdmin
        .from("branches")
        .select(BRANCH_SELECT)
        .eq("id", resolved.id)
        .single();

      if (error || !data) return next(new AppError("Branch not found", 404));
      branch = data;
    }

    // Update hotel (only if needed and branch has hotel_id)
    let hotel = null;
    if (Object.keys(hotelUpdates).length && branch.hotel_id != null) {
      const { data, error } = await supabaseAdmin
        .from("hotels")
        .update(hotelUpdates)
        .eq("id", branch.hotel_id)
        .select("id, name, title, description, image_url_1")
        .single();

      if (error || !data)
        return next(new AppError("Failed to update hotel", 500));
      hotel = data;
    }

    return res.status(200).json({
      status: "success",
      data: { branch, ...(hotel ? { hotel } : {}) },
    });
  }),

  // DELETE /api/admin/branches/:id (id can be numeric id or slug)
  remove: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    if (!id) return next(new AppError("Branch id is required", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    // 2) هل الفرع مستخدم في branch_service_pricing؟
    const { data: pricingUsage, error: pErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id")
      .eq("branch_id", resolved.id)
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
      .eq("branch_id", resolved.id)
      .limit(1);

    if (bkErr) {
      return next(new AppError("Failed to check branch bookings usage", 500));
    }

    if (bookingUsage && bookingUsage.length > 0) {
      return next(
        new AppError("Branch is used in bookings and cannot be deleted", 409),
      );
    }

    // 4) Get hotel_id before deleting branch (resolved only has id)
    const { data: branchToDelete } = await supabaseAdmin
      .from("branches")
      .select("hotel_id")
      .eq("id", resolved.id)
      .single();

    const hotelId = branchToDelete?.hotel_id;

    // 5) Delete branch
    const { error: dErr } = await supabaseAdmin
      .from("branches")
      .delete()
      .eq("id", resolved.id);

    if (dErr) {
      return next(new AppError("Failed to delete branch", 500));
    }

    // 6) Delete hotel (only if branch had one)
    if (hotelId != null) {
      const { error: hErr } = await supabaseAdmin
        .from("hotels")
        .delete()
        .eq("id", hotelId);

      if (hErr) {
        return next(new AppError("Failed to delete hotel", 500));
      }
    }

    return res.status(200).json({
      status: "success",
      message: hotelId != null ? "Branch and hotel deleted successfully" : "Branch deleted successfully",
    });
  }),

  // PATCH /api/admin/branches/:id/toggle (id can be numeric id or slug)
  toggleActiveBranch: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const { data: existing, error: e1 } = await supabaseAdmin
      .from("branches")
      .select("id, is_active")
      .eq("id", resolved.id)
      .single();

    if (e1 || !existing) return next(new AppError("Branch not found", 404));

    const { data: branch, error: e2 } = await supabaseAdmin
      .from("branches")
      .update({ is_active: !existing.is_active })
      .eq("id", resolved.id)
      .select(BRANCH_SELECT)
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
      .select("id, name, slug")
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

  // POST /api/admin/branches/:id/services (id can be numeric id or slug)
  createBranchService: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { service_id, price_amount, currency, duration_min } = req.body;

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const { data: service, error: sErr } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("id", service_id)
      .single();

    if (sErr || !service) return next(new AppError("Service not found", 404));

    const payload = {
      branch_id: resolved.id,
      service_id,
      price_amount,
      currency,
      duration_min,
    };

    const { data: branchService, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .insert([payload])
      .select(
        "id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at",
      )
      .single();

    if (error || !branchService)
      return next(new AppError("Failed to create branch service", 500));

    return res.status(201).json({
      status: "success",
      data: { branchService },
    });
  }),

  // GET /api/admin/branches/:id/services (id can be numeric id or slug)
  getBranchServices: catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const { data: rows, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .select(
        "id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at, services:service_id ( name )",
      )
      .eq("branch_id", resolved.id);

    if (error)
      return next(new AppError("Failed to fetch branch services", 500));

    const services = (rows || []).map((r) => ({
      id: r.id,
      branch_id: r.branch_id,
      service_id: r.service_id,
      price_amount: r.price_amount,
      currency: r.currency,
      duration_min: r.duration_min,
      is_active: r.is_active,
      created_at: r.created_at,
      service_name: r.services?.name ?? null,
    }));

    return res.status(200).json({
      status: "success",
      data: { services },
    });
  }),

  // DELETE /api/admin/branches/:id/services/:service_id (id can be numeric id or slug)
  deleteBranchService: catchAsync(async (req, res, next) => {
    const { id, service_id } = req.params;

    if (!Number.isFinite(Number(service_id)))
      return next(new AppError("Invalid service id", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    // تأكد الخدمة موجودة
    const { data: service, error: sErr } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("id", service_id)
      .single();
    if (sErr || !service) return next(new AppError("Service not found", 404));

    // تأكد الـ pricing row موجود
    const { data: current, error: cErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id")
      .eq("branch_id", resolved.id)
      .eq("service_id", service_id)
      .single();

    if (cErr || !current)
      return next(new AppError("Branch service pricing not found", 404));

    // delete
    const { error: dErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .delete()
      .eq("id", current.id);

    if (dErr) return next(new AppError("Failed to delete branch service", 500));

    return res.status(200).json({
      status: "success",
      message: "Branch service deleted successfully",
    });
  }),

  // PATCH /api/admin/branches/:id/services/:service_id (id can be numeric id or slug)
  toggleActiveBranchService: catchAsync(async (req, res, next) => {
    const { id, service_id } = req.params;

    if (!Number.isFinite(Number(service_id)))
      return next(new AppError("Invalid service id", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    // check service exists
    const { data: service, error: sErr } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("id", service_id)
      .single();

    if (sErr || !service) return next(new AppError("Service not found", 404));

    // get current pricing row (important!)
    const { data: current, error: cErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id, is_active")
      .eq("branch_id", resolved.id)
      .eq("service_id", service_id)
      .single();

    if (cErr || !current) {
      return next(new AppError("Branch service pricing not found", 404));
    }

    // toggle
    const { data: branchService, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .update({ is_active: !current.is_active })
      .eq("id", current.id)
      .select(
        "id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at",
      )
      .single();

    if (error || !branchService) {
      return next(new AppError("Failed to update branch service", 500));
    }

    return res.status(200).json({
      status: "success",
      data: { branchService },
    });
  }),

  // GET /api/admin/branches/:id/services/:service_id (id can be numeric id or slug)
  getBranchService: catchAsync(async (req, res, next) => {
    const { id, service_id } = req.params;

    if (!Number.isFinite(Number(service_id)))
      return next(new AppError("Invalid service id", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    // check service exists
    const { data: service, error: sErr } = await supabaseAdmin
      .from("services")
      .select("id")
      .eq("id", service_id)
      .single();

    if (sErr || !service) return next(new AppError("Service not found", 404));

    // get current pricing row (important!)
    const { data: current, error: cErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id, is_active")
      .eq("branch_id", resolved.id)
      .eq("service_id", service_id)
      .single();

    if (cErr || !current) {
      return next(new AppError("Branch service pricing not found", 404));
    }

    return res.status(200).json({
      status: "success",
      data: { current },
    });
  }),

  // PUT /api/admin/branches/:id/services/:service_id (id can be numeric id or slug)
  updateBranchService: catchAsync(async (req, res, next) => {
    const { id, service_id } = req.params;
    const { price_amount, currency, duration_min } = req.body;

    if (!Number.isFinite(Number(service_id)))
      return next(new AppError("Invalid service id", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    if (
      price_amount === undefined &&
      currency === undefined &&
      duration_min === undefined
    ) {
      return next(new AppError("Nothing to update", 400));
    }

    if (price_amount !== undefined && !Number.isFinite(Number(price_amount))) {
      return next(new AppError("price_amount must be a number", 400));
    }
    if (duration_min !== undefined && !Number.isFinite(Number(duration_min))) {
      return next(new AppError("duration_min must be a number", 400));
    }
    if (currency !== undefined && typeof currency !== "string") {
      return next(new AppError("currency must be a string", 400));
    }

    const payload = {};
    if (price_amount !== undefined) payload.price_amount = Number(price_amount);
    if (currency !== undefined) payload.currency = currency;
    if (duration_min !== undefined) payload.duration_min = Number(duration_min);

    const { data: current, error: cErr } = await supabaseAdmin
      .from("branch_service_pricing")
      .select("id")
      .eq("branch_id", resolved.id)
      .eq("service_id", service_id)
      .single();

    if (cErr || !current)
      return next(new AppError("Branch service pricing not found", 404));

    const { data: branchService, error } = await supabaseAdmin
      .from("branch_service_pricing")
      .update(payload)
      .eq("id", current.id)
      .select(
        "id, branch_id, service_id, price_amount, currency, duration_min, is_active, created_at",
      )
      .single();

    if (error || !branchService)
      return next(new AppError("Failed to update branch service", 500));

    return res.status(200).json({ status: "success", data: { branchService } });
  }),
  
  // POST /api/admin/branches/:id/images/:slot (id can be numeric id or slug, slot 1-5)
  uploadImage: catchAsync(async (req, res, next) => {
    const { id, slot } = req.params;
    const slotNum = Number(slot);

    if (![1, 2, 3, 4, 5].includes(slotNum))
      return next(new AppError("slot must be 1, 2, 3, 4, or 5", 400));
    if (!req.file) return next(new AppError("No file uploaded", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const ext = req.file.originalname.split(".").pop();
    const path = `branches/${resolved.id}/slot-${slotNum}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("branches")
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (upErr) return next(new AppError(upErr.message, 500));

    const { data } = supabaseAdmin.storage.from("branches").getPublicUrl(path);
    const url = data.publicUrl;

    const col = `image_url_${slotNum}`;

    const { data: updated, error: uErr } = await supabaseAdmin
      .from("branches")
      .update({ [col]: url })
      .eq("id", resolved.id)
      .select(BRANCH_SELECT)
      .single();

    if (uErr || !updated)
      return next(new AppError("Failed to update branch image", 500));

    return res
      .status(200)
      .json({ status: "success", data: { branch: updated, url } });
  }),

  // POST /api/admin/branches/:id/hotel/image — رفع صورة الفندق على Supabase (id يمكن أن يكون رقم أو slug)
  uploadHotelImage: catchAsync(async (req, res, next) => {
    const { id } = req.params;
    if (!req.file) return next(new AppError("No file uploaded", 400));

    const resolved = await resolveBranchByIdOrSlug(id);
    if (!resolved) return next(new AppError("Branch not found", 404));

    const { data: branch } = await supabaseAdmin
      .from("branches")
      .select("hotel_id")
      .eq("id", resolved.id)
      .single();
    if (!branch?.hotel_id)
      return next(new AppError("Branch has no hotel", 400));

    const ext = req.file.originalname.split(".").pop();
    const path = `hotels/${branch.hotel_id}/image-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("hotels")
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (upErr) return next(new AppError(upErr.message, 500));

    const { data: urlData } = supabaseAdmin.storage.from("hotels").getPublicUrl(path);
    const url = urlData.publicUrl;

    const { data: hotel, error: uErr } = await supabaseAdmin
      .from("hotels")
      .update({ image_url_1: url })
      .eq("id", branch.hotel_id)
      .select("id, name, title, description, image_url_1")
      .single();

    if (uErr || !hotel)
      return next(new AppError("Failed to update hotel image", 500));

    return res
      .status(200)
      .json({ status: "success", data: { hotel, url } });
  }),
  
};
