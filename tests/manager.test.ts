import { describe, expect, it } from "vitest";
import { MANAGER_COMMANDS, managerPlaybook, parseManagerCommand } from "@/lib/ai/manager";
import { offlineAnswer } from "@/lib/ai/offline";
import { makeContext } from "./fixtures";

describe("artist-manager playbook", () => {
  it("parses commands with their subject and ignores unknown ones", () => {
    expect(parseManagerCommand("/release La Noche")).toMatchObject({ command: { command: "/release" }, rest: "La Noche" });
    expect(parseManagerCommand("  /STRATEGY")?.command.command).toBe("/strategy");
    expect(parseManagerCommand("/unknown thing")).toBeNull();
    expect(parseManagerCommand("plan my /release")).toBeNull();
  });

  it("documents every command and the research mode in the prompt", () => {
    for (const web of [true, false]) {
      const prompt = managerPlaybook(web);
      for (const c of MANAGER_COMMANDS) expect(prompt).toContain(c.command);
      expect(prompt).toContain("NEXT 3 ACTIONS");
      expect(prompt).toContain("Never invent contacts");
    }
    expect(managerPlaybook(true)).toMatch(/search the web/);
    expect(managerPlaybook(false)).toMatch(/can't browse the web/);
  });

  it("answers commands offline from stored data or explains what's needed", () => {
    const ctx = makeContext();
    expect(offlineAnswer(ctx, "/strategy")).toMatch(/priorities/);
    expect(offlineAnswer(ctx, "/release La Noche")).toMatch(/release/i);
    expect(offlineAnswer(ctx, "/labels")).toMatch(/offline mode/);
  });
});
