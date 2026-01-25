# 📋 Joya Spa Backend - Complete API Endpoints Summary

---

## 🔐 Admin Authentication

**Base:** `/api/admin/auth`

| Method | Endpoint  | Description            | Auth |
| ------ | --------- | ---------------------- | ---- |
| `POST` | `/login`  | Admin login            | ❌   |
| `POST` | `/logout` | Admin logout           | ❌   |
| `GET`  | `/me`     | Get current admin info | ✅   |

---

## 📊 Admin Dashboard

**Base:** `/api/admin/dashboard`

| Method | Endpoint           | Description              | Auth |
| ------ | ------------------ | ------------------------ | ---- |
| `GET`  | `/statistics`      | Get dashboard statistics | ✅   |
| `GET`  | `/recent-bookings` | Get recent bookings      | ✅   |

---

## 📅 Admin Bookings

**Base:** `/api/admin/bookings`

| Method  | Endpoint      | Description           | Auth |
| ------- | ------------- | --------------------- | ---- |
| `GET`   | `/`           | List all bookings     | ✅   |
| `GET`   | `/:id`        | Get booking by ID     | ✅   |
| `PATCH` | `/:id/status` | Update booking status | ✅   |

---

## 🏢 Admin Branches

**Base:** `/api/admin/branches`

| Method   | Endpoint        | Description                  | Auth |
| -------- | --------------- | ---------------------------- | ---- |
| `GET`    | `/`             | Get all branches (paginated) | ✅   |
| `GET`    | `/branchesList` | Get branches list (dropdown) | ✅   |
| `GET`    | `/:id`          | Get branch by ID             | ✅   |
| `POST`   | `/`             | Create new branch            | ✅   |
| `PUT`    | `/:id`          | Update branch                | ✅   |
| `DELETE` | `/:id`          | Delete branch                | ✅   |
| `PATCH`  | `/:id/toggle`   | Toggle branch active status  | ✅   |

### 🆕 Branch Services (NEW!)

| Method   | Endpoint                    | Description                   | Auth |
| -------- | --------------------------- | ----------------------------- | ---- |
| `GET`    | `/:id/services`             | Get all services for a branch | ✅   |
| `GET`    | `/:id/services/:service_id` | Get single branch service     | ✅   |
| `POST`   | `/:id/services`             | Add service to branch         | ✅   |
| `PUT`    | `/:id/services/:service_id` | Update branch service pricing | ✅   |
| `PATCH`  | `/:id/services/:service_id` | Toggle branch service active  | ✅   |
| `DELETE` | `/:id/services/:service_id` | Remove service from branch    | ✅   |

---

## 📂 Admin Categories

**Base:** `/api/admin/categories`

| Method   | Endpoint          | Description                    | Auth |
| -------- | ----------------- | ------------------------------ | ---- |
| `GET`    | `/`               | Get all categories (paginated) | ✅   |
| `GET`    | `/categoriesList` | Get categories list (dropdown) | ✅   |
| `GET`    | `/:id`            | Get category by ID             | ✅   |
| `POST`   | `/`               | Create new category            | ✅   |
| `PUT`    | `/:id`            | Update category                | ✅   |
| `DELETE` | `/:id`            | Delete category                | ✅   |
| `PATCH`  | `/:id/toggle`     | Toggle category active status  | ✅   |

---

## 💆 Admin Services

**Base:** `/api/admin/services`

| Method   | Endpoint        | Description                  | Auth |
| -------- | --------------- | ---------------------------- | ---- |
| `GET`    | `/`             | Get all services (paginated) | ✅   |
| `GET`    | `/servicesList` | Get services list (dropdown) | ✅   |
| `GET`    | `/:id`          | Get service by ID            | ✅   |
| `POST`   | `/`             | Create new service           | ✅   |
| `PUT`    | `/:id`          | Update service               | ✅   |
| `DELETE` | `/:id`          | Delete service               | ✅   |
| `PATCH`  | `/:id/toggle`   | Toggle service active status | ✅   |

---

## 💰 Admin Pricing

**Base:** `/api/admin/pricing`

| Method   | Endpoint      | Description                    | Auth |
| -------- | ------------- | ------------------------------ | ---- |
| `GET`    | `/`           | Get all branch service pricing | ✅   |
| `GET`    | `/:id`        | Get pricing by ID              | ✅   |
| `POST`   | `/`           | Create new pricing             | ✅   |
| `PUT`    | `/:id`        | Update pricing                 | ✅   |
| `DELETE` | `/:id`        | Delete pricing                 | ✅   |
| `PATCH`  | `/:id/toggle` | Toggle pricing active status   | ✅   |

---

## 🛒 Customer Browse (Public)

**Base:** `/api/customer/browse`

| Method | Endpoint                       | Query Params      | Description                   |
| ------ | ------------------------------ | ----------------- | ----------------------------- |
| `GET`  | `/branches`                    | `city`, `country` | Get all active branches       |
| `GET`  | `/branches/:branchId/services` | `category_id`     | Get services for a branch     |
| `GET`  | `/categories`                  | -                 | Get all categories (id, name) |

---

## 📝 Customer Bookings (Public)

**Base:** `/api/customer/bookings`

| Method | Endpoint | Description        |
| ------ | -------- | ------------------ |
| `POST` | `/`      | Create new booking |

---

## Legend

- ✅ = Requires Authentication (JWT token)
- ❌ = Public endpoint

---

# 🆕 New Branch Services Endpoints - Details

## POST `/api/admin/branches/:id/services`

Add a service to a branch with pricing.

**Request Body:**

```json
{
  "service_id": 1,
  "price_amount": 150.0,
  "currency": "SAR",
  "duration_min": 60
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "branchService": {
      "id": 1,
      "branch_id": 1,
      "service_id": 1,
      "price_amount": 150.0,
      "currency": "SAR",
      "duration_min": 60,
      "is_active": true,
      "created_at": "2026-01-25T12:00:00Z"
    }
  }
}
```

---

## GET `/api/admin/branches/:id/services`

Get all services for a specific branch.

**Response:**

```json
{
  "status": "success",
  "data": {
    "services": [
      {
        "id": 1,
        "branch_id": 1,
        "service_id": 1,
        "price_amount": 150.0,
        "currency": "SAR",
        "duration_min": 60,
        "is_active": true,
        "created_at": "2026-01-25T12:00:00Z"
      }
    ]
  }
}
```

---

## GET `/api/admin/branches/:id/services/:service_id`

Get a single branch service.

**Response:**

```json
{
  "status": "success",
  "data": {
    "current": {
      "id": 1,
      "is_active": true
    }
  }
}
```

---

## PUT `/api/admin/branches/:id/services/:service_id`

Update branch service pricing.

**Request Body:**

```json
{
  "price_amount": 200.0,
  "currency": "SAR",
  "duration_min": 90
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "branchService": {
      "id": 1,
      "branch_id": 1,
      "service_id": 1,
      "price_amount": 200.0,
      "currency": "SAR",
      "duration_min": 90,
      "is_active": true,
      "created_at": "2026-01-25T12:00:00Z"
    }
  }
}
```

---

## PATCH `/api/admin/branches/:id/services/:service_id`

Toggle is_active status for a branch service.

**Response:**

```json
{
  "status": "success",
  "data": {
    "branchService": {
      "id": 1,
      "branch_id": 1,
      "service_id": 1,
      "price_amount": 150.0,
      "currency": "SAR",
      "duration_min": 60,
      "is_active": false,
      "created_at": "2026-01-25T12:00:00Z"
    }
  }
}
```

---

## DELETE `/api/admin/branches/:id/services/:service_id`

Remove a service from a branch.

**Response:**

```json
{
  "status": "success",
  "message": "Branch service deleted successfully"
}
```
