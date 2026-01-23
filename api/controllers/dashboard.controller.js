import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const dashboardController = {
  /**
   * GET /api/admin/dashboard/statistics
   * Returns dashboard statistics with optional filters
   * Query params: branch_id, service_id, from, to
   */
  getStatistics: catchAsync(async (req, res, next) => {
    const branch_id = req.query.branch_id
      ? parseInt(req.query.branch_id, 10)
      : null;
    const service_id = req.query.service_id
      ? parseInt(req.query.service_id, 10)
      : null;
    const from = req.query.from || null;
    const to = req.query.to || null;

    // 1) Get branches count
    const { count: branches_count, error: branchesError } = await supabaseAdmin
      .from("branches")
      .select("id", { count: "exact", head: true });

    if (branchesError)
      return next(new AppError("Failed to fetch branches count", 500));

    // 2) Get active/inactive services count
    const { count: active_services_count, error: activeServicesError } =
      await supabaseAdmin
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

    if (activeServicesError)
      return next(new AppError("Failed to fetch active services count", 500));

    const { count: inactive_services_count, error: inactiveServicesError } =
      await supabaseAdmin
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false);

    if (inactiveServicesError)
      return next(new AppError("Failed to fetch inactive services count", 500));

    // 3) Build bookings query with filters
    let bookingsQuery = supabaseAdmin
      .from("bookings")
      .select("id, total_amount", { count: "exact" });

    if (branch_id) bookingsQuery = bookingsQuery.eq("branch_id", branch_id);
    if (from) bookingsQuery = bookingsQuery.gte("date", from);
    if (to) bookingsQuery = bookingsQuery.lte("date", to);

    // If filtering by service_id, we need to join with booking_items
    if (service_id) {
      // First get booking IDs that contain this service
      const { data: bookingItems, error: itemsError } = await supabaseAdmin
        .from("booking_items")
        .select("booking_id")
        .eq("service_id", service_id);

      if (itemsError)
        return next(new AppError("Failed to filter by service", 500));

      const bookingIds = [
        ...new Set(bookingItems?.map((item) => item.booking_id) || []),
      ];

      if (bookingIds.length === 0) {
        // No bookings with this service
        return res.json({
          success: true,
          data: {
            bookings_count: 0,
            branches_count: branches_count || 0,
            active_services_count: active_services_count || 0,
            inactive_services_count: inactive_services_count || 0,
            total_revenue: 0,
          },
        });
      }

      bookingsQuery = bookingsQuery.in("id", bookingIds);
    }

    const {
      data: bookings,
      error: bookingsError,
      count: bookings_count,
    } = await bookingsQuery;

    if (bookingsError)
      return next(new AppError("Failed to fetch bookings", 500));

    // Calculate total revenue
    const total_revenue = (bookings || []).reduce(
      (sum, booking) => sum + Number(booking.total_amount || 0),
      0,
    );

    res.json({
      success: true,
      data: {
        bookings_count: bookings_count || 0,
        branches_count: branches_count || 0,
        active_services_count: active_services_count || 0,
        inactive_services_count: inactive_services_count || 0,
        total_revenue,
      },
    });
  }),

  /**
   * GET /api/admin/dashboard/recent-bookings
   * Returns recent bookings
   * Query params: limit (default: 10)
   */
  getRecentBookings: catchAsync(async (req, res, next) => {
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "10", 10), 1),
      50,
    );

    const { data: bookings, error } = await supabaseAdmin
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
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error)
      return next(new AppError("Failed to fetch recent bookings", 500));

    // Get items count for each booking
    const bookingIds = (bookings || []).map((b) => b.id);
    let metaByBookingId = new Map();

    if (bookingIds.length) {
      const { data: itemsMeta, error: metaError } = await supabaseAdmin
        .from("booking_items")
        .select("booking_id, duration_min_snapshot")
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
      data: result,
    });
  }),
};
