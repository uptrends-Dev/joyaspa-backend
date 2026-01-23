# Software Requirements Specification (SRS)
## Joya Spa Backend - Frontend Integration Guide

**Project**: Joya Spa Management System  
**Version**: 1.0  
**Date**: January 23, 2026  
**Backend URL**: `https://your-backend-url.vercel.app` (or `http://localhost:3001` for dev)

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Authentication](#authentication)
5. [API Endpoints](#api-endpoints)
6. [Request/Response Examples](#requestresponse-examples)
7. [Error Handling](#error-handling)
8. [Page Requirements](#page-requirements)
9. [Integration Checklist](#integration-checklist)

---

## 🎯 System Overview

**Joya Spa Backend** is a REST API that manages:
- **Admin Dashboard**: Manage services, categories, branches, pricing, and bookings
- **Customer Booking System**: Browse services and create bookings

### Key Features
- JWT-based authentication for admins
- Multi-branch support with independent pricing
- Real-time booking management
- Customer profile management
- Service categorization and pricing by branch
- Booking status tracking

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js (ES Modules) |
| **API Framework** | Express.js |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | JWT (1 day expiry) |
| **Password Security** | bcryptjs |
| **Validation** | Zod |
| **Deployment** | Vercel |

---

## 📊 Database Schema

### Table: `admins`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `name` | string | NOT NULL | Admin full name |
| `email` | string | UNIQUE, NOT NULL | Login email |
| `password_hash` | string | NOT NULL | Encrypted password |
| `is_active` | boolean | DEFAULT true | Soft delete flag |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `service_categories`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `name` | string | NOT NULL | Category name |
| `description` | text | | Optional description |
| `sort_order` | integer | | For display ordering |
| `is_active` | boolean | DEFAULT true | Visibility flag |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `services`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `category_id` | UUID | FK → service_categories | Service category |
| `name` | string | NOT NULL | Service name |
| `description` | text | | Service details |
| `default_duration_min` | integer | | Duration in minutes |
| `is_active` | boolean | DEFAULT true | Visibility flag |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `branches`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `name` | string | NOT NULL | Branch name |
| `address` | string | | Physical address |
| `phone` | string | | Contact number |
| `is_active` | boolean | DEFAULT true | Visibility flag |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `branch_service_pricing`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `branch_id` | UUID | FK → branches | Branch reference |
| `service_id` | UUID | FK → services | Service reference |
| `price_amount` | decimal | NOT NULL | Service price |
| `currency` | string | DEFAULT 'SAR' | SAR, EGP, USD, EUR, AED |
| `duration_min` | integer | NOT NULL | Duration in minutes |
| `is_active` | boolean | DEFAULT true | Availability flag |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `customers`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `first_name` | string | NOT NULL | Customer first name |
| `last_name` | string | NOT NULL | Customer last name |
| `phone` | string | UNIQUE, NOT NULL | Phone number (upsert key) |
| `email` | string | | Email address |
| `gender` | string | | male, female, other |
| `nationality` | string | | Country name |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `bookings`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `branch_id` | UUID | FK → branches | Booking location |
| `customer_id` | UUID | FK → customers | Customer reference |
| `status` | enum | pending\|confirmed\|completed\|cancelled | Booking state |
| `date` | timestamp | NOT NULL | Appointment date/time |
| `total_amount` | decimal | | Calculated total price |
| `notes` | text | | Booking notes |
| `created_at` | timestamp | DEFAULT now() | Creation date |

### Table: `booking_items`
| Field | Type | Constraints | Notes |
|-------|------|-----------|-------|
| `id` | UUID | PK | Auto-generated |
| `booking_id` | UUID | FK → bookings | Booking reference |
| `service_id` | UUID | FK → services | Service reference |
| `service_name_snapshot` | string | | Immutable service name |
| `price_amount_snapshot` | decimal | | Immutable price |
| `currency_snapshot` | string | | Immutable currency |
| `duration_min_snapshot` | integer | | Immutable duration |
| `sort_order` | integer | | Item order in booking |
| `created_at` | timestamp | DEFAULT now() | Creation date |

---

## 🔐 Authentication

### JWT Token Structure
```json
{
  "id": "admin-uuid",
  "type": "admin",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Token Expiration
- **Expiry Time**: 1 day (86400 seconds)
- **Refresh Strategy**: Relogin required
- **Storage**: localStorage or sessionStorage

### Protected Routes Header
```
Authorization: Bearer <your_jwt_token>
```

### Token Validation Flow
1. Extract token from `Authorization` header
2. Verify JWT signature with `JWT_SECRET`
3. Check `type === "admin"`
4. Verify admin exists in DB
5. Verify `is_active === true`

---

## 📡 API Endpoints

### Base URL
```
Development: http://localhost:3001/api
Production: https://joya-backend.vercel.app/api
```

### Response Format (Success)
```json
{
  "status": "success",
  "data": { /* endpoint-specific data */ }
}
```

### Response Format (Error)
```json
{
  "status": "fail|error",
  "message": "Error description"
}
```

---

## 🔑 Admin Authentication Routes

### 1. Login
**Endpoint**: `POST /admin/auth/login`  
**Auth Required**: No  
**Rate Limit**: Recommended 5 req/min

**Request Body:**
```json
{
  "email": "admin@joyaspa.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ahmed Admin",
    "email": "admin@joyaspa.com",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Cases:**
- `400`: Missing email or password
- `401`: Invalid email or password
- `403`: Admin account is disabled

---

### 2. Logout
**Endpoint**: `POST /admin/auth/logout`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Logged out successfully"
}
```

---

### 3. Get Current Admin
**Endpoint**: `GET /admin/auth/me`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Ahmed Admin",
      "email": "admin@joyaspa.com",
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

---

## 📂 Categories Management Routes

### 1. List Categories
**Endpoint**: `GET /admin/categories`  
**Auth Required**: Yes  

**Query Parameters:**
```
?page=1
&limit=10
&sortBy=name
&sortOrder=asc
&is_active=true
&search=massage
```

**Response (200 OK):**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 25,
  "data": [
    {
      "id": "uuid-1",
      "name": "Body Massage",
      "description": "Various massage techniques",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2024-01-10T08:00:00Z"
    }
  ]
}
```

---

### 2. Get Simple Categories List
**Endpoint**: `GET /admin/categories/categoriesList`  
**Auth Required**: Yes  
**Use Case**: Dropdown menus

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "name": "Body Massage" },
    { "id": "uuid-2", "name": "Facial" },
    { "id": "uuid-3", "name": "Hair Care" }
  ]
}
```

---

### 3. Get Category by ID
**Endpoint**: `GET /admin/categories/:id`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-1",
    "name": "Body Massage",
    "description": "Various massage techniques",
    "sort_order": 1,
    "is_active": true,
    "created_at": "2024-01-10T08:00:00Z"
  }
}
```

---

### 4. Create Category
**Endpoint**: `POST /admin/categories`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "name": "Body Massage",
  "description": "Various massage techniques",
  "sort_order": 1,
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "category": {
      "id": "uuid-1",
      "name": "Body Massage",
      "description": "Various massage techniques",
      "sort_order": 1,
      "is_active": true,
      "created_at": "2024-01-20T10:00:00Z"
    }
  }
}
```

---

### 5. Update Category
**Endpoint**: `PUT /admin/categories/:id`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "name": "Body Massage",
  "description": "Professional massage services",
  "sort_order": 2,
  "is_active": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* updated category */ }
}
```

---

### 6. Delete Category
**Endpoint**: `DELETE /admin/categories/:id`  
**Auth Required**: Yes  
**Note**: Soft delete if services exist, hard delete if unused

**Response (204 No Content)** or:
```json
{
  "status": "success",
  "message": "Category deleted successfully"
}
```

---

### 7. Toggle Category Active Status
**Endpoint**: `PATCH /admin/categories/:id/toggle`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* category with toggled is_active */ }
}
```

---

## 🧖 Services Management Routes

### 1. List Services
**Endpoint**: `GET /admin/services`  
**Auth Required**: Yes  

**Query Parameters:**
```
?page=1
&limit=10
&category_id=uuid
&sortBy=name
&sortOrder=asc
&is_active=true
&search=massage
```

**Response (200 OK):**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 50,
  "data": [
    {
      "id": "uuid-1",
      "category_id": "uuid-cat-1",
      "name": "Swedish Massage",
      "description": "Full body relaxation",
      "default_duration_min": 60,
      "is_active": true,
      "created_at": "2024-01-10T08:00:00Z"
    }
  ]
}
```

---

### 2. Get Simple Services List
**Endpoint**: `GET /admin/services/servicesList`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "name": "Swedish Massage" },
    { "id": "uuid-2", "name": "Thai Massage" }
  ]
}
```

---

### 3. Get Service by ID
**Endpoint**: `GET /admin/services/:id`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "service": {
      "id": "uuid-1",
      "category_id": "uuid-cat-1",
      "name": "Swedish Massage",
      "description": "Full body relaxation",
      "default_duration_min": 60,
      "is_active": true,
      "created_at": "2024-01-10T08:00:00Z"
    }
  }
}
```

---

### 4. Create Service
**Endpoint**: `POST /admin/services`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "category_id": "uuid-cat-1",
  "name": "Swedish Massage",
  "description": "Full body relaxation massage",
  "default_duration_min": 60,
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "service": { /* created service */ }
  }
}
```

---

### 5. Update Service
**Endpoint**: `PUT /admin/services/:id`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "category_id": "uuid-cat-1",
  "name": "Swedish Massage Pro",
  "description": "Professional relaxation massage",
  "default_duration_min": 90,
  "is_active": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* updated service */ }
}
```

---

### 6. Delete Service
**Endpoint**: `DELETE /admin/services/:id`  
**Auth Required**: Yes  

**Response (204 No Content)**

---

### 7. Toggle Service Active Status
**Endpoint**: `PATCH /admin/services/:id/toggle`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* service with toggled is_active */ }
}
```

---

## 🏢 Branches Management Routes

### 1. List Branches
**Endpoint**: `GET /admin/branches`  
**Auth Required**: Yes  

**Query Parameters:**
```
?page=1
&limit=10
&sortBy=name
&sortOrder=asc
&is_active=true
&search=maadi
```

**Response (200 OK):**
```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 5,
  "data": [
    {
      "id": "uuid-1",
      "name": "Maadi Branch",
      "address": "123 Road, Cairo",
      "phone": "+201234567890",
      "is_active": true,
      "created_at": "2024-01-05T09:00:00Z"
    }
  ]
}
```

---

### 2. Get Simple Branches List
**Endpoint**: `GET /admin/branches/branchesList`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid-1", "name": "Maadi Branch" },
    { "id": "uuid-2", "name": "Downtown Branch" }
  ]
}
```

---

### 3. Get Branch by ID
**Endpoint**: `GET /admin/branches/:id`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* branch object */ }
}
```

---

### 4. Create Branch
**Endpoint**: `POST /admin/branches`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "name": "Downtown Branch",
  "address": "456 Avenue, Cairo",
  "phone": "+201234567891",
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "branch": { /* created branch */ }
  }
}
```

---

### 5. Update Branch
**Endpoint**: `PUT /admin/branches/:id`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "name": "Downtown Branch Updated",
  "address": "789 Street, Cairo",
  "phone": "+201234567891",
  "is_active": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* updated branch */ }
}
```

---

### 6. Delete Branch
**Endpoint**: `DELETE /admin/branches/:id`  
**Auth Required**: Yes  

**Response (204 No Content)**

---

### 7. Toggle Branch Active Status
**Endpoint**: `PATCH /admin/branches/:id/toggle`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* branch with toggled is_active */ }
}
```

---

## 💰 Pricing Management Routes

### 1. List Pricing
**Endpoint**: `GET /admin/pricing`  
**Auth Required**: Yes  

**Query Parameters:**
```
?page=1
&limit=20
&branch_id=uuid
&service_id=uuid
&is_active=true
```

**Response (200 OK):**
```json
{
  "success": true,
  "page": 1,
  "limit": 20,
  "total": 150,
  "data": [
    {
      "id": "uuid-1",
      "branch_id": "uuid-branch-1",
      "service_id": "uuid-service-1",
      "price_amount": 250,
      "currency": "SAR",
      "duration_min": 60,
      "is_active": true,
      "created_at": "2024-01-10T08:00:00Z"
    }
  ]
}
```

---

### 2. Get Pricing by ID
**Endpoint**: `GET /admin/pricing/:id`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* pricing object */ }
}
```

---

### 3. Create Pricing
**Endpoint**: `POST /admin/pricing`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "branch_id": "uuid-branch-1",
  "service_id": "uuid-service-1",
  "price_amount": 250,
  "currency": "SAR",
  "duration_min": 60,
  "is_active": true
}
```

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {
    "pricing": { /* created pricing */ }
  }
}
```

---

### 4. Update Pricing
**Endpoint**: `PUT /admin/pricing/:id`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "branch_id": "uuid-branch-1",
  "service_id": "uuid-service-1",
  "price_amount": 300,
  "currency": "SAR",
  "duration_min": 60,
  "is_active": true
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* updated pricing */ }
}
```

---

### 5. Delete Pricing
**Endpoint**: `DELETE /admin/pricing/:id`  
**Auth Required**: Yes  

**Response (204 No Content)**

---

### 6. Toggle Pricing Active Status
**Endpoint**: `PATCH /admin/pricing/:id/toggle`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* pricing with toggled is_active */ }
}
```

---

## 📅 Bookings Management Routes

### 1. List Bookings (Admin)
**Endpoint**: `GET /admin/bookings`  
**Auth Required**: Yes  

**Query Parameters:**
```
?page=1
&limit=20
&status=confirmed
&branch_id=uuid
&from=2024-01-20T00:00:00Z
&to=2024-01-30T23:59:59Z
```

**Response (200 OK):**
```json
{
  "success": true,
  "page": 1,
  "limit": 20,
  "total": 45,
  "data": [
    {
      "id": "uuid-1",
      "branch_id": "uuid-branch-1",
      "customer_id": "uuid-customer-1",
      "status": "confirmed",
      "date": "2024-01-25T14:00:00Z",
      "total_amount": 500,
      "notes": "Prefer morning session",
      "created_at": "2024-01-20T10:00:00Z",
      "branches": {
        "id": "uuid-branch-1",
        "name": "Maadi Branch"
      },
      "customers": {
        "id": "uuid-customer-1",
        "first_name": "John",
        "last_name": "Doe",
        "phone": "+201234567890"
      },
      "items_count": 2,
      "total_duration": 120
    }
  ]
}
```

---

### 2. Get Booking Details
**Endpoint**: `GET /admin/bookings/:id`  
**Auth Required**: Yes  

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "booking": {
      "id": "uuid-1",
      "branch_id": "uuid-branch-1",
      "customer_id": "uuid-customer-1",
      "status": "confirmed",
      "date": "2024-01-25T14:00:00Z",
      "total_amount": 500,
      "notes": "Prefer morning session",
      "created_at": "2024-01-20T10:00:00Z",
      "branches": { /* branch data */ },
      "customers": { /* customer data */ },
      "items": [
        {
          "id": "uuid-item-1",
          "service_id": "uuid-service-1",
          "service_name_snapshot": "Swedish Massage",
          "price_amount_snapshot": 250,
          "currency_snapshot": "SAR",
          "duration_min_snapshot": 60,
          "sort_order": 1
        },
        {
          "id": "uuid-item-2",
          "service_id": "uuid-service-2",
          "service_name_snapshot": "Facial",
          "price_amount_snapshot": 250,
          "currency_snapshot": "SAR",
          "duration_min_snapshot": 60,
          "sort_order": 2
        }
      ]
    }
  }
}
```

---

### 3. Update Booking Status
**Endpoint**: `PATCH /admin/bookings/:id/status`  
**Auth Required**: Yes  

**Request Body:**
```json
{
  "status": "completed"
}
```

**Valid Status Transitions:**
```
pending → confirmed, cancelled, completed
confirmed → completed, cancelled
completed → (terminal state)
cancelled → (terminal state)
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": { /* updated booking */ }
}
```

---

## 👥 Customer Booking Routes

### 1. Browse Branches
**Endpoint**: `GET /customer/browse/branches`  
**Auth Required**: No  
**Use Case**: Customer selects a branch

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "Maadi Branch",
      "address": "123 Road, Cairo",
      "phone": "+201234567890"
    }
  ]
}
```

---

### 2. Browse Services by Branch
**Endpoint**: `GET /customer/browse/branches/:branchId/services`  
**Auth Required**: No  

**Query Parameters:**
```
?category_id=uuid  (optional filter)
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "category_id": "uuid-cat-1",
      "category_name": "Body Massage",
      "name": "Swedish Massage",
      "description": "Full body relaxation",
      "price": 250,
      "currency": "SAR",
      "duration_min": 60
    }
  ]
}
```

---

### 3. Create Booking (Customer)
**Endpoint**: `POST /customer/bookings`  
**Auth Required**: No  

**Request Body:**
```json
{
  "branch_id": "uuid-branch-1",
  "date": "2024-01-25T14:00:00Z",
  "services": ["uuid-service-1", "uuid-service-2"],
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+201234567890",
    "email": "john@example.com",
    "gender": "male",
    "nationality": "Egyptian"
  },
  "notes": "Prefer morning session"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid-1",
    "total_amount": 500,
    "currency": "SAR",
    "status": "pending",
    "message": "Booking created successfully"
  }
}
```

---

## 📝 Request/Response Examples

### Example: Admin Login Flow

**Step 1: Login**
```bash
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@joyaspa.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ahmed Admin",
    "email": "admin@joyaspa.com",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInR5cGUiOiJhZG1pbiIsImlhdCI6MTcwNTMxODYwMCwiZXhwIjoxNzA1NDA1MDAwfQ.signature"
  }
}
```

**Step 2: Store Token**
```javascript
localStorage.setItem('adminToken', 'eyJhbGciOiJIUzI1NiIs...');
```

**Step 3: Use Token in Protected Requests**
```bash
curl -X GET http://localhost:3001/api/admin/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

### Example: Create and Manage Services

**1. Get Categories**
```bash
curl -X GET http://localhost:3001/api/admin/categories/categoriesList \
  -H "Authorization: Bearer <token>"
```

**2. Create Service**
```bash
curl -X POST http://localhost:3001/api/admin/services \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "uuid-cat-1",
    "name": "Swedish Massage",
    "description": "Full body relaxation",
    "default_duration_min": 60,
    "is_active": true
  }'
```

**3. List Services**
```bash
curl -X GET "http://localhost:3001/api/admin/services?page=1&limit=10&category_id=uuid-cat-1" \
  -H "Authorization: Bearer <token>"
```

---

### Example: Customer Booking Flow

**1. Browse Branches**
```bash
curl -X GET http://localhost:3001/api/customer/browse/branches
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-branch-1",
      "name": "Maadi Branch",
      "address": "123 Road, Cairo",
      "phone": "+201234567890"
    }
  ]
}
```

**2. Browse Services**
```bash
curl -X GET http://localhost:3001/api/customer/browse/branches/uuid-branch-1/services
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-service-1",
      "category_id": "uuid-cat-1",
      "category_name": "Body Massage",
      "name": "Swedish Massage",
      "description": "Full body relaxation",
      "price": 250,
      "currency": "SAR",
      "duration_min": 60
    },
    {
      "id": "uuid-service-2",
      "category_id": "uuid-cat-1",
      "category_name": "Body Massage",
      "name": "Thai Massage",
      "description": "Traditional Thai technique",
      "price": 300,
      "currency": "SAR",
      "duration_min": 90
    }
  ]
}
```

**3. Create Booking**
```bash
curl -X POST http://localhost:3001/api/customer/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "branch_id": "uuid-branch-1",
    "date": "2024-01-25T14:00:00Z",
    "services": ["uuid-service-1", "uuid-service-2"],
    "customer": {
      "first_name": "John",
      "last_name": "Doe",
      "phone": "+201234567890",
      "email": "john@example.com",
      "gender": "male",
      "nationality": "Egyptian"
    },
    "notes": "Prefer morning session"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking_id": "uuid-booking-1",
    "total_amount": 550,
    "currency": "SAR",
    "status": "pending",
    "message": "Booking created successfully"
  }
}
```

---

## ⚠️ Error Handling

### Error Response Format
```json
{
  "status": "fail|error",
  "message": "Descriptive error message"
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| **200** | OK | Successful GET/PUT/PATCH |
| **201** | Created | Successful POST |
| **204** | No Content | Successful DELETE |
| **400** | Bad Request | Missing required fields |
| **401** | Unauthorized | No token or invalid token |
| **403** | Forbidden | Inactive account |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate entry or constraint violation |
| **500** | Server Error | Unexpected error |

### Common Error Scenarios

#### 1. Missing Authentication
```json
{
  "status": "fail",
  "message": "No token provided"
}
```

#### 2. Invalid Token
```json
{
  "status": "fail",
  "message": "Invalid or expired token"
}
```

#### 3. Inactive Admin
```json
{
  "status": "fail",
  "message": "Admin account is disabled"
}
```

#### 4. Validation Error
```json
{
  "status": "fail",
  "message": "Email and password are required"
}
```

#### 5. Resource Not Found
```json
{
  "status": "fail",
  "message": "Category not found"
}
```

#### 6. Duplicate Entry
```json
{
  "status": "fail",
  "message": "Email already exists"
}
```

---

## 🖼️ Page Requirements

### Admin Dashboard

#### 1. **Login Page**
- Email input field
- Password input field
- "Login" button
- Error message display
- Loader/spinner during submission
- Remember me checkbox (optional)

**Implementation:**
```javascript
// Store token after login
localStorage.setItem('adminToken', response.data.token);

// Redirect to dashboard
navigate('/admin/dashboard');

// Set authorization header for all future requests
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

---

#### 2. **Categories Management Page**
- **List View**
  - Table with columns: ID, Name, Description, Sort Order, Status, Actions
  - Pagination controls
  - Search bar
  - Sort options
  - Add button
  
- **Create/Edit Modal**
  - Name input (required)
  - Description textarea
  - Sort Order number input
  - Active toggle
  - Save/Cancel buttons

- **Actions**
  - Edit (open modal)
  - Delete (confirm dialog)
  - Toggle active status
  - View details

**API Integration:**
```javascript
// List categories
GET /admin/categories?page=1&limit=10&sortBy=name&sortOrder=asc

// Create category
POST /admin/categories
Body: { name, description, sort_order, is_active }

// Update category
PUT /admin/categories/:id
Body: { name, description, sort_order, is_active }

// Delete category
DELETE /admin/categories/:id

// Toggle active
PATCH /admin/categories/:id/toggle
```

---

#### 3. **Services Management Page**
- **List View**
  - Table: ID, Name, Category, Duration, Status, Actions
  - Filter by category
  - Pagination
  - Search
  - Add button

- **Create/Edit Modal**
  - Category dropdown (required, fetch from `/admin/categories/categoriesList`)
  - Name input (required)
  - Description textarea
  - Default duration input (minutes)
  - Active toggle
  - Save/Cancel buttons

- **Actions**
  - Edit
  - Delete
  - Toggle active
  - View in category

**API Integration:**
```javascript
// List services
GET /admin/services?page=1&limit=10&category_id=uuid

// Create service
POST /admin/services
Body: { category_id, name, description, default_duration_min, is_active }

// Update service
PUT /admin/services/:id
Body: { category_id, name, description, default_duration_min, is_active }

// Delete service
DELETE /admin/services/:id
```

---

#### 4. **Branches Management Page**
- **List View**
  - Table: ID, Name, Address, Phone, Status, Actions
  - Pagination
  - Search
  - Add button

- **Create/Edit Modal**
  - Name input (required)
  - Address input
  - Phone input
  - Active toggle
  - Save/Cancel buttons

- **Actions**
  - Edit
  - Delete
  - Toggle active
  - View associated services/pricing

**API Integration:**
```javascript
// List branches
GET /admin/branches?page=1&limit=10

// Create branch
POST /admin/branches
Body: { name, address, phone, is_active }

// Update branch
PUT /admin/branches/:id
Body: { name, address, phone, is_active }

// Delete branch
DELETE /admin/branches/:id
```

---

#### 5. **Pricing Management Page**
- **List View**
  - Table: ID, Branch, Service, Price, Currency, Duration, Status, Actions
  - Filter by branch
  - Filter by service
  - Pagination
  - Add button

- **Create/Edit Modal**
  - Branch dropdown (required, fetch from `/admin/branches/branchesList`)
  - Service dropdown (required, fetch from `/admin/services/servicesList`)
  - Price amount input (required)
  - Currency dropdown (SAR, EGP, USD, EUR, AED)
  - Duration input (minutes, required)
  - Active toggle
  - Save/Cancel buttons

- **Actions**
  - Edit
  - Delete
  - Toggle active
  - Bulk pricing import (CSV)

**API Integration:**
```javascript
// List pricing
GET /admin/pricing?page=1&limit=20&branch_id=uuid&service_id=uuid

// Create pricing
POST /admin/pricing
Body: { branch_id, service_id, price_amount, currency, duration_min, is_active }

// Update pricing
PUT /admin/pricing/:id
Body: { branch_id, service_id, price_amount, currency, duration_min, is_active }

// Delete pricing
DELETE /admin/pricing/:id
```

---

#### 6. **Bookings Management Page**
- **List View**
  - Table: ID, Customer, Branch, Date, Status, Total, Actions
  - Filter by status (pending, confirmed, completed, cancelled)
  - Filter by branch
  - Date range filter
  - Pagination
  - Search by customer name/phone

- **Booking Details Modal**
  - Customer info (name, phone, email)
  - Booking date/time
  - Services list with prices
  - Total amount
  - Status dropdown (with valid transitions)
  - Notes textarea
  - Save changes button
  - Action buttons (Confirm, Complete, Cancel)

- **Actions**
  - View details
  - Update status
  - Edit notes
  - Delete

**API Integration:**
```javascript
// List bookings
GET /admin/bookings?page=1&limit=20&status=confirmed&branch_id=uuid&from=ISO_DATE&to=ISO_DATE

// Get booking details
GET /admin/bookings/:id

// Update booking status
PATCH /admin/bookings/:id/status
Body: { status: "confirmed|completed|cancelled" }
```

---

#### 7. **Admin Profile Page**
- Display current admin info
- Edit admin profile (name only, email not editable)
- Change password
- Logout button

**API Integration:**
```javascript
// Get current admin
GET /admin/auth/me

// Logout
POST /admin/auth/logout
```

---

### Customer-Facing Pages

#### 1. **Branch Selection Page**
- List of all active branches
- Branch card with name, address, phone
- "Select Branch" button for each

**API Integration:**
```javascript
// Browse branches
GET /customer/browse/branches
```

---

#### 2. **Service Selection Page**
- Services grouped by category
- Service cards showing: name, description, price, duration, "Add to Cart" button
- Shopping cart summary (items count, total price)
- "Checkout" button

**API Integration:**
```javascript
// Browse services
GET /customer/browse/branches/:branchId/services?category_id=uuid
```

---

#### 3. **Checkout Page**
- Customer information form
  - First name (required)
  - Last name (required)
  - Phone number (required, +201... format)
  - Email (optional)
  - Gender dropdown (male, female, other)
  - Nationality input
  
- Appointment date/time picker
- Selected services list with prices
- Total amount display
- Terms & conditions checkbox
- "Confirm Booking" button

**API Integration:**
```javascript
// Create booking
POST /customer/bookings
Body: {
  branch_id,
  date,
  services,
  customer: { first_name, last_name, phone, email, gender, nationality },
  notes
}
```

---

#### 4. **Booking Confirmation Page**
- Booking ID
- Success message
- Booking summary (date, services, total)
- Customer info (name, phone)
- "Download Confirmation" button (optional)
- "Back to Home" button

---

## 🔗 Integration Checklist

### Before Starting Frontend Development

- [ ] **Environment Setup**
  - [ ] Confirm backend URL (dev/production)
  - [ ] Install HTTP client (axios/fetch)
  - [ ] Setup global error handling
  - [ ] Setup token management (localStorage/sessionStorage)
  - [ ] Configure CORS headers

- [ ] **Authentication**
  - [ ] Implement login page
  - [ ] Implement token storage
  - [ ] Setup axios interceptor for token injection
  - [ ] Implement logout
  - [ ] Implement protected routes
  - [ ] Handle token expiry

- [ ] **Admin Dashboard**
  - [ ] Create dashboard layout
  - [ ] Implement navigation menu
  - [ ] Create page skeleton/loading states
  - [ ] Implement error toast/notification system

- [ ] **Categories Management**
  - [ ] List page with pagination
  - [ ] Create/edit modal
  - [ ] Delete confirmation
  - [ ] Toggle active status
  - [ ] Search functionality

- [ ] **Services Management**
  - [ ] List page with pagination and category filter
  - [ ] Create/edit modal with category dropdown
  - [ ] Delete confirmation
  - [ ] Toggle active status
  - [ ] Search functionality

- [ ] **Branches Management**
  - [ ] List page with pagination
  - [ ] Create/edit modal
  - [ ] Delete confirmation
  - [ ] Toggle active status
  - [ ] Search functionality

- [ ] **Pricing Management**
  - [ ] List page with pagination and filters
  - [ ] Create/edit modal with branch/service dropdowns
  - [ ] Delete confirmation
  - [ ] Toggle active status

- [ ] **Bookings Management**
  - [ ] List page with pagination and status/date filters
  - [ ] Booking details modal
  - [ ] Status update functionality
  - [ ] Search by customer

- [ ] **Customer Section**
  - [ ] Branch listing
  - [ ] Service browsing by branch
  - [ ] Booking form
  - [ ] Booking confirmation page

- [ ] **Global Features**
  - [ ] Error handling and user feedback
  - [ ] Loading states
  - [ ] Form validation
  - [ ] Responsive design (mobile, tablet, desktop)
  - [ ] Accessibility (WCAG 2.1)
  - [ ] Internationalization (AR/EN)

---

## 📞 Support & Documentation

### Swagger API Documentation
- **URL**: `http://localhost:3001/api-docs`
- **Description**: Interactive API documentation with try-it-out feature

### Database Connection
- **Supabase Dashboard**: https://app.supabase.com
- **Database**: PostgreSQL 14+
- **Real-time Support**: Enabled for all tables

### Deployment
- **Backend Hosting**: Vercel
- **Frontend Hosting**: Vercel (recommended)
- **Database**: Supabase Cloud

### Key Environment Variables for Frontend
```env
VITE_API_BASE_URL=http://localhost:3001/api        # Dev
# or
VITE_API_BASE_URL=https://joya-backend.vercel.app/api  # Prod

VITE_APP_NAME=Joya Spa
VITE_DEFAULT_CURRENCY=SAR
```

---

## 📄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-23 | Initial release with full API documentation |

---

**Last Updated**: January 23, 2026  
**Prepared For**: Frontend Development Team  
**Backend Team**: Joya Spa Backend Team