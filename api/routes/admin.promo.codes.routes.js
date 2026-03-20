import express from "express";
import protect from "../middleware/protect.js";
import { promoCodesController } from "../controllers/promoCodes.controller.js";

const router = express.Router();

// Protect all admin promo codes routes
router.use(protect);

router.get("/", promoCodesController.getAll);
router.get("/:id", promoCodesController.getById);
router.post("/", promoCodesController.create);
router.put("/:id", promoCodesController.update);
router.delete("/:id", promoCodesController.remove);
router.patch("/:id/toggle", promoCodesController.toggleActive);

export default router;