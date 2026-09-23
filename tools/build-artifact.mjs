/**
 * build-artifact.mjs — gói bảng theo dõi thành MỘT tệp HTML tự chứa để xuất bản
 * lên web cho cô Ngọc xem thử.
 *
 *   node tools/build-artifact.mjs   →  dist/bang-theo-doi-lop.html
 *
 * Bản xuất bản không có máy chủ và không đọc được tệp bên ngoài, nên:
 *  · CSS và JS được nhúng thẳng vào tệp;
 *  · dữ liệu bài học và lớp mẫu nhúng sẵn, phục vụ qua một lớp `fetch` giả,
 *    nhờ vậy mã nguồn của trang KHÔNG phải sửa gì so với bản chạy trong dự án.
 *
 * Nguồn sự thật vẫn là các tệp trong dự án — tệp gói ra là sản phẩm phái sinh,
 * không sửa tay.
 */

import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");

/** Bỏ dòng import và từ khoá export để gộp nhiều mô-đun vào một phạm vi. */
function flatten(src) {
  return src
    .replace(/^import\s[\s\S]*?;\s*$/gm, "")
    .replace(/^export\s+(?=(const|let|var|function|async|class))/gm, "");
}

/** Bắt lỗi trùng tên ở cấp cao nhất trước khi gộp — gộp nhầm thì trang trắng. */
function checkCollisions(modules) {
  const seen = new Map();
  const dup = [];
  for (const [name, src] of modules) {
    for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      const id = m[1];
      if (seen.has(id)) dup.push(`${id} (${seen.get(id)} và ${name})`);
      else seen.set(id, name);
    }
  }
  if (dup.length) {
    console.error("Trùng tên ở cấp cao nhất, không gộp được:\n  " + dup.join("\n  "));
    process.exit(1);
  }
}

const MODULES = [
  ["text.js", "assets/js/core/text.js"],
  ["scoring.js", "assets/js/core/scoring.js"],
  ["lesson-loader.js", "assets/js/core/lesson-loader.js"],
  ["analytics.js", "assets/js/core/analytics.js"],
  ["components.js", "assets/js/ui/components.js"],
  ["charts.js", "assets/js/ui/charts.js"],
  ["teacher.js", "assets/js/pages/teacher.js"],
];

const sources = MODULES.map(([name, path]) => [name, read(path)]);
checkCollisions(sources);

/* --- dữ liệu nhúng ------------------------------------------------------- */

const courses = JSON.parse(read("data/courses.json"));
const lessonFiles = fs.readdirSync("data/lessons").filter((f) => f.endsWith(".json"));
const DATA = { "data/courses.json": courses, "data/demo-lop-hoc.json": JSON.parse(read("data/demo-lop-hoc.json")) };
for (const f of lessonFiles) DATA[`data/lessons/${f}`] = JSON.parse(read(`data/lessons/${f}`));

/* --- CSS ----------------------------------------------------------------- */

let css = read("assets/css/app.css")
  // Khung trang xuất bản đã tự lo chiều cao và lề an toàn của điện thoại.
  .replace(/html,\s*body\s*\{\s*height:\s*100%;\s*\}/, "")
  .replace(/^\s*body\s*\{\s*margin:\s*0;/m, "body {");

/* --- phần thân trang ----------------------------------------------------- */

const page = read("teacher.html");
let body = page.slice(page.indexOf("<body>") + 6, page.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .trim();

/* --- thanh điều hướng: bản xem thử chỉ có một trang ---------------------- */

const navReplacement = `
    <nav class="appbar__nav">
      <span class="tag tag--gold">Bản xem thử</span>
      <button id="themeToggle" title="Đổi nền sáng/tối" aria-label="Đổi nền sáng/tối">◐</button>
    </nav>`;
const teacherIdx = sources.findIndex(([n]) => n === "components.js");
sources[teacherIdx][1] = sources[teacherIdx][1].replace(
  /\n\s*<nav class="appbar__nav">[\s\S]*?<\/nav>/,
  navReplacement,
);

const js = sources.map(([name, src]) => `/* ===== ${name} ===== */\n${flatten(src)}`).join("\n\n");

const out = `<meta charset="utf-8">
<title>Bảng theo dõi lớp</title>
<style>
${css}
/* Bản xem thử: khung xuất bản tự lo lề, trang chỉ cần nền của chính nó. */
body { background: var(--canvas); color: var(--ink); }
</style>

${body}

<script type="module">
/* Dữ liệu nhúng sẵn: bản xem thử không đọc được tệp rời, nên một lớp fetch
   giả trả về đúng những đường dẫn mà trang yêu cầu. Nhờ vậy mã nguồn của
   trang giống hệt bản chạy trong dự án. */
const EMBEDDED = ${JSON.stringify(DATA)};
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const key = String(input && input.url ? input.url : input);
  const hit = EMBEDDED[key];
  if (hit) {
    return Promise.resolve(new Response(JSON.stringify(hit), {
      status: 200, headers: { "Content-Type": "application/json" },
    }));
  }
  return realFetch(input, init);
};

${js}
</script>`;

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/bang-theo-doi-lop.html", out);
console.log(`dist/bang-theo-doi-lop.html — ${(out.length / 1024).toFixed(0)} KB, ${sources.length} mô-đun, ${Object.keys(DATA).length} tệp dữ liệu nhúng`);
