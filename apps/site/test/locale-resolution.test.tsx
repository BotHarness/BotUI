// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://ui.botharness.ai/" }
/**
 * Which locale an island resolves, in a browser.
 *
 * Every island reads its copy through `m.something()` with no locale argument, so the
 * locale comes from Paraglide's runtime, and on the client that means the URL
 * strategy. The compiler emits the patterns in `languageTags` order and takes the
 * FIRST match, so a default-locale pattern that also matches the other locale's path
 * wins silently: `/zh/` satisfies `/:path(.*)?`, the page renders Chinese on the
 * server, and then every control flips back to English on hydration.
 *
 * This is invisible to the build and to a casual screenshot. `group_shape` is
 * bilingual in both catalogs (`shape · 形状` and `形状 shape`), so the section
 * headings read correctly either way and the page only *looks* half translated. The
 * assertions below are on copy that exists in one locale and not the other, and they
 * cover both directions, because "the zh page is Chinese" and "the en page is still
 * English" are separate failures.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Playground } from "../src/components/Playground.js";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function renderAt(path: string): string {
  window.history.replaceState({}, "", path);
  act(() => {
    root.render(<Playground />);
  });
  return container.textContent ?? "";
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("client locale resolution", () => {
  it("keeps the Chinese page's controls in Chinese", () => {
    const text = renderAt("/zh/");
    // the shape controls are cards now, so the discriminators are the card labels and
    // each group's scope line — copy that exists in only one of the two catalogues
    expect(text).toContain("改变整个点阵的外轮廓");
    expect(text).toContain("改变每一个点本身");
    expect(text).toContain("圆形");
  });

  it("keeps the English page's controls in English", () => {
    const text = renderAt("/");
    expect(text).toContain("Changes the outline of the whole field");
    expect(text).toContain("Changes each individual dot");
    expect(text).toContain("circle");
    // "silhouette" is a substring of the Chinese label, so it cannot prove the page
    // stayed English on its own.
    expect(text).not.toContain("整体轮廓");
  });
});
