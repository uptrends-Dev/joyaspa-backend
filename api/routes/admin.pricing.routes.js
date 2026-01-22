import express from "express";
import protect from "../middleware/protect.js"
import { branchServicePricingController } from "../controllers/branchServicePricing.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", branchServicePricingController.getAll);
router.get("/:id", branchServicePricingController.getById);
router.post("/", branchServicePricingController.create);
router.put("/:id", branchServicePricingController.update);
router.delete("/:id", branchServicePricingController.remove);
router.patch("/:id/toggle", branchServicePricingController.toggleActive);

export default router;
