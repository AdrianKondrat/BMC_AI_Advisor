# Product Landing Page Implementation Plan

## Overview

Build a simple, welcoming landing page at the root path `/` that explains the Business Model Canvas and introduces the BMC AI Advisor project. The page should use existing shadcn/ui components, include clear navigation to sign-up and sign-in, and replace the current Welcome component.

## Current State Analysis

- `src/pages/index.astro` currently renders a `Welcome` component
- The root path `/` is publicly accessible (not protected by auth middleware)
- Protected routes (`/dashboard`, `/canvas`) redirect unauthenticated users to `/auth/signin`
- The auth system is in place and working; sign-in and sign-up pages already exist
- shadcn/ui components are available for use throughout the app

## Desired End State

When users visit `/`:

1. They see a clean, informative landing page explaining what a Business Model Canvas is
2. The page briefly describes what the BMC AI Advisor project does
3. The page has prominent links/buttons to sign-in and sign-up
4. Authenticated users see the same page (no special redirect) but can navigate to their dashboard
5. The page uses existing shadcn/ui components and follows the app's design system

### Verification

- Load `/` in a browser and see the landing page (not a blank or broken component)
- Click sign-in and sign-up buttons; verify they navigate to the correct auth pages
- Verify the page looks professional and is readable on mobile and desktop
- Verify links work and styling is consistent

## What We're NOT Doing

- Building a demo mode or interactive canvas walkthrough
- SEO optimization or search engine targeting
- Custom graphics or animations beyond standard component styling
- A/B testing or conversion tracking
- Analytics integration

## Implementation Approach

Create a new `LandingPage` component that displays:

1. A brief, clear headline explaining what the Business Model Canvas is
2. A short paragraph describing the BMC AI Advisor (1-2 sentences)
3. Key features or benefits in simple language (2-3 bullet points)
4. Prominent Call-to-action buttons: "Sign In" and "Sign Up"
5. Optional: a footer with basic information

Use shadcn/ui components (Button, Card) for layout and styling. Replace the Welcome component in `index.astro` with the new LandingPage component.

## Phase 1: Create Landing Page Component

### Overview

Build the LandingPage component with copy about the Business Model Canvas and the project, styled with shadcn/ui components.

### Changes Required:

#### 1. LandingPage Component

**File**: `src/components/LandingPage.astro`

**Intent**: Create a new Astro component that renders the landing page content. Include a headline, brief explanation of BMC, description of the project, key features or benefits, and call-to-action buttons to sign in and sign up.

**Contract**: Export a default Astro component that renders the page layout. The component should:

- Display a headline (e.g., "Bring Your Business Idea to Life")
- Explain the Business Model Canvas in 1-2 sentences
- Describe the BMC AI Advisor project in 1-2 sentences
- List 2-3 key features (e.g., "AI-powered canvas generation", "Real-time critique", "Shareable templates")
- Include two buttons: one links to `/auth/signin`, one links to `/auth/signup`
- Use shadcn/ui Button component
- Use Tailwind classes for responsive layout (mobile-first, centered content)

#### 2. Update Root Page

**File**: `src/pages/index.astro`

**Intent**: Replace the Welcome component with the new LandingPage component.

**Contract**: Change the import from `Welcome` to `LandingPage` and update the JSX to render the new component. The page structure remains the same (imports, Layout wrapper).

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npm run lint`
- Build succeeds: `npm run build`
- No console errors when loading the dev server: `npm run dev`

#### Manual Verification:

- Load `http://localhost:3000` in browser and see the landing page render
- Verify the page is readable and well-formatted
- Click "Sign In" button and verify it navigates to `/auth/signin`
- Click "Sign Up" button and verify it navigates to `/auth/signup`
- Test on mobile viewport (use browser dev tools) and verify layout is responsive
- Verify styling is consistent with the rest of the app (matches color scheme, typography)

**Implementation Note**: After completing this phase and manual verification passes, proceed to Phase 2.

---

## Phase 2: Integration & Verification

### Overview

Ensure the landing page integrates smoothly with the existing app, test all navigation paths, and verify no regressions in auth flows or other pages.

### Changes Required:

#### 1. Verify Navigation Flows

**File**: N/A (manual testing)

**Intent**: Confirm that navigation from the landing page to sign-in and sign-up works correctly, and that users can navigate back to the landing page if needed.

**Contract**: Test the following flows:

1. From `/` click "Sign In" → should land on `/auth/signin`
2. From `/` click "Sign Up" → should land on `/auth/signup`
3. From sign-in page, verify "back" button or logo click returns to `/`
4. Verify authenticated users can see the landing page when they visit `/` directly (no auto-redirect)
5. From the landing page, verify authenticated users can navigate to `/dashboard` if they know the URL

### Success Criteria:

#### Automated Verification:

- Build succeeds: `npm run build`
- No TypeScript errors: `npm run lint`
- ESLint passes on new/modified files

#### Manual Verification:

- Navigation flows work as described above
- Sign-in page loads correctly from the landing page link
- Sign-up page loads correctly from the landing page link
- The landing page has no broken images or missing styling
- No console errors in browser dev tools
- Page load time is reasonable (no performance regressions)
- Verify the page looks good on at least two different screen sizes (desktop and mobile)

---

## Testing Strategy

### Manual Testing Steps:

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000` and verify the landing page loads
3. Test responsive design by resizing the browser window and checking mobile view
4. Click each CTA button and verify navigation
5. Test on an actual mobile device if possible, or use browser dev tools emulation
6. Test with and without being logged in (open an incognito window to test unauthenticated)
7. Verify no console errors or warnings

### What to Test Manually:

- Page renders without errors
- All text is readable and well-formatted
- Buttons are clickable and navigate correctly
- Page is responsive on mobile, tablet, and desktop
- No styling conflicts with existing app components
- Links to sign-in and sign-up work correctly

## References

- Current index page: `src/pages/index.astro`
- Welcome component: `src/components/Welcome.astro`
- shadcn/ui Button: `src/components/ui/button.tsx`
- Auth pages: `src/pages/auth/{signin,signup}.astro`
- Layout: `src/layouts/Layout.astro`
- Tailwind config: `tailwind.config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Create Landing Page Component

#### Automated

- [x] 1.1 TypeScript compiles without errors — 7c9646a
- [x] 1.2 Build succeeds — 7c9646a
- [x] 1.3 No console errors in dev server — 7c9646a

#### Manual

- [x] 1.4 Landing page renders and is readable — 7c9646a
- [x] 1.5 Sign-in and sign-up buttons navigate correctly — 7c9646a
- [x] 1.6 Page is responsive on mobile and desktop — 7c9646a
- [x] 1.7 Styling is consistent with app design — 7c9646a

### Phase 2: Integration & Verification

#### Automated

- [x] 2.1 Build succeeds
- [x] 2.2 Lint/TypeScript passes
- [x] 2.3 No new console errors

#### Manual

- [x] 2.4 Navigation flows work (sign-in, sign-up, back to landing)
- [x] 2.5 No broken images or missing styling
- [x] 2.6 Page performs well (reasonable load time)
- [x] 2.7 Authenticated users can see landing page without redirect
