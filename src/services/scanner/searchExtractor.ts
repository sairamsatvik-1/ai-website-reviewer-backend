// src/services/scanner/searchExtractor.ts
// Detects search bars across every known pattern:
// native HTML, ARIA roles, framework-specific, expandable/hidden, heuristic fallback.

import { Page } from "playwright";
import { SearchBarData } from "../../models/PageData";

export async function extractSearchBar(
  page: Page,
  framework: string
): Promise<SearchBarData> {
  return page.evaluate((fw): SearchBarData => {

    // ── 1. Native HTML search inputs ─────────────────────────
    const nativeSelectors = [
      'input[type="search"]',
      'input[name="q"]',            // Google-style
      'input[name="s"]',            // WordPress default
      'input[name="search"]',
      'input[name="query"]',
      'input[name="keyword"]',
      'input[name="keywords"]',
      'input[name="term"]',
      'input[id*="search" i]',
      'input[class*="search" i]',
      'input[placeholder*="search" i]',
      'input[placeholder*="find" i]',
      'input[placeholder*="look for" i]',
      'input[aria-label*="search" i]',
    ];
    for (const sel of nativeSelectors) {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (el) {
        return {
          found: true, type: "native", selector: sel,
          placeholder: el.placeholder || null,
          ariaLabel: el.getAttribute("aria-label"),
          name: el.name || null, id: el.id || null,
          framework: fw, isExpandable: false, triggerSelector: null,
        };
      }
    }

    // ── 2. ARIA roles ─────────────────────────────────────────
    const ariaSelectors = [
      '[role="searchbox"]',
      '[role="combobox"][aria-label*="search" i]',
      '[role="search"] input',
      'form[role="search"] input',
      '[aria-label="Search"] input',
    ];
    for (const sel of ariaSelectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        const inp = el.tagName === "INPUT" ? (el as HTMLInputElement) : null;
        return {
          found: true, type: "combobox", selector: sel,
          placeholder: inp?.placeholder || null,
          ariaLabel: el.getAttribute("aria-label"),
          name: inp?.name || null, id: el.id || null,
          framework: fw,
          isExpandable: el.getAttribute("aria-expanded") !== null,
          triggerSelector: null,
        };
      }
    }

    // ── 3. Framework-specific selectors ──────────────────────
    const fwMap: Record<string, string[]> = {
      algolia:   [".ais-SearchBox-input", ".DocSearch-Input", '[class*="algolia"] input'],
      shopify:   ['input[name="q"]', ".search__input", '[data-predictive-search-input]'],
      wordpress: [".wp-block-search__input", ".search-field", 'input[name="s"]'],
      webflow:   ['.w-input[type="search"]', '[class*="search"] .w-input'],
      react:     ['[data-testid*="search" i]', '[data-cy*="search" i]'],
      nextjs:    ['[data-testid*="search" i]'],
      vue:       ['input[v-model*="search" i]'],
      angular:   ['input[ng-model*="search" i]', 'input[formcontrolname*="search" i]'],
    };
    for (const sel of (fwMap[fw] || [])) {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      if (el) {
        return {
          found: true, type: "framework", selector: sel,
          placeholder: el.placeholder || null,
          ariaLabel: el.getAttribute("aria-label"),
          name: el.name || null, id: el.id || null,
          framework: fw, isExpandable: false, triggerSelector: null,
        };
      }
    }

    // ── 4. Expandable / hidden search triggers ────────────────
    const expandable = [
      'button[aria-label*="search" i]',
      'button[class*="search" i]',
      '[data-toggle="search"]',
      '[data-action*="search"]',
      ".search-toggle", ".search-icon",
    ];
    for (const sel of expandable) {
      const el = document.querySelector(sel);
      if (el) {
        return {
          found: true, type: "custom", selector: sel,
          placeholder: null,
          ariaLabel: el.getAttribute("aria-label"),
          name: null, id: el.id || null,
          framework: fw, isExpandable: true, triggerSelector: sel,
        };
      }
    }

    // ── 5. Heuristic fallback — scan all text inputs ──────────
    const allInputs = Array.from(
      document.querySelectorAll("input[type='text'], input:not([type])")
    ) as HTMLInputElement[];
    for (const el of allInputs) {
      const cls = el.className.toLowerCase();
      const ph  = (el.placeholder || "").toLowerCase();
      if (
        cls.includes("search") || cls.includes("query") ||
        ph.includes("search")  || ph.includes("find")
      ) {
        return {
          found: true, type: "custom", selector: "heuristic",
          placeholder: el.placeholder || null,
          ariaLabel: el.getAttribute("aria-label"),
          name: el.name || null, id: el.id || null,
          framework: fw, isExpandable: false, triggerSelector: null,
        };
      }
    }

    return {
      found: false, type: "unknown", selector: null,
      placeholder: null, ariaLabel: null, name: null, id: null,
      framework: fw, isExpandable: false, triggerSelector: null,
    };

  }, framework);
}