/**
 * recorder.js — thu âm bản lồng tiếng của học viên và đo các chỉ số âm học
 * cần cho việc chấm nhịp: thời lượng thật, tỉ lệ có tiếng, số lần ngắt dài,
 * mức tín hiệu (để cảnh báo micro quá nhỏ hoặc bị rè).
 *
 * Không gửi audio đi đâu. Mọi thứ nằm trong bộ nhớ trình duyệt.
 */

/** Định dạng thu mà trình duyệt hỗ trợ, chọn cái nhẹ nhất có sẵn. */
function pickMime() {
  if (!window.MediaRecorder) return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function recorderSupport() {
  return {
    mediaRecorder: Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia),
    mime: pickMime(),
  };
}

/**
 * Tạo bộ thu dùng lại được cho cả buổi học (xin quyền micro một lần).
 * @returns {Promise<object>}
 */
export async function createRecorder() {
  const support = recorderSupport();
  if (!support.mediaRecorder) {
    throw new Error("Trình duyệt này không thu được âm. Dùng Chrome, Edge hoặc Safari bản mới.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const srcNode = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  srcNode.connect(analyser);

  const buf = new Uint8Array(analyser.fftSize);
  let rec = null, chunks = [], startedAt = 0;
  /** @type {Array<{t:number, rms:number}>} Mẫu mức tín hiệu, 50ms/lần. */
  let envelope = [];
  let sampler = null;

  /** Mức tín hiệu hiện tại 0..1 — dùng vẽ cột VU. */
  function level() {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  return {
    stream,
    mime: support.mime,
    level,
    get state() { return rec ? rec.state : "inactive"; },

    /** Bắt đầu thu. Ném lỗi nếu đang thu dở. */
    start() {
      if (rec && rec.state === "recording") throw new Error("Đang thu rồi.");
      if (ctx.state === "suspended") ctx.resume();
      chunks = []; envelope = [];
      rec = new MediaRecorder(stream, support.mime ? { mimeType: support.mime } : undefined);
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      startedAt = performance.now();
      rec.start(120);
      sampler = setInterval(() => {
        envelope.push({ t: (performance.now() - startedAt) / 1000, rms: level() });
      }, 50);
    },

    /**
     * Dừng thu và trả về bản thu kèm số đo âm học.
     * @returns {Promise<{blob:Blob, url:string, durationSec:number, metrics:object}>}
     */
    stop() {
      return new Promise((resolve, reject) => {
        if (!rec || rec.state !== "recording") { reject(new Error("Chưa bắt đầu thu.")); return; }
        clearInterval(sampler); sampler = null;
        rec.onstop = () => {
          const durationSec = (performance.now() - startedAt) / 1000;
          const blob = new Blob(chunks, { type: support.mime || "audio/webm" });
          resolve({
            blob,
            url: URL.createObjectURL(blob),
            durationSec,
            metrics: analyzeEnvelope(envelope, durationSec),
            envelope: envelope.slice(),
          });
        };
        rec.onerror = (e) => reject(e.error || new Error("Lỗi khi thu âm."));
        rec.stop();
      });
    },

    cancel() {
      clearInterval(sampler); sampler = null;
      if (rec && rec.state === "recording") { rec.onstop = null; rec.stop(); }
      chunks = []; envelope = [];
    },

    destroy() {
      this.cancel();
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}

/**
 * Phân tích đường bao mức tín hiệu để lấy chỉ số nhịp.
 *
 * Ngưỡng có tiếng nói được tính động theo chính bản thu (đáy nhiễu + biên),
 * nhờ vậy micro to nhỏ khác nhau vẫn cho kết quả so sánh được.
 *
 * @param {Array<{t:number, rms:number}>} envelope
 * @param {number} durationSec
 * @returns {{speechRatio:number, longPauses:number, leadingSilence:number, trailingSilence:number, peak:number, noiseFloor:number, tooQuiet:boolean, clipping:boolean, speechSec:number}}
 */
export function analyzeEnvelope(envelope, durationSec) {
  const empty = {
    speechRatio: 0, longPauses: 0, leadingSilence: 0, trailingSilence: 0,
    peak: 0, noiseFloor: 0, tooQuiet: true, clipping: false, speechSec: 0,
  };
  if (!envelope || envelope.length < 3) return empty;

  const rms = envelope.map((e) => e.rms);
  const sorted = [...rms].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const noiseFloor = pct(0.15);
  const peak = sorted[sorted.length - 1];
  // ngưỡng nằm giữa đáy nhiễu và đỉnh, lệch về phía đáy để không cắt mất phụ âm nhẹ
  const threshold = Math.max(0.012, noiseFloor + (peak - noiseFloor) * 0.22);

  const step = durationSec / envelope.length;
  let voiced = 0, longPauses = 0, run = 0;
  let firstVoiced = -1, lastVoiced = -1;

  envelope.forEach((e, i) => {
    if (e.rms >= threshold) {
      // Đã từng có tiếng TRƯỚC mẫu này chưa? Nếu chưa thì khoảng lặng vừa rồi là
      // lặng đầu bản thu (học viên bấm thu sớm), không phải ngắt giữa câu.
      const alreadyStarted = firstVoiced >= 0;
      voiced++;
      if (!alreadyStarted) firstVoiced = i;
      lastVoiced = i;
      if (alreadyStarted && run * step >= 0.55) longPauses++;
      run = 0;
    } else {
      run++;
    }
  });

  const speechSec = voiced * step;
  return {
    speechRatio: durationSec > 0 ? speechSec / durationSec : 0,
    longPauses,
    leadingSilence: firstVoiced >= 0 ? firstVoiced * step : durationSec,
    trailingSilence: lastVoiced >= 0 ? (envelope.length - 1 - lastVoiced) * step : durationSec,
    peak: Number(peak.toFixed(4)),
    noiseFloor: Number(noiseFloor.toFixed(4)),
    tooQuiet: peak < 0.05,
    clipping: peak > 0.97,
    speechSec: Number(speechSec.toFixed(2)),
  };
}

/**
 * Cắt bỏ khoảng lặng đầu/cuối khi tính thời lượng nói thật — học viên hay bấm
 * thu sớm vài giây, không nên tính phần đó vào nhịp.
 * @param {number} durationSec
 * @param {object} metrics kết quả analyzeEnvelope
 */
export function effectiveDuration(durationSec, metrics) {
  if (!metrics) return durationSec;
  const trimmed = durationSec - metrics.leadingSilence - metrics.trailingSilence;
  return trimmed > 0.3 ? trimmed : durationSec;
}

/** Vẽ cột mức tín hiệu vào canvas — gọi trong requestAnimationFrame. */
export function drawVu(canvas, value) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const bars = 28, gap = 2;
  const bw = (w - gap * (bars - 1)) / bars;
  const lit = Math.round(Math.min(1, value * 2.6) * bars);
  for (let i = 0; i < bars; i++) {
    const on = i < lit;
    ctx.fillStyle = on
      ? (i > bars * 0.85 ? "#a32633" : i > bars * 0.6 ? "#c9a227" : "#1d7a4d")
      : "rgba(125,135,155,.22)";
    const bh = Math.max(3, (h - 8) * (0.35 + (i / bars) * 0.65));
    ctx.fillRect(i * (bw + gap), (h - bh) / 2, bw, bh);
  }
}
