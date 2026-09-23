/**
 * asr.js — nhận dạng giọng nói để lấy văn bản học viên vừa đọc.
 *
 * ĐIỀU CẦN NÓI THẬT VỚI HỌC VIÊN (đã hiển thị trong giao diện):
 * Web Speech API của Chrome/Edge xử lý âm thanh TRÊN MÁY CHỦ của nhà cung cấp
 * trình duyệt, không phải trên máy học viên. Safari cũng tương tự. Vì vậy màn
 * học có banner thông báo trước khi bật, và học viên luôn có đường lùi: tự
 * đánh giá bằng tay (chế độ `self`) nếu không muốn gửi giọng đi.
 *
 * Firefox chưa hỗ trợ API này — ứng dụng tự chuyển sang chế độ tự đánh giá.
 */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

/** @returns {{available:boolean, engine:string|null, note:string}} */
export function asrSupport() {
  if (!SR) {
    return {
      available: false,
      engine: null,
      note: "Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Bài học vẫn thu âm và nghe lại được; điểm sẽ do bạn tự đánh giá.",
    };
  }
  return {
    available: true,
    engine: window.SpeechRecognition ? "SpeechRecognition" : "webkitSpeechRecognition",
    note: "Âm thanh được trình duyệt gửi tới dịch vụ nhận dạng của nhà cung cấp để chuyển thành chữ.",
  };
}

/**
 * Nghe một lượt và trả về văn bản nghe được.
 *
 * Gọi song song với `recorder.start()` để một lần đọc vừa có bản thu nghe lại
 * vừa có văn bản để chấm.
 *
 * @param {object} [opts]
 * @param {string} [opts.lang="en-US"]
 * @param {number} [opts.maxAlternatives=3]
 * @param {(partial:string)=>void} [opts.onPartial] Văn bản tạm, cập nhật liên tục
 * @returns {{promise:Promise<{transcript:string, confidence:number, alternatives:string[], aborted:boolean}>, stop:()=>void, abort:()=>void}}
 */
export function listen({ lang = "en-US", maxAlternatives = 3, onPartial = null } = {}) {
  if (!SR) {
    return {
      promise: Promise.resolve({ transcript: "", confidence: 0, alternatives: [], aborted: true, unsupported: true }),
      stop() {}, abort() {},
    };
  }

  const rec = new SR();
  rec.lang = lang;
  rec.continuous = true;          // câu thoại phim có thể ngắt giữa dòng
  rec.interimResults = true;
  rec.maxAlternatives = maxAlternatives;

  let finals = [];
  let bestConfidence = 0;
  let alternatives = [];
  let settled = false;
  let manuallyStopped = false;

  const promise = new Promise((resolve) => {
    const finish = (extra = {}) => {
      if (settled) return;
      settled = true;
      resolve({
        transcript: finals.join(" ").replace(/\s+/g, " ").trim(),
        confidence: bestConfidence,
        alternatives,
        aborted: false,
        ...extra,
      });
    };

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const top = r[0];
        if (r.isFinal) {
          finals.push(top.transcript.trim());
          if (top.confidence) bestConfidence = Math.max(bestConfidence, top.confidence);
          for (let a = 1; a < r.length; a++) alternatives.push(r[a].transcript.trim());
        } else {
          interim += top.transcript;
        }
      }
      if (onPartial) onPartial((finals.join(" ") + " " + interim).trim());
    };

    rec.onerror = (e) => {
      // "no-speech" và "aborted" là chuyện thường: coi như không nghe được gì.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        finish({ error: "not-allowed" });
      } else if (e.error === "network") {
        finish({ error: "network" });
      } else {
        finish({ error: e.error || "unknown" });
      }
    };

    rec.onend = () => finish({ manuallyStopped });
  });

  try {
    rec.start();
  } catch (err) {
    // start() hai lần liên tiếp sẽ ném lỗi — bỏ qua, onend sẽ chốt kết quả.
    console.warn("ASR start:", err);
  }

  return {
    promise,
    stop() { manuallyStopped = true; try { rec.stop(); } catch {} },
    abort() { manuallyStopped = true; try { rec.abort(); } catch {} },
  };
}

/**
 * Chọn phương án nhận dạng khớp nhất với câu mẫu.
 *
 * Bộ nhận dạng thường trả nhiều phương án; nếu chỉ lấy phương án đầu, học viên
 * đọc đúng vẫn có thể bị trừ oan vì máy đoán sai từ đồng âm. Ta chấm trên
 * phương án gần câu mẫu nhất — đúng tinh thần "người nghe hiểu được là đạt".
 *
 * @param {{transcript:string, alternatives:string[]}} asrResult
 * @param {string} refText
 * @param {(ref:string, hyp:string)=>number} scoreFn Trả về điểm 0..100
 * @returns {{transcript:string, pickedAlternative:boolean}}
 */
export function pickBestAlternative(asrResult, refText, scoreFn) {
  const candidates = [asrResult.transcript, ...(asrResult.alternatives || [])].filter(Boolean);
  if (candidates.length <= 1) {
    return { transcript: asrResult.transcript || "", pickedAlternative: false };
  }
  let best = candidates[0], bestScore = scoreFn(refText, candidates[0]);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreFn(refText, candidates[i]);
    if (s > bestScore) { best = candidates[i]; bestScore = s; }
  }
  return { transcript: best, pickedAlternative: best !== asrResult.transcript };
}
