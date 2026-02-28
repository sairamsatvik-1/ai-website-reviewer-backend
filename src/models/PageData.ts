export interface FrameworkDetection {
  name: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
}

export interface SearchBarData {
  found: boolean;
  type: "native" | "combobox" | "framework" | "custom" | "unknown";
  selector: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  name: string | null;
  id: string | null;
  framework: string | null;
  isExpandable: boolean;
  triggerSelector: string | null;
}

export interface ButtonData {
  text: string | null;
  tag: string;
  type: string | null;
  ariaLabel: string | null;
  isVisible: boolean;
  isAboveFold: boolean;
  role: string | null;
  framework: string | null;
  dataAttributes: Record<string, string>;
}

export interface InteractiveElement {
  tag: string;
  role: string | null;
  type: string | null;
  text: string | null;
  ariaLabel: string | null;
  ariaExpanded: string | null;
  ariaControls: string | null;
  ariaHaspopup: string | null;
  dataAttributes: Record<string, string>;
  classes: string[];
  isVisible: boolean;
  isAboveFold: boolean;
  framework: string | null;
}

export interface InputData {
  type: string | null;
  name: string | null;
  placeholder: string | null;
  id: string | null;
  required: boolean;
  ariaLabel: string | null;
  label: string | null;
  vModel: string | null;
  ngModel: string | null;
  dataTestId: string | null;
  isControlled: boolean;
  framework: string | null;
}

export interface FormData {
  action: string | null;
  method: string | null;
  inputs: InputData[];
  hasSubmitButton: boolean;
  submitText: string | null;
  framework: string | null;
  isAjax: boolean;
}

export interface DropdownData {
  trigger: string | null;
  type: "select" | "custom" | "combobox" | "menu";
  options: string[];
  ariaLabel: string | null;
  framework: string | null;
}

export interface ModalData {
  found: boolean;
  trigger: string | null;
  ariaLabel: string | null;
  framework: string | null;
}

export interface LinkData {
  text: string | null;
  href: string | null;
  isExternal: boolean;
  isNavigation: boolean;
}

export interface ImageData {
  src: string | null;
  alt: string | null;
  hasAlt: boolean;
  width: number | null;
  height: number | null;
  isLazy: boolean;
  isNextImage: boolean;
}

export interface HeadingData {
  level: string;
  text: string | null;
}

export interface NavItem {
  text: string | null;
  href: string | null;
}

export interface MetaTagData {
  name: string | null;
  property: string | null;
  content: string | null;
}

export interface SocialLink {
  platform: string;
  href: string;
}

export interface PerfMetrics {
  ttfb: number;
  domComplete: number;
  totalLoad: number;
  domInteractive: number;
  resourceCount: number;
}

// ─── The complete raw output of one full page scan ────────────────────────────
export interface PageData {
  // Identity
  url: string;
  finalUrl: string;
  title: string;
  loadTime: number;

  // Framework
  framework: FrameworkDetection;

  // Meta
  metaDescription: string | null;
  metaTags: MetaTagData[];
  canonical: string | null;
  language: string | null;
  viewport: string | null;

  // Content
  headings: HeadingData[];
  h1Count: number;
  wordCount: number;
  paragraphCount: number;
  hasHero: boolean;
  hasSchema: boolean;

  // Navigation
  navItems: NavItem[];
  hasMobileMenu: boolean;

  // Interactive
  searchBar: SearchBarData;
  buttons: ButtonData[];
  interactiveElements: InteractiveElement[];
  dropdowns: DropdownData[];
  modals: ModalData[];
  links: LinkData[];
  forms: FormData[];
  inputs: InputData[];

  // Media
  images: ImageData[];
  imagesWithoutAlt: number;
  hasVideo: boolean;
  hasIframe: boolean;

  // Trust
  hasSocialProof: boolean;
  socialLinks: SocialLink[];
  hasPrivacyPolicy: boolean;
  hasTerms: boolean;
  hasCookieBanner: boolean;

  // Technical
  consoleErrors: string[];
  consoleWarnings: string[];
  failedRequests: string[];
  perfMetrics: PerfMetrics;
  isHttps: boolean;

  // Summary counts
  counts: {
    links: number;
    externalLinks: number;
    buttons: number;
    forms: number;
    images: number;
    inputs: number;
    headings: number;
    consoleErrors: number;
    failedRequests: number;
    interactiveElements: number;
    dropdowns: number;
  };

  // Screenshots (base64)
  screenshotDesktop: string;
  screenshotMobile: string;
}