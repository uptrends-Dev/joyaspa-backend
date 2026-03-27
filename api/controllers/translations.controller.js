import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { normalizeEntityType } from "../lib/i18n.js";

const TRANSLATION_SELECT =
  "id, entity_type, entity_id, entity_name, entity_title, entity_description, language_code, language_id, created_at";

const ENTITY_TABLE_BY_TYPE = {
  service: "services",
  category: "service_categories",
  branch: "branches",
  hotel: "hotels",
};

async function assertEntityExists(entityType, entityId) {
  const table = ENTITY_TABLE_BY_TYPE[entityType];
  if (!table) throw new AppError("Unsupported entity_type", 400);

  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("id", entityId)
    .single();
  if (error || !data) throw new AppError(`${entityType} not found`, 404);
}

async function assertLanguageExists(languageCode, languageId) {
  let q = supabaseAdmin
    .from("languages")
    .select("id, code, is_active")
    .eq("is_active", true);

  if (languageId !== undefined && languageId !== null) {
    q = q.eq("id", Number(languageId));
  } else {
    q = q.eq("code", String(languageCode || "").trim().toLowerCase());
  }

  const { data, error } = await q.single();
  if (error || !data) throw new AppError("Language not found or inactive", 404);
  return data;
}

async function assertTranslationDoesNotExist(
  entityType,
  entityId,
  languageCode,
  excludeId = null,
) {
  let query = supabaseAdmin
    .from("translations")
    .select("id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("language_code", languageCode)
    .limit(1);

  if (excludeId !== null && excludeId !== undefined) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) throw new AppError("Failed to validate translation uniqueness", 500);
  if (data?.length) {
    throw new AppError(
      "Translation already exists for this entity and language",
      409,
    );
  }
}

export const translationsController = {
  // GET /api/admin/translations
  getAll: catchAsync(async (req, res, next) => {
    const entityType = req.query.entity_type
      ? normalizeEntityType(req.query.entity_type)
      : null;
    const entityId = req.query.entity_id ? Number(req.query.entity_id) : null;
    const languageCode = req.query.language_code
      ? String(req.query.language_code).trim().toLowerCase()
      : null;

    let query = supabaseAdmin.from("translations").select(TRANSLATION_SELECT);
    if (entityType) query = query.eq("entity_type", entityType);
    if (Number.isFinite(entityId)) query = query.eq("entity_id", entityId);
    if (languageCode) query = query.eq("language_code", languageCode);

    const { data: translations, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) return next(new AppError("Failed to fetch translations", 500));

    return res.status(200).json({ status: "success", data: { translations } });
  }),

  // GET /api/admin/translations/:id
  getById: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid translation id", 400));

    const { data: translation, error } = await supabaseAdmin
      .from("translations")
      .select(TRANSLATION_SELECT)
      .eq("id", id)
      .single();

    if (error || !translation) return next(new AppError("Translation not found", 404));
    return res.status(200).json({ status: "success", data: { translation } });
  }),

  // POST /api/admin/translations
  create: catchAsync(async (req, res, next) => {
    const entityType = normalizeEntityType(req.body.entity_type);
    const entityId = Number(req.body.entity_id);
    const entityName = req.body.entity_name ?? null;
    const entityTitle = req.body.entity_title ?? null;
    const entityDescription = req.body.entity_description ?? null;
    const languageCode = String(req.body.language_code || "")
      .trim()
      .toLowerCase();

    if (!entityType) return next(new AppError("Invalid entity_type", 400));
    if (!Number.isFinite(entityId)) return next(new AppError("entity_id must be numeric", 400));
    if (!languageCode) return next(new AppError("language_code is required", 400));
    if (!entityName && !entityTitle && !entityDescription) {
      return next(
        new AppError("At least one of entity_name/entity_title/entity_description is required", 400),
      );
    }

    await assertEntityExists(entityType, entityId);
    const language = await assertLanguageExists(languageCode, req.body.language_id);
    await assertTranslationDoesNotExist(entityType, entityId, language.code);

    const payload = {
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      entity_title: entityTitle,
      entity_description: entityDescription,
      language_code: language.code,
      language_id: language.id,
    };

    const { data: translation, error } = await supabaseAdmin
      .from("translations")
      .insert([payload])
      .select(TRANSLATION_SELECT)
      .single();

    if (error) {
      return next(new AppError(error.message || "Failed to create translation", 500));
    }

    return res.status(201).json({ status: "success", data: { translation } });
  }),

  // PUT /api/admin/translations/:id
  update: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid translation id", 400));

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("translations")
      .select("id, entity_type, entity_id, language_code")
      .eq("id", id)
      .single();
    if (existingErr || !existing) return next(new AppError("Translation not found", 404));

    const updates = {};
    if (req.body.entity_name !== undefined) updates.entity_name = req.body.entity_name;
    if (req.body.entity_title !== undefined) updates.entity_title = req.body.entity_title;
    if (req.body.entity_description !== undefined) {
      updates.entity_description = req.body.entity_description;
    }

    if (req.body.language_code !== undefined || req.body.language_id !== undefined) {
      const language = await assertLanguageExists(req.body.language_code, req.body.language_id);
      updates.language_code = language.code;
      updates.language_id = language.id;
    }

    if (!Object.keys(updates).length) return next(new AppError("No fields to update", 400));

    const finalLanguageCode = updates.language_code || existing.language_code;
    await assertTranslationDoesNotExist(
      existing.entity_type,
      existing.entity_id,
      finalLanguageCode,
      id,
    );

    const { data: translation, error } = await supabaseAdmin
      .from("translations")
      .update(updates)
      .eq("id", id)
      .select(TRANSLATION_SELECT)
      .single();

    if (error || !translation) return next(new AppError("Translation not found", 404));
    return res.status(200).json({ status: "success", data: { translation } });
  }),

  // DELETE /api/admin/translations/:id
  remove: catchAsync(async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next(new AppError("Invalid translation id", 400));

    const { error } = await supabaseAdmin.from("translations").delete().eq("id", id);
    if (error) return next(new AppError("Failed to delete translation", 500));

    return res.status(200).json({
      status: "success",
      message: "Translation deleted successfully",
    });
  }),
};
