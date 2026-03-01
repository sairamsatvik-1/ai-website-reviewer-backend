// src/services/scanner/interactiveExtractor.ts
// Key fix: el.className can be SVGAnimatedString on SVG elements (YouTube, icon-heavy sites)
// Always use String(el.className) before calling .includes() or .split()

import { Page } from "playwright";
import { ButtonData, DropdownData, InteractiveElement, ModalData } from "../../models/PageData";

// ─── Safe className helper ────────────────────────────────────────────────────
// SVG elements return SVGAnimatedString for className, not a plain string.
// String() handles both cases safely.
function safeClass(el: Element): string {
  try {
    return String(el.className) || "";
  } catch {
    return "";
  }
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export async function extractButtons(
  page: Page,
  framework: string
): Promise<ButtonData[]> {
  return page.evaluate((fw) => {

    function safeClassName(el: Element): string {
      try { return String(el.className) || ""; } catch { return ""; }
    }

    const selectors = [
      "button",
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="reset"]',
      '[role="button"]',
      "a.btn", "a.button",
      "[class*='btn']",
      "[class*='button']",
      "[class*='cta']",
      "[onclick]",
      "[data-action]",
    ];

    const seen   = new Set<string>();
    const result: ButtonData[] = [];

    for (const sel of selectors) {
      for (const el of Array.from(document.querySelectorAll(sel)) as HTMLElement[]) {
        const rect = el.getBoundingClientRect();
        const text = (
          el.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("value") ||
          null
        );
        const key = `${el.tagName}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const dataAttributes: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) {
          if (a.name.startsWith("data-")) dataAttributes[a.name] = a.value;
        }

        // Safe className — handles SVGAnimatedString on icon elements
        const cls = safeClassName(el);
        let elemFw: string | null = fw !== "unknown" ? fw : null;
        if (!elemFw) {
          if (cls.includes("Mui"))          elemFw = "material-ui";
          else if (cls.includes("ant-"))    elemFw = "ant-design";
          else if (cls.includes("chakra-")) elemFw = "chakra-ui";
          else if (cls.includes("w-"))      elemFw = "webflow";
        }

        result.push({
          text,
          tag:      el.tagName.toLowerCase(),
          type:     el.getAttribute("type"),
          ariaLabel:el.getAttribute("aria-label"),
          isVisible:    rect.width > 0 && rect.height > 0,
          isAboveFold:  rect.top < window.innerHeight && rect.top >= 0,
          role:     el.getAttribute("role"),
          framework:    elemFw,
          dataAttributes,
        });

        if (result.length >= 80) return result;
      }
    }
    return result;
  }, framework);
}

// ─── All Interactive Elements ─────────────────────────────────────────────────

export async function extractInteractiveElements(
  page: Page,
  framework: string
): Promise<InteractiveElement[]> {
  return page.evaluate((fw) => {

    function safeClassName(el: Element): string {
      try { return String(el.className) || ""; } catch { return ""; }
    }

    const selectors = [
      "button", "a[href]", "select",
      'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
      '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="tab"]', '[role="option"]', '[role="switch"]',
      '[role="checkbox"]', '[role="radio"]',
      '[role="combobox"]', '[role="listbox"]',
      '[tabindex="0"]:not(input):not(textarea)',
      '[onclick]',
      '[data-action]',
      '[data-click]',
      '[data-href]',
      '[data-toggle]',
      '[data-bs-toggle]',
      '[data-radix-collection-item]',
      '[data-state]',
      '[data-headlessui-state]',
      "[class*='btn']",
      "[class*='trigger']",
      "[class*='toggle']",
      "[class*='accordion']",
      "[class*='dropdown']",
    ];

    const seen    = new Set<string>();
    const result: InteractiveElement[] = [];

    for (const selector of selectors) {
      for (const el of Array.from(document.querySelectorAll(selector)) as HTMLElement[]) {
        const rect = el.getBoundingClientRect();

        const dataAttributes: Record<string, string> = {};
        for (const a of Array.from(el.attributes)) {
          if (a.name.startsWith("data-")) dataAttributes[a.name] = a.value;
        }

        const text = (
          el.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) ||
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          null
        );
        const key = `${el.tagName}|${text}|${selector}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Safe className — SVGAnimatedString fix
        const cls = safeClassName(el);

        let elemFw: string | null = fw !== "unknown" ? fw : null;
        if (!elemFw) {
          if (cls.includes("Mui"))            elemFw = "material-ui";
          else if (cls.includes("ant-"))      elemFw = "ant-design";
          else if (cls.includes("chakra-"))   elemFw = "chakra-ui";
          else if (dataAttributes["data-radix-collection-item"] !== undefined) elemFw = "radix-ui";
          else if (dataAttributes["data-headlessui-state"] !== undefined)      elemFw = "headlessui";
          else if (cls.includes("w-"))        elemFw = "webflow";
        }

        result.push({
          tag:          el.tagName.toLowerCase(),
          role:         el.getAttribute("role"),
          type:         el.getAttribute("type"),
          text,
          ariaLabel:    el.getAttribute("aria-label"),
          ariaExpanded: el.getAttribute("aria-expanded"),
          ariaControls: el.getAttribute("aria-controls"),
          ariaHaspopup: el.getAttribute("aria-haspopup"),
          dataAttributes,
          // Safe class split — handles SVGAnimatedString
          classes: cls ? cls.split(" ").filter(Boolean).slice(0, 8) : [],
          isVisible:   rect.width > 0 && rect.height > 0,
          isAboveFold: rect.top < window.innerHeight && rect.top >= 0,
          framework:   elemFw,
        });

        if (result.length >= 150) return result;
      }
    }
    return result;
  }, framework);
}

// ─── Dropdowns ────────────────────────────────────────────────────────────────

export async function extractDropdowns(page: Page): Promise<DropdownData[]> {
  return page.evaluate(() => {
    const result: DropdownData[] = [];

    // Native <select>
    document.querySelectorAll("select").forEach(sel => {
      const options = Array.from(sel.options)
        .map(o => o.text.trim())
        .filter(Boolean);
      const label = sel.id
        ? document.querySelector(`label[for="${sel.id}"]`)?.textContent?.trim() ?? null
        : sel.getAttribute("aria-label");
      result.push({
        trigger:   label || sel.name || null,
        type:      "select",
        options,
        ariaLabel: sel.getAttribute("aria-label"),
        framework: null,
      });
    });

    // ARIA combobox / listbox
    document.querySelectorAll('[role="listbox"], [role="combobox"]').forEach(el => {
      const options = Array.from(el.querySelectorAll('[role="option"]'))
        .map(o => o.textContent?.trim() ?? "")
        .filter(Boolean);
      result.push({
        trigger:   el.getAttribute("aria-label"),
        type:      "combobox",
        options:   options.slice(0, 20),
        ariaLabel: el.getAttribute("aria-label"),
        framework: null,
      });
    });

    // Bootstrap
    document.querySelectorAll(
      '[data-toggle="dropdown"], [data-bs-toggle="dropdown"]'
    ).forEach(el => {
      const menu    = document.querySelector(".dropdown-menu");
      const options = menu
        ? Array.from(menu.querySelectorAll(".dropdown-item, [role='menuitem']"))
            .map(o => o.textContent?.trim() ?? "")
            .filter(Boolean)
        : [];
      result.push({
        trigger:   el.textContent?.trim() ?? null,
        type:      "menu",
        options:   options.slice(0, 20),
        ariaLabel: el.getAttribute("aria-label"),
        framework: "bootstrap",
      });
    });

    return result;
  });
}

// ─── Modals ───────────────────────────────────────────────────────────────────

export async function extractModals(page: Page): Promise<ModalData[]> {
  return page.evaluate(() => {
    const result: ModalData[] = [];

    // Currently open modals
    const openSelectors = [
      '[role="dialog"]', '[role="alertdialog"]',
      ".modal.show",
      '[data-state="open"]',
      '[aria-modal="true"]',
    ];
    for (const sel of openSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.push({
          found:     true,
          trigger:   null,
          ariaLabel: el.getAttribute("aria-label") || null,
          framework: el.getAttribute("data-state") ? "radix-ui" : null,
        });
      }
    }

    // Modal triggers (modal exists but is closed)
    const triggerSelectors = [
      '[data-bs-toggle="modal"]',
      '[data-toggle="modal"]',
      '[aria-haspopup="dialog"]',
      '[data-radix-dialog-trigger]',
    ];
    for (const sel of triggerSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        result.push({
          found:     false,
          trigger:   el.textContent?.trim().slice(0, 60) ?? null,
          ariaLabel: el.getAttribute("aria-label"),
          framework: sel.includes("bs") || sel.includes("toggle") ? "bootstrap"
                   : sel.includes("radix") ? "radix-ui" : null,
        });
      }
    }

    return result;
  });
}