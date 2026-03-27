import express from "express";
import protect from "../middleware/protect.js";
import { languagesController } from "../controllers/languages.controller.js";

const router = express.Router();

router.use(protect);

router.get("/", languagesController.getAll);
router.get("/:id", languagesController.getById);
router.post("/", languagesController.create);
router.put("/:id", languagesController.update);
router.patch("/:id/toggle", languagesController.toggleActive);
router.delete("/:id", languagesController.remove);

export default router;
