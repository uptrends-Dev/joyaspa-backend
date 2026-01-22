import express from "express";
import { customerBrowseController } from "../controllers/customerBrowse.controller.js";

const router = express.Router();

// GET /api/customer/browse/branches/:branchId/services
router.get("/branches/:branchId/services", customerBrowseController.getServicesByBranchId);
router.get("/branches", customerBrowseController.getBranches);

export default router;
