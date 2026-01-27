import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set(["created_at", "date", "total_amount", "id"]);
const allowedStatuses = new Set([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

export const bookingsController = {
  // GET /api/admin/bookings
  list: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      100,
    );
    const from = req.query.from;
    const to = req.query.to;
    const branch_id = req.query.branch_id
      ? parseInt(req.query.branch_id, 10)
      : null;
    const status = req.query.status || null;

    const sortBy = allowedSortFields.has(req.query.sortBy)
      ? req.query.sortBy
      : "created_at";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    if (status && !allowedStatuses.has(status)) {
      return next(new AppError("Invalid status filter", 400));
    }

    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    let q = supabaseAdmin.from("bookings").select(
      `
        id,
        branch_id,
        customer_id,
        status,
        date,
        total_amount,
        notes,
        created_at,
        branches ( id, name ),
        customers ( id, first_name, last_name, phone )
      `,
      { count: "exact" },
    );

    if (branch_id) q = q.eq("branch_id", branch_id);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);

    q = q
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(fromIdx, toIdx);

    const { data: bookings, error, count } = await q;

    if (error) return next(error);

    // items_count + total_duration: نجيبهم بتجميعة ثانية خفيفة
    const bookingIds = (bookings || []).map((b) => b.id);
    let metaByBookingId = new Map();

    if (bookingIds.length) {
      const { data: itemsMeta, error: metaError } = await supabaseAdmin
        .from("booking_items")
        .select("booking_id, duration_min_snapshot, price_amount_snapshot")
        .in("booking_id", bookingIds);

      if (metaError) return next(metaError);

      for (const row of itemsMeta || []) {
        const prev = metaByBookingId.get(row.booking_id) || {
          items_count: 0,
          total_duration: 0,
        };
        prev.items_count += 1;
        prev.total_duration += Number(row.duration_min_snapshot || 0);
        metaByBookingId.set(row.booking_id, prev);
      }
    }

    const result = (bookings || []).map((b) => {
      const meta = metaByBookingId.get(b.id) || {
        items_count: 0,
        total_duration: 0,
      };
      return {
        ...b,
        items_count: meta.items_count,
        total_duration: meta.total_duration,
      };
    });

    res.json({
      success: true,
      page,
      limit,
      total: count || 0,
      data: result,
    });
  }),

  // GET /api/admin/bookings/:id
  getById: catchAsync(async (req, res, next) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return next(new AppError("Invalid booking id", 400));

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select(
        `
      id,
      branch_id,
      customer_id,
      status,
      date,
      total_amount,
      notes,
      created_at,
      branches ( id, name ),
      customers ( id, first_name, last_name, phone, email, gender, nationality ),
      booking_items (
        id,
        service_id,
        service_name_snapshot,
        price_amount_snapshot,
        currency_snapshot,
        duration_min_snapshot,
        quantity,
        sort_order,
        created_at
      )
    `,
      )
      .eq("id", id)
      .single();

    if (error) return next(error);
    if (!booking) return next(new AppError("Booking not found", 404));

    // ترتيب items
    const items = (booking.booking_items || []).sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
    );

    // تجميع الخدمات (لو نفس الخدمة متكررة) + حساب totals
    const servicesMap = new Map();

    for (const it of items) {
      const serviceId = it.service_id;
      const qty = Number(it.quantity || 1);
      const unitPrice = Number(it.price_amount_snapshot || 0);
      const unitDuration = Number(it.duration_min_snapshot || 0);

      const prev = servicesMap.get(serviceId) || {
        service_id: serviceId,
        service_name: it.service_name_snapshot || null,
        currency: it.currency_snapshot || null,
        quantity: 0,
        unit_price: unitPrice, // آخر unit (غالبًا ثابت)
        total_price: 0,
        total_duration_min: 0,
      };

      prev.quantity += qty;
      prev.total_price += unitPrice * qty;
      prev.total_duration_min += unitDuration * qty;

      // لو في اختلاف unit_price عبر الصفوف (نادر) خليه آخر قيمة
      prev.unit_price = unitPrice;

      servicesMap.set(serviceId, prev);
    }

    const services = Array.from(servicesMap.values());

    const total_duration = services.reduce(
      (sum, s) => sum + Number(s.total_duration_min || 0),
      0,
    );

    const items_count = items.reduce(
      (sum, it) => sum + Number(it.quantity || 1),
      0,
    );

    res.json({
      success: true,
      data: {
        id: booking.id,
        status: booking.status,
        date: booking.date,
        notes: booking.notes,
        created_at: booking.created_at,

        branch: {
          id: booking.branches?.id || booking.branch_id,
          name: booking.branches?.name || null,
        },

        customer: {
          id: booking.customers?.id || booking.customer_id,
          name: `${booking.customers?.first_name || ""} ${booking.customers?.last_name || ""}`.trim(),
          phone: booking.customers?.phone || null,
          email: booking.customers?.email || null,
          gender: booking.customers?.gender || null,
          nationality: booking.customers?.nationality || null,
        },

        services, // array of aggregated services

        totals: {
          items_count,
          total_duration_min: total_duration,
          total_amount: Number(booking.total_amount || 0), // التوتال النهائي للحجز (زي ما طلبت)
        },
      },
    });
  }),

  // PATCH /api/admin/bookings/:id/status
  updateStatus: catchAsync(async (req, res, next) => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!id) return next(new AppError("Invalid booking id", 400));
    if (!status || !allowedStatuses.has(status)) {
      return next(new AppError("Invalid status", 400));
    }

    // 1) هات الحالة الحالية
    const { data: existing, error: findError } = await supabaseAdmin
      .from("bookings")
      .select("id, status")
      .eq("id", id)
      .single();

    if (findError) return next(findError);
    if (!existing) return next(new AppError("Booking not found", 404));

    const current = existing.status;

    // 2) Rules بسيطة للانتقال بين الحالات
    const allowedTransitions = {
      pending: new Set(["confirmed", "cancelled", "completed"]),
      confirmed: new Set(["completed", "cancelled"]),
      completed: new Set([]),
      cancelled: new Set([]),
    };

    if (!allowedTransitions[current]?.has(status)) {
      return next(
        new AppError(
          `Invalid status transition from ${current} to ${status}`,
          400,
        ),
      );
    }

    // 3) update
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();

    if (updateError) return next(updateError);

    res.json({ success: true, data: updated });
  }),
};
