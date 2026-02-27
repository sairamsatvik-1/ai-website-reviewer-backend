import express from "express";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/profile", authenticate, (req, res) => {
  res.json({
    message: "Access granted to protected route",
    user: (req as any).user
  });
});

export default router;