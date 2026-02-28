// src/services/scanner/scanner.ts
// Orchestrates all extractors. This is the only file the controller talks to.
// Returns a complete PageData object.

import { chromium } from "playwright";
import { PageData }  from "../../models/PageData";

import { detectFramework }        from "./frameworkDetector";
import { extractSearchBar }       from "./searchExtractor";
import { extractButtons, extractInteractiveElements, extractDropdowns, extractModals } from "./interactiveExtractor";
import { extractForms, extractInputs }   from "./formExtractor";
import { extractNavigation, extractLinks } from "./navigationExtractor";
import { extractImages, extractHeadings, extractMeta, extractContentStats } from "./mediaExtractor";
import { extractTrustSignals }    from "./trustExtractor";
import { extractPerformance }     from "./performanceExtractor";

export async function scanWebsite(url: string): Promise<PageData> {
  const targetUrl = url.startsWith("http") ? url : `https://${url}`;

  const browser = await chromium.launch({
    headless: false, // false for local debugging
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const page = await context.newPage();

    // ── Capture runtime signals before navigation ─────────────
    const consoleErrors:   string[] = [];
    const consoleWarnings: string[] = [];
    const failedRequests:  string[] = [];

    page.on("console", msg => {
      if (msg.type() === "error")   consoleErrors.push(msg.text());
      if (msg.type() === "warning") consoleWarnings.push(msg.text());
    });
    page.on("requestfailed", req =>
      failedRequests.push(`${req.failure()?.errorText} — ${req.url()}`)
    );

    // ── Navigate ──────────────────────────────────────────────
    const start = Date.now();
  await page.goto(targetUrl, {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});

await page.waitForTimeout(2500);

await page.waitForTimeout(2000);

await page.waitForFunction(() => {
  return document.body.innerText.length > 100;
}, { timeout: 5000 }).catch(() => {});
    const loadTime = Date.now() - start;
    const finalUrl = page.url();
    const title    = await page.title();

    // ── Step 1: Detect framework FIRST ───────────────────────
    // All other extractors receive framework.name so they can
    // use the right selectors for the detected stack.
    const framework = await detectFramework(page);
    const fw        = framework.name;

    // ── Step 2: Run all extractors in parallel ────────────────
    const [
      meta,
      headings,
      navigation,
      links,
      images,
      forms,
      inputs,
      buttons,
      interactiveElements,
      dropdowns,
      modals,
      trustSignals,
      perfMetrics,
      contentStats,
      searchBar,
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
      extractTrustSignals(page),
      extractPerformance(page),
      extractContentStats(page),
      extractSearchBar(page, fw),
    ]);

    // ── Step 3: Desktop screenshot ────────────────────────────
    const desktopBuf        = await page.screenshot({ fullPage: false });
    const screenshotDesktop = desktopBuf.toString("base64");

    // ── Step 4: Mobile screenshot ─────────────────────────────
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800); // allow layout reflow
    const mobileBuf        = await page.screenshot({ fullPage: false });
    const screenshotMobile = mobileBuf.toString("base64");

    await browser.close();

    // ── Step 5: Assemble PageData ─────────────────────────────
    const data: PageData = {
      // Identity
      url: targetUrl,
      finalUrl,
      title,
      loadTime,

      // Framework
      framework,

      // Meta
      ...meta,

      // Content
      headings,
      h1Count:        headings.filter(h => h.level === "h1").length,
      wordCount:      contentStats.wordCount,
      paragraphCount: contentStats.paragraphCount,
      hasHero:        contentStats.hasHero,
      hasSchema:      contentStats.hasSchema,

      // Navigation
      navItems:      navigation.navItems,
      hasMobileMenu: navigation.hasMobileMenu,

      // Interactive
      searchBar,
      buttons,
      interactiveElements,
      dropdowns,
      modals,
      links,
      forms,
      inputs,

      // Media
      images,
      imagesWithoutAlt: images.filter(i => !i.hasAlt).length,
      hasVideo:         contentStats.hasVideo,
      hasIframe:        contentStats.hasIframe,

      // Trust
      ...trustSignals,

      // Technical
      consoleErrors,
      consoleWarnings,
      failedRequests,
      perfMetrics,
      isHttps: finalUrl.startsWith("https"),

      // Counts
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

      // Screenshots
      screenshotDesktop,
      screenshotMobile,
    };

    return data;

  } catch (error) {
    await browser.close();
    throw error;
  }
}