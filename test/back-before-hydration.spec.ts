import { expect, test, type Page } from "@playwright/test";

// Reproduces a blank page when the browser's Back button is pressed while a
// reloaded page has committed but not yet hydrated, with `cacheComponents`
// enabled.
//
// Same technique as test/e2e/app-dir/back-before-hydration in the Next.js
// repo (vercel/next.js#95682): stall every static script so the committed
// document cannot start hydrating until released, making the race
// deterministic. Manually, the same happens with a hard reload (Cmd+Shift+R)
// on /post followed by a quick Back press.
async function stallScripts(page: Page) {
  let stalling = true;
  const stalled: Array<() => void> = [];
  await page.route("**/_next/static/**", async (route) => {
    if (stalling && route.request().resourceType() === "script") {
      await new Promise<void>((resolve) => stalled.push(resolve));
    }
    await route.continue();
  });
  return function releaseScripts() {
    stalling = false;
    for (const release of stalled) {
      release();
    }
  };
}

test("recovers from a Back traversal between reload and hydration", async ({
  page,
}) => {
  // The bug is racy (the router sometimes recovers cleanly), so the scenario
  // runs a few times to catch it reliably.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Client-side navigation, so both history entries are same-document
    // entries created via pushState. The marker asserts the click did not
    // cause a full document navigation (i.e. hydration was ready).
    await page.evaluate("window.__sameDocument = true");
    await page.locator("#to-post").click();
    await expect(page.locator("#post")).toBeVisible();
    expect(await page.evaluate("window.__sameDocument")).toBe(true);

    const releaseScripts = await stallScripts(page);
    await page.reload({ waitUntil: "commit" });
    await page.goBack({ waitUntil: "commit" });
    expect(new URL(page.url()).pathname).toBe("/");

    releaseScripts();

    // One of the two pages must be visible at all times while the router
    // recovers: a blank frame means the reloaded page's content was hidden
    // before the traversed-to page rendered.
    const start = Date.now();
    const blankFrames: number[] = [];
    let recovered = false;
    while (Date.now() - start < 5_000) {
      const visible = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("h1"))
          .filter((element) => element.offsetParent !== null)
          .map((element) => element.id)
          .join(","),
      );
      if (visible === "") {
        blankFrames.push(Date.now() - start);
      }
      if (visible === "home") {
        recovered = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    expect(blankFrames, "blank frames while recovering (ms)").toEqual([]);
    expect(recovered, "recovered to the traversed-to page").toBe(true);
    expect(new URL(page.url()).pathname).toBe("/");

    await page.unroute("**/_next/static/**");
  }
});
