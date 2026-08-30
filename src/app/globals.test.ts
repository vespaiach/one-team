import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const declarations = new Map(
  [...stylesheet.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
);

function resolveToHex(token: string): string {
  const declared = declarations.get(token);
  if (declared === undefined) {
    throw new Error(`${token} is not declared in globals.css`);
  }
  const indirection = /^var\((--[\w-]+)\)$/.exec(declared);
  return indirection ? resolveToHex(indirection[1]) : declared;
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

const textPairs = [
  ["--color-text", "--color-page"],
  ["--color-text", "--color-surface"],
  ["--color-text-muted", "--color-page"],
  ["--color-text-muted", "--color-surface"],
  ["--color-text-placeholder", "--color-surface"],
  ["--color-accent-text", "--color-surface"],
  ["--color-surface", "--color-accent"],
  ["--color-danger-text", "--color-danger-fill"],
  ["--color-success-text", "--color-success-fill"],
  ["--color-advisory-text", "--color-advisory-fill"],
] as const;

const controlBoundaryPairs = [
  ["--color-border-control", "--color-surface"],
  ["--color-danger", "--color-surface"],
  ["--color-accent", "--color-surface"],
  ["--color-accent", "--color-page"],
] as const;

describe("globals.css meets WCAG 2.2 AA (FR-012)", () => {
  it.each(textPairs)("%s on %s clears 4.5:1 for text", (foreground, background) => {
    expect(contrastRatio(resolveToHex(foreground), resolveToHex(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(controlBoundaryPairs)("%s on %s clears 3:1 for non-text (1.4.11)", (foreground, background) => {
    expect(contrastRatio(resolveToHex(foreground), resolveToHex(background))).toBeGreaterThanOrEqual(3);
  });
});