import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "./supabase-url";

describe("normalizeSupabaseUrl", () => {
  it("keeps a normal project URL as an origin", () => {
    expect(normalizeSupabaseUrl("https://abc123.supabase.co")).toBe("https://abc123.supabase.co");
  });

  it("strips accidental REST/Auth paths", () => {
    expect(normalizeSupabaseUrl("https://abc123.supabase.co/rest/v1")).toBe("https://abc123.supabase.co");
    expect(normalizeSupabaseUrl("https://abc123.supabase.co/auth/v1/token")).toBe("https://abc123.supabase.co");
  });

  it("derives project URL from a Supabase dashboard URL", () => {
    expect(normalizeSupabaseUrl("https://supabase.com/dashboard/project/peqfaiwioohgrsevoqju/settings/api")).toBe(
      "https://peqfaiwioohgrsevoqju.supabase.co",
    );
  });

  it("adds https when only the host is provided", () => {
    expect(normalizeSupabaseUrl("abc123.supabase.co")).toBe("https://abc123.supabase.co");
  });
});
