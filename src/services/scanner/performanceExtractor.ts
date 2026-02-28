// src/services/scanner/performanceExtractor.ts
// Extracts real performance metrics using the browser's Performance API.

import { Page } from "playwright";
import { PerfMetrics } from "../../models/PageData";

export async function extractPerformance(page: Page): Promise<PerfMetrics> {
  return page.evaluate((): PerfMetrics => {
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;

    return {
      ttfb:           Math.round(nav.responseStart  - nav.requestStart),
      domComplete:    Math.round(nav.domComplete    - nav.responseEnd),
      totalLoad:      Math.round(nav.loadEventEnd   - nav.startTime),
      domInteractive: Math.round(nav.domInteractive - nav.startTime),
      resourceCount:  performance.getEntriesByType("resource").length,
    };
  });
}