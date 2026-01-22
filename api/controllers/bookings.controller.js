import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const allowedSortFields = new Set(["created_at", "date", "total_amount", "id"]);
const allowedStatuses = new Set(["pending", "confirmed", "completed", "cancelled"]);

export const bookingsController = {
  // GET /api/admin/bookings
  list: catchAsync(async (req, res, next) => {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const from = req.query.from;
    const to = req.query.to;
    const branch_id = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
    const status = req.query.status || null;

    const sortBy = allowedSortFields.has(req.query.sortBy) ? req.query.sortBy : "created_at";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    if (status && !allowedStatuses.has(status)) {
      return next(new AppError("Invalid status filter", 400));
    }

    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    let q = supabaseAdmin
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
        customers ( id, first_name, last_name, phone )
      `,
        { count: "exact" }
      );

    if (branch_id) q = q.eq("branch_id", branch_id);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);

    q = q.order(sortBy, { ascending: sortOrder === "asc" }).range(fromIdx, toIdx);

    const { data: bookings, error, count } = await q;

    if (error) return next(error);

    // items_count + total_duration: نجيبهم بتجميعة ثانية خفيفة
    const bookingIds = (bookings || []).map(b => b.id);
    let metaByBookingId = new Map();

    if (bookingIds.length) {
      const { data: itemsMeta, error: metaError } = await supabaseAdmin
        .from("booking_items")
        .select("booking_id, duration_min_snapshot, price_amount_snapshot")
        .in("booking_id", bookingIds);

      if (metaError) return next(metaError);

      for (const row of itemsMeta || []) {
        const prev = metaByBookingId.get(row.booking_id) || { items_count: 0, total_duration: 0 };
        prev.items_count += 1;
        prev.total_duration += Number(row.duration_min_snapshot || 0);
        metaByBookingId.set(row.booking_id, prev);
      }
    }

    const result = (bookings || []).map(b => {
      const meta = metaByBookingId.get(b.id) || { items_count: 0, total_duration: 0 };
      return {
        ...b,
        items_count: meta.items_count,
        total_duration: meta.total_duration
      };
    });

    res.json({
      success: true,
      page,
      limit,
      total: count || 0,
      data: result
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
        branches ( id, name, address, phone ),
        customers ( id, first_name, last_name, phone, email, gender, nationality ),
        booking_items (
          id,
          service_id,
          service_name_snapshot,
          price_amount_snapshot,
          currency_snapshot,
          duration_min_snapshot,
          sort_order,
          created_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) return next(error);
    if (!booking) return next(new AppError("Booking not found", 404));

    // ترتيب items
    booking.booking_items = (booking.booking_items || []).sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );

    // اجمالي مدة من snapshots
    const total_duration = (booking.booking_items || []).reduce(
      (sum, it) => sum + Number(it.duration_min_snapshot || 0),
      0
    );

    res.json({
      success: true,
      data: {
        ...booking,
        total_duration,
        items_count: booking.booking_items?.length || 0
      }
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
      pending: new Set(["confirmed", "cancelled" , "completed"]),
      confirmed: new Set(["completed", "cancelled"]),
      completed: new Set([]),
      cancelled: new Set([])
    };

    if (!allowedTransitions[current]?.has(status)) {
      return next(
        new AppError(`Invalid status transition from ${current} to ${status}`, 400)
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
  })
};
