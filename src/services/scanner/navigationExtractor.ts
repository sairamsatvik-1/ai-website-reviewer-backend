// src/services/scanner/navigationExtractor.ts
// Extracts navigation items and links.
// Handles standard HTML nav AND React/SPA custom nav patterns.

import { Page } from "playwright";
import { LinkData, NavItem } from "../../models/PageData";

export async function extractNavigation(
  page: Page
): Promise<{ navItems: NavItem[]; hasMobileMenu: boolean }> {
  return page.evaluate(() => {

    // ── Strategy 1: Standard semantic nav selectors ───────────
    const standardSelectors = [
      "nav a", "header nav a",
      '[role="navigation"] a',
      "#nav a", "#navigation a", "#main-nav a",
      "#site-nav a", "#primary-nav a", "#menu a",
      ".nav a", ".navbar a", ".navbar-nav a",
      ".nav-menu a", ".main-nav a", ".site-nav a",
      ".primary-nav a", ".navigation a",
      ".menu a", ".main-menu a", ".top-nav a",
      ".header-nav a",
      // CMS specific
      ".w-nav-link",              // Webflow
      ".menu-item a",             // WordPress
      ".wp-block-navigation a",   // WordPress blocks
    ];

    const seen     = new Set<string>();
    const navItems: NavItem[] = [];

    for (const selector of standardSelectors) {
      const els = Array.from(document.querySelectorAll(selector));
      for (const el of els) {
        const href = el.getAttribute("href");
        const text = el.textContent?.replace(/\s+/g, " ").trim() ?? null;
        const key  = `${text}|${href}`;
        if (!seen.has(key) && text && text.length < 60 && text.length > 1) {
          seen.add(key);
          navItems.push({ text, href });
        }
      }
      if (navItems.length >= 3) break;
    }

    // ── Strategy 2: Header link analysis (React/SPA fallback) ─
    // When no <nav> exists, find all short links inside header/top area.
    // These are almost certainly navigation items.
    if (navItems.length === 0) {
      const headerEls = Array.from(
        document.querySelectorAll("header a, [class*='header'] a, [class*='Header'] a, [class*='topbar'] a, [class*='TopBar'] a, [class*='toolbar'] a, [class*='Toolbar'] a")
      );

      for (const el of headerEls) {
        const href = el.getAttribute("href");
        const text = el.textContent?.replace(/\s+/g, " ").trim() ?? null;
        const key  = `${text}|${href}`;

        // Nav items are short, meaningful text — not icons or long sentences
        if (
          !seen.has(key) && text &&
          text.length > 1 && text.length < 40 &&
          href && !href.startsWith("javascript:") &&
          !href.startsWith("mailto:") && !href.startsWith("tel:")
        ) {
          seen.add(key);
          navItems.push({ text, href });
        }
      }
    }

    // ── Strategy 3: All links in top 20% of page ─────────────
    // Last resort for fully custom React navs with no identifiable container
    if (navItems.length === 0) {
      const pageHeight    = document.body.scrollHeight;
      const topThreshold  = pageHeight * 0.20;
      const allLinks      = Array.from(document.querySelectorAll("a[href]"));

      for (const el of allLinks) {
        const rect = el.getBoundingClientRect();
        const href = el.getAttribute("href") ?? "";
        const text = el.textContent?.replace(/\s+/g, " ").trim() ?? null;

        if (
          rect.top < topThreshold &&
          rect.top >= 0 &&
          text && text.length > 1 && text.length < 40 &&
          !href.startsWith("javascript:") &&
          !href.startsWith("mailto:")
        ) {
          const key = `${text}|${href}`;
          if (!seen.has(key)) {
            seen.add(key);
            navItems.push({ text, href });
          }
        }

        if (navItems.length >= 10) break;
      }
    }

    // ── Mobile menu detection ─────────────────────────────────
    const mobileSelectors = [
      ".hamburger", ".burger",
      ".menu-toggle", ".nav-toggle",
      ".navbar-toggler",
      ".mobile-menu-button",
      '[aria-label*="menu" i]',
      '[aria-label*="navigation" i]',
      '[class*="hamburger" i]',
      '[class*="mobile-menu" i]',
      '[class*="nav-toggle" i]',
      '[class*="MenuToggle" i]',
      '[class*="menuToggle" i]',
      '[id*="hamburger"]',
      '[id*="mobile-nav"]',
      '[data-toggle="collapse"]',
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

        return { text, href, isExternal, isNavigation: inNav };
      })
      .filter(l => l.href && !l.href.startsWith("javascript:"))
      .slice(0, 120);
  }, baseUrl);
}