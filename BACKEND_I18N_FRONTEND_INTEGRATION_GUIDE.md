# Backend Changes for Frontend Integration (i18n + Excel)

This document explains all backend changes added for:

- bookings Excel export
- dynamic translations by language
- new admin APIs for languages, translations, and hotels

Use this as the frontend integration reference.

---

## 1) New Backend Modules Added

- `api/lib/i18n.js`
  - language resolution from query (`language` or `language_code`)
  - translation lookup from `translations` table
  - translation merge/fallback helpers

- New controllers:
  - `api/controllers/languages.controller.js`
  - `api/controllers/translations.controller.js`
  - `api/controllers/hotels.controller.js`

- New routes:
  - `api/routes/admin.languages.routes.js`
  - `api/routes/admin.translations.routes.js`
  - `api/routes/admin.hotels.routes.js`

- Route registration in `api/index.js`:
  - `/api/admin/languages`
  - `/api/admin/translations`
  - `/api/admin/hotels`

---

## 2) Existing APIs Updated (Language-Aware GET)

The following APIs now support translation using query:

- `?language=<code>` or `?language_code=<code>`

If translation exists, translated fields are returned.
If no translation exists, original DB value is returned (fallback).

### Admin

- `GET /api/admin/services`
- `GET /api/admin/services/:id`
- `GET /api/admin/categories`
- `GET /api/admin/categories/:id`
- `GET /api/admin/branches`
- `GET /api/admin/branches/:id`
- `GET /api/admin/hotels`
- `GET /api/admin/hotels/:id`

### Customer Browse

- `GET /api/customer/browse/branches`
- `GET /api/customer/browse/categories`
- `GET /api/customer/browse/branches/:branchId/services`
- `GET /api/customer/browse/branches/:branchId/hotel`

### Response change

Language-aware responses include:

- `data.language` = language code used, or `null` if not provided

---

## 3) Translation Model Mapping

Supported `translations.entity_type` values:

- `service`
- `category`
- `branch`
- `hotel`

Supported translated fields:

- `entity_name` -> replaces `name`
- `entity_title` -> replaces `title`
- `entity_description` -> replaces `description`

---

## 4) New Admin APIs - Languages

Base path: `/api/admin/languages`
Auth: **admin Bearer token required**

- `GET /`
  - optional: `is_active=true|false`

- `GET /:id`

- `POST /`
  - body:
    - `code` (required, lowercase recommended, ex: `en`, `ar`, `de`)
    - `name` (required)
    - `is_default` (optional, boolean, default `false`)
    - `is_active` (optional, boolean, default `true`)
  - behavior:
    - if `is_default=true`, previous default language is unset automatically

- `PUT /:id`
  - body (any subset):
    - `code`
    - `name`
    - `is_default`
    - `is_active`

- `PATCH /:id/toggle`
  - flips `is_active`

- `DELETE /:id`
  - blocked if used in `translations` (`409`)

---

## 5) New Admin APIs - Translations

Base path: `/api/admin/translations`
Auth: **admin Bearer token required**

- `GET /`
  - filters:
    - `entity_type`
    - `entity_id`
    - `language_code`

- `GET /:id`

- `POST /`
  - required:
    - `entity_type` (`service|category|branch|hotel`)
    - `entity_id` (number)
    - `language_code` (active language)
  - optional:
    - `language_id`
    - `entity_name`
    - `entity_title`
    - `entity_description`
  - validation:
    - at least one of `entity_name/entity_title/entity_description` must be provided
    - entity must exist in its table
    - language must exist and be active

- `PUT /:id`
  - allows updating:
    - `entity_name`
    - `entity_title`
    - `entity_description`
    - `language_code` or `language_id`

- `DELETE /:id`

---

## 6) New Admin APIs - Hotels

Base path: `/api/admin/hotels`
Auth: **admin Bearer token required**

- `GET /`
  - supports:
    - pagination: `page`, `limit`
    - sorting: `sortBy=id|name|created_at|title`, `sortOrder=asc|desc`
    - search: `search` (on `name` and `title`)
    - language filter: `language` or `language_code`

- `GET /:id`
  - supports language filter

- `POST /`
  - body:
    - `name` (required)
    - `title` (optional)
    - `description` (optional)
    - `image_url_1` (optional)

- `PUT /:id`
  - update subset of:
    - `name`, `title`, `description`, `image_url_1`

- `DELETE /:id`
  - blocked if used by any branch (`branches.hotel_id`) -> `409`

---

## 7) Bookings Excel Export

Endpoint:

- `GET /api/admin/bookings/export`

Auth: **admin Bearer token required**

Supported query params (same as list bookings):

- `from`
- `to`
- `branch_id`
- `status`
- `sortBy`
- `sortOrder`

Output:

- downloadable `.xlsx` file (`Content-Disposition: attachment`)
- max rows exported: `10000`
- sheet name: `الحجوزات`
- Arabic columns:
  - `المعرف`
  - `الفرع`
  - `اسم العميل`
  - `الجوال`
  - `الحالة`
  - `تاريخ الحجز`
  - `المبلغ الإجمالي`
  - `عدد الخدمات`
  - `المدة (دقيقة)`
  - `ملاحظات`
  - `تاريخ الإنشاء`

---

## 8) Frontend Integration Rules

### A) Pass language query on main GET screens

For all main entity listings/details, pass one of:

- `language=ar`
- `language_code=ar`

Recommendation: use one standard key in frontend (prefer `language`).

### B) Fallback behavior

No frontend fallback logic is required for missing translations.
Backend already returns base value when no translation exists.

### C) Admin translation workflow

Recommended flow in CMS/admin panel:

1. create languages in `/api/admin/languages`
2. create/edit entities normally (`services/categories/branches/hotels`)
3. create translations per entity in `/api/admin/translations`
4. frontend consumes localized GET by language query

### D) Excel download (frontend)

Use `blob` download:

- with `fetch`:
  - call endpoint with Bearer token
  - `const blob = await response.blob()`
  - generate temporary object URL and trigger download

---

## 9) Notes / Edge Cases

- `language` not provided:
  - API works normally, returns base language data

- invalid language code:
  - returns error (`404` for language not found, `400` for inactive)

- translations can target only:
  - `service`, `category`, `branch`, `hotel`

- delete safety:
  - language delete blocked if used by translations
  - hotel delete blocked if referenced by branches

---

## 10) Quick Test Checklist for Frontend QA

- [ ] admin can create a language (`ar`, `en`)
- [ ] admin can set one language as default
- [ ] admin can create a translation for service/category/branch/hotel
- [ ] customer browse endpoints return translated data with `?language=ar`
- [ ] admin list/detail endpoints return translated data with `?language=ar`
- [ ] when translation missing, base value still appears
- [ ] bookings export downloads valid `.xlsx`

---

## 11) Changed/Added Files (Backend)

Added:

- `api/lib/i18n.js`
- `api/controllers/languages.controller.js`
- `api/controllers/translations.controller.js`
- `api/controllers/hotels.controller.js`
- `api/routes/admin.languages.routes.js`
- `api/routes/admin.translations.routes.js`
- `api/routes/admin.hotels.routes.js`

Updated:

- `api/controllers/services.controller.js`
- `api/controllers/categories.controller.js`
- `api/controllers/branches.controller.js`
- `api/controllers/customerBrowse.controller.js`
- `api/controllers/bookings.controller.js`
- `api/routes/admin.bookings.routes.js`
- `api/index.js`

