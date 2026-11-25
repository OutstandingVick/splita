import { restore } from "./restore.js";
import type { Mapping } from "./types.js";

/**
 * The part of a streaming cloud answer that is safe to restore now: everything except a
 * trailing run that could still be the start of a placeholder ("EMPLOY", "EMPLOYEE_", even a
 * complete "EMPLOYEE_1" that might become "EMPLOYEE_12"). That run is held back until more text
 * arrives; the final, complete answer is always restored in full.
 */
export function safeStreamPrefix(text: string): string {
  const m = /[A-Z][A-Z0-9_]*$/.exec(text);
  return m ? text.slice(0, m.index) : text;
}

/** Restores the safe prefix of a partial cloud answer on the device. */
export function restorePartial(partial: string, mapping: Mapping): string {
  return restore(safeStreamPrefix(partial), mapping);
}
