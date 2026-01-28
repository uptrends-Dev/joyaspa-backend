import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { sendBookingEmail } from "../lib/sendBookingEmail.js"; // ✅ عدّل المسار حسب مشروعك

export const customerBookingController = {
  create: catchAsync(async (req, res, next) => {
    const { branch_id, date, services, customer, notes } = req.body;

    // ------------------------
    // 1) Basic validation
    // ------------------------
    if (!branch_id || !date || !Array.isArray(services) || services.length === 0) {
      return next(new AppError("Invalid booking data", 400));
    }

    for (const service of services) {
      if (!service.service_id || !service.quantity || service.quantity < 1) {
        return next(
          new AppError(
            "Each service must have a valid service_id and quantity (>= 1)",
            400
          )
        );
      }
    }

    if (!customer?.phone) {
      return next(new AppError("Customer phone is required", 400));
    }

    const serviceIds = services.map((s) => s.service_id);

    // helper to normalize inputs
    const norm = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s.length ? s : null;
    };

    let customerId = null;

    // ------------------------
    // 2) Always create customer
    // ------------------------
    const { data: newCustomer, error: createCustomerError } = await supabaseAdmin
      .from("customers")
      .insert({
        first_name: norm(customer.first_name),
        last_name: norm(customer.last_name),
        phone: norm(customer.phone),
        email: norm(customer.email),
        gender: norm(customer.gender),
        nationality: norm(customer.nationality),
      })
      .select("id, first_name, last_name, email")
      .single();

    if (createCustomerError) return next(createCustomerError);

    customerId = newCustomer.id;

    try {
      // ------------------------
      // 3) Fetch pricing
      // ------------------------
      const { data: pricing, error: pricingError } = await supabaseAdmin
        .from("branch_service_pricing")
        .select(`
          service_id,
          price_amount,
          currency,
          duration_min,
          services ( name )
        `)
        .eq("branch_id", branch_id)
        .in("service_id", serviceIds)
        .eq("is_active", true);

      if (pricingError) throw pricingError;

      if (pricing.length !== serviceIds.length) {
        throw new AppError("One or more services are not available for this branch", 400);
      }

      // ✅ (اختياري) هات اسم الفرع بدل ما نعرض ID في الإيميل
      const { data: branchRow, error: branchError } = await supabaseAdmin
        .from("branches")
        .select("id, name")
        .eq("id", branch_id)
        .single();

      // لو فشلنا في جلب الفرع، مش هنوقف الحجز
      const branchName = branchError ? null : branchRow?.name;

      // ------------------------
      // 4) Create booking
      // ------------------------
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .insert({
          branch_id,
          customer_id: customerId,
          status: "confirmed",
          date,
          notes: norm(notes),
          total_amount: 0,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // ------------------------
      // 5) Create booking items
      // ------------------------
      let grandTotal = 0;

      const items = services.map((service, index) => {
        const p = pricing.find((x) => x.service_id === service.service_id);
        const quantity = service.quantity;
        const itemTotal = Number(p.price_amount) * quantity;
        grandTotal += itemTotal;

        return {
          booking_id: booking.id,
          service_id: service.service_id,
          service_name_snapshot: p.services.name,
          price_amount_snapshot: p.price_amount,
          currency_snapshot: p.currency,
          duration_min_snapshot: p.duration_min,
          quantity,
          sort_order: index + 1,
        };
      });

      const { error: itemsError } = await supabaseAdmin.from("booking_items").insert(items);
      if (itemsError) throw itemsError;

      // ------------------------
      // 6) Update total amount
      // ------------------------
      const { error: totalError } = await supabaseAdmin
        .from("bookings")
        .update({ total_amount: grandTotal })
        .eq("id", booking.id);

      if (totalError) throw totalError;

      // ------------------------
      // 7) Build response + send email
      // ------------------------
      const itemsBreakdown = items.map((item) => ({
        service_name: item.service_name_snapshot,
        unit_price: item.price_amount_snapshot,
        quantity: item.quantity,
        item_total: Number(item.price_amount_snapshot) * item.quantity,
        currency: item.currency_snapshot,
      }));

      // ✅ إرسال الإيميل (لو فيه email)
      if (newCustomer.email) {
        try {
          await sendBookingEmail({
            booking: {
              id: booking.id,
              date: booking.date,
              branch_id,
              branch_name: branchName,
              notes: booking.notes,
            },
            customer: {
              first_name: newCustomer.first_name,
              last_name: newCustomer.last_name,
              email: newCustomer.email,
            },
            items: itemsBreakdown,
            totals: {
              grand_total: grandTotal,
              currency: itemsBreakdown?.[0]?.currency || null,
            },
          });
        } catch (emailErr) {
          // مهم: ما تفشلش الحجز بسبب الإيميل
          console.error("Failed to send booking email:", emailErr);
        }
      }

      return res.status(201).json({
        success: true,
        booking_id: booking.id,
        items: itemsBreakdown,
        grand_total: grandTotal,
      });
    } catch (err) {
      // ✅ Cleanup: remove customer created in this request to avoid orphan rows
      await supabaseAdmin.from("customers").delete().eq("id", customerId);
      return next(err);
    }
  }),
};
