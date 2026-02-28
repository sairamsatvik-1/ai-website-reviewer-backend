// src/services/scanner/trustExtractor.ts
// Detects trust signals — social proof, legal links, social media, cookie consent.

import { Page } from "playwright";
import { SocialLink } from "../../models/PageData";

export async function extractTrustSignals(page: Page): Promise<{
  hasSocialProof: boolean;
  socialLinks: SocialLink[];
  hasPrivacyPolicy: boolean;
  hasTerms: boolean;
  hasCookieBanner: boolean;
}> {
  return page.evaluate(() => {
    const allLinks = Array.from(document.querySelectorAll("a[href]"));

    // Social proof — testimonials, reviews, ratings, star widgets
    const socialProofSelectors = [
      ".testimonial", ".testimonials",
      ".review", ".reviews",
      ".rating", ".ratings",
      ".stars", ".star-rating",
      "[class*='testimonial']",
      "[class*='review']",
      "[class*='rating']",
      "[class*='trust']",
      "[class*='social-proof']",
      // Specific platforms
      ".trustpilot-widget",
      "[data-testid*='review']",
    ];
    const hasSocialProof = socialProofSelectors.some(s => !!document.querySelector(s));

    // Social platform links
    const socialPatterns: Record<string, string[]> = {
      twitter:   ["twitter.com"],
      x:         ["x.com"],
      facebook:  ["facebook.com", "fb.com"],
      instagram: ["instagram.com"],
      linkedin:  ["linkedin.com"],
      youtube:   ["youtube.com", "youtu.be"],
      tiktok:    ["tiktok.com"],
      github:    ["github.com"],
      pinterest: ["pinterest.com"],
      discord:   ["discord.gg", "discord.com"],
      slack:     ["slack.com"],
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

    // Legal / compliance links
    const linkTexts = allLinks.map(l => (l.textContent ?? "").toLowerCase().trim());
    const linkHrefs = allLinks.map(l => (l.getAttribute("href") ?? "").toLowerCase());

    const hasPrivacyPolicy =
      linkTexts.some(t => t.includes("privacy")) ||
      linkHrefs.some(h => h.includes("privacy"));

    const hasTerms =
      linkTexts.some(t => t.includes("terms") || t.includes("tos") || t.includes("conditions")) ||
      linkHrefs.some(h => h.includes("terms") || h.includes("tos"));

    // Cookie consent banner — covers major CMP platforms
    const cookieSelectors = [
      "[class*='cookie']",
      "[id*='cookie']",
      "[class*='consent']",
      "[id*='consent']",
      "[class*='gdpr']",
      "[id*='gdpr']",
      "#CybotCookiebotDialog",      // Cookiebot
      "#onetrust-banner-sdk",       // OneTrust
      ".cc-window",                 // cookieconsent.js
      "[data-cookiebanner]",
      "#cookie-notice",
      "#cookie-banner",
      ".cookie-banner",
      ".cookie-notice",
    ];
    const hasCookieBanner = cookieSelectors.some(s => !!document.querySelector(s));

    return { hasSocialProof, socialLinks, hasPrivacyPolicy, hasTerms, hasCookieBanner };
  });
}