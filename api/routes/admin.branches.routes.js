import express from "express";
import { branchesController } from "../controllers/branches.controller.js";
import protect from "../middleware/protect.js"
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

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
router.post("/:id/images/:slot", upload.single("file"), branchesController.uploadImage);
router.post("/:id/hotel/image", upload.single("file"), branchesController.uploadHotelImage);
export default router;
