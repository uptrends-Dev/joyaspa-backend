import express from "express";
import { servicesController } from "../controllers/services.controller.js";
import protect from "../middleware/protect.js"

const router = express.Router();

router.use(protect);

router.get("/", servicesController.getAll);
router.get("/servicesList", servicesController.servicesList);
router.get("/:id", servicesController.getById);
router.post("/", servicesController.create);
router.put("/:id", servicesController.update);
router.delete("/:id", servicesController.remove);
router.patch("/:id/toggle", servicesController.toggleActive);

export default router;
