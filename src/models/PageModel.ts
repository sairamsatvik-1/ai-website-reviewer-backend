// src/models/PageModel.ts
// Clean structured model — converted from raw PageData
// Numbers are still raw here. Interpretation happens in ScoredPageModel.

export interface PageModel {
  // Identity
  url: string;
  finalUrl: string;
  title: string;
  isHttps: boolean;

  // Framework
  framework: {
    name: string;
    confidence: "high" | "medium" | "low";
    signals: string[];
  };

  // Meta
  meta: {
    description: string | null;
    canonical: string | null;
    language: string | null;
    viewport: string | null;
    hasOpenGraph: boolean;
    hasTwitterCard: boolean;
    hasSchema: boolean;
  };

  // Content
  content: {
    h1Count: number;
    h1Text: string | null;       // text of the first H1
    totalHeadings: number;
    wordCount: number;
    paragraphCount: number;
    hasHero: boolean;
    hasVideo: boolean;
  };

  // Navigation
  navigation: {
    items: number;
    hasMobileMenu: boolean;
    hasExternalLinks: boolean;
    totalLinks: number;
    externalLinks: number;
  };

  // Search
  search: {
    present: boolean;
    expandable: boolean;
    type: string | null;
    framework: string | null;
  };

  // Interaction
  interaction: {
    buttons: number;
    buttonsAboveFold: number;
    forms: number;
    ajaxForms: number;
    inputs: number;
    inputsWithoutLabels: number;
    dropdowns: number;
    modals: number;
    interactiveElements: number;
  };

  // Accessibility
  accessibility: {
    imagesWithoutAlt: number;
    totalImages: number;
    inputsWithoutLabels: number;
    hasViewport: boolean;
    hasLanguage: boolean;
  };

  // Performance
  performance: {
    loadTime: number;
    ttfb: number;
    domInteractive: number;
    resourceCount: number;
  };

  // Trust
  trust: {
    isHttps: boolean;
    hasPrivacyPolicy: boolean;
    hasTerms: boolean;
    hasCookieBanner: boolean;
    hasSocialProof: boolean;
    socialLinksCount: number;
  };

  // Technical health
  health: {
    consoleErrors: number;
    consoleWarnings: number;
    failedRequests: number;
    consoleErrorMessages: string[];  // first 5 only
    failedRequestMessages: string[]; // first 5 only
  };
}