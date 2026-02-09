# ملخص التعديلات - Joya Spa Backend (للفرونت إند)

**التاريخ:** 9 فبراير 2026

---

## 1. Branches (الفروع)

### حقول جديدة في جدول branches
| الحقل | النوع | الوصف |
|-------|------|-------|
| `slug` | string | نص مختصر للرابط (مثل: `joya-maadi`) |
| `description` | text | وصف الفرع |
| `hotel_id` | number | ربط الفرع بفندق |
| `image_url_3` | text | صورة إضافية |
| `image_url_4` | text | صورة إضافية |
| `image_url_5` | text | صورة إضافية |

### استخدام Slug في الـ APIs
**كل الـ endpoints التي تأخذ `:id` الآن تقبل إما:**
- رقم الـ id (مثل: `12`)
- أو الـ slug (مثل: `joya-maadi`)

**مثال:**
```
GET /api/admin/branches/12          ← يشتغل
GET /api/admin/branches/joya-maadi  ← يشتغل
```

### Create Branch - Body Request
```json
{
  "name": "Joya Maadi",
  "address": "123 Main Street",
  "phone": "+201234567890",
  "is_active": true,
  "country": "Egypt",
  "city": "Cairo",
  "region": "Maadi",
  "slug": "joya-maadi",
  "description": "وصف الفرع",
  "image_url_1": "https://...",
  "image_url_2": "https://...",
  "image_url_3": "https://...",
  "image_url_4": "https://...",
  "image_url_5": "https://...",
  "hotel_name": "Hotel Name",
  "hotel_title": "Hotel Title",
  "hotel_description": "Hotel Description",
  "hotel_image_url_1": "https://..."
}
```
**ملاحظة:** `name` مطلوب، الباقي اختياري. لو ما أرسلتش `slug` يتم توليده تلقائياً من الاسم.

### Update Branch - Body Request
نفس الحقول السابقة، كلها اختيارية. لو عدّلت `name` فقط، الـ `slug` بيتحدّث تلقائياً من الاسم الجديد.

### Get Branch By ID - Response
```json
{
  "status": "success",
  "data": {
    "branch": {
      "id": 12,
      "name": "Joya Maadi",
      "address": "...",
      "phone": "...",
      "is_active": true,
      "country": "Egypt",
      "city": "Cairo",
      "region": "Maadi",
      "slug": "joya-maadi",
      "description": "وصف الفرع",
      "hotel_id": 5,
      "image_url_1": "...",
      "image_url_2": "...",
      "image_url_3": "...",
      "image_url_4": "...",
      "image_url_5": "..."
    },
    "hotel": {
      "id": 5,
      "name": "Hotel Name",
      "title": "Hotel Title",
      "description": "Hotel Description",
      "image_url_1": "..."
    }
  }
}
```
**ملاحظة:** `hotel` يظهر فقط لو الفرع مربوط بـ hotel. لو مافيهوش ربط بيرجع `branch` فقط.

### Get Branch Services - Response
```json
{
  "status": "success",
  "data": {
    "services": [
      {
        "id": 35,
        "branch_id": 12,
        "service_id": 13,
        "price_amount": 100,
        "currency": "EUR",
        "duration_min": 60,
        "is_active": true,
        "created_at": "...",
        "service_name": "Salt Lake"
      }
    ]
  }
}
```
**جديد:** حقل `service_name` في كل عنصر.

### رفع الصور (Image Upload)
- **Slot:** كان 1 أو 2 فقط، دلوقتي من 1 لحد 5
- `POST /api/admin/branches/:id/images/:slot` (slot = 1, 2, 3, 4, 5)

---

## 2. Customer Browse APIs

### GET /api/customer/browse/branches
**التعديل:** Response بيشمل `slug`, `description`, و `image_url_3`, `image_url_4`, `image_url_5`

```json
{
  "status": "success",
  "data": {
    "branches": [
      {
        "id": 12,
        "name": "Joya Maadi",
        "address": "...",
        "phone": "...",
        "country": "Egypt",
        "city": "Cairo",
        "region": "Maadi",
        "slug": "joya-maadi",
        "description": "وصف الفرع",
        "image_url_1": "...",
        "image_url_2": "...",
        "image_url_3": "...",
        "image_url_4": "...",
        "image_url_5": "..."
      }
    ],
    "filters": { "city": null, "country": null }
  }
}
```

### GET /api/customer/browse/branches/:branchId/services
**التعديل:** `branchId` يقبل رقم id أو slug

```
/branches/12/services           ← يشتغل
/branches/joya-maadi/services   ← يشتغل
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "branch": {
      "id": 12,
      "name": "Joya Maadi",
      "slug": "joya-maadi",
      "description": "وصف الفرع",
      "image_url_1": "...",
      "image_url_2": "...",
      "image_url_3": "...",
      "image_url_4": "...",
      "image_url_5": "..."
    },
    "services": [
      {
        "id": 35,
        "name": "Salt Lake",
        "description": "وصف الخدمة",
        "price_amount": 100,
        "currency": "EUR",
        "duration_min": 60,
        "image_url_1": "...",
        "category": { "id": 1, "name": "Massage" }
      }
    ]
  }
}
```

### GET /api/customer/browse/branches/:branchId/hotel (جديد)
**Endpoint جديد** لجلب بيانات الفندق المرتبط بالفرع.

```
GET /api/customer/browse/branches/12/hotel
GET /api/customer/browse/branches/joya-maadi/hotel
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "hotel": {
      "id": 5,
      "name": "Hotel Name",
      "title": "Hotel Title",
      "description": "Hotel Description",
      "image_url_1": "..."
    }
  }
}
```
**ملاحظة:** لو الفرع مافيهوش hotel، يرجع 404.

---

## 3. ملخص للفرونت إند

| التعديل | الوصف |
|---------|-------|
| **Slug** | استخدم `slug` في الـ URLs بدل id (مثل `/branches/joya-maadi`) |
| **Branch Object** | يحوي `slug`, `description`, `image_url_3`, `image_url_4`, `image_url_5` |
| **Hotel** | كل branch ممكن يكون مربوط بـ hotel – استخدم `/branches/:id/hotel` لجلب بياناته |
| **Branch Services** | كل service فيها `service_name` |
| **Image slots** | 5 صور للفرع (كان 2) |

---

## 4. Breaking Changes

- **لا يوجد** – التعديلات backward compatible. الـ id لسه شغال في كل الـ endpoints.
