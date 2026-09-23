# 10 — Triển khai website

---

## 1. Dựng thư mục xuất bản

```bash
node tools/build-site.mjs      # → public/  (khoảng 330 KB)
```

Chỉ gom trang, mã nguồn và dữ liệu bài học. Không đẩy kiểm thử, công cụ, tài liệu
hay `node_modules` lên máy chủ.

## 2. Đưa lên Netlify

Project đã tạo sẵn trong tài khoản của trung tâm:

| | |
|---|---|
| Tên project | `mnee-film-shadowing` |
| Site ID | `8379b20b-64bb-474b-984a-1db665d22bb7` |
| Địa chỉ | `mnee-film-shadowing.netlify.app` |
| Bảng quản trị | https://app.netlify.com/projects/mnee-film-shadowing |

### Cách A — kéo thả (không cần dòng lệnh)

1. `node tools/build-site.mjs`
2. Mở bảng quản trị → tab **Deploys**
3. Kéo thả **thư mục `public/`** vào ô "Drag and drop your site output folder here"

### Cách B — dòng lệnh

```bash
npx netlify-cli deploy --prod --dir=public --site 8379b20b-64bb-474b-984a-1db665d22bb7
```

## 3. Yêu cầu về mạng — đọc trước khi triển khai từ phiên Claude Code

Website cần hai nhóm địa chỉ:

| Địa chỉ | Dùng để làm gì | Thiếu thì sao |
|---|---|---|
| `www.youtube.com`, `youtube.com` | Nạp trình phát nhúng và phát video | Bài dùng YouTube không phát được. Màn học **vẫn chạy** (kịch bản, thu âm, chấm điểm) và hiện lời giải thích — xem `createNullPlayer` trong `core/player.js` |
| `api.netlify.com`, `app.netlify.com`, `netlify-mcp.netlify.app` | Tải bản dựng lên | Không triển khai được từ phiên Claude Code; phải kéo thả tay |

**Điểm hay quên:** đổi Network access của môi trường **không áp vào phiên đang
chạy**. Container giữ nguyên chính sách lúc nó khởi động. Sửa xong phải **mở
phiên mới** thì mới có hiệu lực.

Đổi ở đâu: menu môi trường trên thanh tiêu đề phiên làm việc → **Edit** →
**Network access**.

## 4. Kiểm tra sau khi lên mạng

Chạy lần lượt, đánh dấu từng dòng:

- [ ] Trang chủ hiện đủ danh sách bài.
- [ ] Bài **"Tập 1 — Chuyến tàu cuối ngày"** (giọng máy) học được trọn vòng: từ mới → nghe → thu → có điểm.
- [ ] Bài **"Bài thử — video thật"**: khung phát YouTube hiện lên và phát được.
- [ ] Bấm dòng mốc **0:45** → video tua tới đúng giây 45.
- [ ] Bật **🔁 Lặp** → đoạn 45–52s chạy đi chạy lại.
- [ ] Đổi **0.75x** → video chạy chậm lại.
- [ ] Vòng **Lồng tiếng** → tiếng gốc tắt nhưng hình vẫn chạy.
- [ ] Trình duyệt hỏi quyền micro, cho phép xong thu được và có điểm.
- [ ] **Soạn bài**: dán link YouTube → bấm **Nạp video** → video hiện; bấm `I` và `O` bắt được mốc.
- [ ] **Bảng lớp** mở ra có lớp mẫu.
- [ ] Không có phần tử nào của trang phủ lên khung phát ở mọi kích thước màn hình.

## 5. Quyền truy cập

Nhóm Netlify của trung tâm đang đặt mặc định **yêu cầu đăng nhập SSO** cho mọi
project. Nghĩa là website chỉ mở được khi đã đăng nhập tài khoản Netlify của
trung tâm — phù hợp cho giai đoạn chạy thử nội bộ.

Khi cần mở cho học viên:
- Bảng quản trị → **Site configuration** → **Access & security** → tắt SSO, hoặc
- Đặt mật khẩu chung cho cả site ở cùng mục đó.

Trước khi mở công khai, đọc `06-tu-lieu-va-ban-quyen.md` — bài dùng video của
bên thứ ba không nên nằm trong bản công khai.
