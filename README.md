# Blank page on Back-before-hydration with `cacheComponents`

With `cacheComponents: true` and a root layout that wraps `children` in `<Suspense>`, pressing the browser's Back button between a reload and hydration leaves the app on a blank page: the reloaded page's content is hidden, but the page the browser traversed to never renders.

This started with the traversal replay introduced in [vercel/next.js#95682](https://github.com/vercel/next.js/pull/95682) (`next@16.3.0-canary.87`). The replay works without `cacheComponents`. Before that PR (`16.3.0-canary.86`), the same scenario showed the reloaded page's content under the traversed-to URL — out of sync, but not blank.

## Reproduce

```bash
pnpm install
pnpm test
```

The Playwright test navigates client-side from `/` to `/post`, reloads with all static scripts stalled (same technique as `test/e2e/app-dir/back-before-hydration` in the Next.js repo), presses Back before releasing them, and then watches the visible `<h1>` elements. It fails with a list of blank frames: from ~400ms after hydration onwards, neither page is visible.

Manually: `pnpm build && pnpm start`, open the app, click **To post**, hard-reload (Cmd+Shift+R), press Back quickly before hydration finishes. The URL bar shows `/` and the page goes blank.

To widen the pre-hydration window on fast machines, enable network throttling in the browser devtools (e.g. Slow 4G): the HTML streams in quickly but the static chunks take a while to load, delaying hydration — press Back at leisure within that window.

## Expected

Once the router replays the missed traversal, the Home page renders (as it does without `cacheComponents`), and the reloaded page's content stays visible until then.

## Notes

- `cacheComponents: false` in [`next.config.ts`](./next.config.ts): test passes.
- Removing the `<Suspense>` boundary around `children` in [`app/layout.tsx`](./app/layout.tsx): test passes.
- `next@16.3.0-canary.86`: no blank frames, but the Post page's content stays visible under the `/` URL (the desync that #95682 fixes).
- The failure is racy on fast machines (the router occasionally recovers cleanly), so the test runs the scenario 3 times.
