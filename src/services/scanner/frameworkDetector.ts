// src/services/scanner/frameworkDetector.ts
// Detects which JS framework / CMS built this page.
// Must run FIRST — every other extractor uses the result.

import { Page } from "playwright";
import { FrameworkDetection } from "../../models/PageData";

export async function detectFramework(page: Page): Promise<FrameworkDetection> {
  return page.evaluate((): FrameworkDetection => {
    const signals: string[] = [];
    let name = "unknown";
    let confidence: "high" | "medium" | "low" = "low";

    const set = (n: string, c: "high" | "medium" | "low") => {
      if (name === "unknown") { name = n; confidence = c; }
    };

    // ── Next.js ──────────────────────────────────────────────
    if ((window as any).__NEXT_DATA__ || document.getElementById("__NEXT_DATA__")) {
      signals.push("__NEXT_DATA__ present"); set("nextjs", "high");
    }
    if (document.querySelector("[data-nimg]")) {
      signals.push("Next.js <Image> component found"); set("nextjs", "high");
    }

    // ── Nuxt ─────────────────────────────────────────────────
    if ((window as any).__NUXT__ || document.getElementById("__NUXT_DATA__")) {
      signals.push("__NUXT__ present"); set("nuxt", "high");
    }

    // ── React ────────────────────────────────────────────────
    const reactRoot =
      document.querySelector("[data-reactroot]") ||
      document.querySelector("#root") ||
      document.querySelector("#app");
    if (reactRoot) {
      const keys = Object.keys(reactRoot);
      if (keys.some(k => k.startsWith("__reactFiber") || k.startsWith("__reactInternals"))) {
        signals.push("React fiber found on root"); set("react", "high");
      }
    }
    if (document.querySelector("[data-testid]")) {
      signals.push("data-testid found (React testing pattern)"); set("react", "medium");
    }

    // ── Vue ──────────────────────────────────────────────────
    if ((window as any).__vue_app__ || (window as any).Vue) {
      signals.push("Vue instance found on window"); set("vue", "high");
    }
    if (document.querySelector("[v-cloak], [data-v-app]")) {
      signals.push("Vue directive found"); set("vue", "high");
    }
    const hasVueScoped = Array.from(document.querySelectorAll("*"))
      .slice(0, 50)
      .some(el => Array.from(el.attributes).some(a => /^data-v-[a-f0-9]+$/.test(a.name)));
    if (hasVueScoped) {
      signals.push("Vue scoped style attributes found"); set("vue", "high");
    }

    // ── Angular ──────────────────────────────────────────────
    if ((window as any).ng || document.querySelector("[ng-version]")) {
      signals.push("Angular ng global / ng-version found"); set("angular", "high");
    }
    if (document.querySelector("[_nghost], [_ngcontent]")) {
      signals.push("Angular component host attributes found"); set("angular", "high");
    }

    // ── Svelte ───────────────────────────────────────────────
    const hasSvelte = Array.from(document.querySelectorAll("*"))
      .slice(0, 50)
      .some(el => Array.from(el.attributes).some(a => /^svelte-[a-z0-9]+$/.test(a.name)));
    if (hasSvelte) {
      signals.push("Svelte scoped attributes found"); set("svelte", "high");
    }

    // ── SvelteKit ────────────────────────────────────────────
    if ((window as any).__sveltekit_dev !== undefined ||
        document.querySelector("[data-sveltekit-preload-data]")) {
      signals.push("SvelteKit found"); set("sveltekit", "high");
    }

    // ── Remix ────────────────────────────────────────────────
    if ((window as any).__remixContext || document.querySelector("[data-remix-run-router]")) {
      signals.push("Remix context found"); set("remix", "high");
    }

    // ── Gatsby ───────────────────────────────────────────────
    if ((window as any).___gatsby) {
      signals.push("Gatsby global found"); set("gatsby", "high");
    }

    // ── CMS / Site Builders ──────────────────────────────────
    if (
      document.querySelector('meta[name="generator"][content*="WordPress"]') ||
      (window as any).wp
    ) {
      signals.push("WordPress detected"); set("wordpress", "high");
    }
    if (
      document.querySelector('meta[name="generator"][content*="Shopify"]') ||
      (window as any).Shopify
    ) {
      signals.push("Shopify detected"); set("shopify", "high");
    }
    if (document.querySelector("[data-wf-page], [data-wf-site]")) {
      signals.push("Webflow attributes found"); set("webflow", "high");
    }

    // ── UI Library signals (secondary — don't override framework) ──
    if (document.querySelector("[class*='MuiButton'], [class*='MuiInput']")) {
      signals.push("Material UI classes found");
    }
    if (document.querySelector("[class*='ant-btn'], [class*='ant-input']")) {
      signals.push("Ant Design classes found");
    }
    if (document.querySelector("[class*='chakra-']")) {
      signals.push("Chakra UI classes found");
    }
    if (document.querySelector("[data-radix-collection-item]")) {
      signals.push("Radix UI / shadcn found");
    }
    if (document.querySelector("[class*='ais-']")) {
      signals.push("Algolia InstantSearch found");
    }

    return { name, confidence, signals };
  });
}