import { describe, it, expect } from "vitest";
import { redactText } from "../src/pipeline/redact.js";

describe("Secrets Redaction Engine", () => {
  it("redacts AWS access keys", () => {
    const input = "Deploying with key AKIAIOSFODNN7EXAMPLE to us-east-1";
    const result = redactText(input);
    expect(result.text).toBe("Deploying with key [REDACTED:aws_key] to us-east-1");
    expect(result.redactionsCount).toBe(1);
  });

  it("redacts GitHub tokens (ghp_ and github_pat_)", () => {
    const input1 = "Cloning with token ghp_1234567890abcdefghijklmnopqrstuvwxyzAB";
    const result1 = redactText(input1);
    expect(result1.text).toBe("Cloning with token [REDACTED:github_token]");

    const input2 = "Using github_pat_11A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5I6J7K8L9M0";
    const result2 = redactText(input2);
    expect(result2.text).toBe("Using [REDACTED:github_token]");
  });

  it("redacts Bearer tokens preserving the Bearer keyword", () => {
    const input = "Authorization: Bearer secret_token_value.123456";
    const result = redactText(input);
    expect(result.text).toBe("Authorization: Bearer [REDACTED:bearer_token]");
    expect(result.redactionsCount).toBe(1);
  });

  it("redacts multi-line private key blocks", () => {
    const input = `Checking SSH config...
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----
Connection established`;

    const result = redactText(input);
    expect(result.text).toContain("[REDACTED:private_key]");
    expect(result.text).not.toContain("MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz");
    expect(result.redactionsCount).toBe(1);
  });

  it("redacts JWT strings", () => {
    const input = "User token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const result = redactText(input);
    expect(result.text).toBe("User token: [REDACTED:jwt]");
    expect(result.redactionsCount).toBe(1);
  });

  it("redacts credentials inside URLs", () => {
    const input = "git clone https://username:superSecretPassword123@github.com/org/repo.git";
    const result = redactText(input);
    expect(result.text).toBe("git clone https://[REDACTED:credentials]@github.com/org/repo.git");
    expect(result.redactionsCount).toBe(1);
  });

  it("redacts KEY=VALUE secret patterns", () => {
    const input = "Setting DB_PASSWORD=my_super_secret_password and STRIPE_API_KEY=sk_test_12345 in env";
    const result = redactText(input);
    expect(result.text).toContain("DB_PASSWORD=[REDACTED:secret]");
    expect(result.text).toContain("STRIPE_API_KEY=[REDACTED:secret]");
    expect(result.text).not.toContain("my_super_secret_password");
  });

  it("redacts project env var values >= 6 characters, leaves shorter alone", () => {
    const projectEnvVarValues = [
      "production_database_secret_123", // length >= 6
      "dev", // length 3 (< 6, should not be redacted)
    ];

    const input = "Connecting to dev database using production_database_secret_123 in cluster";
    const result = redactText(input, { projectEnvVarValues });
    expect(result.text).toBe("Connecting to dev database using [REDACTED:env_var] in cluster");
    expect(result.redactionsCount).toBe(1);
  });

  it("is idempotent: running twice does not change text or increment count", () => {
    const input = "Deploying with AKIAIOSFODNN7EXAMPLE and https://user:pass@host.com and DB_SECRET=foo12345";
    const pass1 = redactText(input);
    const pass2 = redactText(pass1.text);

    expect(pass2.text).toBe(pass1.text);
    expect(pass2.redactionsCount).toBe(0);
  });
});
