/**
 * run.mjs — chạy toàn bộ kiểm thử: `npm test`
 *
 * Chỉ kiểm thử phần lõi chạy được trong Node (chuẩn hoá văn bản, chấm điểm,
 * phân tích âm thanh, lưu tiến độ, dữ liệu bài học). Phần cần trình duyệt thật
 * (micro, nhận dạng giọng nói, trình phát YouTube) được kiểm bằng danh sách
 * duyệt tay trong docs/07-kiem-thu-va-duyet.md.
 */

import { runAll } from "./harness.mjs";

await import("./text.test.mjs");
await import("./scoring.test.mjs");
await import("./recorder.test.mjs");
await import("./store.test.mjs");
await import("./lesson-data.test.mjs");
await import("./analytics.test.mjs");
await import("./exercises.test.mjs");
await import("./suggest.test.mjs");
await import("./karaoke.test.mjs");

const ok = await runAll();
process.exit(ok ? 0 : 1);
