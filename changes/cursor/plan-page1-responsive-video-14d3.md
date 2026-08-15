# Kế hoạch: Fix responsive + video Page 1 (`#chuong-trinh`)

> Tài liệu này là **PLAN** (chưa sửa code). Nguồn tham chiếu: `responsive_auto_scroll_solution_575e.md` + khảo sát code hiện tại.

---

## 1. Mục tiêu

1. **Video gọn gàng**: bỏ toàn bộ chrome thừa của YouTube (logo YouTube to, nút CC, bánh răng, prev/next, thanh progress, nút fullscreen), chỉ giữ đúng thành phần cần thiết.
2. **Bật âm thanh khi người dùng nhấn vào bất kỳ đâu trên trang** (first user gesture → unmute), có thể tắt lại và ghi nhớ lựa chọn.
3. **Responsive theo đặc tính viewport** thay vì hard-code breakpoint/scroll distance, theo đúng kiến trúc trong tài liệu phân tích.

---

## 2. Hiện trạng (khảo sát code)

### 2.1 Video Page 1

| Vị trí | Nội dung |
|---|---|
| `index.html:185-192` | iframe `#pageOneVideoFrame`, src có `controls=1` → hiện toàn bộ control bar của YouTube |
| `app.js:364-379` | `buildPageOneEmbedSrc()` cũng set `controls: '1'`, không có `iv_load_policy`, `fs`, `disablekb`, `origin` |
| `app.js:356-362` | `forcePageOneMutedPlayback()` — luôn `mute()` rồi `playVideo()`; **không có đường nào để unmute** |
| `app.js:527-561` | `initPageOneAutoplayGestureFallback()` — đã có listener gesture toàn trang, nhưng chỉ dùng để *unlock muted autoplay*, rồi `detach()` |
| `styles.css:1182-1246` | Nguyên khối `.p1-video-poster*` (poster, nút play, label) — **CSS chết**, không còn dùng trong `index.html` |
| `styles.css:1445-1452`, `1654-1660` | Mobile ép `aspect-ratio: auto !important` + `flex: 1 1 18%` → khung video không còn 16:9, YouTube tự letterbox → viền đen thừa |

Đây chính là nguyên nhân ảnh chụp màn hình: control bar mobile của YouTube (nút pause to giữa khung, prev/next, CC, bánh răng, chữ "YouTube" lớn) phủ gần hết vùng video.

### 2.2 Responsive Page 1

| Vị trí | Vấn đề |
|---|---|
| `app.js:738` | `pageOneMobileFitMq = (max-width: 639px)` — biên cứng |
| `app.js:739` | `SHORT_VIEWPORT_HEIGHT = 650` — ngưỡng cứng, lại **chỉ áp dụng cho width ≥ 640** |
| `app.js:753-775` | `syncShortViewportResponsive()` quyết định fit/không-fit **chỉ bằng chiều cao viewport**, không hề đo chiều cao content |
| `styles.css:1289-1627` | Layout mobile chia ngân sách theo phần trăm cố định: title `18%`, schedule `8%`, video `18%`, speaker `22%`… → tổng % không tự thích ứng khi font/nội dung đổi |
| `styles.css` (32 `@media`) | Có 8 query phụ thuộc **chiều cao cứng**: `max-height` 700 / 720 / 740 / 780 / 820, `min-height: 800`, cộng `(min-width:1024px) and (max-width:1366px) and (orientation:portrait)` — đúng kiểu anti-pattern tài liệu cảnh báo |
| Không có | Không có lớp đo `contentHeight` vs `availableHeight`; không có scroll engine tính theo viewport |

Kết quả: mỗi lần gặp một viewport lạ (ví dụ `414×630`, `1366×607`, `1050×1893`) lại phải thêm một `@media` mới → CSS phình 128KB và ngày càng khó bảo trì.

---

## 3. Ràng buộc kỹ thuật đã xác minh

1. **`modestbranding` đã bị YouTube khai tử (15/08/2023)** — set cũng vô tác dụng. Cách duy nhất còn hiệu lực để bỏ logo + control bar là **`controls=0`**.
2. **`showinfo` cũng đã chết**: tiêu đề video + avatar kênh **luôn hiện trước khi phát và khi pause**. ⇒ muốn sạch thì phải **giữ video luôn ở trạng thái playing** (autoplay + loop) và **chặn tương tác trực tiếp vào iframe** để không kích hoạt overlay pause/hover của YouTube.
3. **Unmute xuyên iframe cross-origin không đảm bảo trên iOS/WebKit**: user gesture ở document cha **không được truyền** vào process của YouTube (`allow="autoplay"` không được WebKit honor). Hệ quả: `unMute()` có thể bị chặn và **video bị pause thay vì phát có tiếng**. Chrome/Android/desktop thì hoạt động bình thường.
   ⇒ Bắt buộc phải có **verify + rollback**: sau khi gọi `unMute()`, kiểm tra lại `isMuted()` / `getPlayerState()`; nếu thất bại thì khôi phục muted playback và hiện nút loa để người dùng chủ động bật.
4. **`onAutoplayBlocked`** là event chính thức của IFrame API, dùng để bắt trường hợp trình duyệt chặn.
5. Khi dùng `controls=0`, **ta chịu trách nhiệm dựng UI điều khiển riêng** — nên chỉ dựng đúng những gì cần (nút loa, và tùy chọn play/pause).

---

## 4. Kiến trúc đề xuất

```text
                 VIEWPORT (width, height, aspectRatio, orientation, dpr)
                                    │
                          [A] Viewport Metrics Engine
                                    │  → data-vp-profile / data-vp-orient / --app-height / --avail-h
                                    ▼
                          [B] Fit Engine (đo content thật)
                                    │  → data-fit="fit" | "overflow"
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          [C] CSS Layout Layer              [D] Scroll Engine
      (3 breakpoint + scale factor)   (scroll distance = availableHeight)
```

Nguyên tắc: **CSS quyết định layout theo width; JS quyết định fit/scroll theo height + content height.** Hai lớp không được lẫn vào nhau.

---

## 5. Kế hoạch theo phase

Mỗi phase là một commit/PR độc lập, có thể ship riêng và rollback riêng.

### Phase 1 — Video gọn gàng + click-to-unmute *(ưu tiên cao nhất, rủi ro thấp)*

**File:** `index.html`, `app.js`, `styles.css`

**1.1 Tham số embed mới**

```js
const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',              // bắt buộc để autoplay được chấp nhận
    loop: '1',
    playlist: PAGE_ONE_VIDEO_ID,
    controls: '0',          // ẩn control bar + logo YouTube + CC + bánh răng + prev/next
    disablekb: '1',
    fs: '0',
    iv_load_policy: '3',    // tắt annotation
    cc_load_policy: '0',
    rel: '0',
    playsinline: '1',
    enablejsapi: '1',
    origin: window.location.origin
});
```

Sửa đồng bộ ở 2 nơi: `index.html:189` (first paint) và `app.js:364-379` (`buildPageOneEmbedSrc`).

**1.2 Chặn tương tác trực tiếp vào iframe**

```css
.p1-video-frame { pointer-events: none; }   /* YouTube không còn hiện overlay title/avatar khi hover/tap */
.p1-video-shield { position: absolute; inset: 0; z-index: 1; }  /* lớp bắt gesture của mình */
```

**1.3 Overlay tối giản** — chỉ **một** nút loa (góc trên phải, ~32px, nền `rgba(0,0,0,.45)`, icon Lucide `volume-2` / `volume-x`), ẩn mờ khi không hover, luôn hiện trên mobile:

```html
<button type="button" id="pageOneSoundToggle" class="p1-video-sound" aria-pressed="false"
        aria-label="Bật âm thanh video">
    <i data-lucide="volume-x"></i>
</button>
```

**1.4 Logic âm thanh**

```text
first user gesture (pointerdown/click/keydown, capture, toàn document)
        │
        ├─ đã từng tắt tiếng thủ công (sessionStorage p1SoundOptOut) → bỏ qua
        ├─ prefers-reduced-motion → bỏ qua
        ├─ section 1 không active → giữ listener, chờ gesture sau
        └─ unMute() + setVolume(60) + playVideo()
                 │
                 └─ sau 350ms verify: isMuted() === false && state === PLAYING ?
                        ├─ OK  → cập nhật icon, gỡ listener
                        └─ FAIL→ mute() + playVideo() lại (tránh video bị pause treo),
                                 giữ listener cho gesture kế tiếp,
                                 nhấp nháy nút loa 1 lần để mời người dùng bấm trực tiếp
```

- Gộp chung với `initPageOneAutoplayGestureFallback()` hiện có (`app.js:527`) thành **một** handler gesture duy nhất: unlock autoplay **rồi** unmute — tránh hai listener tranh nhau.
- Đăng ký thêm `onAutoplayBlocked` để log/rollback.
- Khi rời section (`stopPageOneVideo`, `app.js:400`) → `mute()` trước khi pause, để lần quay lại không phát tiếng bất ngờ.
- Bấm nút loa = tắt/bật tiếng thủ công; nếu người dùng tắt → ghi `sessionStorage` và **không bao giờ tự unmute lại** trong session đó.

**1.5 Dọn rác**: xóa khối `.p1-video-poster*` không dùng (`styles.css:1182-1246`, ~65 dòng).

**1.6 Giữ khung 16:9**: bỏ `aspect-ratio: auto !important` ở `styles.css:1445-1452` và `1654-1660`; để Fit Engine (Phase 2) phân bổ chỗ trống thay vì kéo dãn khung video.

**Acceptance Phase 1**
- [ ] Không còn thấy logo YouTube lớn, CC, bánh răng, prev/next, progress bar trên mobile & desktop
- [ ] Không hiện tiêu đề video/avatar kênh khi chạm vào khung video
- [ ] Chrome desktop + Chrome Android: nhấn bất kỳ đâu → có tiếng trong ≤ 1 giây
- [ ] iOS Safari: nếu bị chặn, video **vẫn chạy muted** (không bị pause), nút loa hiện rõ, bấm nút → có tiếng
- [ ] Bấm nút loa để tắt tiếng → không tự bật lại khi click tiếp
- [ ] `prefers-reduced-motion: reduce` → không autoplay, không auto-unmute

---

### Phase 2 — Viewport Metrics Engine + Fit Engine

**File:** `app.js` (module mới `viewport.js` nội tuyến), `styles.css`

**2.1 Metrics** (thay cho `SHORT_VIEWPORT_HEIGHT`):

```js
function readViewportMetrics() {
    const vv = window.visualViewport;
    const width  = Math.round(vv?.width  ?? window.innerWidth);
    const height = Math.round(vv?.height ?? window.innerHeight);
    return {
        width, height,
        aspectRatio: width / height,
        orientation: width > height ? 'landscape' : (width < height ? 'portrait' : 'square'),
        profile: width < 768 ? 'mobile' : (width < 1200 ? 'tablet' : 'desktop'),
        dpr: window.devicePixelRatio || 1
    };
}
```

Publish ra DOM để CSS dùng được, thay vì đẻ thêm `@media`:

```js
root.dataset.vpProfile = m.profile;          // mobile | tablet | desktop
root.dataset.vpOrient  = m.orientation;
root.style.setProperty('--app-height', m.height + 'px');
root.style.setProperty('--avail-h', (m.height - headerH) + 'px');
```

Cập nhật qua `requestAnimationFrame` + debounce 120ms trên `resize`, `orientationchange`, `visualViewport.resize`.

**2.2 Fit Engine** — thay `syncShortViewportResponsive()` bằng đo thật:

```js
function measureSectionFit(section) {
    const natural = section.scrollHeight;              // chiều cao content thật
    const available = getAvailableHeight();            // viewport - header
    return natural <= available + FIT_TOLERANCE_PX;    // FIT_TOLERANCE_PX = 8
}
```

- `data-fit="fit"` → giữ `fp-noscroll`, snap section như hiện tại.
- `data-fit="overflow"` → mở internal scroll (`fp-responsive` / `scrollOverflow`) — **không phân biệt mobile/desktop nữa**, vì mobile 414×630 cũng có thể overflow.
- Đo lại sau khi web font load (`document.fonts.ready`) và sau mỗi `reBuild()`.

**2.3 Gỡ ngưỡng cứng**: xóa `SHORT_VIEWPORT_HEIGHT = 650` và điều kiện `width >= 640` (`app.js:753-758`).

**Acceptance Phase 2**
- [ ] Không còn hằng số chiều cao nào trong `app.js` quyết định fit/không-fit
- [ ] `414×630` (mobile rất thấp) không bị cắt CTA — tự chuyển sang internal scroll
- [ ] Xoay ngang/dọc, zoom Chrome 175%, thanh URL mobile co giãn → đo lại đúng

---

### Phase 3 — Dọn CSS Page 1 theo scale factor

**File:** `styles.css`

**3.1 Thay ngân sách `%` cứng bằng một biến scale duy nhất**, tính từ available height:

```js
// 1.0 tại 800px khả dụng; kẹp trong [0.78, 1.12]
const scale = clamp(availableHeight / 800, 0.78, 1.12);
root.style.setProperty('--p1-scale', scale.toFixed(3));
```

```css
#chuong-trinh h1        { font-size: clamp(1.9rem, calc(2.6rem * var(--p1-scale)), 4.5rem); }
#chuong-trinh .p1-video { flex: 0 1 auto; aspect-ratio: 16 / 9; max-height: calc(var(--avail-h) * 0.30); }
```

**3.2 Hợp nhất breakpoint** về 3 mốc layout + tối đa 2 mốc behavior:

```css
@media (max-width: 767px)  { /* mobile  */ }
@media (min-width: 768px) and (max-width: 1199px) { /* tablet */ }
@media (min-width: 1200px) { /* desktop */ }
```

**3.3 Xóa dần 8 media query phụ thuộc chiều cao cứng** — chúng được thay bằng `--p1-scale` + Fit Engine:

`styles.css` dòng `1630` (`max-h 780`), `2226` (`820`), `2316` (`700`), `3106` (`≥1024 & max-h 780`), `3329` (`≥1024 & max-h 720`), `3388` (`1024–1366 portrait`), `3759` (`max-h 740`), `3789` (`min-h 800`).

> Làm từng nhóm một, chụp ảnh so sánh trước/sau theo test matrix — **không xóa hàng loạt trong một commit**.

**Acceptance Phase 3**
- [ ] Số `@media` trong `styles.css` giảm rõ rệt (mục tiêu ≤ 20)
- [ ] Không còn `@media` nào dựa trên `max-height` cụ thể cho Page 1
- [ ] Không horizontal overflow, không overlap header/CTA ở toàn bộ test matrix

---

### Phase 4 — Scroll Engine + regression

**File:** `app.js`

- Scroll distance = `getAvailableHeight()`, không hard-code theo device (thay các nhánh `moveSectionDown/moveTo` cứng ở `app.js:703-724`).
- Section overflow → cuộn **nhiều bước trong section** trước khi chuyển section.
- Chặn overshoot ở cuối trang; recalc sau resize/orientationchange.
- Mũi tên `#sectionScrollHint` phản ánh đúng trạng thái (còn nội dung trong section vs. sang section kế).

---

## 6. Test matrix

Dùng đúng bộ đại diện trong tài liệu phân tích, chạy bằng script Playwright mới (`tools/viewport-shots.mjs`, Node 22 đã có sẵn — chỉ cần `npx playwright`):

| Nhóm | Viewport |
|---|---|
| Mobile | `320×568`, `360×650`, `360×800`, `375×812`, `390×844`, `392×740`, `392×788`, `414×630`, `414×808`, `430×753`, `440×850` |
| Tablet | `800×600`, `1024×768`, `1024×1024`, `1050×1500`, `1050×1893` |
| Desktop | `1280×603`, `1366×607`, `1366×768`, `1536×864`, `1920×854`, `1920×945`, `1920×1080`, `2560×1305`, `2880×1417` |

Script tự kiểm 3 lỗi phổ biến và fail nếu vi phạm:
1. `document.documentElement.scrollWidth > innerWidth` (tràn ngang)
2. CTA `.cta-register` nằm ngoài vùng nhìn thấy khi `data-fit="fit"`
3. Bất kỳ phần tử Page 1 nào bị header che (`getBoundingClientRect().top < headerHeight`)

Cặp cùng width khác height bắt buộc phải test: `360×650 / 360×800`, `392×740 / 392×788`, `414×630 / 414×808`, `1366×607 / 1366×768`, `1920×854 / 1920×1080`.

---

## 7. Rủi ro & đánh đổi

| Rủi ro | Mức | Xử lý |
|---|---|---|
| iOS Safari chặn unmute xuyên iframe | **Cao** | Verify sau 350ms, rollback về muted, nút loa thủ công (đã thiết kế ở 1.4) |
| Tự bật tiếng gây khó chịu / bị coi là intrusive | Trung bình | Volume 60%, nút tắt luôn hiển thị, nhớ lựa chọn trong session |
| `controls=0` = tự chịu trách nhiệm UI + sát ranh giới ToS về branding | Trung bình | Chỉ ẩn control bar (tham số hợp lệ của API), **không** che watermark bằng thủ thuật CSS |
| Xóa media query hàng loạt gây regression | Trung bình | Xóa theo nhóm nhỏ + ảnh so sánh theo matrix ở mỗi commit |
| `data-fit` đo sai khi web font chưa load | Thấp | Đo lại sau `document.fonts.ready` |

---

## 8. Thứ tự thực hiện đề xuất

1. **Phase 1** (video) — độc lập hoàn toàn, thấy kết quả ngay, có thể merge trước.
2. **Phase 2** (engine) — nền tảng cho Phase 3/4.
3. **Phase 3** (dọn CSS) — chia nhỏ nhiều commit.
4. **Phase 4** (scroll) — chốt bằng regression toàn matrix.

## 9. Cách kiểm tra thủ công

```bash
python3 -m http.server 8000   # mở http://localhost:8000
```

- DevTools → device toolbar → lần lượt các viewport trong matrix.
- Kiểm tra video: không còn chrome YouTube; nhấn vào vùng bất kỳ → có tiếng; bấm nút loa → tắt tiếng và không tự bật lại.
- Kiểm tra responsive: không tràn ngang, CTA luôn bấm được, không bị header che.
