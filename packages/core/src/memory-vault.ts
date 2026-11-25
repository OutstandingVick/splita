import type { VaultPort } from "./ports.js";
import type { Entity } from "./types.js";

const clone = (e: Entity): Entity => ({ ...e, aliases: [...e.aliases] });

/** In-memory VaultPort for tests and server-free runs. Returns copies, never live references. */
export class InMemoryVault implements VaultPort {
  private readonly store = new Map<string, Map<string, Entity>>();

  async get(workspaceId: string, entityId: string): Promise<Entity | undefined> {
    const e = this.store.get(workspaceId)?.get(entityId);
    return e ? clone(e) : undefined;
  }

  async put(workspaceId: string, entity: Entity): Promise<void> {
    let ws = this.store.get(workspaceId);
    if (!ws) {
      ws = new Map();
      this.store.set(workspaceId, ws);
    }
    ws.set(entity.id, clone(entity));
  }

  async list(workspaceId: string): Promise<Entity[]> {
    return [...(this.store.get(workspaceId)?.values() ?? [])].map(clone);
  }
}
