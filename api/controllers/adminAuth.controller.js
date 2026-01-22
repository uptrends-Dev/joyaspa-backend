import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import catchAsync from "../lib/catchAsync.js";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

const signAdminToken = (admin) => {
  return jwt.sign({ id: admin.id, type: "admin" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

export const adminAuthController = {
  login: catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // 1) validate input
    if (!email || !password) {
      return next(new AppError("Email and password are required", 400));
    }

    // 2) get admin by email
    const { data: admin, error } = await supabaseAdmin
      .from("admins")
      .select("id, name, email, password_hash, is_active, created_at")
      .eq("email", email)
      .single();

    // 3) check admin exists
    if (error || !admin) {
      return next(new AppError("Invalid email or password", 401));
    }

    // 4) check active
    if (!admin.is_active) {
      return next(new AppError("Admin account is disabled", 403));
    }

    // 5) check password
    if (password != admin.password_hash) {
      return next(new AppError("Invalid email or password", 401));
    }

    // 6) sign token
    const token = signAdminToken(admin);

    // 7) response (مترجعش password_hash)
    return res.status(200).json({
      status: "success",
      data: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        is_active: admin.is_active,
        created_at: admin.created_at,
        token,
      },
    });
  }),

  logout: catchAsync(async (req, res) => {
    // JWT logout = client removes token
    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  }),
  // GET /api/admin/auth/me
  me: (req, res) => {
    // console.log(req.admin)
    return res.status(200).json({
      status: "success",
      data: {
        admin: req.admin,
      },
    });
  },
};
