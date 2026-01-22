import express from "express";
import { branchesController } from "../controllers/branches.controller.js";
import protect from "../middleware/protect.js"

const router = express.Router();

router.use(protect);

router.get("/", branchesController.getAll);
router.get("/branchesList", branchesController.branchsList);
router.get("/:id", branchesController.getById);
router.post("/", branchesController.create);
router.put("/:id", branchesController.update);
router.delete("/:id", branchesController.remove);
router.patch("/:id/toggle", branchesController.toggleActive);


export default router;
