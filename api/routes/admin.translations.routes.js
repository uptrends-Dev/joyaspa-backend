import express from "express";
import protect from "../middleware/protect.js";
import { translationsController } from "../controllers/translations.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", translationsController.getAll);
router.get("/:id", translationsController.getById);
router.post("/", translationsController.create);
router.put("/:id", translationsController.update);
router.delete("/:id", translationsController.remove);

export default router;
