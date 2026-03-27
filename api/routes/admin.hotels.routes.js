import express from "express";
import protect from "../middleware/protect.js";
import { hotelsController } from "../controllers/hotels.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", hotelsController.getAll);
router.get("/:id", hotelsController.getById);
router.post("/", hotelsController.create);
router.put("/:id", hotelsController.update);
router.delete("/:id", hotelsController.remove);

export default router;
