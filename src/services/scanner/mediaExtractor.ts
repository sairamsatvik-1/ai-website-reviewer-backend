// src/services/scanner/mediaExtractor.ts
// Word count uses querySelectorAll across all visible text elements.
// This works for Web Components (YouTube/Polymer) where innerText
// only returns ~27 words but the real content is 900+.

import { Page } from "playwright";
import { HeadingData, ImageData, MetaTagData } from "../../models/PageData";

// ─── Images ───────────────────────────────────────────────────────────────────

export async function extractImages(page: Page): Promise<ImageData[]> {
  return page.$$eval("img", imgs =>
    (imgs as HTMLImageElement[]).map(img => ({
      src:
        img.getAttribute("src") ??
        img.getAttribute("data-src") ??
        img.getAttribute("data-lazy-src") ??
        img.getAttribute("data-original") ??
        img.getAttribute("data-lazy") ??
        img.getAttribute("data-delayed-src") ??
        null,
      alt:        img.getAttribute("alt"),
      hasAlt:     img.hasAttribute("alt") && (img.getAttribute("alt") ?? "").length > 0,
      width:      img.naturalWidth  || img.width  || null,
      height:     img.naturalHeight || img.height || null,
      isLazy:     img.loading === "lazy" || img.hasAttribute("data-src"),
      isNextImage:img.hasAttribute("data-nimg"),
    }))
  );
}

// ─── Headings ─────────────────────────────────────────────────────────────────

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
  metaTags:        MetaTagData[];
  canonical:       string | null;
  language:        string | null;
  viewport:        string | null;
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
  wordCount:      number;
  paragraphCount: number;
  hasHero:        boolean;
  hasVideo:       boolean;
  hasIframe:      boolean;
  hasSchema:      boolean;
}> {
  return page.evaluate(() => {

    // ── Word count — querySelectorAll method ──────────────────
    // innerText only returns ~27 words on YouTube (Polymer/Web Components).
    // querySelectorAll across all visible text elements returns 900+.
    // This is the accurate method for all site types.
    const textElements = Array.from(
      document.querySelectorAll(
        "h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, label, " +
        "div[class], section, article, main, header, footer, nav, aside"
      )
    );

    const seen    = new Set<Node>();
    let wordCount = 0;

    for (const el of textElements) {
      // Only count leaf-level text to avoid double-counting parent + child
      // A "leaf" is an element whose direct text nodes have content
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && !seen.has(child)) {
          const text = (child.textContent || "").trim();
          if (text.length > 1) {
            seen.add(child);
            wordCount += text.split(/\s+/).filter(w => w.length > 1).length;
          }
        }
      }
    }

    // Fallback: if querySelectorAll returns very little, use innerText
    const innerTextCount = (document.body.innerText || "")
      .split(/\s+/).filter(w => w.length > 1).length;

    // Take whichever is higher — covers all site types
    const finalWordCount = Math.max(wordCount, innerTextCount);

    // ── Other stats ───────────────────────────────────────────
    const heroSelectors = [
      ".hero", "#hero", "[class*='hero']",
      ".banner", "#banner", "[class*='banner']",
      ".jumbotron", ".splash", "[class*='splash']",
      "section:first-of-type", ".above-fold",
      ".w-container:first-child",
    ];
    const hasHero = heroSelectors.some(s => !!document.querySelector(s));

    const hasVideo = !!document.querySelector(
      'video, [class*="video"], ' +
      'iframe[src*="youtube"], iframe[src*="vimeo"], ' +
      'iframe[src*="loom"], iframe[src*="wistia"]'
    );

    return {
      wordCount:      finalWordCount,
      paragraphCount: document.querySelectorAll("p").length,
      hasHero,
      hasVideo,
      hasIframe:  !!document.querySelector("iframe"),
      hasSchema:  !!document.querySelector('script[type="application/ld+json"]'),
    };
  });
}