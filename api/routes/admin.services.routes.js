import express from "express";
import { servicesController } from "../controllers/services.controller.js";
import protect from "../middleware/protect.js"
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get("/", servicesController.getAll);
router.get("/servicesList", servicesController.servicesList);
router.get("/:id", servicesController.getById);
router.post("/", servicesController.create);
router.put("/:id", servicesController.update);
router.delete("/:id", servicesController.remove);
router.patch("/:id/toggle", servicesController.toggleActive);
router.post("/:id/images/:slot", upload.single("file"), servicesController.uploadImage);
export default router;
