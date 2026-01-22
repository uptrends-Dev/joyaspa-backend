import express from "express";
import { customerBookingController } from "../controllers/customerBooking.controller.js";

const router = express.Router();

router.post("/", customerBookingController.create);
// router.get("/:customerId", customerBookingController.getByCustomerId);
// router.put("/:id", customerBookingController.update);
// router.delete("/:id", customerBookingController.delete);

export default router;
