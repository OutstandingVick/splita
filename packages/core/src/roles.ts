export const ROLES = ["employer", "employee", "landlord", "tenant", "claimant", "defendant", "client"] as const;
export type Role = (typeof ROLES)[number];

const R = ROLES.join("|");
/** "X (the Employer)", "X (hereinafter referred to as "the Tenant")" */
const AFTER_PAREN = new RegExp(
  `^\\s*\\(\\s*(?:hereinafter\\s+(?:referred\\s+to\\s+as|called)\\s+)?["“']?(?:the\\s+)?["“']?(${R})["”']?\\s*\\)`,
  "i",
);
/** "X, the Employer" */
const AFTER_APPOSITIVE = new RegExp(`^,\\s*(?:the|our|my)\\s+(${R})\\b`, "i");
/** "the Tenant, X" / "my client X" / "Landlord: X" */
const BEFORE = new RegExp(`\\b(?:the|my|our|your|his|her|their)\\s+(${R})\\s*[,:]?\\s*$`, "i");

const toRole = (s: string | undefined): Role | undefined => ROLES.find((r) => r === s?.toLowerCase());

/** Role stated immediately around a mention, or undefined. Strong local patterns only. */
export function detectRole(text: string, span: { start: number; end: number }): Role | undefined {
  const after = text.slice(span.end, span.end + 80);
  const before = text.slice(Math.max(0, span.start - 40), span.start);
  return (
    toRole(AFTER_PAREN.exec(after)?.[1]) ??
    toRole(AFTER_APPOSITIVE.exec(after)?.[1]) ??
    toRole(BEFORE.exec(before)?.[1])
  );
}
