import express from "express";
import { promoValidateController } from "../controllers/promoValidate.controller.js";

const router = express.Router();

// POST /api/customer/promo-codes/validate
router.post("/validate", promoValidateController.validate);

export default router;

