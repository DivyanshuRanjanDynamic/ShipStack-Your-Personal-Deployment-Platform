import { describe, it, expect } from "vitest";
import path from "path";
import { fetchContext, parseRawLogs } from "../src/pipeline/fetchContext.js";
import type { DiagnosisRequest } from "../contracts/diagnosis-request.js";

describe("fetchContext Step (Phase 2, §5.1)", () => {
  const dummyRequest: DiagnosisRequest = {
    deployment_id: "dep-fetch-1",
    project_id: "proj-1",
    user_id: null,
    git_url: "https://github.com/org/repo",
    failed_step: "install",
    exit_code: 1,
    failure_reason: "NONZERO_EXIT",
    context_s3_key: "__meta/dep-fetch-1/build-context.json",
    failed_at: "2026-10-10T12:00:00Z",
  };

  it("parses raw logs into NumberedLines with 1-based indexing and step detection", () => {
    const raw = [
      "[clone] Cloning into '/repo'...",
      "[clone] Done.",
      "[install] npm install",
      "[install] npm ERR! code ERESOLVE",
      "[build] npm run build",
    ].join("\n");

    const lines = parseRawLogs(raw);

    expect(lines.length).toBe(5);
    expect(lines[0]).toEqual({ n: 1, text: "[clone] Cloning into '/repo'...", step: "clone" });
    expect(lines[1]).toEqual({ n: 2, text: "[clone] Done.", step: "clone" });
    expect(lines[2]).toEqual({ n: 3, text: "[install] npm install", step: "install" });
    expect(lines[3]).toEqual({ n: 4, text: "[install] npm ERR! code ERESOLVE", step: "install" });
    expect(lines[4]).toEqual({ n: 5, text: "[build] npm run build", step: "build" });
  });

  it("loads fixtures in eval mode from real case folders", async () => {
    const fixtureDir = path.resolve(__dirname, "../../eval/cases/DEPENDENCY_CONFLICT-01");
    const result = await fetchContext(dummyRequest, { fixtureDir });

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs[0].n).toBe(1);
    expect(result.contextMissing).toBe(false);
    expect(result.buildContext).toBeDefined();
    expect(result.buildContext?.framework).toBe("vite");
    expect(result.buildContext?.package_manager).toBe("npm");
  });

  it("handles missing build-context gracefully by setting contextMissing = true", async () => {
    const result = await fetchContext(dummyRequest, {
      rawLogsText: "Some log line\nAnother log line",
      buildContextOverride: null,
    });

    expect(result.logs.length).toBe(2);
    expect(result.logs[0].n).toBe(1);
    expect(result.logs[1].n).toBe(2);
    expect(result.buildContext).toBeNull();
    expect(result.contextMissing).toBe(true);
  });
});
