// src/services/analysis/pageModelBuilder.ts
// Converts raw PageData → clean PageModel.
// No Playwright here. Pure data transformation.

import { PageData }  from "../../models/PageData";
import { PageModel } from "../../models/PageModel";

export function buildPageModel(data: PageData): PageModel {
  // Check for OpenGraph tags
  const hasOpenGraph = data.metaTags.some(m => m.property?.startsWith("og:"));
  const hasTwitterCard = data.metaTags.some(
    m => m.name === "twitter:card" || m.property === "twitter:card"
  );

  // First H1 text
  const firstH1 = data.headings.find(h => h.level === "h1");

  // Inputs without labels
  const inputsWithoutLabels = data.inputs.filter(
    i => !i.label && !i.ariaLabel && !i.placeholder
  ).length;

  // Buttons above the fold
  const buttonsAboveFold = data.buttons.filter(b => b.isAboveFold).length;

  // Ajax forms (no server action — handled by JS)
  const ajaxForms = data.forms.filter(f => f.isAjax).length;

  return {
    // Identity
    url:       data.url,
    finalUrl:  data.finalUrl,
    title:     data.title,
    isHttps:   data.isHttps,

    // Framework
    framework: {
      name:       data.framework.name,
      confidence: data.framework.confidence,
      signals:    data.framework.signals,
    },

    // Meta
    meta: {
      description:   data.metaDescription,
      canonical:     data.canonical,
      language:      data.language,
      viewport:      data.viewport,
      hasOpenGraph,
      hasTwitterCard,
      hasSchema:     data.hasSchema,
    },

    // Content
    content: {
      h1Count:       data.h1Count,
      h1Text:        firstH1?.text ?? null,
      totalHeadings: data.headings.length,
      wordCount:     data.wordCount,
      paragraphCount:data.paragraphCount,
      hasHero:       data.hasHero,
      hasVideo:      data.hasVideo,
    },

    // Navigation
    navigation: {
      items:           data.navItems.length,
      hasMobileMenu:   data.hasMobileMenu,
      hasExternalLinks:data.links.some(l => l.isExternal),
      totalLinks:      data.links.length,
      externalLinks:   data.links.filter(l => l.isExternal).length,
    },

    // Search
    search: {
      present:    data.searchBar.found,
      expandable: data.searchBar.isExpandable,
      type:       data.searchBar.type,
      framework:  data.searchBar.framework,
    },

    // Interaction
    interaction: {
      buttons:             data.buttons.length,
      buttonsAboveFold,
      forms:               data.forms.length,
      ajaxForms,
      inputs:              data.inputs.length,
      inputsWithoutLabels,
      dropdowns:           data.dropdowns.length,
      modals:              data.modals.length,
      interactiveElements: data.interactiveElements.length,
    },

    // Accessibility
    accessibility: {
      imagesWithoutAlt:    data.imagesWithoutAlt,
      totalImages:         data.images.length,
      inputsWithoutLabels,
      hasViewport:         !!data.viewport,
      hasLanguage:         !!data.language,
    },

    // Performance
    performance: {
      loadTime:      data.loadTime,
      ttfb:          data.perfMetrics.ttfb,
      domInteractive:data.perfMetrics.domInteractive,
      resourceCount: data.perfMetrics.resourceCount,
    },

    // Trust
    trust: {
      isHttps:          data.isHttps,
      hasPrivacyPolicy: data.hasPrivacyPolicy,
      hasTerms:         data.hasTerms,
      hasCookieBanner:  data.hasCookieBanner,
      hasSocialProof:   data.hasSocialProof,
      socialLinksCount: data.socialLinks.length,
    },

    // Health
    health: {
      consoleErrors:        data.consoleErrors.length,
      consoleWarnings:      data.consoleWarnings.length,
      failedRequests:       data.failedRequests.length,
      consoleErrorMessages: data.consoleErrors.slice(0, 5),
      failedRequestMessages:data.failedRequests.slice(0, 5),
    },
  };
}