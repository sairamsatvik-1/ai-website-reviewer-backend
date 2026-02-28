// src/models/ScoredPageModel.ts
// Every field has a value, a signal (good/warning/critical), and a reason.
// This is what the AI receives — pre-interpreted signals, not raw numbers.

export type Signal = "good" | "warning" | "critical";

export interface ScoredField<T = number | boolean | string> {
  value: T;
  signal: Signal;
  reason: string;
}

export interface ScoredPageModel {
  // Identity
  url: string;
  title: string;
  framework: string;

  // Section scores (0-100 per section)
  sectionScores: {
    meta:          number;
    content:       number;
    navigation:    number;
    interaction:   number;
    accessibility: number;
    performance:   number;
    trust:         number;
    health:        number;
  };

  // Overall score (weighted average of section scores)
  overallScore: number;

  // Scored fields per section
  meta: {
    hasDescription:   ScoredField<boolean>;
    hasCanonical:     ScoredField<boolean>;
    hasViewport:      ScoredField<boolean>;
    hasLanguage:      ScoredField<boolean>;
    hasOpenGraph:     ScoredField<boolean>;
    hasSchema:        ScoredField<boolean>;
  };

  content: {
    h1Count:       ScoredField<number>;
    wordCount:     ScoredField<number>;
    hasHero:       ScoredField<boolean>;
    totalHeadings: ScoredField<number>;
  };

  navigation: {
    items:           ScoredField<number>;
    hasMobileMenu:   ScoredField<boolean>;
    externalLinks:   ScoredField<number>;
  };

  search: {
    present:    ScoredField<boolean>;
    expandable: ScoredField<boolean>;
  };

  interaction: {
    buttons:             ScoredField<number>;
    buttonsAboveFold:    ScoredField<number>;
    forms:               ScoredField<number>;
    inputsWithoutLabels: ScoredField<number>;
  };

  accessibility: {
    imagesWithoutAlt:    ScoredField<number>;
    inputsWithoutLabels: ScoredField<number>;
    hasViewport:         ScoredField<boolean>;
    hasLanguage:         ScoredField<boolean>;
  };

  performance: {
    loadTime:      ScoredField<number>;
    ttfb:          ScoredField<number>;
    resourceCount: ScoredField<number>;
    domInteractive:ScoredField<number>;
  };

  trust: {
    isHttps:          ScoredField<boolean>;
    hasPrivacyPolicy: ScoredField<boolean>;
    hasTerms:         ScoredField<boolean>;
    hasCookieBanner:  ScoredField<boolean>;
    hasSocialProof:   ScoredField<boolean>;
  };

  health: {
    consoleErrors:   ScoredField<number>;
    failedRequests:  ScoredField<number>;
  };

  // Aggregated signal lists — fed directly into AI prompt
  signals: {
    critical: string[];  // must fix
    warnings: string[];  // should fix
    good:     string[];  // working well
  };
}