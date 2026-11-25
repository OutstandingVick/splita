import type { Stage } from "@splita/core";

export interface FailureExplanation {
  title: string;
  body: string;
  /** What, if anything, reached the cloud. */
  sent: "nothing" | "anonymized-only";
  /** Safe technical detail (error name/message never contains document text). */
  detail: string;
}

/**
 * Fail-closed errors in plain language. Before the cloud stage nothing was sent; at or after it,
 * only the anonymized payload could have been, and no answer is shown without a receipt.
 */
export function explainFailure(stage: Stage, error: { name?: string; message: string }): FailureExplanation {
  const detail = `${error.name && error.name !== "Error" ? `${error.name}: ` : ""}${error.message}`.slice(0, 400);
  switch (stage) {
    case "detect":
    case "resolve":
    case "pseudonymize":
      if (error.name === "IdentityLeakError") {
        return {
          title: "Nothing was sent.",
          body: "Splita found a real identity still present after anonymization, so it stopped before contacting the cloud. Try again, or check the document for an unusual spelling of a name.",
          sent: "nothing",
          detail,
        };
      }
      return {
        title: "Nothing was sent.",
        body: "Identity detection on this device didn't finish, so Splita stopped before anything left the device.",
        sent: "nothing",
        detail,
      };
    case "reason":
      return {
        title: "The cloud model didn't answer.",
        body: "Splita retried and tried a backup model, then stopped. At most the anonymized text (stand-ins only, no real names) reached the cloud. Nothing was restored and no receipt was written. Please try again in a moment.",
        sent: "anonymized-only",
        detail,
      };
    case "restore":
      return {
        title: "The answer couldn't be restored.",
        body: "The cloud answered, but Splita couldn't put the real values back on this device, so it isn't shown. Only stand-ins left the device.",
        sent: "anonymized-only",
        detail,
      };
    case "receipt":
      return {
        title: "The receipt couldn't be saved, so the answer is withheld.",
        body: "Every answer must have a receipt proving what was sent. Saving it failed, so Splita isn't showing the answer. Only stand-ins left the device. Check your connection and try again.",
        sent: "anonymized-only",
        detail,
      };
  }
}
