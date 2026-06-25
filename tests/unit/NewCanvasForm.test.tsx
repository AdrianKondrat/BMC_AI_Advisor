import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import NewCanvasForm from "@/components/NewCanvasForm";

describe("NewCanvasForm", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders error message on non-201 response and clears loading state", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<NewCanvasForm />);

    fireEvent.change(screen.getByPlaceholderText("Describe your business idea…"), {
      target: { value: "My startup idea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate my canvas" }));

    await waitFor(() => {
      expect(screen.getByText("AI generation failed")).toBeInTheDocument();
    });
    expect(screen.queryByText("Generating…")).not.toBeInTheDocument();
  });

  it("renders error message on network rejection and clears loading state", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

    render(<NewCanvasForm />);

    fireEvent.change(screen.getByPlaceholderText("Describe your business idea…"), {
      target: { value: "My startup idea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate my canvas" }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
    expect(screen.queryByText("Generating…")).not.toBeInTheDocument();
  });
});
