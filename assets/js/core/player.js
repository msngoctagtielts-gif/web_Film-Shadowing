/**
 * player.js — một giao diện điều khiển duy nhất cho nhiều nguồn video/âm thanh.
 *
 * Ba chế độ:
 *   youtube — nhúng qua IFrame Player API chính thức. KHÔNG tải video về,
 *             KHÔNG cắt ghép, KHÔNG phủ phần tử nào lên khung phát (bảng kịch
 *             bản nằm BÊN CẠNH), đúng Developer Policies của YouTube.
 *   file    — thẻ <video>/<audio> trỏ vào tệp mà trung tâm có quyền sử dụng.
 *   tts     — giọng đọc máy của trình duyệt đọc chính kịch bản. Dùng cho bài
 *             mẫu và bài do trung tâm tự viết: chạy offline, không vướng bản quyền.
 *
 * Mọi chế độ trả về cùng một đối tượng điều khiển, nên `lesson.js` không cần
 * biết bài học đang dùng nguồn nào.
 */

const YT_API = "https://www.youtube.com/iframe_api";
let ytApiPromise = null;

/** Nạp IFrame Player API một lần duy nhất cho cả trang. */
function loadYouTubeApi() {
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = YT_API;
    tag.async = true;
    tag.onerror = () => reject(new Error("Không nạp được YouTube IFrame API (kiểm tra mạng)."));
    document.head.appendChild(tag);
    setTimeout(() => { if (!window.YT || !window.YT.Player) reject(new Error("YouTube IFrame API quá thời gian chờ.")); }, 12000);
  });
  return ytApiPromise;
}

/** Gom các thuộc tính chung của mọi player. */
function baseController() {
  return {
    /** @type {{start:number, end:number, loop:boolean}|null} */
    segment: null,
    listeners: { time: [], state: [], segmentend: [] },
    on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; },
    emit(evt, payload) { (this.listeners[evt] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); },
  };
}

/* ------------------------------ YouTube ---------------------------------- */

async function createYouTubePlayer({ mount, source }) {
  const YT = await loadYouTubeApi();
  const ctl = baseController();
  const host = document.createElement("div");
  mount.innerHTML = "";
  mount.appendChild(host);

  let ticker = null;
  const yt = await new Promise((resolve) => {
    const p = new YT.Player(host, {
      videoId: source.videoId,
      playerVars: {
        rel: 0, modestbranding: 1, playsinline: 1,
        cc_load_policy: 0, iv_load_policy: 3,
        origin: location.origin,
      },
      events: {
        onReady: () => resolve(p),
        onStateChange: (e) => {
          const map = { [-1]: "unstarted", 0: "ended", 1: "playing", 2: "paused", 3: "buffering", 5: "cued" };
          ctl.emit("state", map[e.data] || String(e.data));
        },
        onError: (e) => ctl.emit("state", "error:" + e.data),
      },
    });
  });

  const tick = () => {
    const t = yt.getCurrentTime ? yt.getCurrentTime() : 0;
    ctl.emit("time", t);
    const seg = ctl.segment;
    if (seg && t >= seg.end - 0.04) {
      if (seg.loop) { yt.seekTo(seg.start, true); }
      else { yt.pauseVideo(); ctl.segment = null; ctl.emit("segmentend", seg); }
    }
  };
  ticker = setInterval(tick, 80);

  return Object.assign(ctl, {
    kind: "youtube",
    capabilities: { rate: true, seek: true, duration: true },
    get duration() { return yt.getDuration ? yt.getDuration() : 0; },
    getTime: () => (yt.getCurrentTime ? yt.getCurrentTime() : 0),
    play() { yt.playVideo(); },
    pause() { yt.pauseVideo(); },
    seek(sec) { yt.seekTo(Math.max(0, sec), true); },
    setRate(r) { try { yt.setPlaybackRate(r); } catch { /* tốc độ không được hỗ trợ */ } },
    mute() { try { yt.mute(); } catch {} },
    unmute() { try { yt.unMute(); } catch {} },
    playSegment(start, end, { loop = false, rate = null } = {}) {
      if (rate) this.setRate(rate);
      ctl.segment = { start, end, loop };
      yt.seekTo(start, true);
      yt.playVideo();
    },
    clearSegment() { ctl.segment = null; },
    stop() { ctl.segment = null; yt.pauseVideo(); },
    destroy() { clearInterval(ticker); try { yt.destroy(); } catch {} },
  });
}

/* --------------------------- Tệp cục bộ ---------------------------------- */

function createFilePlayer({ mount, source }) {
  const ctl = baseController();
  const el = document.createElement(source.mediaKind === "audio" ? "audio" : "video");
  el.src = source.url;
  el.controls = true;
  el.preload = "metadata";
  el.playsInline = true;
  mount.innerHTML = "";
  mount.appendChild(el);

  el.addEventListener("timeupdate", () => {
    ctl.emit("time", el.currentTime);
    const seg = ctl.segment;
    if (seg && el.currentTime >= seg.end - 0.04) {
      if (seg.loop) { el.currentTime = seg.start; }
      else { el.pause(); ctl.segment = null; ctl.emit("segmentend", seg); }
    }
  });
  ["play", "pause", "ended", "waiting"].forEach((e) =>
    el.addEventListener(e, () => ctl.emit("state", e === "waiting" ? "buffering" : e === "play" ? "playing" : e)));

  return Object.assign(ctl, {
    kind: "file",
    capabilities: { rate: true, seek: true, duration: true },
    get duration() { return el.duration || 0; },
    getTime: () => el.currentTime,
    play() { el.play(); },
    pause() { el.pause(); },
    seek(sec) { el.currentTime = Math.max(0, sec); },
    setRate(r) { el.playbackRate = r; },
    mute() { el.muted = true; },
    unmute() { el.muted = false; },
    playSegment(start, end, { loop = false, rate = null } = {}) {
      if (rate) el.playbackRate = rate;
      ctl.segment = { start, end, loop };
      el.currentTime = start;
      el.play();
    },
    clearSegment() { ctl.segment = null; },
    stop() { ctl.segment = null; el.pause(); },
    destroy() { el.pause(); el.removeAttribute("src"); el.remove(); },
  });
}

/* ----------------------- Giọng đọc máy (TTS) ----------------------------- */

/**
 * Chọn giọng tiếng Anh tốt nhất đang có trên máy, ưu tiên giọng bản xứ.
 * @param {string} [prefer] ví dụ "en-US"
 */
export function pickVoice(prefer = "en-US") {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  if (!en.length) return null;
  const exact = en.filter((v) => v.lang.replace("_", "-").toLowerCase() === prefer.toLowerCase());
  const pool = exact.length ? exact : en;
  // giọng "natural"/"neural" của hệ điều hành nghe gần người thật hơn
  return pool.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) || pool[0];
}

/** Đợi danh sách giọng nạp xong (Chrome nạp bất đồng bộ). */
export function voicesReady(timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve([]); return; }
    const got = speechSynthesis.getVoices();
    if (got.length) { resolve(got); return; }
    const t = setTimeout(() => resolve(speechSynthesis.getVoices()), timeoutMs);
    speechSynthesis.addEventListener("voiceschanged", () => {
      clearTimeout(t); resolve(speechSynthesis.getVoices());
    }, { once: true });
  });
}

/**
 * Player đọc kịch bản bằng giọng máy. "Dòng thời gian" ở đây là ảo: mỗi câu
 * chiếm đúng khoảng [start, end] mà bài học khai báo, phát câu nào thì đọc câu đó.
 */
function createTtsPlayer({ mount, source, lesson }) {
  const ctl = baseController();
  mount.innerHTML = "";
  const stage = document.createElement("div");
  stage.className = "tts-stage";
  stage.innerHTML = `<div><div class="tts-stage__speaker" data-role="speaker"></div>
    <div class="tts-stage__line" data-role="line"><span class="tts-stage__idle">Bấm một câu ở bảng kịch bản để nghe giọng mẫu</span></div></div>`;
  mount.appendChild(stage);
  const elSpeaker = stage.querySelector('[data-role="speaker"]');
  const elLine = stage.querySelector('[data-role="line"]');

  const lines = lesson.lines || [];
  let rate = 1;
  let current = null;       // câu đang đọc
  let virtualTime = 0;
  let raf = null;
  let startedAt = 0;
  let voice = null;
  let muted = false;
  voicesReady().then(() => { voice = pickVoice(source.voiceLang || "en-US"); });

  const lineAt = (sec) => lines.find((l) => sec >= l.start && sec < l.end) || null;

  const stopSpeaking = () => {
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  };

  const speak = (line, { loop = false } = {}) => {
    if (!window.speechSynthesis) { ctl.emit("state", "error:no-tts"); return; }
    stopSpeaking();
    current = line;
    elSpeaker.textContent = line.speaker || "";
    elLine.textContent = line.text;
    const u = new SpeechSynthesisUtterance(line.text);
    u.lang = source.voiceLang || "en-US";
    if (voice) u.voice = voice;
    u.rate = Math.max(0.5, Math.min(1.6, rate));
    startedAt = performance.now();
    const span = Math.max(0.6, (line.end - line.start));
    const follow = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      // Trình duyệt không cho biết thời lượng thật của giọng máy, nên con trỏ
      // chạy theo thời gian thực và dừng ở cuối câu.
      virtualTime = line.start + Math.min(span, elapsed);
      ctl.emit("time", virtualTime);
      raf = requestAnimationFrame(follow);
    };
    u.onstart = () => { ctl.emit("state", "playing"); follow(); };
    u.onend = () => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      virtualTime = line.end;
      ctl.emit("time", virtualTime);
      if (loop && ctl.segment && ctl.segment.loop) { speak(line, { loop: true }); return; }
      ctl.emit("state", "paused");
      const seg = ctl.segment; ctl.segment = null;
      if (seg) ctl.emit("segmentend", seg);
    };
    u.onerror = () => { ctl.emit("state", "error:tts"); };
    speechSynthesis.speak(u);
  };

  return Object.assign(ctl, {
    kind: "tts",
    capabilities: { rate: true, seek: true, duration: true },
    get duration() { return lines.length ? lines[lines.length - 1].end : 0; },
    getTime: () => virtualTime,
    play() { const l = current || lines[0]; if (l) speak(l); },
    pause() { stopSpeaking(); ctl.emit("state", "paused"); },
    seek(sec) {
      virtualTime = sec;
      const l = lineAt(sec);
      if (l) { current = l; elSpeaker.textContent = l.speaker || ""; elLine.textContent = l.text; }
      ctl.emit("time", sec);
    },
    setRate(r) { rate = r; },
    // Chế độ lồng tiếng của nguồn TTS = im lặng hoàn toàn để học viên tự nói.
    mute() { muted = true; },
    unmute() { muted = false; },
    playSegment(start, end, { loop = false, rate: r = null } = {}) {
      if (muted) { ctl.segment = null; ctl.emit("state", "paused"); return; }
      if (r) rate = r;
      const l = lineAt(start) || lines.find((x) => Math.abs(x.start - start) < 0.3);
      ctl.segment = { start, end, loop };
      if (l) speak(l, { loop });
    },
    clearSegment() { ctl.segment = null; },
    stop() { ctl.segment = null; stopSpeaking(); ctl.emit("state", "paused"); },
    destroy() { stopSpeaking(); mount.innerHTML = ""; },
  });
}

/**
 * Tạo player theo khai báo nguồn của bài học.
 * @param {{mount:HTMLElement, lesson:object}} args
 */
export async function createPlayer({ mount, lesson }) {
  const source = lesson.source || { type: "tts" };
  switch (source.type) {
    case "youtube": return createYouTubePlayer({ mount, source });
    case "file": return createFilePlayer({ mount, source });
    case "tts":
    default: return createTtsPlayer({ mount, source, lesson });
  }
}

/** Đọc một câu rời bằng giọng máy — dùng cho thẻ từ vựng và nút "nghe mẫu". */
export function speakOnce(text, { lang = "en-US", rate = 1 } = {}) {
  if (!window.speechSynthesis) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const v = pickVoice(lang);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return true;
}
