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

  describe("dispatch chain fallthrough (plex → trakt → arr)", () => {
    it("first registry handles when tool is registered there", async () => {
      const plex = new ToolRegistry();
      const trakt = new ToolRegistry();
      const arr = new ToolRegistry();
      const plexHandler = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "plex" }] });
      const traktHandler = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "trakt" }] });
      plex.register("shared_tool", plexHandler);
      trakt.register("shared_tool", traktHandler);

      const reg = plex.has("shared_tool") ? plex : trakt.has("shared_tool") ? trakt : arr;
      await reg.handle("shared_tool", {});

      expect(plexHandler).toHaveBeenCalled();
      expect(traktHandler).not.toHaveBeenCalled();
    });

    it("falls through to second registry when first does not have tool", async () => {
      const plex = new ToolRegistry();
      const trakt = new ToolRegistry();
      const arr = new ToolRegistry();
      const traktHandler = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "trakt" }] });
      trakt.register("trakt_only", traktHandler);

      const reg = plex.has("trakt_only") ? plex : trakt.has("trakt_only") ? trakt : arr;
      const result = await reg.handle("trakt_only", {});

      expect(traktHandler).toHaveBeenCalled();
      expect(result.content[0].text).toBe("trakt");
    });

    it("falls through to third registry when neither plex nor trakt has tool", async () => {
      const plex = new ToolRegistry();
      const trakt = new ToolRegistry();
      const arr = new ToolRegistry();
      const arrHandler = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "arr" }] });
      arr.register("arr_only", arrHandler);

      const reg = plex.has("arr_only") ? plex : trakt.has("arr_only") ? trakt : arr;
      const result = await reg.handle("arr_only", {});

      expect(arrHandler).toHaveBeenCalled();
      expect(result.content[0].text).toBe("arr");
    });

    it("final registry throws Unknown tool when none of the chain registers it", async () => {
      const plex = new ToolRegistry();
      const trakt = new ToolRegistry();
      const arr = new ToolRegistry();

      const reg = plex.has("ghost") ? plex : trakt.has("ghost") ? trakt : arr;
      await expect(reg.handle("ghost")).rejects.toThrow("Unknown tool: ghost");
    });
  });
});
