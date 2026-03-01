// src/services/scanner/scanner.ts
// Critical fix: trust extractor runs AFTER scroll+footer wait, not in parallel.
// The Airbnb debug proved Privacy/Terms links exist — they just render late.
// Running trust extraction after scrollWithFooterWait() fixes this.

import { chromium } from "playwright";
import { PageData }  from "../../models/PageData";

import { detectFramework }          from "./frameworkDetector";
import { extractSearchBar }         from "./searchExtractor";
import { extractButtons, extractInteractiveElements, extractDropdowns, extractModals } from "./interactiveExtractor";
import { extractForms, extractInputs }     from "./formExtractor";
import { extractNavigation, extractLinks } from "./navigationExtractor";
import { extractImages, extractHeadings, extractMeta, extractContentStats } from "./mediaExtractor";
import { extractTrustSignals }      from "./trustExtractor";
import { extractPerformance }       from "./performanceExtractor";

const NOISE_PATTERNS = [
  "analytics", "tracking", "telemetry", "logging", "metrics",
  "beacon", "pixel", "jitney", "collect", "ping", "rum",
  "hotjar", "segment", "mixpanel", "amplitude", "heap",
  "fullstory", "logrocket", "clarity", "mouseflow",
  "facebook.com/tr", "connect.facebook",
  "google-analytics", "googletagmanager", "googlesyndication",
  "doubleclick", "criteo", "optimizely", "qualtrics",
  "newrelic", "datadog", "sentry",
  "airbnb.co.in/tracking", "airbnb.com/tracking", "eventemitter",
  "youtubei/v1/log", "play.google.com/log",
  "google.com/gen_204", "youtube.com/ptracking",
];

function isNoise(url: string): boolean {
  return NOISE_PATTERNS.some(p => url.toLowerCase().includes(p));
}

export async function scanWebsite(url: string): Promise<PageData> {
  const targetUrl = url.startsWith("http") ? url : `https://${url}`;
  const browser   = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext({
      viewport:  { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                 "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const page = await context.newPage();

    const consoleErrors:   string[] = [];
    const consoleWarnings: string[] = [];
    const failedRequests:  string[] = [];

    page.on("console", msg => {
      if (msg.type() === "error")   consoleErrors.push(msg.text());
      if (msg.type() === "warning") consoleWarnings.push(msg.text());
    });
    page.on("requestfailed", req => {
      const u = req.url();
      if (!isNoise(u)) failedRequests.push(`${req.failure()?.errorText} — ${u}`);
    });

    // ── Navigate ──────────────────────────────────────────────
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("load").catch(() => null);
    const finalUrl = page.url();
    const title    = await page.title();

    // ── Wait for JS framework to render ──────────────────────
    await waitForRender(page);

    // ── Scroll to bottom and WAIT for footer to render ────────
    // Debug confirmed: Airbnb Privacy/Terms links exist but render
    // ~1500ms after scroll reaches bottom. Must complete before
    // running ANY extractors that read footer content.
    await scrollWithFooterWait(page);

    // ── Detect framework ──────────────────────────────────────
    const framework = await detectFramework(page);
    const fw        = framework.name;

    // ── Phase 1: Run non-footer extractors in parallel ────────
    // These don't need footer content so run them together for speed
    const [
      meta, headings, navigation, links, images,
      forms, inputs, buttons, interactiveElements,
      dropdowns, modals, perfMetrics, contentStats, searchBar,
    ] = await Promise.all([
      extractMeta(page),
      extractHeadings(page),
      extractNavigation(page),
      extractLinks(page, finalUrl),
      extractImages(page),
      extractForms(page, fw),
      extractInputs(page, fw),
      extractButtons(page, fw),
      extractInteractiveElements(page, fw),
      extractDropdowns(page),
      extractModals(page),
      extractPerformance(page),
      extractContentStats(page),
      extractSearchBar(page, fw),
    ]);

    // ── Phase 2: Trust AFTER scroll — footer content dependent ─
    // Runs separately to guarantee footer has fully rendered.
    // This is why Privacy/Terms were always false — they were
    // running before footer DOM existed.
    const trustSignals = await extractTrustSignals(page);

    // ── Load time from Navigation Timing API ─────────────────
    const loadTime = await page.evaluate((): number => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (!nav) return 0;
      const interactive = Math.round(nav.domInteractive - nav.startTime);
      const total       = Math.round(nav.loadEventEnd   - nav.startTime);
      return interactive > 0 ? interactive : total;
    });

    // ── Screenshots ───────────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const screenshotDesktop = (await page.screenshot({ fullPage: false })).toString("base64");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const screenshotMobile = (await page.screenshot({ fullPage: false })).toString("base64");
     
    await browser.close();

    const data: PageData = {
      url: targetUrl, finalUrl, title,
      loadTime: loadTime || perfMetrics.domInteractive || perfMetrics.totalLoad,
      framework,
      ...meta,
      headings,
      h1Count:        headings.filter(h => h.level === "h1").length,
      wordCount:      contentStats.wordCount,
      paragraphCount: contentStats.paragraphCount,
      hasHero:        contentStats.hasHero,
      hasSchema:      contentStats.hasSchema,
      navItems:       navigation.navItems,
      hasMobileMenu:  navigation.hasMobileMenu,
      searchBar, buttons, interactiveElements,
      dropdowns, modals, links, forms, inputs,
      images,
      imagesWithoutAlt: images.filter(i => !i.hasAlt).length,
      hasVideo:  contentStats.hasVideo,
      hasIframe: contentStats.hasIframe,
      ...trustSignals,
      consoleErrors, consoleWarnings, failedRequests,
      perfMetrics,
      isHttps: finalUrl.startsWith("https"),
      counts: {
        links:               links.length,
        externalLinks:       links.filter(l => l.isExternal).length,
        buttons:             buttons.length,
        forms:               forms.length,
        images:              images.length,
        inputs:              inputs.length,
        headings:            headings.length,
        consoleErrors:       consoleErrors.length,
        failedRequests:      failedRequests.length,
        interactiveElements: interactiveElements.length,
        dropdowns:           dropdowns.length,
      },
      screenshotDesktop,
      screenshotMobile,
    };

    return data;

  } catch (error) {
    await browser.close();
    throw error;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForRender(page: any): Promise<void> {
  await Promise.race([
    page.waitForFunction(
      () => document.body.innerText.trim().split(/\s+/).length > 50,
      { timeout: 5000 }
    ).catch(() => null),
    new Promise(r => setTimeout(r, 2500)),
  ]);
  await page.waitForTimeout(300);
}

// Scrolls to each quarter of the page, pauses 1500ms at bottom
// so React/Vue footers finish rendering before we extract trust signals.
async function scrollWithFooterWait(page: any): Promise<void> {
  await page.evaluate(async () => {
    const height = document.body.scrollHeight;
    for (const pct of [0.25, 0.50, 0.75]) {
      window.scrollTo(0, height * pct);
      await new Promise(r => setTimeout(r, 150));
    }
    // Full bottom — wait for footer React render
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1500));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
}