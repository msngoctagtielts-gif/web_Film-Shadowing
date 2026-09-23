# Film Shadowing — học tiếng Anh bằng cách lồng tiếng phim

Nền tảng cho học viên **nhận vai và lồng tiếng** cho từng cảnh phim: nghe lại bất kỳ câu nào, thu âm, được chấm điểm ngay và biết chính xác từ nào chưa ra.

Xây cho Ms.Ngọc Elite English. Chạy hoàn toàn trên trình duyệt — không cần cài đặt, không cần đăng ký, không có máy chủ.

---

## Chạy thử trong 30 giây

```bash
npm run serve          # hoặc: python3 -m http.server 4173
# mở http://localhost:4173
```

Bài mẫu **“Tập 1 — Chuyến tàu cuối ngày”** chạy được ngay: kịch bản tự viết, giọng đọc máy của trình duyệt, không cần mạng và không vướng bản quyền.

> Phải mở qua `http://`, không mở bằng `file://` — trình duyệt chặn đọc tệp JSON khi dùng `file://`.

## Học viên làm gì

```
Từ mới (có hình)  →  Nghe  →  Đọc chồng  →  Lồng tiếng  →  Kiểm tra
      trước khi        lặp      đọc cùng     tiếng gốc      ẩn chữ,
      xem phim       vô hạn     bản mẫu      tắt, hình      lấy điểm
                                             vẫn chạy
```

Vì sao đúng thứ tự này: `docs/03-thiet-ke-su-pham.md`.

## Giáo viên làm gì

Mở `studio.html`, dán link YouTube (hoặc chọn tệp của trung tâm), vừa xem vừa bấm `I` / `O` để bắt mốc từng câu, gõ lời thoại và từ mới, bấm kiểm tra, rồi xuất tệp JSON vào `data/lessons/`.

## Cấu trúc mã nguồn

```
index.html      danh sách khoá học
lesson.html     màn luyện lồng tiếng (màn chính)
studio.html     công cụ soạn bài cho giáo viên
progress.html   tiến độ, câu cần luyện lại, xuất/nhập dữ liệu

assets/js/core/
  text.js           chuẩn hoá văn bản, khoá ngữ âm, độ giống giữa hai từ
  scoring.js        máy chấm điểm — hàm thuần, kiểm thử được
  recorder.js       thu âm + đo nhịp, ngắt, mức tín hiệu
  asr.js            nhận dạng giọng nói (Web Speech API)
  player.js         một giao diện chung cho YouTube / tệp / giọng máy
  store.js          tiến độ học (localStorage)
  srs.js            lịch ôn từ vựng giãn dần
  lesson-loader.js  nạp và KIỂM TRA bài học

assets/js/ui/       các khối giao diện dùng lại
assets/js/pages/    điều phối từng trang
data/lessons/       bài học dạng JSON
tests/              131 kiểm thử lõi + 23 kiểm thử trình duyệt thật
docs/               nghiên cứu thị trường, chiến lược, sư phạm, kiểm định, ra thị trường
```

## Kiểm thử

```bash
npm test                                  # 131 phép kiểm lõi, không cần trình duyệt

python3 -m http.server 4173 &             # kiểm thử trình duyệt cần máy chủ
node tests/e2e/smoke.mjs                  # 23 phép kiểm trên Chromium thật
```

Kiểm thử trình duyệt cần gói `playwright`. Nếu máy đã cài toàn cục:
`ln -s $(npm root -g)/playwright node_modules/playwright`

## Máy chấm điểm đo gì

Bốn chỉ số: **Chính xác**, **Đầy đủ**, **Cụm trọng tâm**, **Nhịp & tốc độ** — cộng theo trọng số tuỳ trình độ.

**Nói cho đúng:** máy trả lời câu hỏi *“người bản xứ nghe có ra không”*, chứ không phải *“khẩu hình đã đúng chưa”*. Chấm ở tầng âm vị như ELSA cần API trả phí; thiết kế đã tách sẵn để đổi sang chỉ phải sửa một chỗ. Chi tiết và giới hạn: `docs/05-may-cham-diem.md`.

## Tư liệu phim và bản quyền

Video của bên thứ ba chỉ được **nhúng** qua trình phát chính thức — không tải về, không cắt ghép, và bảng kịch bản luôn nằm **bên cạnh**, không phủ lên khung phát (có kiểm thử tự động đo toạ độ để bảo đảm điều này).

Hướng an toàn nhất là trung tâm **tự quay** chuỗi phim ngắn. Đọc `docs/06-tu-lieu-va-ban-quyen.md` trước khi đưa phim có bản quyền vào khoá học thu phí.

## Tài liệu

| Tệp | Nội dung |
|---|---|
| [01 — Nghiên cứu thị trường](docs/01-nghien-cuu-thi-truong.md) | Quy mô thị trường có dẫn nguồn, mổ xẻ Cake / ELSA / eJOY / VoiceTube / Lingopie, khoảng trống còn lại |
| [02 — Chiến lược sản phẩm](docs/02-chien-luoc-san-pham.md) | Định vị, ba nhóm học viên, gói bán, thứ đối thủ không sao chép được |
| [03 — Thiết kế sư phạm](docs/03-thiet-ke-su-pham.md) | Vòng lặp bốn bước, độ dài câu theo trình độ, chọn cụm trọng tâm, đối chiếu CEFR |
| [04 — Thiết kế trải nghiệm](docs/04-thiet-ke-trai-nghiem.md) | Bố cục màn hình, cơ chế giữ chân, những chỗ dễ làm hỏng |
| [05 — Máy chấm điểm](docs/05-may-cham-diem.md) | Công thức, bảng chẩn đoán lỗi người Việt, giới hạn, đường nâng cấp |
| [06 — Tư liệu và bản quyền](docs/06-tu-lieu-va-ban-quyen.md) | Ba con đường lấy nội dung, chính sách nhúng YouTube, danh mục kiểm tra |
| [07 — Kiểm thử và duyệt](docs/07-kiem-thu-va-duyet.md) | Ba tầng kiểm thử, danh mục kiểm tay, ba cổng duyệt bài, hiệu chuẩn máy chấm |
| [08 — Ra thị trường](docs/08-ra-thi-truong.md) | Thứ tự mở bán, thông điệp từng nhóm, chi phí vận hành, ngưỡng dừng |
| [09 — Lộ trình và chỉ số](docs/09-lo-trinh-va-chi-so.md) | Ba giai đoạn, chỉ số theo dõi, nợ kỹ thuật |

## Việc tiếp theo

Giai đoạn 1 không phải viết thêm mã. Là **quay 4 tập đầu**, soạn bằng Studio, chạy thử với 5 học viên, và **hiệu chuẩn máy chấm** với 30 bản thu thật (`docs/07`, mục 5).
