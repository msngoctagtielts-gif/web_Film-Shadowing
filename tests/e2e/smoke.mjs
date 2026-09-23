/**
 * smoke.mjs — kiểm thử đầu-cuối trên Chromium thật.
 *
 * Chạy: node tests/e2e/smoke.mjs   (cần máy chủ tĩnh ở http://localhost:4173)
 *
 * Kiểm những thứ mà kiểm thử Node không chạm được: trang có dựng lên không,
 * bảng kịch bản có bấm được không, micro có thu được không, luồng tự đánh giá
 * có ghi điểm vào tiến độ không. Micro dùng thiết bị giả của Chromium.
 */

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const OUT = "tests/e2e/screenshots";
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const results = [];

async function check(name, fn) {
  try {
    await fn();
    pass++; results.push(["✓", name]);
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    fail++; results.push(["✗", name + " — " + err.message]);
    console.log(`  \x1b[31m✗ ${name}\x1b[0m\n      ${err.message}`);
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const ctx = await browser.newContext({
  permissions: ["microphone"],
  viewport: { width: 1360, height: 900 },
});
const page = await ctx.newPage();

/** Bất kỳ lỗi JavaScript nào trên trang cũng là lỗi cần sửa. */
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });

console.log("\n\x1b[1mTrang chủ\x1b[0m");
await page.goto(`${BASE}/index.html`, { waitUntil: "networkidle" });

await check("trang chủ dựng được và hiện danh mục", async () => {
  await page.waitForSelector(".lesson-card", { timeout: 8000 });
  const n = await page.locator(".lesson-card").count();
  assert(n >= 2, `mong đợi >= 2 thẻ bài, thấy ${n}`);
});
await check("không có lỗi JavaScript ở trang chủ", () => {
  assert(pageErrors.length === 0, pageErrors.join(" | "));
});
await page.screenshot({ path: `${OUT}/01-trang-chu.png`, fullPage: true });

console.log("\n\x1b[1mMàn học\x1b[0m");
pageErrors.length = 0;
await page.goto(`${BASE}/lesson.html?lesson=demo-doan-thoai-ga-tau`, { waitUntil: "networkidle" });

await check("bài học nạp được, hiện tiêu đề", async () => {
  await page.waitForSelector("#lessonRoot:not([hidden])", { timeout: 8000 });
  const t = await page.locator("#lsTitle").textContent();
  assert(t.includes("Chuyến tàu"), `tiêu đề lạ: ${t}`);
});

await check("thẻ từ mới tự mở ở lần học đầu", async () => {
  await page.waitForSelector(".modal .flash__term", { timeout: 6000 });
  const term = await page.locator(".flash__term").first().textContent();
  assert(term.trim().length > 0, "thẻ từ vựng không có từ");
});

await check("thẻ từ mới có hình minh hoạ", async () => {
  const has = await page.locator(".flash__art svg, .flash__art img").count();
  assert(has > 0, "thẻ không có hình");
});
await page.screenshot({ path: `${OUT}/02-the-tu-moi.png` });

await check("đi hết bộ thẻ thì hộp thoại tự đóng", async () => {
  for (let i = 0; i < 8; i++) {
    const btn = page.locator('.modal [data-grade="good"]');
    if (!(await btn.count())) break;
    await btn.click();
    await page.waitForTimeout(120);
  }
  assert((await page.locator(".modal").count()) === 0, "hộp thoại từ vựng chưa đóng");
});

await check("bảng kịch bản hiện đủ 12 câu", async () => {
  const n = await page.locator(".script-line").count();
  assert(n === 12, `mong đợi 12 câu, thấy ${n}`);
});

await check("cụm trọng tâm được tô sáng trong kịch bản", async () => {
  const n = await page.locator(".script-line .kw").count();
  assert(n >= 4, `mong đợi >= 4 cụm được tô, thấy ${n}`);
});

await check("bấm một câu thì phòng thu nhận câu đó", async () => {
  await page.locator(".script-line").nth(1).click();
  await page.waitForTimeout(400);
  const txt = await page.locator("#curText").textContent();
  assert(txt.includes("delayed"), `phòng thu đang hiện: ${txt}`);
});

await check("khung nhắc cụm trọng tâm hiện bên cạnh, không phủ lên trình phát", async () => {
  await page.locator(".script-line").first().click();
  await page.waitForTimeout(300);
  const cueVisible = await page.locator("#cueCard").isVisible();
  assert(cueVisible, "khung nhắc không hiện");
  const cue = await page.locator("#cueCard").boundingBox();
  const player = await page.locator(".player-box").boundingBox();
  const overlaps = !(cue.x + cue.width <= player.x || player.x + player.width <= cue.x);
  assert(!overlaps, "khung nhắc chồng lên vùng trình phát");
});

await check("có đường lùi khi học viên không muốn gửi giọng đi", async () => {
  const btn = page.locator("#btnAsrNo");
  assert(await btn.count(), "không thấy lựa chọn tự đánh giá");
  await btn.click();
  await page.waitForTimeout(250);
});
await page.screenshot({ path: `${OUT}/03-man-hoc.png`, fullPage: true });

await check("thu âm được và hiện lại bản thu", async () => {
  await page.locator("#btnRec").click();
  await page.waitForTimeout(1600);
  await page.locator("#btnRec").click();
  await page.waitForSelector("#playbackBox:not([hidden])", { timeout: 8000 });
  const src = await page.locator("#myAudio").getAttribute("src");
  assert(src && src.startsWith("blob:"), `bản thu không hợp lệ: ${src}`);
});

await check("luồng tự đánh giá ghi điểm vào tiến độ", async () => {
  await page.waitForSelector("[data-self]", { timeout: 5000 });
  await page.locator('[data-self="80"]').click();
  await page.waitForTimeout(400);
  const counts = await page.locator("#lsCounts").textContent();
  assert(/1\/12/.test(counts), `tiến độ chưa cập nhật: ${counts}`);
});
await page.screenshot({ path: `${OUT}/04-sau-khi-thu.png`, fullPage: true });

await check("đổi vòng luyện sang Kiểm tra thì ẩn được chữ", async () => {
  await page.locator('[data-step="test"]').click();
  await page.locator("#chkHide").check();
  await page.waitForTimeout(300);
  const hidden = await page.locator('.script-line[data-hide-text="true"]').count();
  assert(hidden === 12, `mong đợi 12 câu bị ẩn chữ, thấy ${hidden}`);
});

await check("không có lỗi JavaScript trong cả màn học", () => {
  const real = pageErrors.filter((e) => !/favicon|net::ERR_/.test(e));
  assert(real.length === 0, real.join(" | "));
});

await check("mở được bài tập sinh từ chính kịch bản", async () => {
  await page.locator("#btnQuiz").click();
  await page.waitForSelector(".modal .ex-options, .modal .ex-tiles", { timeout: 6000 });
  const q = await page.locator(".modal [data-role=\"quiz\"]").textContent();
  assert(q.length > 20, "màn bài tập trống");
});

await check("chọn đáp án thì chấm ngay và giải thích", async () => {
  const opts = page.locator(".modal .ex-option");
  if (await opts.count()) {
    await opts.first().click();
    await page.locator('.modal [data-role="next"]').click();
    await page.waitForTimeout(400);
    const fb = await page.locator('.modal [data-role="feedback"]').textContent();
    assert(/Đúng|Chưa đúng/.test(fb), `không có phản hồi: ${fb.slice(0, 60)}`);
    const marked = await page.locator('.modal .ex-option[data-verdict="right"]').count();
    assert(marked === 1, "không tô đáp án đúng");
  }
});

await check("đi hết bộ đề thì có bảng tổng kết", async () => {
  for (let n = 0; n < 40; n++) {
    const btn = page.locator('.modal [data-role="next"]');
    if (!(await btn.count())) break;
    if ((await btn.textContent()) === "Làm lại bộ đề khác") break;
    if (await btn.isDisabled()) {
      const o = page.locator(".modal .ex-option:not([disabled])");
      const t = page.locator(".modal .ex-tile:not([data-used])");
      if (await o.count()) await o.first().click();
      else if (await t.count()) await t.first().click();
      else break;
    }
    await btn.click();
    await page.waitForTimeout(150);
  }
  const body = await page.locator('.modal [data-role="quiz"]').textContent();
  assert(/câu đúng/.test(body), "không thấy bảng tổng kết");
});
await page.screenshot({ path: `${OUT}/11-bai-tap.png` });
await page.locator(".modal__head [data-close]").click();

console.log("\n\x1b[1mSoạn bài\x1b[0m");
pageErrors.length = 0;
await page.goto(`${BASE}/studio.html`, { waitUntil: "networkidle" });

await check("trang soạn bài dựng được", async () => {
  await page.waitForSelector("#inVideoId", { timeout: 6000 });
});

await check("nhận ra mã video từ link YouTube đầy đủ", async () => {
  await page.fill("#inVideoId", "https://www.youtube.com/watch?v=g6PXXpA5zTk&list=PLabc&index=7");
  await page.dispatchEvent("#inVideoId", "input");
  await page.waitForTimeout(250);
  const v = await page.inputValue("#inVideoId");
  // ô nhập giữ nguyên chữ người dùng gõ; mã đã được tách vào bản nháp
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("film-shadowing:draft:v1")));
  assert(draft.source.videoId === "g6PXXpA5zTk", `mã tách ra sai: ${draft.source.videoId}`);
});

await check("dán cả kịch bản một lần thì ra đủ câu thoại", async () => {
  await page.fill("#inScript", "MAI: Hold on, let me check the app.\nSAM: Is there a bus I can take instead?\nMAI: The last bus left ten minutes ago.\nSAM: That is fine. I am not in a hurry.");
  await page.fill("#inScriptStart", "10");
  await page.locator("#btnBuildScript").click();
  await page.waitForTimeout(700);
  const n = await page.locator('[data-field="text"]').count();
  assert(n === 4, `mong đợi 4 câu, thấy ${n}`);
  const first = await page.inputValue('[data-field="start"][data-i="0"]');
  assert(Number(first) === 10, `câu đầu phải bắt đầu ở giây 10, thấy ${first}`);
});

await check("tự nhận ra cụm trọng tâm trong kịch bản", async () => {
  const kws = await page.inputValue('[data-field="keywords"][data-i="0"]');
  assert(/hold on/i.test(kws), `không nhận ra cụm: "${kws}"`);
});

await check("nhắc về quyền sử dụng khi dán lời thoại của người khác", async () => {
  const notice = await page.locator("#scriptNotice").textContent();
  assert(/quyền sử dụng|bản quyền|thu phí/i.test(notice), "không nhắc gì về bản quyền");
});

await check("gợi ý từ mới và thêm được vào bộ thẻ", async () => {
  const add = page.locator("[data-addvocab]");
  assert(await add.count() > 0, "không gợi ý từ mới nào");
  await add.first().click();
  await page.waitForTimeout(400);
  assert(await page.locator("[data-vf=\"term\"]").count() > 0, "không thêm được vào bộ thẻ");
});

await check("cho người soạn thấy bài sinh được bao nhiêu câu hỏi", async () => {
  const box = await page.locator("#quizBox").textContent();
  assert(/câu hỏi|chưa có/.test(box), `ô bài tập trống: ${box.slice(0, 60)}`);
});
await page.screenshot({ path: `${OUT}/12-soan-bai-dan-kich-ban.png`, fullPage: true });

await check("thêm câu và kiểm tra bài chỉ ra lỗi còn thiếu", async () => {
  const before = await page.locator('[data-field="text"]').count();
  await page.locator("#btnAddLine").click();
  await page.waitForTimeout(200);
  const n = await page.locator('[data-field="text"]').count();
  assert(n === before + 1, `mong đợi ${before + 1} câu, thấy ${n}`);
  await page.locator("#btnValidate").click();
  await page.waitForTimeout(200);
  const box = await page.locator("#validateBox").textContent();
  assert(/lỗi/.test(box), "bộ kiểm tra không báo lỗi cho bài chưa điền");
});
await page.screenshot({ path: `${OUT}/05-soan-bai.png`, fullPage: true });

await check("không có lỗi JavaScript ở trang soạn bài", () => {
  const real = pageErrors.filter((e) => !/favicon|net::ERR_|youtube/i.test(e));
  assert(real.length === 0, real.join(" | "));
});

console.log("\n\x1b[1mTiến độ\x1b[0m");
pageErrors.length = 0;
await page.goto(`${BASE}/progress.html`, { waitUntil: "networkidle" });

await check("trang tiến độ hiện tổng kết từng bài", async () => {
  await page.waitForSelector("#summary .card", { timeout: 8000 });
  const n = await page.locator("#summary .card").count();
  assert(n >= 3, `mong đợi >= 3 thẻ (chuỗi ngày + các bài), thấy ${n}`);
});

await check("câu điểm thấp được đưa lên danh sách cần luyện lại", async () => {
  const txt = await page.locator("#weakLines").textContent();
  assert(txt.length > 20, "danh sách câu yếu rỗng bất thường");
});
await page.screenshot({ path: `${OUT}/06-tien-do.png`, fullPage: true });

await check("không có lỗi JavaScript ở trang tiến độ", () => {
  const real = pageErrors.filter((e) => !/favicon|net::ERR_/.test(e));
  assert(real.length === 0, real.join(" | "));
});

console.log("\n\x1b[1mBảng theo dõi lớp\x1b[0m");
pageErrors.length = 0;
await page.goto(`${BASE}/teacher.html`, { waitUntil: "networkidle" });

await check("bảng mở ra là đã có lớp mẫu, không phải bảng trống", async () => {
  await page.waitForSelector(".tile", { timeout: 8000 });
  const n = await page.locator(".roster tbody tr, .attn__card").count();
  assert(n > 0, "bảng trống trơn khi vừa mở");
});

await check("dải chỉ số hiện đủ sáu ô", async () => {
  const n = await page.locator("#tiles .tile").count();
  assert(n === 6, `mong đợi 6 ô, thấy ${n}`);
});

await check("thẻ Cần chú ý nêu rõ lý do và việc nên làm", async () => {
  const cards = page.locator(".attn__card");
  assert(await cards.count() > 0, "không có thẻ cần chú ý nào");
  const txt = await cards.first().textContent();
  assert(/Nên làm/.test(txt), "thẻ không có phần việc nên làm");
  assert(/ngày|lượt|%/.test(txt), "thẻ không nêu lý do cụ thể");
});

await check("cảnh báo có ý nghĩa: không gắn cờ quá nửa lớp", async () => {
  const flagged = await page.locator(".attn__card").count();
  const total = await page.evaluate(() => {
    const t = document.querySelectorAll(".tile__val");
    return Number(t[0]?.textContent || 0);
  });
  assert(flagged <= Math.ceil(total / 2), `gắn cờ ${flagged}/${total} — cảnh báo mất ý nghĩa`);
});

await check("tab Cả lớp sắp xếp được theo cột", async () => {
  await page.locator('[data-tab="roster"]').click();
  await page.waitForSelector(".roster tbody tr", { timeout: 4000 });
  const before = await page.locator(".roster tbody tr td:first-child").first().textContent();
  await page.locator('th[data-sort="percent"]').click();
  await page.waitForTimeout(250);
  const after = await page.locator(".roster tbody tr td:first-child").first().textContent();
  assert(before !== after || (await page.locator("th[aria-sort]").count()) > 0, "bấm tiêu đề cột không đổi thứ tự");
});

await check("tab Điểm nghẽn chỉ ra câu cả lớp cùng sai", async () => {
  await page.locator('[data-tab="block"]').click();
  await page.waitForSelector(".bars__row", { timeout: 4000 });
  const n = await page.locator(".bars__row").count();
  assert(n >= 3, `mong đợi >= 3 cột, thấy ${n}`);
});

await check("cột biểu đồ không tràn ra ngoài khung", async () => {
  const over = await page.evaluate(() => {
    let worst = 0;
    document.querySelectorAll(".bars__fill").forEach((el) => {
      const t = el.parentElement.getBoundingClientRect();
      const f = el.getBoundingClientRect();
      worst = Math.max(worst, f.right - t.right);
    });
    return worst;
  });
  assert(over <= 1, `cột vượt khung ${over.toFixed(1)}px`);
});

await check("tab Từng em vẽ được đường điểm theo ngày", async () => {
  await page.locator('[data-tab="one"]').click();
  await page.waitForSelector("#pickStudent", { timeout: 4000 });
  const hasSpark = await page.locator(".spark").count();
  assert(hasSpark > 0, "không vẽ được đường tiến bộ");
});

await check("đổi học viên thì bảng đổi theo", async () => {
  const names = await page.locator("#pickStudent option").allTextContents();
  assert(names.length >= 2, "chỉ có một học viên");
  const before = await page.locator("#tabOne .tile__val").first().textContent();
  await page.selectOption("#pickStudent", names[1]);
  await page.waitForTimeout(300);
  const after = await page.locator("#tabOne .tile__val").first().textContent();
  assert(before !== after, "đổi học viên nhưng số liệu không đổi");
});

await check("xuất được báo cáo chuẩn bị buổi tới", async () => {
  await page.locator("#btnReport").click();
  await page.waitForSelector("#reportText", { timeout: 4000 });
  const txt = await page.inputValue("#reportText");
  assert(/GỌI TRƯỚC BUỔI HỌC/.test(txt), "báo cáo thiếu phần gọi học viên");
  assert(/DẠY LẠI/.test(txt), "báo cáo thiếu phần dạy lại");
  await page.locator(".modal__head [data-close]").click();
});

await check("từ chối tệp không đúng định dạng, báo rõ lý do", async () => {
  await page.setInputFiles("#inFiles", {
    name: "linh-tinh.json", mimeType: "application/json", buffer: Buffer.from('{"khong":"phai"}'),
  });
  await page.waitForTimeout(500);
  const notice = await page.locator("#notice").textContent();
  assert(/không đọc được/i.test(notice), `không báo lỗi: ${notice.slice(0, 80)}`);
});

await check("nạp tệp học viên thật thì lớp mẫu tự nhường chỗ", async () => {
  const real = {
    profile: { name: "Học Viên Thật" },
    lessons: { "demo-doan-thoai-ga-tau": { startedAt: new Date().toISOString(), vocab: {},
      lines: { l1: { best: 82, attempts: [{ at: new Date().toISOString(), overall: 82, parts: {}, mode: "asr", durationSec: 3 }] } } } },
    totals: { attempts: 1, recordedSec: 3 }, streak: { count: 1 },
  };
  await page.setInputFiles("#inFiles", {
    name: "tien-do-that.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(real)),
  });
  await page.waitForTimeout(600);
  const meta = await page.locator("#classMeta").textContent();
  assert(!/lớp mẫu/.test(meta), "lớp mẫu vẫn còn sau khi nạp học viên thật");
  const body = await page.locator("body").textContent();
  assert(/Học Viên Thật/.test(body), "không thấy học viên vừa nạp");
});
await page.screenshot({ path: `${OUT}/08-bang-lop.png`, fullPage: true });

await check("không có lỗi JavaScript ở bảng theo dõi", () => {
  const real = pageErrors.filter((e) => !/favicon|net::ERR_/.test(e));
  assert(real.length === 0, real.join(" | "));
});

console.log("\n\x1b[1mMàn hình điện thoại (390x844)\x1b[0m");
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 390, height: 844 });
await mob.goto(`${BASE}/lesson.html?lesson=demo-doan-thoai-ga-tau`, { waitUntil: "networkidle" });
await mob.waitForSelector("#lessonRoot:not([hidden])", { timeout: 8000 });
const modalClose = mob.locator(".modal__head [data-close]");
if (await modalClose.count()) await modalClose.click();
await check("không bị tràn ngang trên điện thoại", async () => {
  const over = await mob.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(over <= 1, `tràn ngang ${over}px`);
});
await mob.screenshot({ path: `${OUT}/07-dien-thoai.png`, fullPage: true });

await mob.goto(`${BASE}/teacher.html`, { waitUntil: "networkidle" });
await mob.waitForSelector(".tile", { timeout: 8000 });
await check("bảng theo dõi không tràn ngang trên điện thoại", async () => {
  const over = await mob.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(over <= 1, `tràn ngang ${over}px`);
});
await mob.screenshot({ path: `${OUT}/09-bang-lop-dien-thoai.png`, fullPage: true });

await browser.close();

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} đạt, ${fail} không đạt\x1b[0m`);
console.log(`Ảnh chụp: ${OUT}/`);
process.exit(fail === 0 ? 0 : 1);
