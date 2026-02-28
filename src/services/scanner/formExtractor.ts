// src/services/scanner/formExtractor.ts
// Extracts all forms and inputs with full framework-aware label detection.

import { Page } from "playwright";
import { FormData, InputData } from "../../models/PageData";

export async function extractForms(
  page: Page,
  framework: string
): Promise<FormData[]> {
  return page.$$eval(
    "form",
    (forms, fw) =>
      (forms as HTMLFormElement[]).map(form => {
        const inputs = Array.from(
          form.querySelectorAll("input, textarea, select")
        ).map(el => {
          const inp = el as HTMLInputElement;

          // Label lookup — 3 strategies
          const id = inp.id;
          let label: string | null = null;
          if (id)
            label =
              document.querySelector(`label[for="${id}"]`)?.textContent?.trim() ?? null;
          if (!label)
            label = inp.closest("label")?.textContent?.trim() ?? null;
          if (!label) {
            const lby = inp.getAttribute("aria-labelledby");
            if (lby)
              label = document.getElementById(lby)?.textContent?.trim() ?? null;
          }

          // Framework-specific binding attrs
          const attrs: Record<string, string> = {};
          for (const a of Array.from(inp.attributes)) attrs[a.name] = a.value;

          // Detect UI framework from class
          let elemFw: string | null = fw !== "unknown" ? (fw as string) : null;
          if (!elemFw) {
            const cls = inp.className || "";
            if (cls.includes("MuiInput"))        elemFw = "material-ui";
            else if (cls.includes("ant-input"))  elemFw = "ant-design";
            else if (cls.includes("chakra"))     elemFw = "chakra-ui";
            else if (cls.includes("form-control"))elemFw = "bootstrap";
            else if (cls.includes("w-input"))    elemFw = "webflow";
          }

          return {
            type:         inp.type || inp.tagName.toLowerCase(),
            name:         inp.name || null,
            placeholder:  inp.placeholder || null,
            id:           inp.id || null,
            required:     inp.required,
            ariaLabel:    inp.getAttribute("aria-label"),
            label,
            vModel:       attrs["v-model"] ?? attrs[":value"] ?? null,
            ngModel:      attrs["ng-model"] ?? attrs["[(ngmodel)]"] ?? null,
            dataTestId:   attrs["data-testid"] ?? null,
            isControlled: !!(attrs["v-model"] || attrs["ng-model"] || attrs["data-testid"]),
            framework:    elemFw,
          } as InputData;
        });

        const submitBtn = form.querySelector(
          'button[type="submit"], input[type="submit"], button:not([type])'
        );
        const action = form.getAttribute("action");

        // Detect form framework from attributes
        let formFw: string | null = fw !== "unknown" ? (fw as string) : null;
        if (!formFw) {
          if (form.getAttribute("@submit"))      formFw = "vue";
          else if (form.getAttribute("(ngsubmit)")) formFw = "angular";
          else if (form.getAttribute("data-testid")) formFw = "react";
        }

        return {
          action,
          method:          form.getAttribute("method") ?? "get",
          inputs,
          hasSubmitButton: !!submitBtn,
          submitText:      submitBtn?.textContent?.trim() ?? null,
          framework:       formFw,
          isAjax:          !action || action === "#" || action === "",
        } as FormData;
      }),
    framework
  );
}

// ─── Standalone inputs (outside forms) ───────────────────────────────────────

export async function extractInputs(
  page: Page,
  framework: string
): Promise<InputData[]> {
  return page.evaluate((fw) => {
    return Array.from(
      document.querySelectorAll("input, textarea, select")
    ).map(el => {
      const inp = el as HTMLInputElement;
      const id  = inp.id;

      let label: string | null = null;
      if (id)
        label =
          document.querySelector(`label[for="${id}"]`)?.textContent?.trim() ?? null;
      if (!label)
        label = inp.closest("label")?.textContent?.trim() ?? null;
      if (!label) {
        const lby = inp.getAttribute("aria-labelledby");
        if (lby)
          label = document.getElementById(lby)?.textContent?.trim() ?? null;
      }

      const attrs: Record<string, string> = {};
      for (const a of Array.from(inp.attributes)) attrs[a.name] = a.value;

      let elemFw: string | null = fw !== "unknown" ? fw : null;
      if (!elemFw) {
        const cls = inp.className || "";
        if (cls.includes("MuiInput"))        elemFw = "material-ui";
        else if (cls.includes("ant-input"))  elemFw = "ant-design";
        else if (cls.includes("chakra"))     elemFw = "chakra-ui";
        else if (cls.includes("form-control"))elemFw = "bootstrap";
        else if (cls.includes("w-input"))    elemFw = "webflow";
      }

      return {
        type:         inp.type || inp.tagName.toLowerCase(),
        name:         inp.name || null,
        placeholder:  inp.placeholder || null,
        id:           inp.id || null,
        required:     inp.required,
        ariaLabel:    inp.getAttribute("aria-label"),
        label,
        vModel:       attrs["v-model"] ?? attrs[":value"] ?? null,
        ngModel:      attrs["ng-model"] ?? attrs["[(ngmodel)]"] ?? null,
        dataTestId:   attrs["data-testid"] ?? null,
        isControlled: !!(attrs["v-model"] || attrs["ng-model"] || attrs["data-testid"]),
        framework:    elemFw,
      } as InputData;
    });
  }, framework);
}