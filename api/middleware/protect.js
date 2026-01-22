import jwt from "jsonwebtoken";
import AppError from "../lib/AppError.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

export default async function protectAdmin(req, res, next) {
  let token;

  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return next(new AppError("Admin not logged in", 401));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // لازم يكون admin token
    if (decoded.type !== "admin") {
      return next(new AppError("Invalid token type", 401));
    }

    const { data: admin, error } = await supabaseAdmin
      .from("admins")
      .select("id, name, email, is_active, created_at")
      .eq("id", decoded.id)
      .single();

    if (error || !admin) return next(new AppError("Admin not found", 401));
    if (!admin.is_active) return next(new AppError("Admin account disabled", 403));

    req.admin = admin;
  
    next();
  } catch (e) {
    return next(new AppError("Invalid or expired token", 401));
  }
}
