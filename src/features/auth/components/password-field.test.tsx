import { fireEvent, render, screen } from "@testing-library/react";
import { Form } from "react-aria-components/Form";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./password-field";

describe("PasswordField", () => {
  it("renders a password input labelled by the given text", () => {
    render(
      <Form>
        <PasswordField
          name="password"
          label="Password"
        />
      </Form>,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("reveals the value and toggles its accessible name when the reveal button is pressed", () => {
    render(
      <Form>
        <PasswordField
          name="password"
          label="Password"
        />
      </Form>,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const reveal = screen.getByRole("button", { name: "Show password" });

    fireEvent.click(reveal);

    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.type).toBe("password");
  });

  it("removes the reveal button and disables the input when isDisabled", () => {
    render(
      <Form>
        <PasswordField
          name="password"
          label="Password"
          isDisabled
        />
      </Form>,
    );

    expect(screen.queryByRole("button", { name: /password/i })).toBeNull();
    expect((screen.getByLabelText("Password") as HTMLInputElement).disabled).toBe(true);
  });

  it("renders extra label content, such as a forgot-password link", () => {
    render(
      <Form>
        <PasswordField
          name="password"
          label="Password"
          labelExtra={<a href="/reset">Forgot password?</a>}
        />
      </Form>,
    );

    expect(screen.getByRole("link", { name: "Forgot password?" })).not.toBeNull();
  });

  it("shows the error message instead of the hint when invalid", () => {
    render(
      <Form>
        <PasswordField
          name="password"
          label="Password"
          isInvalid
          errorMessage="Enter your password."
          hint="Twelve characters minimum."
        />
      </Form>,
    );

    expect(screen.getByText("Enter your password.")).not.toBeNull();
    expect(screen.queryByText("Twelve characters minimum.")).toBeNull();
  });

  it("shows the hint when not invalid", () => {
    render(
      <Form>
        <PasswordField
          name="password"
          label="Password"
          hint="Twelve characters minimum."
        />
      </Form>,
    );

    expect(screen.getByText("Twelve characters minimum.")).not.toBeNull();
  });
});