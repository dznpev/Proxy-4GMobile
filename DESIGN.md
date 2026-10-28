# Tổng quan

## Mission
Create implementation-ready, token-driven UI guidance for Tổng quan that is optimized for consistency, accessibility, and fast delivery across documentation site.

## Brand
- Product/brand: Tổng quan
- URL: https://trucmod.fun/overview
- Audience: developers and technical teams
- Product surface: documentation site

## Style Foundations
- Visual style: structured, tokenized, content-first
- Main font style: `font.family.primary=Be Vietnam Pro`, `font.family.stack=Be Vietnam Pro, Inter, -apple-system, BlinkMacSystemFont, sans-serif`, `font.size.base=13px`, `font.weight.base=400`, `font.lineHeight.base=19.5px`
- Typography scale: `font.size.xs=10px`, `font.size.sm=11px`, `font.size.md=12px`, `font.size.lg=13px`, `font.size.xl=14px`, `font.size.2xl=16px`, `font.size.3xl=30px`
- Color palette: `color.text.primary=#18181b`, `color.text.secondary=#52525b`, `color.text.tertiary=#8a8a93`, `color.surface.muted=#ffffff`, `color.surface.base=#000000`, `color.surface.raised=#fafafa`, `color.border.default=#e5e7eb`, `color.border.strong=#e4e4e7`
- Spacing scale: `space.1=2px`, `space.2=4px`, `space.3=6px`, `space.4=6.4px`, `space.5=6.72px`, `space.6=8px`, `space.7=8.8px`, `space.8=9.6px`
- Radius/shadow/motion tokens: `radius.xs=7px`, `radius.sm=8px`, `radius.md=9px`, `radius.lg=10px`, `radius.xl=12px`, `radius.2xl=9999px` | `shadow.1=rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` | `motion.duration.instant=150ms`, `motion.duration.fast=200ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (40), buttons (11), cards (8), navigation (3), inputs (1), tables (1).


## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.
