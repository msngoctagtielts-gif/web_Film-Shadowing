/**
 * illustrations.js — bộ hình minh hoạ cho thẻ từ vựng.
 *
 * Toàn bộ hình ở đây là hình hình học vẽ mới bằng SVG cho dự án này: không dùng
 * ảnh, icon hay nhân vật của bên thứ ba, nên không có rủi ro bản quyền và không
 * cần tải tệp ngoài (bài học chạy được cả khi mất mạng).
 *
 * Người soạn bài vẫn có thể gắn ảnh riêng của trung tâm:
 *   "image": { "kind": "url", "src": "assets/img/ga-tau.jpg", "alt": "..." }
 */

const P = {
  ink: "currentColor",
  gold: "#c9a227",
  navy: "#204179",
  wine: "#a8495a",
  sky: "#8fb3e0",
};

/** Khung nền chung cho mọi hình, giữ tỉ lệ và khoảng đệm nhất quán. */
function frame(inner) {
  return `<svg viewBox="0 0 200 120" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    <rect width="200" height="120" fill="none"/>
    <g fill="none" stroke="${P.navy}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
}

/** Từ khoá hình → hàm vẽ. Thêm hình mới chỉ cần thêm một dòng ở đây. */
export const GLYPHS = {
  phone: () => frame(`
    <rect x="76" y="24" width="48" height="76" rx="8"/>
    <line x1="88" y1="36" x2="112" y2="36"/>
    <circle cx="100" cy="88" r="4" fill="${P.gold}" stroke="none"/>
    <path d="M136 44c8 8 8 24 0 32" stroke="${P.gold}"/>
    <path d="M148 34c14 14 14 38 0 52" stroke="${P.gold}" opacity=".6"/>`),

  clock: () => frame(`
    <circle cx="100" cy="60" r="34"/>
    <path d="M100 40v22l16 10" stroke="${P.gold}"/>
    <line x1="100" y1="22" x2="100" y2="28"/>
    <line x1="100" y1="92" x2="100" y2="98"/>`),

  door: () => frame(`
    <rect x="66" y="18" width="68" height="86" rx="4"/>
    <circle cx="120" cy="62" r="4" fill="${P.gold}" stroke="none"/>
    <path d="M66 104h68" stroke-width="4"/>
    <path d="M150 50l18 12-18 12" stroke="${P.gold}"/>`),

  train: () => frame(`
    <rect x="52" y="30" width="96" height="52" rx="10"/>
    <rect x="66" y="42" width="28" height="22" rx="3" fill="${P.sky}" stroke="none"/>
    <rect x="106" y="42" width="28" height="22" rx="3" fill="${P.sky}" stroke="none"/>
    <circle cx="74" cy="92" r="8"/><circle cx="126" cy="92" r="8"/>
    <line x1="34" y1="104" x2="166" y2="104" stroke="${P.gold}"/>`),

  suitcase: () => frame(`
    <rect x="56" y="42" width="88" height="58" rx="7"/>
    <path d="M84 42V30a6 6 0 016-6h20a6 6 0 016 6v12"/>
    <line x1="56" y1="70" x2="144" y2="70" stroke="${P.gold}"/>`),

  letter: () => frame(`
    <rect x="50" y="34" width="100" height="62" rx="6"/>
    <path d="M50 40l50 34 50-34" stroke="${P.gold}"/>`),

  umbrella: () => frame(`
    <path d="M44 62a56 56 0 01112 0z"/>
    <line x1="100" y1="62" x2="100" y2="94"/>
    <path d="M100 94a10 10 0 0018 4" stroke="${P.gold}"/>`),

  coffee: () => frame(`
    <path d="M60 46h68v26a26 26 0 01-26 26H86a26 26 0 01-26-26z"/>
    <path d="M128 54h14a12 12 0 010 24h-14" stroke="${P.gold}"/>
    <path d="M82 34c0-6 8-6 8-12M100 34c0-6 8-6 8-12" stroke="${P.gold}" opacity=".7"/>`),

  key: () => frame(`
    <circle cx="74" cy="60" r="18"/>
    <line x1="92" y1="60" x2="152" y2="60"/>
    <line x1="134" y1="60" x2="134" y2="76"/>
    <line x1="146" y1="60" x2="146" y2="72" stroke="${P.gold}"/>`),

  map: () => frame(`
    <path d="M48 36l34-10 36 12 34-10v66l-34 10-36-12-34 10z"/>
    <path d="M82 26v68M118 38v68" stroke="${P.gold}" opacity=".8"/>`),

  heart: () => frame(`
    <path d="M100 96S56 72 56 50a22 22 0 0144-10 22 22 0 0144 10c0 22-44 46-44 46z" stroke="${P.wine}"/>`),

  star: () => frame(`
    <path d="M100 24l14 30 33 4-24 23 6 33-29-16-29 16 6-33-24-23 33-4z" stroke="${P.gold}"/>`),

  warning: () => frame(`
    <path d="M100 24l46 78H54z"/>
    <line x1="100" y1="52" x2="100" y2="74" stroke="${P.wine}"/>
    <circle cx="100" cy="86" r="3.4" fill="${P.wine}" stroke="none"/>`),

  money: () => frame(`
    <rect x="46" y="38" width="108" height="46" rx="6"/>
    <circle cx="100" cy="61" r="13" stroke="${P.gold}"/>
    <line x1="100" y1="50" x2="100" y2="72" stroke="${P.gold}"/>`),

  handshake: () => frame(`
    <path d="M40 66l26-16 20 10 20-10 26 16"/>
    <path d="M86 60l14 12 14-12" stroke="${P.gold}"/>
    <path d="M52 70l18 16M148 70l-18 16"/>`),

  idea: () => frame(`
    <path d="M100 22a26 26 0 0116 46v10H84V68a26 26 0 0116-46z"/>
    <line x1="86" y1="88" x2="114" y2="88" stroke="${P.gold}"/>
    <line x1="90" y1="98" x2="110" y2="98" stroke="${P.gold}"/>
    <path d="M60 34l8 6M140 34l-8 6M50 66h10M140 66h10" stroke="${P.gold}" opacity=".75"/>`),

  voice: () => frame(`
    <rect x="88" y="26" width="24" height="42" rx="12"/>
    <path d="M74 60a26 26 0 0052 0" stroke="${P.gold}"/>
    <line x1="100" y1="86" x2="100" y2="100"/>
    <line x1="84" y1="100" x2="116" y2="100"/>`),

  film: () => frame(`
    <rect x="44" y="34" width="112" height="56" rx="6"/>
    <line x1="44" y1="48" x2="156" y2="48" stroke="${P.gold}"/>
    <line x1="44" y1="76" x2="156" y2="76" stroke="${P.gold}"/>
    <path d="M86 56l26 10-26 10z" fill="${P.gold}" stroke="none"/>`),

  walk: () => frame(`
    <circle cx="100" cy="30" r="9"/>
    <path d="M100 39v26l-14 20M100 65l16 18"/>
    <path d="M100 48l-16 8M100 48l18 6" stroke="${P.gold}"/>`),

  question: () => frame(`
    <circle cx="100" cy="60" r="34"/>
    <path d="M88 48a12 12 0 1120 8c-4 4-8 6-8 12" stroke="${P.gold}"/>
    <circle cx="100" cy="80" r="3.2" fill="${P.gold}" stroke="none"/>`),
};

/** Hình thay thế khi chưa chọn được: chữ cái đầu trong khung trang trí. */
function initialGlyph(term) {
  const ch = (term || "?").trim()[0]?.toUpperCase() || "?";
  return `<svg viewBox="0 0 200 120" role="img" aria-hidden="true">
    <rect x="8" y="8" width="184" height="104" rx="10" fill="none" stroke="${P.navy}" stroke-width="2.4" opacity=".5"/>
    <rect x="16" y="16" width="168" height="88" rx="6" fill="none" stroke="${P.gold}" stroke-width="1.6" opacity=".7"/>
    <text x="100" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="${P.navy}">${ch}</text>
  </svg>`;
}

/** Từ khoá gợi ý để tự chọn hình khi người soạn chưa chỉ định. */
const AUTO = [
  [/phone|call|ring|dial/i, "phone"],
  [/time|clock|hour|minute|late|early|wait/i, "clock"],
  [/door|open|close|enter|leave|knock/i, "door"],
  [/train|station|platform|travel|ticket/i, "train"],
  [/bag|suitcase|pack|luggage/i, "suitcase"],
  [/letter|mail|write|note|message|envelope/i, "letter"],
  [/rain|umbrella|wet|storm/i, "umbrella"],
  [/coffee|drink|cup|tea|cafe/i, "coffee"],
  [/key|lock|unlock|secret/i, "key"],
  [/map|way|direction|find|lost|road/i, "map"],
  [/love|heart|care|miss|kind/i, "heart"],
  [/star|best|great|wish|dream/i, "star"],
  [/danger|careful|warn|risk|afraid|scare/i, "warning"],
  [/money|pay|cost|price|buy|cheap|expensive/i, "money"],
  [/deal|agree|promise|meet|friend|help/i, "handshake"],
  [/idea|think|plan|remember|learn|know/i, "idea"],
  [/say|speak|talk|voice|whisper|shout|tell/i, "voice"],
  [/film|movie|scene|watch|show/i, "film"],
  [/walk|run|go|come|move|hurry/i, "walk"],
  [/why|what|how|ask|wonder|question/i, "question"],
];

/**
 * Trả về mã HTML hình minh hoạ cho một từ vựng.
 * @param {{term:string, meaningVi?:string, image?:{kind:string, key?:string, src?:string, alt?:string}}} vocab
 * @returns {string} HTML
 */
export function illustrationFor(vocab) {
  const img = vocab.image || {};

  if (img.kind === "url" && img.src) {
    const alt = (img.alt || vocab.term || "").replace(/"/g, "&quot;");
    return `<img src="${img.src}" alt="${alt}" loading="lazy">`;
  }
  if (img.kind === "builtin" && GLYPHS[img.key]) return GLYPHS[img.key]();
  if (img.kind === "emoji" && img.src) {
    return `<div style="font-size:56px;line-height:1" aria-hidden="true">${img.src}</div>`;
  }

  // tự chọn theo nghĩa của từ
  const hay = `${vocab.term || ""} ${vocab.definitionEn || ""} ${vocab.meaningVi || ""}`;
  const auto = AUTO.find(([re]) => re.test(hay));
  if (auto && GLYPHS[auto[1]]) return GLYPHS[auto[1]]();

  return initialGlyph(vocab.term);
}

/** Danh sách tên hình dùng được — Studio hiển thị cho người soạn chọn. */
export function glyphKeys() { return Object.keys(GLYPHS); }
