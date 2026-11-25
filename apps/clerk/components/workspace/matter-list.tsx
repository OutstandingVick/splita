"use client";

import { type FormEvent, useState } from "react";
import { DEMO_MATTER_ID, type Matter } from "@/lib/matters";

export function MatterList({
  matters,
  selectedId,
  onSelect,
  onCreate,
}: {
  matters: readonly Matter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    onCreate(title);
    setTitle("");
    setAdding(false);
  }

  return (
    <nav aria-label="Matters" className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Matters</h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="rounded-md px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50"
        >
          + New matter
        </button>
      </div>
      {adding && (
        <form onSubmit={submit} className="flex gap-2">
          <input
            autoFocus
            aria-label="Matter name"
            placeholder="e.g. Bello tenancy"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md bg-stone-900 px-3 text-xs font-medium text-white">
            Add
          </button>
        </form>
      )}
      <ul className="space-y-1 overflow-y-auto">
        {matters.map((m) => {
          const active = m.id === selectedId;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                aria-current={active ? "true" : undefined}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-white font-medium shadow-sm ring-1 ring-stone-200" : "text-stone-700 hover:bg-white/70"}`}
              >
                <span className="block truncate">{m.title}</span>
                <span className="mt-0.5 block text-xs font-normal text-stone-500">
                  {m.id === DEMO_MATTER_ID ? "Demo matter" : `Updated ${new Date(m.updatedAt).toLocaleDateString()}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto text-xs leading-relaxed text-stone-500">
        Matters and their identity vaults are stored only in this browser. Each matter has its own vault.
      </p>
    </nav>
  );
}
