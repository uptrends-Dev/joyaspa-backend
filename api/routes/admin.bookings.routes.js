import express from "express";
import { bookingsController } from "../controllers/bookings.controller.js";
import protect from "../middleware/protect.js"

const router = express.Router();

router.use(protect);

router.get("/", bookingsController.list);
router.get("/:id", bookingsController.getById);
router.patch("/:id/status", bookingsController.updateStatus);

export default router;
