// src/services/scanner/mediaExtractor.ts
// Extracts images, headings, and general content stats.

import { Page } from "playwright";
import { HeadingData, ImageData, MetaTagData } from "../../models/PageData";

// ─── Images ───────────────────────────────────────────────────────────────────

export async function extractImages(page: Page): Promise<ImageData[]> {
  return page.$$eval("img", imgs =>
    (imgs as HTMLImageElement[]).map(img => ({
      // Handle lazy loading — check every known attribute
      src:
        img.getAttribute("src") ??
        img.getAttribute("data-src") ??          // generic lazy
        img.getAttribute("data-lazy-src") ??     // WordPress lazy
        img.getAttribute("data-original") ??     // lazysizes
        img.getAttribute("data-lazy") ??         // custom
        img.getAttribute("data-delayed-src") ??  // Squarespace
        null,
      alt:      img.getAttribute("alt"),
      hasAlt:   img.hasAttribute("alt") && (img.getAttribute("alt") ?? "").length > 0,
      width:    img.naturalWidth || img.width || null,
      height:   img.naturalHeight || img.height || null,
      isLazy:   img.loading === "lazy" || img.hasAttribute("data-src"),
      isNextImage: img.hasAttribute("data-nimg"),  // Next.js <Image>
    }))
  );
}

// ─── Headings ────────────────────────────────────────────────────────────────

export async function extractHeadings(page: Page): Promise<HeadingData[]> {
  return page.$$eval("h1, h2, h3, h4, h5, h6", els =>
    els.map(el => ({
      level: el.tagName.toLowerCase(),
      text:  el.textContent?.replace(/\s+/g, " ").trim().slice(0, 200) ?? null,
    }))
  );
}

// ─── Meta tags ────────────────────────────────────────────────────────────────

export async function extractMeta(page: Page): Promise<{
  metaDescription: string | null;
  metaTags: MetaTagData[];
  canonical: string | null;
  language: string | null;
  viewport: string | null;
}> {
  return page.evaluate(() => {
    const get = (sel: string, attr: string) =>
      document.querySelector(sel)?.getAttribute(attr) ?? null;

    const metaTags: MetaTagData[] = Array.from(document.querySelectorAll("meta")).map(m => ({
      name:     m.getAttribute("name"),
      property: m.getAttribute("property"),
      content:  m.getAttribute("content"),
    }));

    return {
      metaDescription:
        get('meta[name="description"]', "content") ??
        get('meta[property="og:description"]', "content"),
      metaTags,
      canonical: get('link[rel="canonical"]', "href"),
      language:  document.documentElement.getAttribute("lang"),
      viewport:  get('meta[name="viewport"]', "content"),
    };
  });
}

// ─── Content stats ────────────────────────────────────────────────────────────

export async function extractContentStats(page: Page): Promise<{
  wordCount: number;
  paragraphCount: number;
  hasHero: boolean;
  hasVideo: boolean;
  hasIframe: boolean;
  hasSchema: boolean;
}> {
  return page.evaluate(() => {
    const bodyText  = document.body.innerText ?? "";
    const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

    const heroSelectors = [
      ".hero", "#hero",
      "[class*='hero']",
      ".banner", "#banner",
      "[class*='banner']",
      ".jumbotron", ".splash",
      "[class*='splash']",
      "section:first-of-type",
      ".above-fold",
      // Webflow
      ".w-container:first-child",
      // Bootstrap
      ".jumbotron",
    ];
    const hasHero = heroSelectors.some(s => !!document.querySelector(s));

    const hasVideo = !!document.querySelector(
      'video, [class*="video"], ' +
      'iframe[src*="youtube"], iframe[src*="vimeo"], ' +
      'iframe[src*="loom"], iframe[src*="wistia"]'
    );

    return {
      wordCount,
      paragraphCount: document.querySelectorAll("p").length,
      hasHero,
      hasVideo,
      hasIframe: !!document.querySelector("iframe"),
      hasSchema:  !!document.querySelector('script[type="application/ld+json"]'),
    };
  });
}