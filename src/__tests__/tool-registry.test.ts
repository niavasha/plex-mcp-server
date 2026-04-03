import { describe, it, expect, vi } from "vitest";
import { ToolRegistry } from "../plex/tool-registry.js";

describe("ToolRegistry", () => {
  it("registers and dispatches a handler", async () => {
    const registry = new ToolRegistry();
    const handler = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    registry.register("test_tool", handler);

    expect(registry.has("test_tool")).toBe(true);
    const result = await registry.handle("test_tool", { arg1: "value" });
    expect(handler).toHaveBeenCalledWith({ arg1: "value" });
    expect(result.content[0].text).toBe("ok");
  });

  it("returns false for unregistered tools", () => {
    const registry = new ToolRegistry();
    expect(registry.has("nonexistent")).toBe(false);
  });

  it("throws McpError for unknown tool", async () => {
    const registry = new ToolRegistry();
    await expect(registry.handle("nonexistent")).rejects.toThrow("Unknown tool: nonexistent");
  });
});
