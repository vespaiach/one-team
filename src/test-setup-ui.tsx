import type { RenderOptions } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { afterEach, vi } from "vitest";

vi.mock("@testing-library/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@testing-library/react")>();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale="en-US">{children}</I18nProvider>
  );
  return {
    ...actual,
    render: (ui: ReactElement, options?: RenderOptions) =>
      actual.render(ui, { ...options, wrapper: Wrapper }),
  };
});

afterEach(() => {
  cleanup();
});