# Product Landing Page — Plan Brief

> Full plan: `context/changes/product-landing-page/plan.md`

## What & Why

Build a simple landing page at `/` that explains the Business Model Canvas and introduces the BMC AI Advisor project. This replaces the current Welcome component and gives new visitors a clear entry point to the product with easy navigation to sign-up or sign-in.

## Starting Point

Currently, `src/pages/index.astro` renders a Welcome component. The root path is publicly accessible and not protected by auth. Auth pages (sign-in, sign-up) already exist and are working.

## Desired End State

Users visiting `/` see a welcoming landing page with:

- A headline and brief explanation of what the Business Model Canvas is
- A short description of the BMC AI Advisor project (1-2 sentences)
- 2-3 key features or benefits listed
- Prominent "Sign In" and "Sign Up" buttons
- Professional, responsive layout using existing shadcn/ui components
- Consistent styling with the app's design system

## Key Decisions Made

| Decision        | Choice                                               | Why                                                        | Source        |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------------- | ------------- |
| Page location   | Root path `/` (replaces Welcome)                     | Makes it the primary entry point for new visitors.         | Plan          |
| Design approach | Existing shadcn/ui components with custom layout     | Maintains design consistency, faster to build.             | User feedback |
| Scope           | Simple static page, no demo mode                     | User clarified: nice-to-have, short copy, straightforward. | Plan          |
| Auth behavior   | Allow anyone to see it (no auto-redirect)            | Supports both new and returning users.                     | User feedback |
| Content         | Brief BMC explainer + project description + features | Balances educational and marketing goals.                  | Plan          |

## Scope

**In scope:**

- LandingPage component with copy, layout, and CTAs
- Replace Welcome in index.astro
- Use shadcn/ui Button for sign-in and sign-up links
- Responsive mobile/desktop design
- Manual testing of navigation and styling

**Out of scope:**

- Demo mode or interactive features
- SEO optimization
- Custom graphics or animations
- Analytics or conversion tracking
- A/B testing

## Architecture / Approach

Simple single-component replacement: `LandingPage.astro` renders a vertically stacked layout with:

1. Headline section
2. BMC explainer (1-2 sentences)
3. Project description (1-2 sentences)
4. Features list (2-3 bullets)
5. CTA buttons (Sign In / Sign Up) using shadcn/ui Button
6. Responsive Tailwind styling

No state management, no API calls, no backend changes needed.

## Phases at a Glance

| Phase                   | What it delivers                                                     | Key risk                                                |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Create LandingPage   | New component with copy, layout, and CTAs; updated index.astro       | Styling doesn't match app design system                 |
| 2. Integration & verify | Confirmed navigation works, responsive design tested, no regressions | Missed edge case in navigation or styling inconsistency |

**Prerequisites:** None. Existing auth pages and components are ready to use.

**Estimated effort:** ~1 session to build and test the component.

## Open Risks & Assumptions

- Assumes the Welcome component can be safely removed with no other references
- Assumes shadcn/ui Button component is sufficient for navigation (no custom link styling needed)
- Assumes "short copy" is 1-2 sentences per section; if more space is needed, may require additional design discussion

## Success Criteria (Summary)

- Landing page loads at `/` with no errors
- Sign-in and sign-up buttons navigate to the correct auth pages
- Page is readable and responsive on mobile and desktop
- Styling is consistent with the app's existing design
- No regressions in auth flows or other existing pages
