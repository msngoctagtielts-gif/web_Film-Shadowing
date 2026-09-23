/**
 * build-site.mjs — gom những tệp thực sự cần để chạy website vào thư mục public/.
 *
 *   node tools/build-site.mjs
 *
 * Chỉ chép trang, mã nguồn và dữ liệu bài học. Không chép kiểm thử, công cụ,
 * tài liệu hay node_modules — những thứ đó không việc gì phải nằm trên máy chủ.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = "public";
const PAGES = ["index.html", "lesson.html", "studio.html", "progress.html", "teacher.html"];
const DIRS = ["assets", "data"];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
for (const f of PAGES) {
  fs.copyFileSync(f, path.join(OUT, f));
  count++;
}
for (const d of DIRS) {
  fs.cpSync(d, path.join(OUT, d), { recursive: true });
  count += fs.readdirSync(path.join(OUT, d), { recursive: true }).length;
}

// Trang 404 dùng lại trang chủ, để gõ sai đường dẫn không rơi vào màn trắng.
fs.copyFileSync("index.html", path.join(OUT, "404.html"));

const size = fs.readdirSync(OUT, { recursive: true })
  .map((f) => path.join(OUT, f))
  .filter((f) => fs.statSync(f).isFile())
  .reduce((s, f) => s + fs.statSync(f).size, 0);

console.log(`public/ — ${count} mục, ${(size / 1024).toFixed(0)} KB`);
