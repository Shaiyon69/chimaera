// @types/node 20 predates node:sqlite; Electron's bundled Node provides it.
declare module "node:sqlite" {
  type SQLValue = string | number | bigint | null | Uint8Array;

  export interface StatementSync {
    run(...params: SQLValue[]): {
      changes: number | bigint;
      lastInsertRowid: number | bigint;
    };
    get(...params: SQLValue[]): Record<string, unknown> | undefined;
    all(...params: SQLValue[]): Record<string, unknown>[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
