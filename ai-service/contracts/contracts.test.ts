import { describe, it, expect } from "vitest";
import {
  BuildContext,
  DiagnosisRequest,
  DiagnosisSource,
  FailureReason,
  LlmOutput,
} from "./index.js";

describe("BuildContext schema", () => {
  it("validates a complete valid payload", () => {
    const payload = {
      deployment_id: "dep_123",
      git_url: "https://github.com/foo/bar",
      framework: "vite",
      package_manager: "npm",
      node_version: "20.11.0",
      engines: { node: ">=18" },
      scripts: { build: "vite build" },
      build_command: "npm run build",
      expected_output_dir: "dist",
      has_lockfile: true,
      captured_at: "2026-10-09T15:30:00Z",
    };
    expect(() => BuildContext.parse(payload)).not.toThrow();
  });

  it("validates when optional fields are null", () => {
    const payload = {
      deployment_id: "dep_123",
      git_url: "https://github.com/foo/bar",
      framework: null,
      package_manager: null,
      node_version: null,
      engines: null,
      scripts: null,
      build_command: null,
      expected_output_dir: null,
      has_lockfile: false,
      captured_at: "2026-10-09T15:30:00Z",
    };
    expect(() => BuildContext.parse(payload)).not.toThrow();
  });

  it("rejects missing fields (they must be null, not omitted)", () => {
    const payload = {
      deployment_id: "dep_123",
      git_url: "https://github.com/foo/bar",
      has_lockfile: false,
      captured_at: "2026-10-09T15:30:00Z",
    };
    expect(BuildContext.safeParse(payload).success).toBe(false);
  });

  it("accepts the extended framework labels", () => {
    const base = {
      deployment_id: "dep_123",
      git_url: "https://github.com/foo/bar",
      package_manager: null,
      node_version: null,
      engines: null,
      scripts: null,
      build_command: null,
      expected_output_dir: null,
      has_lockfile: false,
      captured_at: "2026-10-09T15:30:00Z",
    };
    for (const framework of ["gatsby", "angular", "astro", "vue", "svelte"]) {
      expect(BuildContext.safeParse({ ...base, framework }).success).toBe(true);
    }
    expect(BuildContext.safeParse({ ...base, framework: "handwritten" }).success).toBe(false);
  });
});

describe("DiagnosisRequest schema", () => {
  it("validates a valid payload with string user_id", () => {
    const payload = {
      deployment_id: "dep_123",
      project_id: "proj_456",
      user_id: "usr_789",
      git_url: "https://github.com/foo/bar",
      failed_step: "build",
      exit_code: 137,
      failure_reason: "TASK_OOM",
      context_s3_key: "__meta/dep_123/build-context.json",
      failed_at: "2026-10-09T15:30:00Z",
    };
    expect(() => DiagnosisRequest.parse(payload)).not.toThrow();
  });

  it("validates a valid payload with null user_id and optional stop fields", () => {
    const payload = {
      deployment_id: "dep_123",
      project_id: "proj_456",
      user_id: null,
      git_url: "https://github.com/foo/bar",
      failed_step: "build",
      exit_code: 137,
      failure_reason: "TASK_OOM",
      context_s3_key: "__meta/dep_123/build-context.json",
      failed_at: "2026-10-09T15:30:00Z",
      stop_code: "EssentialContainerExited",
      stopped_reason: "OutOfMemoryError: Container killed due to memory limit",
    };
    const parsed = DiagnosisRequest.parse(payload);
    expect(parsed.user_id).toBeNull();
    expect(parsed.stop_code).toBe("EssentialContainerExited");
    expect(parsed.stopped_reason).toBe("OutOfMemoryError: Container killed due to memory limit");
  });

  it("rejects when user_id is missing/omitted", () => {
    const payload = {
      deployment_id: "dep_123",
      project_id: "proj_456",
      git_url: "https://github.com/foo/bar",
      failed_step: "build",
      exit_code: 137,
      failure_reason: "TASK_OOM",
      context_s3_key: "__meta/dep_123/build-context.json",
      failed_at: "2026-10-09T15:30:00Z",
    };
    expect(DiagnosisRequest.safeParse(payload).success).toBe(false);
  });

  it("rejects invalid failed_step", () => {
    const payload = {
      deployment_id: "dep_123",
      project_id: "proj_456",
      user_id: "usr_789",
      git_url: "https://github.com/foo/bar",
      failed_step: "not_a_step",
      exit_code: 1,
      failure_reason: "NONZERO_EXIT",
      context_s3_key: "key",
      failed_at: "2026-10-09T15:30:00Z",
    };
    expect(DiagnosisRequest.safeParse(payload).success).toBe(false);
  });
});

describe("DiagnosisSource schema", () => {
  it("accepts STUB as a valid source", () => {
    expect(() => DiagnosisSource.parse("STUB")).not.toThrow();
    expect(() => DiagnosisSource.parse("RULES")).not.toThrow();
    expect(() => DiagnosisSource.parse("LLM")).not.toThrow();
    expect(() => DiagnosisSource.parse("CACHE")).not.toThrow();
  });

  it("rejects invalid source", () => {
    expect(DiagnosisSource.safeParse("UNKNOWN_SOURCE").success).toBe(false);
  });
});

describe("LlmOutput schema", () => {
  it("validates a valid payload", () => {
    const payload = {
      category: "NODE_VERSION_MISMATCH",
      confidence: 0.9,
      root_cause: "Wrong node version",
      evidence: [{ line: 10, text: "Error" }],
      fix_steps: [{ step: "change version", type: "env" }],
      sources: ["chunk_1"],
      needs_human: false,
    };
    expect(() => LlmOutput.parse(payload)).not.toThrow();
  });

  it("rejects invalid category", () => {
    const payload = {
      category: "NOT_A_REAL_CATEGORY",
      confidence: 0.9,
      root_cause: "foo",
      evidence: [{ line: 10, text: "Error" }],
      fix_steps: [{ step: "change version", type: "env" }],
      sources: ["chunk_1"],
      needs_human: false,
    };
    expect(LlmOutput.safeParse(payload).success).toBe(false);
  });

  it("rejects confidence out of bounds", () => {
    const base = {
      category: "UNKNOWN" as const,
      root_cause: "foo",
      evidence: [{ line: 10, text: "Error" }],
      fix_steps: [{ step: "change version", type: "env" as const }],
      sources: [],
      needs_human: true,
    };
    expect(LlmOutput.safeParse({ ...base, confidence: 1.5 }).success).toBe(false);
    expect(LlmOutput.safeParse({ ...base, confidence: -0.1 }).success).toBe(false);
  });

  it("rejects empty evidence or fix_steps", () => {
    const base = {
      category: "UNKNOWN" as const,
      confidence: 0.5,
      root_cause: "foo",
      sources: [],
      needs_human: true,
    };
    expect(LlmOutput.safeParse({ ...base, evidence: [], fix_steps: [{ step: "x", type: "none" }] }).success).toBe(false);
    expect(LlmOutput.safeParse({ ...base, evidence: [{ line: 1, text: "x" }], fix_steps: [] }).success).toBe(false);
  });
});

describe("FailureReason enum", () => {
  it("keeps the existing reasons", () => {
    for (const r of ["TASK_OOM", "TIMEOUT", "NONZERO_EXIT", "UPLOAD_EMPTY", "CLONE_FAILED"]) {
      expect(FailureReason.safeParse(r).success).toBe(true);
    }
  });

  it("accepts the build-server reasons", () => {
    for (const r of ["UNSUPPORTED_PROJECT", "UPLOAD_FAILED", "MISSING_BUILD_SCRIPT", "ROOT_DIR_AMBIGUOUS"]) {
      expect(FailureReason.safeParse(r).success).toBe(true);
    }
  });

  it("rejects unknown reasons", () => {
    expect(FailureReason.safeParse("SOMETHING_ELSE").success).toBe(false);
  });
});
