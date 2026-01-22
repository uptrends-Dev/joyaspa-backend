import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export const customerBookingController = {
  create: catchAsync(async (req, res, next) => {
    const { branch_id, date, services, customer, notes } = req.body;

    // ------------------------
    // 1) Basic validation
    // ------------------------
    if (!branch_id || !date || !Array.isArray(services) || services.length === 0) {
      return next(new AppError("Invalid booking data", 400));
    }

    if (!customer?.phone) {
      return next(new AppError("Customer phone is required", 400));
    }

    // ------------------------
    // 2) Upsert customer (by phone)
    // ------------------------
    const { data: existingCustomer, error: customerFindError } =
      await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("phone", customer.phone)
        .maybeSingle();

    if (customerFindError) {
      return next(customerFindError);
    }

    let customerId;

    if (!existingCustomer) {
      const { data: newCustomer, error: createCustomerError } =
        await supabaseAdmin
          .from("customers")
          .insert({
            first_name: customer.first_name,
            last_name: customer.last_name,
            phone: customer.phone,
            email: customer.email ?? null,
            gender: customer.gender ?? null,
            nationality: customer.nationality ?? null
          })
          .select("id")
          .single();

      if (createCustomerError) {
        return next(createCustomerError);
      }

      customerId = newCustomer.id;
    } else {
      const { error: updateCustomerError } =
        await supabaseAdmin
          .from("customers")
          .update({
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email ?? null,
            gender: customer.gender ?? null,
            nationality: customer.nationality ?? null
          })
          .eq("id", existingCustomer.id);

      if (updateCustomerError) {
        return next(updateCustomerError);
      }

      customerId = existingCustomer.id;
    }

    // ------------------------
    // 3) Fetch pricing for services
    // ------------------------
    const { data: pricing, error: pricingError } =
      await supabaseAdmin
        .from("branch_service_pricing")
        .select(`
          service_id,
          price_amount,
          currency,
          duration_min,
          services (
            name
          )
        `)
        .eq("branch_id", branch_id)
        .in("service_id", services)
        .eq("is_active", true);

    if (pricingError) {
      return next(pricingError);
    }

    if (pricing.length !== services.length) {
      return next(
        new AppError("One or more services are not available for this branch", 400)
      );
    }

    // ------------------------
    // 4) Create booking
    // ------------------------
    const { data: booking, error: bookingError } =
      await supabaseAdmin
        .from("bookings")
        .insert({
          branch_id,
          customer_id: customerId,
          status: "confirmed",
          date,
          notes,
          total_amount: 0
        })
        .select()
        .single();

    if (bookingError) {
      return next(bookingError);
    }

    // ------------------------
    // 5) Create booking items (snapshots)
    // ------------------------
    let totalAmount = 0;

    const items = services.map((serviceId, index) => {
      const p = pricing.find(x => x.service_id === serviceId);

      totalAmount += Number(p.price_amount);

      return {
        booking_id: booking.id,
        service_id: serviceId,
        service_name_snapshot: p.services.name,
        price_amount_snapshot: p.price_amount,
        currency_snapshot: p.currency,
        duration_min_snapshot: p.duration_min,
        sort_order: index + 1
      };
    });

    const { error: itemsError } =
      await supabaseAdmin
        .from("booking_items")
        .insert(items);

    if (itemsError) {
      return next(itemsError);
    }

    // ------------------------
    // 6) Update total amount
    // ------------------------
    const { error: totalError } =
      await supabaseAdmin
        .from("bookings")
        .update({ total_amount: totalAmount })
        .eq("id", booking.id);

    if (totalError) {
      return next(totalError);
    }

    // ------------------------
    // 7) Response
    // ------------------------
    res.status(201).json({
      success: true,
      booking_id: booking.id,
      total_amount: totalAmount
    });
  })
};
