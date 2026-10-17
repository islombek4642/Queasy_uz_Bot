// tgcloud/lib/turso_client.js
// Ultra-fast HTTP Pipeline client for Turso Cloud (LibSQL)
// Zero external npm dependencies - fully compatible with Telegram Cloud runtime

import { fetch as sdkFetch } from 'sdk';
import { CONFIG } from './constants/config.js';

const fetchFn = typeof sdkFetch === 'function' ? sdkFetch : (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);

function formatArg(val) {
  if (val === null || val === undefined) return { type: 'null' };
  if (typeof val === 'number') {
    return { type: Number.isInteger(val) ? 'integer' : 'float', value: String(val) };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  return { type: 'text', value: String(val) };
}

function parseRow(cols, rowCells) {
  const obj = {};
  for (let i = 0; i < cols.length; i++) {
    const colName = cols[i].name;
    const cell = rowCells[i];
    if (!cell || cell.type === 'null') {
      obj[colName] = null;
    } else if (cell.type === 'integer') {
      obj[colName] = Number(cell.value);
    } else if (cell.type === 'float') {
      obj[colName] = parseFloat(cell.value);
    } else {
      obj[colName] = cell.value;
    }
  }
  return obj;
}

export class TursoClient {
  constructor(url, token) {
    this.url = (url || CONFIG.TURSO?.URL || '').replace(/^turso:\/\//, 'https://');
    this.token = token || CONFIG.TURSO?.TOKEN || '';
  }

  async pipeline(requests) {
    const fn = fetchFn || (typeof sdkFetch === 'function' ? sdkFetch : (typeof globalThis.fetch === 'function' ? globalThis.fetch : null));
    if (!fn) throw new Error('Fetch function not available in runtime');
    const res = await fn(`${this.url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [...requests, { type: 'close' }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Turso HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    for (const r of data.results || []) {
      if (r.type === 'error') {
        throw new Error(`Turso Error: ${r.error?.message}`);
      }
    }
    return data.results || [];
  }

  async all(sql, params = []) {
    const results = await this.pipeline([{
      type: 'execute',
      stmt: {
        sql,
        args: params.map(formatArg)
      }
    }]);

    const res = results[0]?.response?.result;
    if (!res || !res.cols || !res.rows) return [];
    return res.rows.map(r => parseRow(res.cols, r));
  }

  async get(sql, params = []) {
    const rows = await this.all(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async run(sql, params = []) {
    const results = await this.pipeline([{
      type: 'execute',
      stmt: {
        sql,
        args: params.map(formatArg)
      }
    }]);

    const res = results[0]?.response?.result;
    return {
      rowsAffected: res?.affected_row_count || 0,
      lastInsertRowid: res?.last_insert_rowid ? Number(res.last_insert_rowid) : null
    };
  }

  async batch(statements) {
    const requests = statements.map(s => ({
      type: 'execute',
      stmt: typeof s === 'string' ? { sql: s } : { sql: s.sql, args: (s.params || []).map(formatArg) }
    }));
    const rawResults = await this.pipeline(requests);
    return rawResults.filter(r => r.response?.type !== 'close').map(r => {
      if (r.type === 'ok' && r.response?.type === 'execute') {
        const res = r.response.result;
        return {
          type: 'ok',
          rows: res?.rows && res?.cols ? res.rows.map(row => parseRow(res.cols, row)) : [],
          rowsAffected: res?.affected_row_count || 0,
          lastInsertRowid: res?.last_insert_rowid ? Number(res.last_insert_rowid) : null,
        };
      }
      return r;
    });
  }
}

export const turso = new TursoClient(CONFIG.TURSO?.URL, CONFIG.TURSO?.TOKEN);
export default turso;
