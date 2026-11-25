import type { Entity, VaultPort } from "@splita/core";

export const VAULT_DB = "splita-vault";

const storeName = (workspaceId: string) => `ws:${workspaceId}`;

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/**
 * Local-only VaultPort on IndexedDB. One database, one object store per workspace (created on
 * first write by bumping the DB version). Nothing here is ever synced or sent anywhere.
 */
export class IndexedDBVault implements VaultPort {
  constructor(
    private readonly idb: IDBFactory = globalThis.indexedDB,
    private readonly dbName: string = VAULT_DB,
  ) {}

  async get(workspaceId: string, entityId: string): Promise<Entity | undefined> {
    return this.read(workspaceId, (s) => s.get(entityId) as IDBRequest<Entity | undefined>, undefined);
  }

  async list(workspaceId: string): Promise<Entity[]> {
    return this.read(workspaceId, (s) => s.getAll() as IDBRequest<Entity[]>, []);
  }

  async put(workspaceId: string, entity: Entity): Promise<void> {
    const db = await this.open(storeName(workspaceId));
    try {
      const tx = db.transaction(storeName(workspaceId), "readwrite");
      tx.objectStore(storeName(workspaceId)).put(entity);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      });
    } finally {
      db.close();
    }
  }

  /** Forget every entity (and so every placeholder mapping) for a workspace. */
  async clearWorkspace(workspaceId: string): Promise<void> {
    const db = await this.open();
    try {
      if (!db.objectStoreNames.contains(storeName(workspaceId))) return;
      await promisify(db.transaction(storeName(workspaceId), "readwrite").objectStore(storeName(workspaceId)).clear());
    } finally {
      db.close();
    }
  }

  private async read<T>(workspaceId: string, op: (s: IDBObjectStore) => IDBRequest<T>, empty: T): Promise<T> {
    const db = await this.open();
    try {
      if (!db.objectStoreNames.contains(storeName(workspaceId))) return empty;
      return await promisify(op(db.transaction(storeName(workspaceId), "readonly").objectStore(storeName(workspaceId))));
    } finally {
      db.close();
    }
  }

  /** Opens the DB; if `ensureStore` is missing, reopens at version+1 and creates it. */
  private async open(ensureStore?: string): Promise<IDBDatabase> {
    const db = await this.openAt();
    if (!ensureStore || db.objectStoreNames.contains(ensureStore)) return db;
    const next = db.version + 1;
    db.close();
    return this.openAt(next, (upgraded) => {
      if (!upgraded.objectStoreNames.contains(ensureStore)) upgraded.createObjectStore(ensureStore, { keyPath: "id" });
    });
  }

  private openAt(version?: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = version === undefined ? this.idb.open(this.dbName) : this.idb.open(this.dbName, version);
      req.onupgradeneeded = () => upgrade?.(req.result);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close(); // let other tabs add workspaces
        resolve(db);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
      req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
    });
  }
}
