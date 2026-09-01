import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ArrowLeftIcon,
  BanIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  KeyRoundIcon,
  LockIcon,
  MailCheckIcon,
  MailIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "./icons";

const ICONS = [
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  XCircleIcon,
  BanIcon,
  ArrowLeftIcon,
  MailCheckIcon,
  InfoIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
];

describe("auth icons", () => {
  it("renders every icon as a decorative, fixed-size svg", () => {
    for (const Icon of ICONS) {
      const { container, unmount } = render(<Icon size={16} />);
      const svg = container.querySelector("svg");

      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("width")).toBe("16");
      expect(svg?.getAttribute("height")).toBe("16");
      unmount();
    }
  });

  it("sizes each icon from the size prop", () => {
    const { container } = render(<MailIcon size={20} />);
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("width")).toBe("20");
    expect(svg?.getAttribute("height")).toBe("20");
  });
});