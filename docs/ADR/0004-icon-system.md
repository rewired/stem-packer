# ADR 0004: Material Symbols Icon System

- Status: Accepted
- Date: 2024-12-06

## Context

The renderer previously relied on placeholder glyphs for affordances and lacked a shared icon story. Emoji usage is prohibited by project policy, and we need a consistent, scalable option that works across renderer surfaces and future packages. The UI kit did not expose an icon primitive, so downstream code could not standardize on sizing, alignment, or accessibility defaults.

## Decision

- Adopt Google Material Symbols Outlined as the canonical icon set and load the variable font via the renderer HTML entry point.
- Expose a shared `<Icon />` component from `@stem-packer/ui` that sets the Material Symbols class, hides decorative icons from assistive tech by default, and allows overrides for fill, weight, grade, and optical size through CSS custom properties.
- Define global styling in the renderer Tailwind bundle so that Material Symbols render with consistent alignment and default variation values.
- Harden the ESLint configuration for TSX/MDX files to block emoji characters, ensuring future UI contributions stay within the icon policy.

## Consequences

- Renderer views now demonstrate icon usage (header, actions, toast notifications), providing a visual smoke test for the font load.
- Teams share a single icon primitive that can be reused by additional packages without copy-pasting font settings.
- The stricter ESLint rule prevents regressions where emojis slip into JSX or MDX content, aligning with the "no emojis" policy.
- Offline builds will require bundling the font locally if the Google CDN becomes unavailable; we can revisit packaging when distribution planning begins.
