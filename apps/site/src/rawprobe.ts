import src from "./traversals.ts?raw";
export const hasRaw = typeof src === "string" && src.includes("chevron");
