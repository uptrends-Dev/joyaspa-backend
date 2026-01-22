import express from "express";
import { categoriesController } from "../controllers/categories.controller.js";
import protect from "../middleware/protect.js"

const router = express.Router();

// Protect all admin category routes
router.use(protect);

router.get("/", categoriesController.getAll);
router.get("/categoriesList", categoriesController.categoriesList);
router.get("/:id", categoriesController.getById);
router.post("/", categoriesController.create);
router.put("/:id", categoriesController.update);
router.delete("/:id", categoriesController.remove);

// optional
router.patch("/:id/toggle", categoriesController.toggleActive);

export default router;
