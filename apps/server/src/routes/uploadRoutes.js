import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getCloudinaryUploadSignature, getUploadConfig } from "../controllers/uploadController.js";

const router = Router();

router.get("/config", getUploadConfig);
router.post("/cloudinary/signature", requireAuth, getCloudinaryUploadSignature);

export default router;
