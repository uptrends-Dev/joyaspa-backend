import AppError from "./AppError.js";
import { supabaseAdmin } from "./supabaseAdmin.js";

const ENTITY_TYPE_ALIASES = {
  service: "service",
  services: "service",
  category: "category",
  categories: "category",
  branch: "branch",
  branches: "branch",
  hotel: "hotel",
  hotels: "hotel",
};

export function normalizeEntityType(entityType) {
  const key = String(entityType || "")
    .trim()
    .toLowerCase();
  return ENTITY_TYPE_ALIASES[key] || null;
}

export async function getLanguageByCode(languageCode) {
  const code = String(languageCode || "")
    .trim()
    .toLowerCase();
  if (!code) return null;

  const { data, error } = await supabaseAdmin
    .from("languages")
    .select("id, code, name, is_active, is_default")
    .eq("code", code)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getDefaultLanguage() {
  const { data, error } = await supabaseAdmin
    .from("languages")
    .select("id, code, name, is_active, is_default")
    .eq("is_default", true)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

export async function resolveLanguageFromQuery(req, { required = false } = {}) {
  const queryCode = String(req.query.language || req.query.language_code || "")
    .trim()
    .toLowerCase();

  if (!queryCode) {
    if (required) throw new AppError("language or language_code is required", 400);
    return null;
  }

  const language = await getLanguageByCode(queryCode);
  if (!language) throw new AppError("Language not found", 404);
  if (!language.is_active) throw new AppError("Language is inactive", 400);

  return language;
}

export async function getTranslationsMap(entityType, entityIds, languageCode) {
  const normalizedType = normalizeEntityType(entityType);
  if (!normalizedType || !Array.isArray(entityIds) || entityIds.length === 0) {
    return new Map();
  }

  const code = String(languageCode || "")
    .trim()
    .toLowerCase();
  if (!code) return new Map();

  const uniqueIds = [...new Set(entityIds.map(Number).filter(Number.isFinite))];
  if (!uniqueIds.length) return new Map();

  const { data, error } = await supabaseAdmin
    .from("translations")
    .select(
      "id, entity_type, entity_id, entity_name, entity_title, entity_description, language_code",
    )
    .eq("entity_type", normalizedType)
    .eq("language_code", code)
    .in("entity_id", uniqueIds);

  if (error) throw new AppError(`Failed to fetch ${normalizedType} translations`, 500);

  const map = new Map();
  for (const row of data || []) {
    map.set(Number(row.entity_id), row);
  }
  return map;
}

export function applyEntityTranslation(entity, translation) {
  if (!entity || !translation) return entity;

  return {
    ...entity,
    ...(translation.entity_name ? { name: translation.entity_name } : {}),
    ...(translation.entity_title ? { title: translation.entity_title } : {}),
    ...(translation.entity_description
      ? { description: translation.entity_description }
      : {}),
  };
}
