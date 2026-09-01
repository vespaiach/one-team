import { render, screen } from "@testing-library/react";
import { Form } from "react-aria-components/Form";
import { describe, expect, it } from "vitest";
import { EmailField } from "./email-field";

describe("EmailField", () => {
  it("renders an email input labelled by the given text, with a leading icon", () => {
    render(
      <Form>
        <EmailField
          name="email"
          label="Email"
          placeholder="you@company.com"
        />
      </Form>,
    );

    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.type).toBe("email");
    expect(input.placeholder).toBe("you@company.com");
  });

  it("associates the error message once invalid", () => {
    render(
      <Form>
        <EmailField
          name="email"
          label="Email"
          isInvalid
          errorMessage="Enter a valid email address."
        />
      </Form>,
    );

    expect(screen.getByText("Enter a valid email address.")).not.toBeNull();
  });

  it("disables the input when isDisabled", () => {
    render(
      <Form>
        <EmailField
          name="email"
          label="Email"
          isDisabled
        />
      </Form>,
    );

    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
  });
});