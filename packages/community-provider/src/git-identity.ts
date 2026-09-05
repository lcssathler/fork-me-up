import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const maximumGitIdentityBytes = 512;

export function digestGitIdentity(name: string, email: string): string | undefined {
  if (typeof name !== "string" || typeof email !== "string") return undefined;
  if (
    name.length === 0 ||
    email.length === 0 ||
    !name.isWellFormed() ||
    !email.isWellFormed() ||
    Buffer.byteLength(name, "utf8") > maximumGitIdentityBytes ||
    Buffer.byteLength(email, "utf8") > maximumGitIdentityBytes ||
    containsUnsafeControl(name) ||
    containsUnsafeControl(email) ||
    /[<>]/u.test(email)
  ) {
    return undefined;
  }
  const normalizedName = normalizeGitIdentityPart(name);
  const normalizedEmail = normalizeGitIdentityPart(email);
  if (
    normalizedName.length === 0 ||
    normalizedEmail.length === 0 ||
    Buffer.byteLength(normalizedName, "utf8") > maximumGitIdentityBytes ||
    Buffer.byteLength(normalizedEmail, "utf8") > maximumGitIdentityBytes ||
    containsUnsafeControl(normalizedName) ||
    containsUnsafeControl(normalizedEmail)
  ) {
    return undefined;
  }
  return createHash("sha256")
    .update(normalizedName, "utf8")
    .update("\0", "utf8")
    .update(normalizedEmail, "utf8")
    .digest("hex");
}

function normalizeGitIdentityPart(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function containsUnsafeControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x1f || codeUnit === 0x7f) return true;
  }
  return false;
}
