/* Minimal Cloudflare D1 binding on top of node:sqlite, with the same method shapes the Worker uses:
   prepare(sql).bind(...).first() / all() / run(), and batch([...]) as one transaction.
   It also counts rows read and written, like D1's billing meter, so tests can prove we stay inside the free plan. */
import { DatabaseSync } from 'node:sqlite';

export function makeD1() {
  const db = new DatabaseSync(':memory:');
  const meter = { reads: 0, writes: 0, queries: 0 };
  const exec = (sql, args, mode) => {
    meter.queries++;
    for (const a of args) if (a !== null && !['string', 'number', 'bigint'].includes(typeof a) && !(a instanceof Uint8Array))
      throw new TypeError(`D1_TYPE_ERROR: Type '${typeof a}' not supported for value '${a}'`);   /* real D1 rejects undefined/objects the same way */
    const st = db.prepare(sql);
    const isRead = /^\s*(SELECT|WITH)/i.test(sql), returning = /\bRETURNING\b/i.test(sql);
    if (isRead || returning) {
      const rows = st.all(...args);
      if (isRead) meter.reads += Math.max(rows.length, 1); else meter.writes += rows.length;
      return mode === 'first' ? (rows[0] ?? null) : { results: rows, success: true, meta: { changes: returning ? rows.length : 0 } };
    }
    const r = st.run(...args);
    meter.writes += Number(r.changes || 0);
    return mode === 'first' ? null : { results: [], success: true, meta: { changes: Number(r.changes || 0), last_row_id: Number(r.lastInsertRowid || 0) } };
  };
  const stmt = (sql, args = []) => ({
    sql, args,
    bind: (...a) => stmt(sql, a),
    first: async () => exec(sql, args, 'first'),
    all: async () => exec(sql, args, 'all'),
    run: async () => exec(sql, args, 'run'),
  });
  return {
    meter, raw: db,
    prepare: sql => stmt(sql),
    batch: async list => {
      db.exec('BEGIN');
      try { const out = list.map(s => exec(s.sql, s.args, 'all')); db.exec('COMMIT'); return out; }
      catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
