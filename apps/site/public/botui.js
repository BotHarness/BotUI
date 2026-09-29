/**
 * The site: a live demo of the component, and the registry index rendered from the
 * SAME document the CLI installs from.
 *
 * It loads the built engine rather than a copy of it, so what runs on this page is
 * the artifact a user receives. If the demo and the registry ever disagreed, the
 * demo would be lying about the component.
 */
import {
  DOT_SHAPES,
  DOT_SHAPE_KEYS,
  PRESETS,
  PRESET_KEYS,
  SILHOUETTE_KEYS,
  createDotMatrix,
  dotShareOfPitch,
  layout,
  touchingDotSize,
} from "./botui-engine.js";

const $ = (sel) => document.querySelector(sel);
const options = {
  size: 120,
  cols: 7,
  rows: 7,
  silhouette: "circle",
  dot: "square",
  dotSize: 0.55,
  gapX: 0.45,
  gapY: 0.45,
  preset: "spiral",
  speed: 1,
  grow: 0.5,
  floor: 0.16,
  stagger: null,
  softness: 0,
  renderer: "svg",
};

const stage = $("#stage");
const host = document.createElement("div");
host.style.color = "var(--ink)";
stage.appendChild(host);
const dm = createDotMatrix(host, options);
dm.start();

/* ---- controls ---- */
const fill = (sel, values, current) => {
  const el = $(sel);
  for (const v of values) {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = v;
    if (v === current) option.selected = true;
    el.appendChild(option);
  }
};
fill("#preset", PRESET_KEYS, options.preset);
fill("#silhouette", SILHOUETTE_KEYS, options.silhouette);
fill("#dot", DOT_SHAPE_KEYS, options.dot);

const readout = $("#readout");
const render = () => {
  const L = layout(options);
  const share = dotShareOfPitch(options.dotSize, Math.max(options.gapX, options.gapY));
  readout.textContent = [
    `dot / cell   ${(options.dotSize * 100).toFixed(0)}%`,
    `dot / pitch  ${(share * 100).toFixed(0)}%   (100% = two dots touching)`,
    `touching at  dot / cell = ${touchingDotSize(Math.max(options.gapX, options.gapY)).toFixed(2)}`,
    `pitch        ${L.pitchX.toFixed(1)} × ${L.pitchY.toFixed(1)} px`,
    `dot          ${L.dotPx.toFixed(1)} px`,
    `renderer     ${options.renderer}`,
    `preset       ${PRESETS[options.preset]?.task ?? "off"} · ${options.preset}`,
  ].join("\n");
};

$("#preset").addEventListener("change", (e) => {
  options.preset = e.target.value;
  dm.set({ preset: options.preset });
  const gap = dm.cssGap();
  $("#css-mode").disabled = Boolean(gap);
  if (gap && options.renderer === "css") {
    options.renderer = "svg";
    $("#css-mode").checked = false;
    dm.set({ renderer: "svg" });
  }
  render();
});
$("#silhouette").addEventListener("change", (e) => {
  options.silhouette = e.target.value;
  dm.set({ silhouette: options.silhouette });
});
$("#dot").addEventListener("change", (e) => {
  options.dot = e.target.value;
  dm.set({ dot: options.dot, spec: { ...DOT_SHAPES[e.target.value].spec } });
});
$("#size").addEventListener("input", (e) => {
  options.size = Number(e.target.value);
  $("#size-out").textContent = `${options.size}px`;
  dm.set({ size: options.size });
});
$("#dotSize").addEventListener("input", (e) => {
  options.dotSize = Number(e.target.value) / 100;
  $("#dotSize-out").textContent = `${e.target.value}%`;
  dm.set({ dotSize: options.dotSize });
  render();
});
$("#softness").addEventListener("input", (e) => {
  options.softness = Number(e.target.value) / 100;
  $("#softness-out").textContent = e.target.value;
  dm.set({ softness: options.softness });
});
$("#css-mode").addEventListener("change", (e) => {
  options.renderer = e.target.checked ? "css" : "svg";
  dm.set({ renderer: options.renderer });
  if (options.renderer === "css") dm.stop();
  else dm.start();
  render();
});

$("#size-out").textContent = `${options.size}px`;
$("#dotSize-out").textContent = "55%";
$("#softness-out").textContent = "0";
render();

/* ---- the brand mark, which is the component too ---- */
const mark = $("#brand-mark");
const markHost = document.createElement("div");
markHost.style.cssText = "width:22px;height:22px";
mark.appendChild(markHost);
const markDm = createDotMatrix(markHost, {
  ...options,
  size: 22,
  cols: 4,
  rows: 4,
  silhouette: "square",
  dotSize: 0.5,
});
markDm.start();

/* ---- the registry index, read from the same URL the CLI uses ---- */
const list = $("#registry-list");
try {
  const response = await fetch("/registry.json");
  const registry = await response.json();
  list.replaceChildren(
    ...registry.items.map((item) => {
      const card = document.createElement("article");
      card.className = "card";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = item.title ?? item.name;
      const preview = document.createElement("div");
      preview.className = "preview";
      const previewHost = document.createElement("div");
      preview.appendChild(previewHost);
      const description = document.createElement("p");
      description.textContent = item.description ?? "";
      card.append(name, preview, description);
      // a small live field per card, so the index shows the components rather than
      // describing them
      const presets = Object.keys(PRESETS).filter((p) => p !== "off");
      createDotMatrix(previewHost, {
        ...options,
        size: 72,
        cols: 6,
        rows: 6,
        silhouette: item.name.includes("react") ? "hex" : "circle",
        preset: presets[Math.abs(hash(item.name)) % presets.length],
      }).start();
      return card;
    }),
  );
} catch (error) {
  list.innerHTML = `<p class="fine">could not load the registry: ${error.message}</p>`;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/* ---- copy button ---- */
$("#copy").addEventListener("click", async () => {
  const button = $("#copy");
  try {
    await navigator.clipboard.writeText($("#install-cmd").textContent);
    button.textContent = "copied";
  } catch {
    button.textContent = "select it";
  }
  setTimeout(() => {
    button.textContent = "copy";
  }, 1600);
});
