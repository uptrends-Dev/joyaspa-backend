import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const LANGUAGE_SELECT = "id, code, name, is_default, is_active, created_at";
const toBoolean = (val) => val === true || String(val).toLowerCase() === "true";

export const languagesController = {
  // GET /api/admin/languages
  getAll: catchAsync(async (req, res, next) => {
    const onlyActive =
      req.query.is_active === undefined
        ? null
        : req.query.is_active === "true" || req.query.is_active === true;

    let query = supabaseAdmin
      .from("languages")
      .select(LANGUAGE_SELECT)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (onlyActive !== null) query = query.eq("is_active", onlyActive);

    const { data: languages, error } = await query;
    if (error) return next(new AppError("Failed to fetch languages", 500));

    return res.status(200).json({
      status: "success",
      data: { languages },
    });
  }),

  // GET /api/admin/languages/:id
  getById: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid language id", 400));

    const { data: language, error } = await supabaseAdmin
      .from("languages")
      .select(LANGUAGE_SELECT)
      .eq("id", id)
      .single();

    if (error || !language) return next(new AppError("Language not found", 404));

    return res.status(200).json({
      status: "success",
      data: { language },
    });
  }),

  // POST /api/admin/languages
  create: catchAsync(async (req, res, next) => {
    const code = String(req.body.code || "")
      .trim()
      .toLowerCase();
    const name = String(req.body.name || "").trim();
    const is_default =
      req.body.is_default === undefined ? false : toBoolean(req.body.is_default);
    const is_active =
      req.body.is_active === undefined ? true : toBoolean(req.body.is_active);

    if (!code) return next(new AppError("code is required", 400));
    if (!name) return next(new AppError("name is required", 400));

    if (is_default) {
      await supabaseAdmin.from("languages").update({ is_default: false }).neq("id", -1);
    }

    const { data: language, error } = await supabaseAdmin
      .from("languages")
      .insert([{ code, name, is_default, is_active }])
      .select(LANGUAGE_SELECT)
      .single();

    if (error || !language) return next(new AppError("Failed to create language", 500));

    return res.status(201).json({
      status: "success",
      data: { language },
    });
  }),

  // PUT /api/admin/languages/:id
  update: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid language id", 400));

    const updates = {};
    if (req.body.code !== undefined) {
      const code = String(req.body.code || "")
        .trim()
        .toLowerCase();
      if (!code) return next(new AppError("code must be non-empty", 400));
      updates.code = code;
    }
    if (req.body.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) return next(new AppError("name must be non-empty", 400));
      updates.name = name;
    }
    if (req.body.is_active !== undefined) updates.is_active = toBoolean(req.body.is_active);
    if (req.body.is_default !== undefined) updates.is_default = toBoolean(req.body.is_default);

    if (!Object.keys(updates).length) {
      return next(new AppError("No fields to update", 400));
    }

    if (updates.is_default === true) {
      await supabaseAdmin.from("languages").update({ is_default: false }).neq("id", id);
    }

    const { data: language, error } = await supabaseAdmin
      .from("languages")
      .update(updates)
      .eq("id", id)
      .select(LANGUAGE_SELECT)
      .single();

    if (error || !language) return next(new AppError("Language not found", 404));

    return res.status(200).json({
      status: "success",
      data: { language },
    });
  }),

  // PATCH /api/admin/languages/:id/toggle
  toggleActive: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid language id", 400));

    const { data: existing, error: e1 } = await supabaseAdmin
      .from("languages")
      .select("id, is_active")
      .eq("id", id)
      .single();
    if (e1 || !existing) return next(new AppError("Language not found", 404));

    const { data: language, error: e2 } = await supabaseAdmin
      .from("languages")
      .update({ is_active: !existing.is_active })
      .eq("id", id)
      .select(LANGUAGE_SELECT)
      .single();
    if (e2 || !language) return next(new AppError("Failed to toggle language", 500));

    return res.status(200).json({ status: "success", data: { language } });
  }),

  // DELETE /api/admin/languages/:id
  remove: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid language id", 400));

    const { data: inUse, error: useErr } = await supabaseAdmin
      .from("translations")
      .select("id")
      .eq("language_id", id)
      .limit(1);
    if (useErr) return next(new AppError("Failed to check language usage", 500));
    if (inUse?.length) {
      return next(new AppError("Language is used in translations and cannot be deleted", 409));
    }

    const { error } = await supabaseAdmin.from("languages").delete().eq("id", id);
    if (error) return next(new AppError("Failed to delete language", 500));

    return res.status(200).json({ status: "success", message: "Language deleted successfully" });
  }),
};
