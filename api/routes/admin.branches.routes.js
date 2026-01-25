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
router.patch("/:id/toggle", branchesController.toggleActiveBranch);
router.post("/:id/services", branchesController.createBranchService);
router.get("/:id/services", branchesController.getBranchServices); // 
router.delete("/:id/services/:service_id", branchesController.deleteBranchService);
router.patch("/:id/services/:service_id", branchesController.toggleActiveBranchService);
router.get("/:id/services/:service_id", branchesController.getBranchService);
router.put("/:id/services/:service_id", branchesController.updateBranchService);

export default router;
