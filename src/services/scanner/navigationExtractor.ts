// src/services/scanner/navigationExtractor.ts
// Extracts navigation items and all links.
// Tries every known nav pattern — modern semantic, ARIA, legacy id/class.

import { Page } from "playwright";
import { LinkData, NavItem } from "../../models/PageData";

export async function extractNavigation(
  page: Page
): Promise<{ navItems: NavItem[]; hasMobileMenu: boolean }> {
  return page.evaluate(() => {
    // Try selectors from most specific to least — stop at first that finds items
    const navSelectors = [
      "nav a",
      "header nav a",
      '[role="navigation"] a',
      "#nav a",
      "#navigation a",
      "#main-nav a",
      "#site-nav a",
      "#primary-nav a",
      "#menu a",
      "#main-menu a",
      ".nav a",
      ".navbar a",
      ".navbar-nav a",
      ".nav-menu a",
      ".main-nav a",
      ".site-nav a",
      ".primary-nav a",
      ".navigation a",
      ".menu a",
      ".main-menu a",
      ".top-nav a",
      ".header-nav a",
      // Webflow
      ".w-nav-link",
      // WordPress
      ".menu-item a",
      ".wp-block-navigation a",
    ];

    const seen     = new Set<string>();
    const navItems: NavItem[] = [];

    for (const selector of navSelectors) {
      const els = Array.from(document.querySelectorAll(selector));
      for (const el of els) {
        const href = el.getAttribute("href");
        const text = el.textContent?.replace(/\s+/g, " ").trim() ?? null;
        const key  = `${text}|${href}`;
        if (!seen.has(key) && text && text.length < 60) {
          seen.add(key);
          navItems.push({ text, href });
        }
      }
      if (navItems.length > 0) break; // stop at first successful selector
    }

    // Mobile menu detection — covers hamburger patterns across all frameworks
    const mobileSelectors = [
      ".hamburger",
      ".burger",
      ".menu-toggle",
      ".nav-toggle",
      ".navbar-toggler",           // Bootstrap
      ".mobile-menu-button",
      ".mobile-nav-toggle",
      '[aria-label*="menu" i]',
      '[aria-label*="navigation" i]',
      '[class*="hamburger"]',
      '[class*="mobile-menu"]',
      '[class*="nav-toggle"]',
      '[id*="hamburger"]',
      '[id*="mobile-nav"]',
      '[id*="menu-toggle"]',
      '[data-toggle="collapse"]',  // Bootstrap collapse
      '[data-bs-toggle="collapse"]',
    ];
    const hasMobileMenu = mobileSelectors.some(s => !!document.querySelector(s));

    return { navItems: navItems.slice(0, 25), hasMobileMenu };
  });
}

// ─── Links ────────────────────────────────────────────────────────────────────

export async function extractLinks(
  page: Page,
  baseUrl: string
): Promise<LinkData[]> {
  return page.evaluate((base) => {
    const baseDomain = (() => {
      try { return new URL(base).hostname; } catch { return ""; }
    })();

    return Array.from(document.querySelectorAll("a[href]"))
      .map(el => {
        const href = el.getAttribute("href") ?? "";
        const text = el.textContent?.replace(/\s+/g, " ").trim().slice(0, 100) ?? null;

        let isExternal = false;
        try {
          isExternal = new URL(href, base).hostname !== baseDomain;
        } catch {}

        const inNav = !!(
          el.closest("nav") ||
          el.closest("header") ||
          el.closest('[role="navigation"]') ||
          el.closest("#nav") ||
          el.closest(".nav") ||
          el.closest(".navbar")
        );

        return {
          text, href, isExternal, isNavigation: inNav,
        } as { text: string | null; href: string | null; isExternal: boolean; isNavigation: boolean };
      })
      .filter(l => l.href && !l.href.startsWith("javascript:"))
      .slice(0, 120);
  }, baseUrl);
}