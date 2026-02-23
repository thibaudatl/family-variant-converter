# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An Akeneo PIM UI extension that converts simple products into variant product hierarchies. It runs inside an iframe in the PIM product grid action bar (`pim.product-grid.action-bar` position). Users select simple products from the grid, then the extension walks them through a 6-step wizard to create product models and reassign the products as variants.

## Commands

```bash
make install          # Install npm dependencies
make build-dev        # Dev build (no minification)
make update-dev       # Build dev + deploy to PIM (most common during development)
make watch            # Watch mode — auto-rebuilds and redeploys on file changes
make start            # First-time setup (install, configure .env, deploy)
make dev              # Vite dev server (local only, no PIM context available)
```

`make build` requires terser which may not be installed — use `make build-dev` or `make update-dev` instead.

## Architecture

**Standalone Vite library build** — compiles to a single `dist/variant-converter.js` ES module. Uses its own `vite.config.js` (does NOT use the shared `createViteConfig()` from `../common/`). The `common/` directory provides the Makefile and deployment scripts (`create-extension.mjs`, `update-extension.mjs`, `watch.mjs`, `token.mjs`).

**UI stack**: React 19 + Tailwind CSS v4 + Lucide icons. CSS is injected into JS via `vite-plugin-css-injected-by-js`. Path alias `@/` maps to `./src/`.

**6-step wizard flow** (`App.tsx` manages step state):

1. **LoadingStep** — Fetches selected products from grid context, validates they're all simple products in the same family
2. **FamilyVariantStep** — Lists available family variants for the common family, user picks one
3. **AxisValuesStep** — User assigns axis attribute values per product (supports select attributes with option dropdowns)
4. **ModelCodeStep** — User sets root product model code and sub-model codes (for 2-level variants)
5. **PreviewStep** — Shows the planned hierarchy before execution
6. **ExecutionStep** — Creates root model → sub-models (if 2-level) → patches each product with `parent`

**Key modules:**
- `utils/attributeDistribution.ts` — Splits product attribute values across hierarchy levels (root vs level-1 vs variant) based on the family variant's `variantAttributeSets`
- `utils/validation.ts` — Validates same-family, simple-only, unique axis combinations
- `hooks/useSelectedProducts.ts` — Reads `PIM.context.productGrid.productUuids`, fetches full product data
- `hooks/useFamilyVariants.ts` — Fetches family variants for a given family code
- `hooks/useAttributeDetails.ts` — Fetches attribute metadata and options for axis attributes

## PIM SDK Access

All PIM data goes through `globalThis.PIM` (typed in `../common/global.d.ts`, included via `tsconfig.json`). Key APIs used:
- `PIM.context.productGrid.productUuids` — selected product UUIDs from grid
- `PIM.api.product_uuid_v1.get/patch` — fetch and update products
- `PIM.api.product_model_v1.post` — create product models
- `PIM.api.family_variant_v1.list/get` — fetch family variant definitions
- `PIM.api.attribute_v1.get` — fetch attribute metadata
- `PIM.api.attribute_option_v1.list` — fetch select attribute options
- `PIM.navigate.internal()` — navigate to created product model after execution

## SES Sandbox Constraints

The extension runs in a Secure ECMAScript (SES) sandbox. Avoid `eval()`, `Function()`, and dynamic code generation. Use `globalThis.PIM.*` for all PIM interactions.

## External Gateway Gotcha

`PIM.api.external.call()` does NOT forward `Content-Type` from headers. For JSON requests, pass `body` as a raw object (not `JSON.stringify()`). The gateway auto-sets `Content-Type: application/json` when it detects an object body.
