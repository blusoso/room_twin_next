// types/node-sqlite.d.ts
//
// ⭐ @types/node@20 ยังไม่มี typings ของโมดูล `node:sqlite` (built-in ตั้งแต่ Node 22.5)
//    repo นี้ใช้ SQLite ผ่านโมดูล built-in เพื่อ "ไม่เพิ่ม dependency" จึงประกาศ type
//    เท่าที่ใช้จริง (DatabaseSync / StatementSync) ไว้ที่นี่
//
//    ถ้าอนาคตอัปเกรด @types/node >= 22 → ลบไฟล์นี้ได้ทันที (type จะมาจาก @types/node เอง)

declare module "node:sqlite" {
  export interface StatementSyncResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export class StatementSync {
    run(...params: unknown[]): StatementSyncResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(
      path: string,
      options?: { open?: boolean; readOnly?: boolean },
    );
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
