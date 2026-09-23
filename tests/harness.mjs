/**
 * harness.mjs — bộ kiểm thử tối giản, không phụ thuộc thư viện ngoài.
 * Lý do không dùng Jest/Vitest: dự án là web tĩnh, không có bước build.
 * Thêm một bộ công cụ chỉ để chạy kiểm thử là thêm thứ phải bảo trì.
 */

const state = { suites: [], current: null, pass: 0, fail: 0, failures: [] };

export function describe(name, fn) {
  state.current = { name, tests: [] };
  state.suites.push(state.current);
  fn();
  state.current = null;
}

export function it(name, fn) {
  if (!state.current) throw new Error("it() phải nằm trong describe()");
  state.current.tests.push({ name, fn });
}

export function expect(actual) {
  return {
    toBe(want) {
      if (actual !== want) throw new Error(`mong đợi ${JSON.stringify(want)}, nhận ${JSON.stringify(actual)}`);
    },
    toEqual(want) {
      const a = JSON.stringify(actual), b = JSON.stringify(want);
      if (a !== b) throw new Error(`mong đợi ${b}, nhận ${a}`);
    },
    toBeCloseTo(want, tolerance = 0.01) {
      if (Math.abs(actual - want) > tolerance) throw new Error(`mong đợi ≈${want} (±${tolerance}), nhận ${actual}`);
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`mong đợi > ${n}, nhận ${actual}`);
    },
    toBeGreaterThanOrEqual(n) {
      if (!(actual >= n)) throw new Error(`mong đợi >= ${n}, nhận ${actual}`);
    },
    toBeLessThan(n) {
      if (!(actual < n)) throw new Error(`mong đợi < ${n}, nhận ${actual}`);
    },
    toBeLessThanOrEqual(n) {
      if (!(actual <= n)) throw new Error(`mong đợi <= ${n}, nhận ${actual}`);
    },
    toBeTruthy() { if (!actual) throw new Error(`mong đợi giá trị đúng, nhận ${JSON.stringify(actual)}`); },
    toBeFalsy() { if (actual) throw new Error(`mong đợi giá trị sai, nhận ${JSON.stringify(actual)}`); },
    toBeNull() { if (actual !== null) throw new Error(`mong đợi null, nhận ${JSON.stringify(actual)}`); },
    toContain(sub) {
      const ok = Array.isArray(actual) ? actual.includes(sub) : String(actual).includes(sub);
      if (!ok) throw new Error(`mong đợi có chứa ${JSON.stringify(sub)} trong ${JSON.stringify(actual)}`);
    },
  };
}

export async function runAll() {
  for (const suite of state.suites) {
    console.log(`\n\x1b[1m${suite.name}\x1b[0m`);
    for (const t of suite.tests) {
      try {
        await t.fn();
        state.pass++;
        console.log(`  \x1b[32m✓\x1b[0m ${t.name}`);
      } catch (err) {
        state.fail++;
        state.failures.push({ suite: suite.name, test: t.name, err });
        console.log(`  \x1b[31m✗ ${t.name}\x1b[0m`);
        console.log(`      ${err.message}`);
      }
    }
  }
  console.log(`\n${state.fail === 0 ? "\x1b[32m" : "\x1b[31m"}${state.pass} đạt, ${state.fail} không đạt\x1b[0m`);
  return state.fail === 0;
}

/** Giả lập localStorage để kiểm thử các module lưu trữ. */
export function stubLocalStorage() {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
    get length() { return mem.size; },
  };
  return () => mem.clear();
}
