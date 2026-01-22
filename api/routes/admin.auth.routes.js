import express from "express";

import { adminAuthController } from "../controllers/adminAuth.controller.js";
import protect from "../middleware/protect.js"
const router = express.Router();

router.post("/login", adminAuthController.login);
router.post("/logout", adminAuthController.logout);
router.get("/me",protect, adminAuthController.me);

export default router;
