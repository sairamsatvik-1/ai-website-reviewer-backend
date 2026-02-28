import express from "express";
import { reviewWebsite } from "../controllers/reviewController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/review", authenticate, reviewWebsite);

export default router;