# 05 — Máy chấm điểm: nó đo gì và không đo gì

*Tài liệu này tồn tại để không ai — kể cả người viết quảng cáo của trung tâm — nói quá về khả năng của sản phẩm.*

---

## 1. Điều phải nói rõ trước tiên

Máy chấm hiện tại hoạt động bằng cách **nghe học viên nói gì rồi so với kịch bản**. Nó trả lời câu hỏi:

> *"Người bản xứ nghe học viên nói câu này, có nhận ra đúng câu đó không?"*

Nó **không** trả lời câu hỏi:

> *"Khẩu hình của học viên đã đúng chưa? Âm /θ/ này đặt lưỡi đúng chỗ chưa?"*

Câu hỏi thứ hai cần chấm ở tầng **âm vị**, như ELSA hay [Azure Pronunciation Assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment) làm. Bản này không làm được, và không giả vờ làm được.

**Cách nói đúng khi bán hàng:** *"Máy kiểm tra xem bạn nói có nghe ra được và có kịp nhịp không, rồi chỉ đúng từ bị rơi."*
**Cách nói sai:** *"AI chấm phát âm chuẩn người bản xứ."*

## 2. Bốn chỉ số thành phần

### 2.1 Chính xác (accuracy)

Gióng hàng từng từ giữa kịch bản và lời học viên bằng thuật toán Levenshtein, nhưng **chi phí thay thế được tính theo độ giống**, không phải luôn bằng 1.

```
chi phí thay "sheep" → "ship"  = 1 − 0,82 = 0,18   (lệch nguyên âm, vẫn nghe ra)
chi phí thay "sheep" → "dog"   = 1 − 0,00 = 1,00   (từ khác hẳn)
```

Độ giống giữa hai từ là tổ hợp của **chính tả** và **khoá ngữ âm** (`phoneticKey` trong `core/text.js`, họ Metaphone rút gọn). Khoá ngữ âm bỏ nguyên âm **ở giữa** từ nhưng **giữ nguyên âm đầu** — nhờ vậy:

| Cặp từ | Điểm giống | Vì sao đúng |
|---|---|---|
| ship / sheep | 0,82 | Lệch độ dài nguyên âm, người nghe vẫn hiểu → gần đúng |
| live / leave | 0,82 | Như trên |
| think / sink | 0,64 | Lỗi /θ/ kinh điển của người Việt → hạ điểm nhưng chưa đánh trượt |
| in / on | 0,40 | Hai giới từ khác nghĩa hẳn → phải bị tính là sai |
| cat / dog | 0,00 | Từ khác |

*Nếu bỏ hết nguyên âm thì "in" và "on" ra cùng khoá và được 0,82 điểm — đó là lỗi đã từng có trong bản dựng và đã sửa. Bài kiểm thử `text.test.mjs` khoá hành vi này lại.*

### 2.2 Đầy đủ (completeness)

Tỉ lệ từ trong kịch bản đã được nói ra ở mức **nghe ra được** (độ giống ≥ 0,60). Chỉ số này bắt trường hợp học viên đọc trôi nửa câu rồi bỏ.

### 2.3 Cụm trọng tâm (keywords)

Điểm của những cụm mà người soạn bài đánh dấu là quan trọng.

**Quy tắc quan trọng:** một cụm bị khuyết một từ ở giữa thì **không tính là đạt**, dù các từ còn lại đọc hoàn hảo.

```
Kịch bản:   "I will call you back in two minutes"
Học viên:   "I will call back in two minutes"      ← rơi mất "you"
Cụm:        "call you back"
Điểm cụm:   33 / 100, KHÔNG đạt
```

Điểm cụm lấy `0,5 × trung bình + 0,5 × từ yếu nhất`, và "đạt" chỉ khi **mọi từ trong cụm** đều nghe ra được. *(Bản đầu lấy trung bình đơn thuần và cho ví dụ trên 67 điểm — đạt. Sai, đã sửa.)*

### 2.4 Nhịp & tốc độ (pacing)

Đây là chỉ số làm nên khác biệt giữa "lồng tiếng" và "đọc to một câu". Đo bằng:

| Thành phần | Nguồn dữ liệu | Cách trừ điểm |
|---|---|---|
| Tỉ lệ tốc độ | thời lượng thu / thời lượng câu mẫu | Chấp nhận 0,80–1,30. Nhanh hơn: −190 điểm/đơn vị lệch. Chậm hơn: −120. |
| Ngắt dài giữa câu | phân tích đường bao mức tín hiệu của bản thu | −9 điểm mỗi lần ngắt > 0,55 giây, tối đa −30 |
| Tỉ lệ có tiếng | phần thời gian thực sự có tiếng nói | Dưới 50% thì bắt đầu trừ |

Khoảng lặng **đầu** và **cuối** bản thu bị cắt trước khi tính, vì học viên hay bấm thu sớm vài giây. Ngưỡng "có tiếng" tính động theo từng bản thu (đáy nhiễu + biên), nên micro to hay nhỏ vẫn cho kết quả so sánh được.

**Chốt chặn quan trọng:** nếu điểm Đầy đủ dưới 40, điểm Nhịp trả về `null` và **không tính vào điểm tổng**. Lý do: học viên đọc 2 trong 10 từ mà vẫn ăn trọn điểm nhịp thì điểm tổng đang nói dối họ.

## 3. Điểm tổng

```
điểm tổng = Σ(trọng số × điểm thành phần) / Σ(trọng số của các thành phần đo được)
```

Mẫu số chỉ cộng những thành phần **đo được** — thiếu dữ liệu thì chia lại trọng số, không trừ điểm học viên vì lý do kỹ thuật.

| Bộ trọng số | Chính xác | Đầy đủ | Cụm trọng tâm | Nhịp | Dùng cho |
|---|:--:|:--:|:--:|:--:|---|
| `starter` | 0,50 | 0,25 | 0,15 | 0,10 | Mới bắt đầu — ưu tiên đọc đúng |
| `standard` | 0,40 | 0,20 | 0,18 | 0,22 | Mặc định |
| `advanced` | 0,34 | 0,16 | 0,20 | 0,30 | B2+ — nhịp quan trọng gần ngang chính xác |

| Điểm | Nhãn |
|---|---|
| ≥ 88 | Xuất sắc |
| 75–87 | Tốt |
| 60–74 | Tạm được |
| 40–59 | Cần luyện lại |
| < 40 | Thu lại nhé |

## 4. Góp ý được sinh ra thế nào

Không phải câu chung chung. Có bảng chẩn đoán các lỗi hay gặp của người học Việt Nam:

| Mã | Điều kiện | Câu góp ý |
|---|---|---|
| `final-s` | Kịch bản kết thúc bằng s/z, lời học viên không | Rơi âm cuối /s/ hoặc /z/ ở "…" — bật nhẹ hơi ở cuối từ |
| `final-ed` | Kịch bản kết thúc bằng -ed, lời học viên không | Rơi âm cuối -ed — quá khứ mất dấu thì người nghe hiểu sai thời gian |
| `th` | Kịch bản bắt đầu bằng th, học viên đọc thành s/t/f/d/z | Đặt đầu lưỡi chạm nhẹ răng trên rồi thổi hơi |
| `sh-s` | Có /ʃ/ trong kịch bản, học viên đọc thành /s/ | Chu môi tròn về trước, khác hẳn /s/ tiếng Việt |
| `vowel-length` | Cùng chữ đầu và chữ cuối, khác độ dài | Nguyên âm dài phải ngân rõ hơn hẳn nguyên âm ngắn |
| `cluster` | Cụm phụ âm cuối bị lược | Đọc rõ từng phụ âm, chậm lại cũng được |

Thứ tự ưu tiên hiển thị: **cụm trọng tâm → lỗi âm cụ thể → từ bị bỏ → nhịp → tiếng đệm**. Tối đa 5 góp ý. Khi không có lỗi nào, góp ý chuyển thành lời nâng thử thách.

## 5. Nâng lên chấm âm vị khi cần

Thiết kế đã tách sẵn để việc này chỉ phải sửa **một chỗ**:

```js
// Hiện tại — trong pages/lesson.js
const result = gradeAttempt({ refText, hypText, keywords, refSec, userSec, ... });

// Sau này — thay bằng một adapter, giữ nguyên hình dạng kết quả trả về
const result = await gradeWithAzure({ audioBlob, refText, keywords });
```

Yêu cầu bắt buộc của adapter mới: trả về đúng cấu trúc `AttemptResult` (`overall`, `band`, `parts`, `words`, `advice`, `stats`). Giao diện, bảng điểm, bộ lưu tiến độ không phải sửa dòng nào.

**Khi nào nên trả tiền:** chỉ khi đã có học viên trả phí, và chỉ dùng ở **vòng Kiểm tra** (mỗi câu một lần). Vòng luyện học viên thu 10 lần một câu là bình thường — dùng API ở đó sẽ tốn gấp mười lần mà không thêm giá trị sư phạm.

## 6. Những giới hạn còn lại

| Giới hạn | Ảnh hưởng | Cách xử lý hiện tại |
|---|---|---|
| Không đo được ngữ điệu (cao độ F0) | Không biết học viên nói có cảm xúc không | Gọi đúng tên chỉ số là "Nhịp & tốc độ", không gọi là "ngữ điệu". Vòng B2 bắt buộc giáo viên nghe. |
| Nhận dạng giọng nói gửi âm thanh lên máy chủ của nhà cung cấp trình duyệt | Vấn đề riêng tư | Hỏi ý kiến học viên rõ ràng trước; luôn có chế độ tự đánh giá |
| Firefox chưa hỗ trợ nhận dạng giọng nói | Không chấm tự động được | Tự chuyển sang tự đánh giá, báo rõ lý do |
| Máy nghe nhầm ở nơi ồn | Điểm thấp oan | Chấm trên phương án nhận dạng khớp nhất; cảnh báo khi tín hiệu quá nhỏ hoặc vỡ |
| Chưa hiệu chuẩn với học viên thật | Chưa biết điểm 70 của máy tương đương nhận xét gì của giáo viên | **Việc bắt buộc trước khi thu phí** — xem `07-kiem-thu-va-duyet.md` mục 5 |
