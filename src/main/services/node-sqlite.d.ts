// @types/node 20 predates node:sqlite; Electron's bundled Node provides it.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    prepare(sql: string): { all(): Record<string, unknown>[] };
    close(): void;
  }
}
