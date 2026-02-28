// src/services/analysis/scoringEngine.ts
// Converts PageModel → ScoredPageModel.
// Every number becomes a signal. Every boolean becomes a reason.
// This is what the AI reads — not raw numbers.

import { PageModel }                    from "../../models/PageModel";
import { Signal, ScoredField, ScoredPageModel } from "../../models/ScoredPageModel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scored<T>(
  value: T,
  signal: Signal,
  reason: string
): ScoredField<T> {
  return { value, signal, reason };
}

function scoreNum(
  value: number,
  rules: { signal: Signal; reason: string; when: (v: number) => boolean }[]
): ScoredField<number> {
  for (const rule of rules) {
    if (rule.when(value)) return scored(value, rule.signal, rule.reason);
  }
  return scored(value, "good", "Within acceptable range");
}

function scoreBool(
  value: boolean,
  ifTrue:  { signal: Signal; reason: string },
  ifFalse: { signal: Signal; reason: string }
): ScoredField<boolean> {
  return value
    ? scored(value, ifTrue.signal,  ifTrue.reason)
    : scored(value, ifFalse.signal, ifFalse.reason);
}

// ─── Section score: average of field signals ─────────────────────────────────
// critical = 0, warning = 50, good = 100

function sectionScore(fields: ScoredField<any>[]): number {
  const map: Record<Signal, number> = { critical: 0, warning: 50, good: 100 };
  const total = fields.reduce((sum, f) => sum + map[f.signal], 0);
  return Math.round(total / fields.length);
}

// ─── Main scoring function ────────────────────────────────────────────────────

export function scorePageModel(model: PageModel): ScoredPageModel {
  const critical: string[] = [];
  const warnings: string[] = [];
  const good:     string[] = [];

  const track = (f: ScoredField<any>) => {
    if (f.signal === "critical") critical.push(f.reason);
    if (f.signal === "warning")  warnings.push(f.reason);
    if (f.signal === "good")     good.push(f.reason);
    return f;
  };

  // ── Meta ────────────────────────────────────────────────────
  const meta = {
    hasDescription: track(scoreBool(
      !!model.meta.description,
      { signal: "good",     reason: "Meta description present" },
      { signal: "warning",  reason: "Missing meta description — affects SEO click-through rate" }
    )),
    hasCanonical: track(scoreBool(
      !!model.meta.canonical,
      { signal: "good",    reason: "Canonical URL set" },
      { signal: "warning", reason: "No canonical URL — duplicate content risk" }
    )),
    hasViewport: track(scoreBool(
      !!model.meta.viewport,
      { signal: "good",     reason: "Viewport meta tag present" },
      { signal: "critical", reason: "No viewport meta — site will break on mobile" }
    )),
    hasLanguage: track(scoreBool(
      !!model.meta.language,
      { signal: "good",    reason: "Language attribute set" },
      { signal: "warning", reason: "No language attribute — accessibility and SEO issue" }
    )),
    hasOpenGraph: track(scoreBool(
      model.meta.hasOpenGraph,
      { signal: "good",    reason: "OpenGraph tags present — good social sharing" },
      { signal: "warning", reason: "No OpenGraph tags — links shared on social will look plain" }
    )),
    hasSchema: track(scoreBool(
      model.meta.hasSchema,
      { signal: "good",    reason: "JSON-LD schema markup present" },
      { signal: "warning", reason: "No schema markup — missing rich search results opportunity" }
    )),
  };

  // ── Content ─────────────────────────────────────────────────
  const content = {
    h1Count: track(scoreNum(model.content.h1Count, [
      { signal: "critical", reason: "No H1 found — critical SEO issue",
        when: v => v === 0 },
      { signal: "warning",  reason: `${model.content.h1Count} H1 tags found — only one is recommended`,
        when: v => v > 1 },
      { signal: "good",     reason: "Single H1 present",
        when: v => v === 1 },
    ])),
    wordCount: track(scoreNum(model.content.wordCount, [
      { signal: "critical", reason: `Only ${model.content.wordCount} words — page lacks meaningful content`,
        when: v => v < 100 },
      { signal: "warning",  reason: `${model.content.wordCount} words — consider adding more content for SEO`,
        when: v => v < 300 },
      { signal: "good",     reason: `${model.content.wordCount} words — good content depth`,
        when: v => v >= 300 },
    ])),
    hasHero: track(scoreBool(
      model.content.hasHero,
      { signal: "good",    reason: "Hero section detected" },
      { signal: "warning", reason: "No hero section — first impression may be weak" }
    )),
    totalHeadings: track(scoreNum(model.content.totalHeadings, [
      { signal: "warning", reason: "No headings found — poor content structure",
        when: v => v === 0 },
      { signal: "good",    reason: `${model.content.totalHeadings} headings — good page structure`,
        when: v => v > 0 },
    ])),
  };

  // ── Navigation ──────────────────────────────────────────────
  const navigation = {
    items: track(scoreNum(model.navigation.items, [
      { signal: "critical", reason: "No navigation items found",
        when: v => v === 0 },
      { signal: "warning",  reason: `${model.navigation.items} nav items — consider simplifying (ideal: 5-7)`,
        when: v => v > 10 },
      { signal: "good",     reason: `${model.navigation.items} navigation items`,
        when: v => v >= 1 && v <= 10 },
    ])),
    hasMobileMenu: track(scoreBool(
      model.navigation.hasMobileMenu,
      { signal: "good",     reason: "Mobile menu detected" },
      { signal: "warning",  reason: "No mobile menu detected — mobile navigation may be broken" }
    )),
    externalLinks: track(scoreNum(model.navigation.externalLinks, [
      { signal: "warning", reason: `${model.navigation.externalLinks} external links — review for SEO link equity`,
        when: v => v > 20 },
      { signal: "good",    reason: `${model.navigation.externalLinks} external links`,
        when: v => v <= 20 },
    ])),
  };

  // ── Search ──────────────────────────────────────────────────
  const search = {
    present: track(scoreBool(
      model.search.present,
      { signal: "good",    reason: "Search bar present" },
      { signal: "warning", reason: "No search bar — content discovery may be difficult" }
    )),
    expandable: track(scoreBool(
      model.search.expandable,
      { signal: "warning", reason: "Search is hidden — users may not find it" },
      { signal: "good",    reason: "Search is always visible" }
    )),
  };

  // ── Interaction ─────────────────────────────────────────────
  const interaction = {
    buttons: track(scoreNum(model.interaction.buttons, [
      { signal: "critical", reason: "No buttons found — no calls to action",
        when: v => v === 0 },
      { signal: "warning",  reason: `${model.interaction.buttons} buttons — too many can cause decision paralysis`,
        when: v => v > 25 },
      { signal: "good",     reason: `${model.interaction.buttons} buttons found`,
        when: v => v > 0 && v <= 25 },
    ])),
    buttonsAboveFold: track(scoreNum(model.interaction.buttonsAboveFold, [
      { signal: "warning", reason: "No buttons above the fold — CTA not immediately visible",
        when: v => v === 0 },
      { signal: "good",    reason: `${model.interaction.buttonsAboveFold} button(s) above the fold`,
        when: v => v > 0 },
    ])),
    forms: track(scoreNum(model.interaction.forms, [
      { signal: "warning", reason: "No forms found — no conversion mechanism detected",
        when: v => v === 0 },
      { signal: "good",    reason: `${model.interaction.forms} form(s) present`,
        when: v => v > 0 },
    ])),
    inputsWithoutLabels: track(scoreNum(model.interaction.inputsWithoutLabels, [
      { signal: "critical", reason: `${model.interaction.inputsWithoutLabels} inputs have no labels — form accessibility broken`,
        when: v => v > 3 },
      { signal: "warning",  reason: `${model.interaction.inputsWithoutLabels} inputs missing labels`,
        when: v => v > 0 },
      { signal: "good",     reason: "All inputs have labels",
        when: v => v === 0 },
    ])),
  };

  // ── Accessibility ────────────────────────────────────────────
  const accessibility = {
    imagesWithoutAlt: track(scoreNum(model.accessibility.imagesWithoutAlt, [
      { signal: "critical", reason: `${model.accessibility.imagesWithoutAlt} images missing alt text — accessibility violation`,
        when: v => v > 5 },
      { signal: "warning",  reason: `${model.accessibility.imagesWithoutAlt} images missing alt text`,
        when: v => v > 0 },
      { signal: "good",     reason: "All images have alt text",
        when: v => v === 0 },
    ])),
    inputsWithoutLabels: track(scoreNum(model.accessibility.inputsWithoutLabels, [
      { signal: "critical", reason: `${model.accessibility.inputsWithoutLabels} form inputs have no accessible label`,
        when: v => v > 3 },
      { signal: "warning",  reason: `${model.accessibility.inputsWithoutLabels} inputs missing labels`,
        when: v => v > 0 },
      { signal: "good",     reason: "All inputs are labelled",
        when: v => v === 0 },
    ])),
    hasViewport: track(scoreBool(
      model.accessibility.hasViewport,
      { signal: "good",     reason: "Viewport meta present" },
      { signal: "critical", reason: "No viewport meta — mobile rendering broken" }
    )),
    hasLanguage: track(scoreBool(
      model.accessibility.hasLanguage,
      { signal: "good",    reason: "Page language declared" },
      { signal: "warning", reason: "No lang attribute on <html> — screen readers affected" }
    )),
  };

  // ── Performance ─────────────────────────────────────────────
  const performance = {
    loadTime: track(scoreNum(model.performance.loadTime, [
      { signal: "critical", reason: `${model.performance.loadTime}ms total load — critically slow`,
        when: v => v > 5000 },
      { signal: "warning",  reason: `${model.performance.loadTime}ms total load — above 3s target`,
        when: v => v > 3000 },
      { signal: "good",     reason: `${model.performance.loadTime}ms total load — good`,
        when: v => v <= 3000 },
    ])),
    ttfb: track(scoreNum(model.performance.ttfb, [
      { signal: "critical", reason: `${model.performance.ttfb}ms TTFB — server response very slow`,
        when: v => v > 1000 },
      { signal: "warning",  reason: `${model.performance.ttfb}ms TTFB — above 600ms target`,
        when: v => v > 600 },
      { signal: "good",     reason: `${model.performance.ttfb}ms TTFB — good server response`,
        when: v => v <= 600 },
    ])),
    resourceCount: track(scoreNum(model.performance.resourceCount, [
      { signal: "warning", reason: `${model.performance.resourceCount} resources loaded — page may be heavy`,
        when: v => v > 100 },
      { signal: "good",    reason: `${model.performance.resourceCount} resources loaded`,
        when: v => v <= 100 },
    ])),
    domInteractive: track(scoreNum(model.performance.domInteractive, [
      { signal: "warning", reason: `${model.performance.domInteractive}ms to interactive — slow JS execution`,
        when: v => v > 3000 },
      { signal: "good",    reason: `${model.performance.domInteractive}ms to interactive`,
        when: v => v <= 3000 },
    ])),
  };

  // ── Trust ────────────────────────────────────────────────────
  const trust = {
    isHttps: track(scoreBool(
      model.trust.isHttps,
      { signal: "good",     reason: "Site is served over HTTPS" },
      { signal: "critical", reason: "Site is NOT HTTPS — major security and trust issue" }
    )),
    hasPrivacyPolicy: track(scoreBool(
      model.trust.hasPrivacyPolicy,
      { signal: "good",     reason: "Privacy policy link present" },
      { signal: "critical", reason: "No privacy policy found — legal risk" }
    )),
    hasTerms: track(scoreBool(
      model.trust.hasTerms,
      { signal: "good",    reason: "Terms of service link present" },
      { signal: "warning", reason: "No terms of service found" }
    )),
    hasCookieBanner: track(scoreBool(
      model.trust.hasCookieBanner,
      { signal: "good",    reason: "Cookie consent banner present" },
      { signal: "warning", reason: "No cookie consent banner — potential GDPR issue" }
    )),
    hasSocialProof: track(scoreBool(
      model.trust.hasSocialProof,
      { signal: "good",    reason: "Social proof / reviews detected" },
      { signal: "warning", reason: "No social proof found — consider adding testimonials or reviews" }
    )),
  };

  // ── Health ───────────────────────────────────────────────────
  const health = {
    consoleErrors: track(scoreNum(model.health.consoleErrors, [
      { signal: "critical", reason: `${model.health.consoleErrors} console errors — JS broken`,
        when: v => v > 5 },
      { signal: "warning",  reason: `${model.health.consoleErrors} console error(s)`,
        when: v => v > 0 },
      { signal: "good",     reason: "No console errors",
        when: v => v === 0 },
    ])),
    failedRequests: track(scoreNum(model.health.failedRequests, [
      { signal: "critical", reason: `${model.health.failedRequests} network requests failed`,
        when: v => v > 3 },
      { signal: "warning",  reason: `${model.health.failedRequests} failed network request(s)`,
        when: v => v > 0 },
      { signal: "good",     reason: "No failed requests",
        when: v => v === 0 },
    ])),
  };

  // ── Section scores ───────────────────────────────────────────
  const sectionScores = {
    meta:          sectionScore(Object.values(meta)),
    content:       sectionScore(Object.values(content)),
    navigation:    sectionScore(Object.values(navigation)),
    interaction:   sectionScore(Object.values(interaction)),
    accessibility: sectionScore(Object.values(accessibility)),
    performance:   sectionScore(Object.values(performance)),
    trust:         sectionScore(Object.values(trust)),
    health:        sectionScore(Object.values(health)),
  };

  // ── Overall score — weighted average ─────────────────────────
  const weights = {
    performance:   0.20,
    trust:         0.15,
    accessibility: 0.15,
    content:       0.15,
    health:        0.15,
    interaction:   0.10,
    navigation:    0.05,
    meta:          0.05,
  };
  const overallScore = Math.round(
    Object.entries(weights).reduce(
      (sum, [key, w]) => sum + sectionScores[key as keyof typeof sectionScores] * w,
      0
    )
  );

  return {
    url:      model.url,
    title:    model.title,
    framework:model.framework.name,
    sectionScores,
    overallScore,
    meta, content, navigation, search,
    interaction, accessibility, performance,
    trust, health,
    signals: { critical, warnings, good },
  };
}