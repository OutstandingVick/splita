import type { Receipt, ReceiptPort } from "@splita/core";
import { type Auth, signInAnonymously } from "firebase/auth";
import { collection, doc, type Firestore, getDocs, limit, orderBy, query, setDoc, where } from "firebase/firestore/lite";
import { assertSafeReceipt, RECEIPT_FIELDS } from "./receipt-safety.js";

/** Signs in anonymously if needed; resolves to the uid receipts are stored under. */
export async function ensureAnonymousUser(auth: Auth): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  return (await signInAnonymously(auth)).user.uid;
}

/** Picks exactly the receipt fields back out of a Firestore document (drops anything else). */
function toReceipt(data: Record<string, unknown>): Receipt {
  const out: Record<string, unknown> = {};
  for (const k of RECEIPT_FIELDS) out[k] = data[k];
  return out as unknown as Receipt; // shape validated by assertSafeReceipt on write; rules enforce it server-side
}

/**
 * Hash-chained receipts at users/{uid}/receipts/{receiptId}. Create-only; rules deny update/delete.
 * Uses Firestore Lite: each write or query is one HTTPS request, with no streaming-channel
 * handshake on the first write, which keeps the Receipt stage well under a second.
 */
export class FirestoreReceipts implements ReceiptPort {
  /** Latest receipt per workspace, so the receipt stage can skip the head() round trip. */
  private readonly heads = new Map<string, Receipt>();

  constructor(
    private readonly db: Firestore,
    private readonly uid: () => Promise<string>,
  ) {}

  async append(receipt: Receipt): Promise<void> {
    assertSafeReceipt(receipt);
    const uid = await this.uid();
    await setDoc(doc(this.db, "users", uid, "receipts", receipt.id), receipt);
    this.heads.set(receipt.workspaceId, receipt);
  }

  /** This user's receipts, newest first (all workspaces, or one). */
  async list(workspaceId?: string, max = 500): Promise<Receipt[]> {
    const uid = await this.uid();
    const col = collection(this.db, "users", uid, "receipts");
    const q = workspaceId
      ? query(col, where("workspaceId", "==", workspaceId), orderBy("timestamp", "desc"), limit(max))
      : query(col, orderBy("timestamp", "desc"), limit(max));
    return (await getDocs(q)).docs.map((d) => toReceipt(d.data()));
  }

  async head(workspaceId: string): Promise<Receipt | undefined> {
    const cached = this.heads.get(workspaceId);
    if (cached) return cached;
    const uid = await this.uid();
    const q = query(
      collection(this.db, "users", uid, "receipts"),
      where("workspaceId", "==", workspaceId),
      orderBy("timestamp", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    const head = first ? toReceipt(first.data()) : undefined;
    if (head) this.heads.set(workspaceId, head);
    return head;
  }
}
