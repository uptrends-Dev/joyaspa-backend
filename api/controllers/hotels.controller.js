import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  applyEntityTranslation,
  getTranslationsMap,
  resolveLanguageFromQuery,
} from "../lib/i18n.js";

const HOTEL_SELECT = "id, name, title, description, image_url_1, created_at";
const allowedSortFields = new Set(["id", "name", "created_at", "title"]);

export const hotelsController = {
  // GET /api/admin/hotels
  getAll: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortBy = allowedSortFields.has(req.query.sortBy)
      ? req.query.sortBy
      : "created_at";
    const ascending = req.query.sortOrder === "asc";
    const search = String(req.query.search || "").trim();
    const language = await resolveLanguageFromQuery(req);

    let query = supabaseAdmin
      .from("hotels")
      .select(HOTEL_SELECT, { count: "exact" })
      .order(sortBy, { ascending })
      .range(from, to);

    if (search) query = query.or(`name.ilike.%${search}%,title.ilike.%${search}%`);

    const { data: hotels, error, count } = await query;
    if (error) return next(new AppError("Failed to fetch hotels", 500));

    let transformed = hotels || [];
    if (language && transformed.length) {
      const trMap = await getTranslationsMap(
        "hotel",
        transformed.map((h) => h.id),
        language.code,
      );
      transformed = transformed.map((hotel) =>
        applyEntityTranslation(hotel, trMap.get(Number(hotel.id))),
      );
    }

    return res.status(200).json({
      status: "success",
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
      data: { hotels: transformed, language: language?.code || null },
    });
  }),

  // GET /api/admin/hotels/:id
  getById: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid hotel id", 400));
    const language = await resolveLanguageFromQuery(req);

    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .select(HOTEL_SELECT)
      .eq("id", id)
      .single();
    if (error || !hotel) return next(new AppError("Hotel not found", 404));

    let transformed = hotel;
    if (language) {
      const trMap = await getTranslationsMap("hotel", [hotel.id], language.code);
      transformed = applyEntityTranslation(hotel, trMap.get(Number(hotel.id)));
    }

    return res.status(200).json({
      status: "success",
      data: { hotel: transformed, language: language?.code || null },
    });
  }),

  // POST /api/admin/hotels
  create: catchAsync(async (req, res, next) => {
    const {
      name,
      title = null,
      description = null,
      image_url_1 = null,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return next(new AppError("name is required", 400));
    }

    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .insert([{ name: name.trim(), title, description, image_url_1 }])
      .select(HOTEL_SELECT)
      .single();
    if (error || !hotel) return next(new AppError("Failed to create hotel", 500));

    return res.status(201).json({ status: "success", data: { hotel } });
  }),

  // PUT /api/admin/hotels/:id
  update: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid hotel id", 400));

    const updates = {};
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        return next(new AppError("name must be non-empty", 400));
      }
      updates.name = String(req.body.name).trim();
    }
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.image_url_1 !== undefined) updates.image_url_1 = req.body.image_url_1;

    if (!Object.keys(updates).length) return next(new AppError("No fields to update", 400));

    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .update(updates)
      .eq("id", id)
      .select(HOTEL_SELECT)
      .single();
    if (error || !hotel) return next(new AppError("Hotel not found", 404));

    return res.status(200).json({ status: "success", data: { hotel } });
  }),

  // DELETE /api/admin/hotels/:id
  remove: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid hotel id", 400));

    const { data: branchUsage, error: useErr } = await supabaseAdmin
      .from("branches")
      .select("id")
      .eq("hotel_id", id)
      .limit(1);
    if (useErr) return next(new AppError("Failed to check hotel usage", 500));
    if (branchUsage?.length) {
      return next(new AppError("Hotel is used by branches and cannot be deleted", 409));
    }

    const { error } = await supabaseAdmin.from("hotels").delete().eq("id", id);
    if (error) return next(new AppError("Failed to delete hotel", 500));

    return res.status(200).json({ status: "success", message: "Hotel deleted successfully" });
  }),
};
