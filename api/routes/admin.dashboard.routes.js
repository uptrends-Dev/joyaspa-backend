import express from "express";
import { dashboardController } from "../controllers/dashboard.controller.js";
import protect from "../middleware/protect.js";

const router = express.Router();

router.use(protect);

router.get("/statistics", dashboardController.getStatistics);
router.get("/recent-bookings", dashboardController.getRecentBookings);

export default router;
