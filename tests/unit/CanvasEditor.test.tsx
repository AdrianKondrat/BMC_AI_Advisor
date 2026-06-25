import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import CanvasEditor from "@/components/CanvasEditor";
import type { Canvas } from "@/types";

const mockCanvas: Canvas = {
  id: "canvas-123",
  name: "Test",
  owner_id: "user-123",
  idea: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  blocks: {
    key_partners: "Partners content",
    key_activities: "Activities content",
    key_resources: "Resources content",
    value_propositions: "VP content",
    customer_relationships: "CR content",
    channels: "Channels content",
    customer_segments: "CS content",
    cost_structure: "Cost content",
    revenue_streams: "Revenue content",
  },
  critique: {
    key_partners: { category: "completeness", text: "Existing critique text" },
    key_activities: { category: "completeness", text: "Activities critique" },
    key_resources: { category: "completeness", text: "Resources critique" },
    value_propositions: { category: "completeness", text: "VP critique" },
    customer_relationships: { category: "completeness", text: "CR critique" },
    channels: { category: "completeness", text: "Channels critique" },
    customer_segments: { category: "completeness", text: "CS critique" },
    cost_structure: { category: "completeness", text: "Cost critique" },
    revenue_streams: { category: "completeness", text: "Revenue critique" },
  },
};

describe("CanvasEditor", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders critique error and preserves existing critique on fetch rejection", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValueOnce(new Error("Network"));

    render(<CanvasEditor canvas={mockCanvas} initialShareLink={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Re-run Critique" }));

    await waitFor(() => {
      expect(screen.getByText("Critique failed — try again")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Re-run Critique" })).toBeInTheDocument();
    expect(screen.getByText("Existing critique text")).toBeInTheDocument();
  });

  it("renders critique error and preserves existing critique on non-OK response", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    render(<CanvasEditor canvas={mockCanvas} initialShareLink={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Re-run Critique" }));

    await waitFor(() => {
      expect(screen.getByText("Critique failed — try again")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Re-run Critique" })).toBeInTheDocument();
    expect(screen.getByText("Existing critique text")).toBeInTheDocument();
  });
});
