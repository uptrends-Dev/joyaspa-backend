import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  applyEntityTranslation,
  getTranslationsMap,
  resolveLanguageFromQuery,
} from "../lib/i18n.js";

/** Resolve branch by id (numeric) or slug (string). Returns branch row or null. */
async function resolveBranchByIdOrSlug(idOrSlug) {
  if (!idOrSlug || String(idOrSlug).trim() === "") return null;
  const val = String(idOrSlug).trim();
  const isNumeric = /^\d+$/.test(val);
  const { data, error } = await supabaseAdmin
    .from("branches")
    .select("id, name, slug, is_active")
    .or(isNumeric ? `id.eq.${val}` : `slug.eq.${val}`)
    .single();
  if (error || !data) return null;
  return data;
}

export const customerBrowseController = {
  // GET /api/customer/browse/branches/:branchId/services (branchId can be id or slug)
  getServicesByBranchId: catchAsync(async (req, res, next) => {
    const { branchId } = req.params;
    const { category_id } = req.query;

    if (!branchId) {
      return next(new AppError("branchId is required", 400));
    }

    if (category_id !== undefined && !Number.isFinite(Number(category_id))) {
      return next(new AppError("category_id must be a number", 400));
    }
    const language = await resolveLanguageFromQuery(req);

    const branch = await resolveBranchByIdOrSlug(branchId);
    if (!branch) return next(new AppError("Branch not found", 404));
    if (!branch.is_active)
      return next(new AppError("Branch is not active", 404));

    // Fetch full branch details (description, images) for response
    const { data: fullBranch } = await supabaseAdmin
      .from("branches")
      .select(
        "id, address, name, slug, description, image_url_1, image_url_2, image_url_3, image_url_4, image_url_5",
      )
      .eq("id", branch.id)
      .single();

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
    services:service_id (
      id,
      name,
      description,
      default_duration_min,
      is_active,
      category_id,
      image_url_1,
      image_url_2,
      image_url_3,
      image_url_4,
      service_categories:category_id ( id, name )
    ),
    branches:branch_id ( id, name, slug, description, image_url_1, image_url_2, image_url_3, image_url_4, image_url_5 )
  `,
      )
      .eq("branch_id", branch.id)
      .eq("is_active", true)
      .filter("services.is_active", "eq", true);

    if (category_id !== undefined) {
      q = q.filter("services.category_id", "eq", Number(category_id));
    }
    const { data: rows, error } = await q;
    if (error) return next(new AppError(error.message, 500));

    let services = (rows || [])
      .filter((r) => r.services)
      .map((r) => ({
        id: r.services.id,
        name: r.services.name,
        description: r.services.description,
        price_amount: r.price_amount,
        currency: r.currency,
        address: r.branches.address,
        // duration_min: r.duration_min,
        duration_min: r.services.default_duration_min,
        image_url_1: r.services.image_url_1,
        // image_url_2: r.services.image_url_2,
        // image_url_3: r.services.image_url_3,
        // image_url_4: r.services.image_url_4,

        category: r.services.service_categories
          ? {
              id: r.services.service_categories.id,
              name: r.services.service_categories.name,
            }
          : null,
      }))
      .sort(
        (a, b) => (Number(a.price_amount) ?? 0) - (Number(b.price_amount) ?? 0),
      );

    let branchData = fullBranch || {
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      address: branch.address,
      description: null,
      image_url_1: null,
      image_url_2: null,
      image_url_3: null,
      image_url_4: null,
      image_url_5: null,
    };

    if (language) {
      const serviceTrMap = await getTranslationsMap(
        "service",
        services.map((s) => s.id),
        language.code,
      );
      const categoryTrMap = await getTranslationsMap(
        "category",
        services.map((s) => s.category?.id).filter(Boolean),
        language.code,
      );
      const branchTrMap = await getTranslationsMap("branch", [branchData.id], language.code);

      branchData = applyEntityTranslation(
        branchData,
        branchTrMap.get(Number(branchData.id)),
      );

      services = services.map((service) => {
        const translatedService = applyEntityTranslation(
          service,
          serviceTrMap.get(Number(service.id)),
        );
        const translatedCategory = service.category
          ? applyEntityTranslation(
              service.category,
              categoryTrMap.get(Number(service.category.id)),
            )
          : null;
        return {
          ...translatedService,
          category: translatedCategory,
        };
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        branch: {
          id: branchData.id,
          name: branchData.name,
          slug: branchData.slug,
          address: branchData.address,
          description: branchData.description,
          image_url_1: branchData.image_url_1,
          image_url_2: branchData.image_url_2,
          image_url_3: branchData.image_url_3,
          image_url_4: branchData.image_url_4,
          image_url_5: branchData.image_url_5,
        },
        services,
        language: language?.code || null,
      },
    });
  }),

  getBranches: catchAsync(async (req, res, next) => {
    const { city, country, governorate } = req.query;
    const language = await resolveLanguageFromQuery(req);

    let query = supabaseAdmin
      .from("branches")
      .select(
        "id, name, address, phone, country, governorate, city, region, slug, description, image_url_1, image_url_2, image_url_3, image_url_4, image_url_5",
      )
      .eq("is_active", true);

    // Filter by country (case-insensitive)
    if (country) {
      query = query.ilike("country", `%${country}%`);
    }

    // Filter by governorate (case-insensitive)
    if (governorate) {
      query = query.ilike("governorate", `%${governorate}%`);
    }

    // Filter by city (case-insensitive)
    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    const { data: branches, error } = await query.order("name", {
      ascending: true,
    });

    if (error) {
      return next(new AppError("Failed to fetch branches", 500));
    }

    let transformedBranches = branches || [];
    if (language && transformedBranches.length) {
      const branchTrMap = await getTranslationsMap(
        "branch",
        transformedBranches.map((b) => b.id),
        language.code,
      );
      transformedBranches = transformedBranches.map((branch) =>
        applyEntityTranslation(branch, branchTrMap.get(Number(branch.id))),
      );
    }

    return res.status(200).json({
      status: "success",
      data: {
        branches: transformedBranches,
        filters: {
          city: city || null,
          country: country || null,
          governorate: governorate || null,
        },
        language: language?.code || null,
      },
    });
  }),

  // GET /api/customer/browse/categories
  getCategories: catchAsync(async (req, res, next) => {
    const language = await resolveLanguageFromQuery(req);
    const { data: categories, error } = await supabaseAdmin
      .from("service_categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      return next(new AppError("Failed to fetch categories", 500));
    }

    let transformed = categories || [];
    if (language && transformed.length) {
      const categoryTrMap = await getTranslationsMap(
        "category",
        transformed.map((c) => c.id),
        language.code,
      );
      transformed = transformed.map((category) =>
        applyEntityTranslation(category, categoryTrMap.get(Number(category.id))),
      );
    }

    return res.status(200).json({
      status: "success",
      data: {
        categories: transformed,
        language: language?.code || null,
      },
    });
  }),

  // GET /api/customer/browse/languages
  getLanguages: catchAsync(async (req, res, next) => {
    const { data: languages, error } = await supabaseAdmin
      .from("languages")
      .select("id, code, name, is_default")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      return next(new AppError("Failed to fetch languages", 500));
    }

    return res.status(200).json({
      status: "success",
      data: {
        languages: languages || [],
      },
    });
  }),

  // GET /api/customer/browse/countries
  getCountries: catchAsync(async (req, res, next) => {
    const { data: branches, error } = await supabaseAdmin
      .from("branches")
      .select("country")
      .eq("is_active", true)
      .not("country", "is", null);

    if (error) {
      return next(new AppError("Failed to fetch countries", 500));
    }

    // Get distinct countries and sort them
    const countries = [...new Set(branches.map((b) => b.country))]
      .filter(Boolean)
      .sort();

    return res.status(200).json({
      status: "success",
      data: {
        countries,
      },
    });
  }),

  // GET /api/customer/browse/cities
  getCities: catchAsync(async (req, res, next) => {
    const { country, governorate } = req.query;

    let query = supabaseAdmin
      .from("branches")
      .select("city, country, governorate")
      .eq("is_active", true)
      .not("city", "is", null);
    // Filter by country if provided
    if (country) {
      query = query.ilike("country", `%${country}%`);
    }
    if (governorate) {
      query = query.ilike("governorate", `%${governorate}%`);
    }
    const { data: branches, error } = await query;

    if (error) {
      return next(new AppError("Failed to fetch cities", 500));
    }

    // Get distinct cities and sort them
    const cities = [...new Set(branches.map((b) => b.city))]
      .filter(Boolean)
      .sort();

    return res.status(200).json({
      status: "success",
      data: {
        cities,
        filter: {
          country: country || null,
          governorate: governorate || null,
        },
      },
    });
  }),
  // GET /api/customer/browse/branches/:branchId/hotel
  getHotelByBranchId: catchAsync(async (req, res, next) => {
    const { branchId } = req.params;
    const language = await resolveLanguageFromQuery(req);
    const branch = await resolveBranchByIdOrSlug(branchId);
    if (!branch) return next(new AppError("Branch not found", 404));
    if (!branch.is_active)
      return next(new AppError("Branch is not active", 404));

    const { data: branchRow } = await supabaseAdmin
      .from("branches")
      .select("hotel_id")
      .eq("id", branch.id)
      .single();

    if (!branchRow?.hotel_id) return next(new AppError("Hotel not found", 404));

    const { data: hotel, error: hErr } = await supabaseAdmin
      .from("hotels")
      .select("id, name, title, description, image_url_1")
      .eq("id", branchRow.hotel_id)
      .single();

    if (hErr || !hotel) return next(new AppError("Hotel not found", 404));

    let transformedHotel = hotel;
    if (language && hotel) {
      const hotelTrMap = await getTranslationsMap("hotel", [hotel.id], language.code);
      transformedHotel = applyEntityTranslation(
        hotel,
        hotelTrMap.get(Number(hotel.id)),
      );
    }

    return res.status(200).json({
      status: "success",
      data: {
        hotel: transformedHotel,
        language: language?.code || null,
      },
    });
  }),
};
