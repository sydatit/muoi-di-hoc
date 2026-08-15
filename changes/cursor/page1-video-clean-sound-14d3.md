# Thay đổi: Phase 1 — Video Page 1 gọn gàng + bật tiếng khi người dùng nhấn

Triển khai Phase 1 của plan `changes/cursor/plan-page1-responsive-video-14d3.md`.

## Mục tiêu

1. Bỏ toàn bộ chrome thừa của YouTube trên video Page 1 (logo YouTube to, nút CC, bánh răng, prev/next, thanh progress, nút fullscreen).
2. Tự bật âm thanh khi người dùng nhấn vào bất kỳ đâu trên trang, có nút loa để tắt/bật lại và ghi nhớ lựa chọn trong session.

## File thay đổi

- `index.html` — tham số embed mới cho `#pageOneVideoFrame`, thêm nút loa overlay
- `app.js` — `buildPageOneEmbedSrc()`, logic âm thanh (unmute + verify + rollback), gộp handler gesture
- `styles.css` — xóa CSS chết `.p1-video-poster*`, thêm style cho nút loa + chặn tương tác iframe

## Tóm tắt thay đổi

### 1. Tham số embed

`controls=0` (bỏ control bar + logo YouTube), `fs=0`, `disablekb=1`, `iv_load_policy=3`, `cc_load_policy=0`, giữ `rel=0`, `playsinline=1`, `mute=1`, `loop=1`, `enablejsapi=1`.

Ngoại lệ **`prefers-reduced-motion: reduce`**: video không autoplay, nên phải giữ `controls=1` để người dùng còn cách bấm phát — nếu không sẽ mất hẳn khả năng xem video. Khi đó CSS cũng trả lại tương tác cho iframe và ẩn nút loa của mình.

### 2. Chặn tương tác trực tiếp vào iframe

`.p1-video-frame { pointer-events: none; }` — YouTube không còn hiện overlay tiêu đề/avatar kênh khi hover hoặc chạm vào video (hai thứ này không tắt được bằng tham số vì `showinfo` đã bị khai tử). Sự kiện chạm vẫn tới `.p1-video` rồi bubble lên document nên handler gesture vẫn chạy bình thường.

### 3. Nút loa (thành phần điều khiển duy nhất)

Nút tròn 2rem ở góc trên phải khung video, icon `volume-x` / `volume-2`, `aria-pressed` + `aria-label` đổi theo trạng thái.

### 4. Luồng âm thanh

```text
gesture đầu tiên (pointerdown / touchstart / click) trên document
  ├─ prefers-reduced-motion → bỏ qua, gỡ listener
  ├─ đã tắt tiếng thủ công (sessionStorage) → bỏ qua, gỡ listener
  ├─ đang mở modal → bỏ qua (không bật tiếng khi đang điền form)
  ├─ không ở section 1 → giữ listener, chờ gesture sau
  ├─ player chưa chạy (UNSTARTED/CUED) → dùng gesture này để unlock muted playback
  └─ unMute() + setVolume(60) + playVideo()
        └─ verify sau 350ms: isMuted() === false và đang PLAYING/BUFFERING?
              ├─ OK   → gỡ listener
              └─ FAIL → mute() + playVideo() lại (không để video treo ở trạng thái pause),
                        nhấp nháy nút loa, cho phép thử lại tối đa 2 lần rồi dừng
```

Lý do phải verify: user gesture ở document cha **không được truyền vào iframe cross-origin trên iOS/WebKit**, `unMute()` có thể bị chặn và làm video pause thay vì phát có tiếng. Ngoài ra đăng ký thêm event chính thức `onAutoplayBlocked` để rollback trong trường hợp trình duyệt chặn.

Các hành vi liên quan:
- Rời section 1 → mute rồi pause; quay lại → phát lại và khôi phục đúng trạng thái tiếng trước đó (có verify).
- Bấm nút loa để tắt → ghi `sessionStorage`, **không tự bật lại** trong session đó.
- Bấm nút loa để bật lại → xóa cờ opt-out và thử unmute (có verify như trên).

### 5. Dọn dẹp

Xóa ~65 dòng CSS chết `.p1-video-poster*` (`styles.css`) — markup poster đã bị gỡ khỏi `index.html` từ trước.

## Không nằm trong phạm vi

- Mục 1.6 của plan (bỏ `aspect-ratio: auto !important` trên mobile) **hoãn sang Phase 2/3**: hiện mobile dựa vào `flex: 1 1 18%` để video hút phần không gian thừa; ép lại 16:9 khi chưa có Fit Engine sẽ làm tràn section trên máy thấp.
- Không thêm tham số `origin=` vào embed: `index.html` là trang tĩnh không biết origin lúc render, thêm ở phía JS sẽ khiến iframe bị reload thừa một lần ngay khi tải trang.

## Cách kiểm tra

```bash
python3 -m http.server 8000   # http://localhost:8000
```

- Khung video không còn logo YouTube, CC, bánh răng, prev/next, progress bar.
- Chạm/hover vào video không làm hiện tiêu đề video hay avatar kênh.
- Nhấn vào vùng bất kỳ trên trang → có tiếng trong khoảng 1 giây (Chrome desktop/Android).
- iOS Safari: nếu bị chặn thì video vẫn chạy muted (không đứng hình), nút loa nhấp nháy; bấm nút loa để bật tiếng.
- Bấm nút loa tắt tiếng → click tiếp ra ngoài không tự bật lại.
- Bật `prefers-reduced-motion: reduce` → video không tự chạy, hiện control gốc của YouTube để bấm phát, nút loa của mình ẩn đi.
