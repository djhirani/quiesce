import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Quiesce home", () => {
  it("presents the shutdown assurance premise without fabricated results", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /prove your agents truly stop/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no real infrastructure/i)).toBeInTheDocument();
    expect(screen.getByText(/metrics remain unset/i)).toBeInTheDocument();
  });
});
