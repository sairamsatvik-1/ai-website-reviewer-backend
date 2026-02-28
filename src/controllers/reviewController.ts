// src/controllers/reviewController.ts
// Current version: scan → model → score → return
// AI reviewer will be added later after we validate scoring output

import { Request, Response } from "express";
import { scanWebsite }    from "../services/scanner/scanner";
import { buildPageModel } from "../services/analysis/pageModelBuilder";
import { scorePageModel } from "../services/analysis/scoringEngine";

export const reviewWebsite = async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: "URL is required",
    });
  }

  try {
    // Step 1 — Scan
    const rawData = await scanWebsite(url);

    // Step 2 — Build page model
    const pageModel = buildPageModel(rawData);

    // Step 3 — Score
    const scoredModel = scorePageModel(pageModel);

    // Return all three layers so you can inspect each one
    return res.json({
      success: true,

      // What matters most — scored output with signals
      score: scoredModel,

      // Clean structured model — pre-scoring
      pagemodel:pageModel,

      // Raw DOM extraction — full detail
      rawdata:rawData,
    });

  } catch (error: any) {
    console.error("[reviewWebsite]", error);
    return res.status(500).json({
      success: false,
      message: "Review failed",
      error:   error.message ?? String(error),
    });
  }
};