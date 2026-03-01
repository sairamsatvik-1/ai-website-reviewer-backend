// src/services/scanner/trustExtractor.ts

import { Page }       from "playwright";
import { SocialLink } from "../../models/PageData";

export async function extractTrustSignals(page: Page): Promise<{
  hasSocialProof:  boolean;
  socialLinks:     SocialLink[];
  hasPrivacyPolicy:boolean;
  hasTerms:        boolean;
  hasCookieBanner: boolean;
}> {
  return page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll("a[href]"));

    // ── Social proof ──────────────────────────────────────────
    const hasSocialProof = [
      ".testimonial", ".testimonials", ".review", ".reviews",
      ".rating", ".ratings", ".stars", ".star-rating",
      "[class*='testimonial']", "[class*='review']",
      "[class*='rating']", "[class*='trust']",
      "[class*='social-proof']", ".trustpilot-widget",
    ].some(s => !!document.querySelector(s));

    // ── Social links ──────────────────────────────────────────
    const socialPatterns: Record<string, string[]> = {
      twitter:   ["twitter.com"],
      x:         ["x.com/"],
      facebook:  ["facebook.com", "fb.com"],
      instagram: ["instagram.com"],
      linkedin:  ["linkedin.com"],
      youtube:   ["youtube.com", "youtu.be"],
      tiktok:    ["tiktok.com"],
      github:    ["github.com"],
      pinterest: ["pinterest.com"],
      discord:   ["discord.gg", "discord.com"],
    };
    const socialLinks: SocialLink[] = [];
    for (const link of allLinks) {
      const href = link.getAttribute("href") ?? "";
      for (const [platform, domains] of Object.entries(socialPatterns)) {
        if (domains.some(d => href.includes(d))) {
          socialLinks.push({ platform, href });
          break;
        }
      }
    }

    // ── Legal links — three strategies ───────────────────────

    // Strategy 1: link href contains legal keywords
    const linkHrefs = allLinks.map(l =>
      (l.getAttribute("href") ?? "").toLowerCase()
    );

    // Strategy 2: visible link text (handles React/SPA sites)
    const linkTexts = allLinks.map(l =>
      (l.textContent ?? "").toLowerCase().replace(/\s+/g, " ").trim()
    );

    // Strategy 3: full page body text scan
    // Catches cases where legal text exists but links haven't rendered yet
    const bodyText = (document.body.innerText ?? "").toLowerCase();

    const hasPrivacyPolicy =
      // Text on links
      linkTexts.some(t =>
        t === "privacy" ||
        t === "privacy policy" ||
        t === "privacy notice" ||
        t === "your privacy choices" ||
        t.startsWith("privacy")
      ) ||
      // Href patterns
      linkHrefs.some(h =>
        h.includes("/privacy") ||
        h.includes("privacy-policy") ||
        h.includes("privacypolicy")
      ) ||
      // Body text fallback
      bodyText.includes("privacy policy") ||
      bodyText.includes("privacy notice");

    const hasTerms =
      linkTexts.some(t =>
        t === "terms" ||
        t === "terms of service" ||
        t === "terms of use" ||
        t === "terms and conditions" ||
        t === "tos" ||
        t.startsWith("terms")
      ) ||
      linkHrefs.some(h =>
        h.includes("/terms") ||
        h.includes("terms-of-service") ||
        h.includes("terms-of-use")
      ) ||
      bodyText.includes("terms of service") ||
      bodyText.includes("terms of use");

    // ── Cookie banner ─────────────────────────────────────────
    const hasCookieBanner = [
      "[class*='cookie']", "[id*='cookie']",
      "[class*='consent']", "[id*='consent']",
      "[class*='gdpr']",   "[id*='gdpr']",
      "#CybotCookiebotDialog", "#onetrust-banner-sdk",
      ".cc-window", "[data-cookiebanner]",
      "#cookie-notice", "#cookie-banner",
      ".cookie-banner", ".cookie-notice",
    ].some(s => !!document.querySelector(s));

    return { hasSocialProof, socialLinks, hasPrivacyPolicy, hasTerms, hasCookieBanner };
  });
}