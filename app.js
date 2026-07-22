        // -------------------------------------------------------------
        // 1. CHỨC NĂNG TRACKING KHÁCH HÀNG (DEVELOPER REQUIREMENTS)
        // -------------------------------------------------------------
        const trackingState = {
            visitorId: '',
            cd: 'N/A (Truy cập trực tiếp)',
            timeSpent: 0,
            clicks: 0,
            isFormCompleted: false,
            entryPoint: ''
        };

        function initTracking() {
            let storedId = localStorage.getItem('mdh_visitor_id');
            if (!storedId) {
                storedId = 'VISITOR-' + Math.random().toString(36).substring(2, 11).toUpperCase();
                localStorage.setItem('mdh_visitor_id', storedId);
            }
            trackingState.visitorId = storedId;

            let storedCd = localStorage.getItem('mdh_campaign_cd');
            const urlParams = new URLSearchParams(window.location.search);
            const currentCd = urlParams.get('cd') || urlParams.get('utm_source');

            if (currentCd) {
                if (!storedCd) {
                    localStorage.setItem('mdh_campaign_cd', currentCd);
                    trackingState.cd = currentCd;
                } else {
                    trackingState.cd = storedCd;
                }
            } else {
                if (storedCd) {
                    trackingState.cd = storedCd;
                }
            }

            let storedFormStatus = localStorage.getItem('mdh_form_completed');
            if (storedFormStatus === 'true') {
                trackingState.isFormCompleted = true;
            }

            document.addEventListener('click', (e) => {
                const isClickable = e.target.closest('a') || e.target.closest('button');
                if (isClickable) {
                    trackingState.clicks += 1;
                    updateDevConsoleUI();
                }
            });

            setInterval(() => {
                trackingState.timeSpent += 1;
                updateDevConsoleUI();
            }, 1000);

            updateDevConsoleUI();
        }

        function updateDevConsoleUI() {
            const devId = document.getElementById('dev_visitorId');
            const devCd = document.getElementById('dev_cd');
            const devTime = document.getElementById('dev_time');
            const devClicks = document.getElementById('dev_clicks');
            if(devId) devId.innerText = trackingState.visitorId;
            if(devCd) devCd.innerText = trackingState.cd;
            if(devTime) devTime.innerText = trackingState.timeSpent + ' giây';
            if(devClicks) devClicks.innerText = trackingState.clicks + ' lần';
            
            const formStatusEl = document.getElementById('dev_form_status');
            if (formStatusEl) {
                if (trackingState.isFormCompleted) {
                    formStatusEl.innerText = 'Đã Hoàn Thành';
                    formStatusEl.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/40';
                } else {
                    formStatusEl.innerText = 'Chưa Đăng Ký';
                    formStatusEl.className = 'px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950 text-red-400 border border-red-900/40';
                }
            }
        }

        function resetTrackingDemo() {
            localStorage.removeItem('mdh_visitor_id');
            localStorage.removeItem('mdh_campaign_cd');
            localStorage.removeItem('mdh_form_completed');
            window.location.href = window.location.pathname;
        }

        function toggleDevConsole() {
            const consoleEl = document.getElementById('devConsole');
            consoleEl.classList.toggle('hidden');
        }

        // -------------------------------------------------------------
        // 2. LOGIC MỞ POPUP & FORM SUBMISSION
        // -------------------------------------------------------------
        function isRegisterModalOpen() {
            const modal = document.getElementById('registerModal');
            return Boolean(modal && !modal.classList.contains('hidden'));
        }

        function openRegisterModal(entryPointName) {
            trackingState.entryPoint = entryPointName;
            
            const modal = document.getElementById('registerModal');
            const card = document.getElementById('modalCard');
            const form = document.getElementById('enrollmentForm');
            
            document.getElementById('track_visitorId').value = trackingState.visitorId;
            document.getElementById('track_cd').value = trackingState.cd;
            document.getElementById('track_timeSpent').value = trackingState.timeSpent;
            document.getElementById('track_clicks').value = trackingState.clicks;
            document.getElementById('track_entryPoint').value = trackingState.entryPoint;

            document.body.classList.add('modal-open');
            if (form) form.scrollTop = 0;
            modal.classList.remove('hidden');
            setFullPageScrolling(false);
            syncAppHeight();
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }, 50);
        }

        function closeRegisterModal() {
            const modal = document.getElementById('registerModal');
            const card = document.getElementById('modalCard');
            const active = document.activeElement;
            if (active && modal && modal.contains(active) && typeof active.blur === 'function') {
                active.blur();
            }
            
            modal.classList.add('opacity-0');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            document.body.classList.remove('modal-open');
            setFullPageScrolling(true);
            syncRegisterModalViewport();
            
            setTimeout(() => {
                modal.classList.add('hidden');
                syncRegisterModalViewport();
            }, 300);
        }

        const INTRO_VIDEO_EMBED = 'https://www.youtube.com/embed/iGl9y1BA4j8?autoplay=1&rel=0';

        function playIntroVideo() {
            const modal = document.getElementById('videoModal');
            const frame = document.getElementById('introVideoFrame');
            if (frame) {
                frame.src = INTRO_VIDEO_EMBED;
            }
            if (modal) {
                modal.classList.remove('hidden');
                document.body.classList.add('modal-open');
                setFullPageScrolling(false);
            }
        }
        function closeIntroVideo() {
            const modal = document.getElementById('videoModal');
            const frame = document.getElementById('introVideoFrame');
            if (modal) {
                modal.classList.add('hidden');
            }
            if (frame) {
                frame.src = '';
            }
            if (!isRegisterModalOpen()) {
                document.body.classList.remove('modal-open');
                setFullPageScrolling(true);
            }
        }

        function syncHeaderHeight() {
            const header = document.getElementById('siteHeader') || document.querySelector('header.site-header');
            if (!header) return;
            document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
        }

        function syncRegisterModalViewport() {
            const modal = document.getElementById('registerModal');
            if (!modal) return;
            const vv = window.visualViewport;
            if (!isRegisterModalOpen() || !vv) {
                modal.style.top = '';
                modal.style.left = '';
                modal.style.width = '';
                return;
            }
            // Pin the overlay to the visual viewport so keyboard/focus pan cannot leave a white gap.
            modal.style.top = `${Math.round(vv.offsetTop || 0)}px`;
            modal.style.left = `${Math.round(vv.offsetLeft || 0)}px`;
            modal.style.width = `${Math.round(vv.width || window.innerWidth)}px`;
        }

        function syncAppHeight() {
            const vv = window.visualViewport;
            const height = vv && typeof vv.height === 'number' ? vv.height : window.innerHeight;
            if (!height || height < 1) return;
            document.documentElement.style.setProperty('--app-height', `${Math.round(height)}px`);
            syncHeaderHeight();
            syncRegisterModalViewport();
            // While the register modal is open, avoid fighting Chrome's focus/keyboard pan.
            if (document.body.classList.contains('modal-open') || isRegisterModalOpen()) {
                return;
            }
            // Chrome Android can pan the visual viewport; keep the shell pinned at the top.
            if (window.scrollX || window.scrollY) {
                window.scrollTo(0, 0);
            }
        }

        const FULLPAGE_SECTION_IDS = ['chuong-trinh', 'gioi-thieu', 've-chung-toi'];
        let fullpageApi = null;
        let pageOneVideoVisible = false;
        let setPageOneVideoVisible = () => {};
        let rebuildFullPageTimer = null;

        function setFullPageScrolling(enabled) {
            if (!fullpageApi) return;
            fullpageApi.setAllowScrolling(enabled);
            fullpageApi.setKeyboardScrolling(enabled);
        }

        function sectionIndexFromId(id) {
            return FULLPAGE_SECTION_IDS.indexOf(id);
        }

        function syncNavCurrent(sectionId) {
            document.querySelectorAll('#siteNav a[href^="#"], a[href^="#chuong-trinh"], a[href^="#gioi-thieu"], a[href^="#ve-chung-toi"]').forEach((link) => {
                const href = link.getAttribute('href');
                if (!href || !href.startsWith('#')) return;
                const isActive = href === `#${sectionId}`;
                if (isActive) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
        }

        function updateSectionHash(sectionId) {
            if (!sectionId) return;
            const nextHash = `#${sectionId}`;
            if (window.location.hash !== nextHash) {
                const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
                window.history.replaceState(null, '', nextUrl);
            }
            syncNavCurrent(sectionId);
        }

        function scheduleFullPageRebuild() {
            if (rebuildFullPageTimer !== null) window.clearTimeout(rebuildFullPageTimer);
            rebuildFullPageTimer = window.setTimeout(() => {
                rebuildFullPageTimer = null;
                if (document.body.classList.contains('modal-open') || isRegisterModalOpen()) return;
                if (fullpageApi && typeof fullpageApi.reBuild === 'function') {
                    fullpageApi.reBuild();
                }
            }, 120);
        }

        function initFullPageScroll() {
            if (typeof fullpage !== 'function') return;
            const container = document.getElementById('fullpage');
            if (!container) return;

            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const hashId = window.location.hash.replace(/^#/, '');
            const hashIndex = sectionIndexFromId(hashId);

            fullpageApi = new fullpage('#fullpage', {
                // GPLv3 project: replace with your OSS/commercial key from alvarotrigo.com/fullPage
                licenseKey: 'gplv3-license',
                sectionSelector: '.section',
                // Avoid anchors option — same names as section IDs conflict with fullPage.
                lockAnchors: true,
                recordHistory: false,
                navigation: false,
                scrollingSpeed: reduceMotion ? 0 : 700,
                css3: true,
                easingcss3: 'ease',
                autoScrolling: true,
                fitToSection: true,
                fitToSectionDelay: 300,
                scrollBar: false,
                scrollOverflow: true,
                scrollOverflowMacStyle: true,
                fixedElements: '#siteHeader',
                normalScrollElements: '#registerModal, #videoModal, #imageLightbox, #modalCard, #enrollmentForm',
                verticalCentered: false,
                onLeave(_origin, _destination, _direction) {
                    // Pause page-1 video as soon as we leave so decode cost drops mid-transition.
                    if (_origin && _origin.item && _origin.item.id === 'chuong-trinh') {
                        setPageOneVideoVisible(false);
                    }
                },
                afterLoad(_origin, destination) {
                    const sectionEl = destination && destination.item;
                    const sectionId = sectionEl && sectionEl.id;
                    if (sectionId) updateSectionHash(sectionId);
                    setPageOneVideoVisible(sectionId === 'chuong-trinh');
                },
                afterRender() {
                    const active = container.querySelector('.section.active') || container.querySelector('.section');
                    if (active && active.id) {
                        updateSectionHash(active.id);
                        setPageOneVideoVisible(active.id === 'chuong-trinh');
                    }
                },
                afterResize() {
                    syncHeaderHeight();
                }
            });

            // Expose for modal helpers / debugging.
            window.fullpage_api = fullpageApi;

            document.querySelectorAll('a[href^="#"]').forEach((link) => {
                const id = (link.getAttribute('href') || '').slice(1);
                const index = sectionIndexFromId(id);
                if (index < 0) return;
                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    if (document.body.classList.contains('modal-open')) return;
                    fullpageApi.moveTo(index + 1);
                });
            });

            if (hashIndex >= 0) {
                fullpageApi.silentMoveTo(hashIndex + 1);
            }
        }

        function initPageOneVideoLifecycle() {
            const video = document.getElementById('pageOneVideo');
            if (!video) return;

            let tapStart = null;

            // Keep muted autoplay reliable on mobile WebViews / older iOS.
            video.muted = true;
            video.defaultMuted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');

            const tryPlay = () => {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
                return playPromise;
            };

            setPageOneVideoVisible = (visible) => {
                pageOneVideoVisible = Boolean(visible);
                if (pageOneVideoVisible) {
                    tryPlay();
                } else {
                    video.pause();
                }
            };

            // Tap the video itself to toggle sound: mute → unmute → mute → …
            const toggleSoundFromVideoTap = () => {
                if (!pageOneVideoVisible) return;

                if (!video.muted) {
                    video.muted = true;
                    return;
                }

                video.muted = false;
                video.volume = 1;

                const recoverMutedPlayback = () => {
                    video.muted = true;
                    if (pageOneVideoVisible) tryPlay();
                };

                const playPromise = tryPlay();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(() => {
                        if (pageOneVideoVisible && video.paused) {
                            recoverMutedPlayback();
                        }
                    }).catch(() => {
                        recoverMutedPlayback();
                    });
                } else {
                    requestAnimationFrame(() => {
                        if (pageOneVideoVisible && video.paused) {
                            recoverMutedPlayback();
                        }
                    });
                }
            };

            const videoHost = video.closest('.p1-video') || video;
            videoHost.addEventListener('pointerdown', (event) => {
                if (event.isPrimary === false) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                tapStart = { x: event.clientX, y: event.clientY };
            }, { passive: true });

            videoHost.addEventListener('pointerup', (event) => {
                if (!tapStart) return;
                const dx = event.clientX - tapStart.x;
                const dy = event.clientY - tapStart.y;
                tapStart = null;
                // Ignore swipes so fullpage page changes from the video area stay mute-safe.
                if (Math.hypot(dx, dy) > 12) return;
                toggleSoundFromVideoTap();
            }, { passive: true });

            videoHost.addEventListener('pointercancel', () => {
                tapStart = null;
            }, { passive: true });
        }

        function showToast(title, message) {
            const toast = document.getElementById('toast');
            document.getElementById('toastTitle').innerText = title;
            document.getElementById('toastMsg').innerText = message;
            
            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('translate-x-1');
            }, 50);

            setTimeout(() => {
                toast.classList.add('hidden');
            }, 5000);
        }

        function isValidVietnamesePhone(phone) {
            const cleaned = phone.replace(/[\s\-.]/g, '');
            return /^(0)(3|5|7|8|9)\d{8}$/.test(cleaned);
        }

        function setFieldError(fieldId, errorId, message) {
            const field = document.getElementById(fieldId);
            const errorEl = document.getElementById(errorId);
            if (!field || !errorEl) return null;
            field.classList.add('border-red-500', 'focus:ring-red-500');
            field.classList.remove('border-gray-200', 'focus:ring-brand-rust', 'focus:ring-brand-pink');
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            return field;
        }

        function clearFieldError(fieldId, errorId) {
            const field = document.getElementById(fieldId);
            const errorEl = document.getElementById(errorId);
            if (!field || !errorEl) return;
            field.classList.remove('border-red-500', 'focus:ring-red-500');
            field.classList.add('border-gray-200', 'focus:ring-brand-rust');
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }

        function setGroupError(groupId, errorId, message) {
            const group = document.getElementById(groupId);
            const errorEl = document.getElementById(errorId);
            if (!group || !errorEl) return null;
            group.classList.add('ring-1', 'ring-red-500', 'rounded-xl');
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
            return group;
        }

        function clearGroupError(groupId, errorId) {
            const group = document.getElementById(groupId);
            const errorEl = document.getElementById(errorId);
            if (!group || !errorEl) return;
            group.classList.remove('ring-1', 'ring-red-500', 'rounded-xl');
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }

        function focusFirstEnrollmentError(targetEl) {
            if (!targetEl) return;
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const focusable = targetEl.matches('input, textarea, select, button')
                ? targetEl
                : targetEl.querySelector('input, textarea, select, button');
            if (focusable && typeof focusable.focus === 'function') {
                try {
                    focusable.focus({ preventScroll: true });
                } catch (_) {
                    focusable.focus();
                }
            }
        }

        function validateEnrollmentForm() {
            const fullNameEl = document.getElementById('fullName');
            const ageEl = document.getElementById('age');
            const phoneEl = document.getElementById('phoneNumber');
            const acknowledgementEl = document.getElementById('acknowledgement');
            if (!fullNameEl || !ageEl || !phoneEl || !acknowledgementEl) {
                return { isValid: false, firstErrorEl: null };
            }

            const fullName = fullNameEl.value.trim();
            const age = ageEl.value.trim();
            const phone = phoneEl.value.trim();
            const youtubeExperienceEl = document.getElementById('youtubeExperience');
            const youtubeExperience = youtubeExperienceEl ? youtubeExperienceEl.value.trim() : '';
            const acknowledgement = acknowledgementEl.checked;
            let isValid = true;
            let firstErrorEl = null;

            const markError = (el) => {
                if (!firstErrorEl && el) firstErrorEl = el;
            };

            clearFieldError('fullName', 'fullNameError');
            clearFieldError('age', 'ageError');
            clearFieldError('phoneNumber', 'phoneError');
            clearFieldError('youtubeExperience', 'youtubeExperienceError');
            clearGroupError('acknowledgementGroup', 'acknowledgementError');

            if (!fullName) {
                markError(setFieldError('fullName', 'fullNameError', 'Vui lòng nhập họ và tên.'));
                isValid = false;
            }

            if (!age) {
                markError(setFieldError('age', 'ageError', 'Vui lòng nhập độ tuổi.'));
                isValid = false;
            } else if (Number(age) < 10 || Number(age) > 100) {
                markError(setFieldError('age', 'ageError', 'Vui lòng nhập độ tuổi từ 10 đến 100.'));
                isValid = false;
            }

            if (!phone) {
                markError(setFieldError('phoneNumber', 'phoneError', 'Vui lòng nhập số điện thoại.'));
                isValid = false;
            } else if (!isValidVietnamesePhone(phone)) {
                markError(setFieldError(
                    'phoneNumber',
                    'phoneError',
                    'Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.'
                ));
                isValid = false;
            }

            if (!youtubeExperience) {
                markError(setFieldError('youtubeExperience', 'youtubeExperienceError', 'Vui lòng chọn kinh nghiệm làm Youtube.'));
                isValid = false;
            }

            if (!acknowledgement) {
                markError(setGroupError('acknowledgementGroup', 'acknowledgementError', 'Bạn cần xác nhận đã hiểu các lưu ý trước khi đăng ký.'));
                isValid = false;
            }

            return { isValid, firstErrorEl };
        }

        function handleFormSubmit(e) {
            if (e && typeof e.preventDefault === 'function') {
                e.preventDefault();
            }

            const validation = validateEnrollmentForm();
            if (!validation.isValid) {
                focusFirstEnrollmentError(validation.firstErrorEl);
                return false;
            }

            const submitBtn = document.getElementById('submitBtn');
            if (!submitBtn || submitBtn.disabled) return false;
            const originalContent = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang gửi đăng ký...
            `;

            const expertQuestionEl = document.getElementById('expertQuestion');
            const expertQuestion = expertQuestionEl ? expertQuestionEl.value.trim() : '';
            const youtubeExperienceEl = document.getElementById('youtubeExperience');
            const incomePotential = document.querySelector('input[name="incomePotential"]:checked');
            const formData = {
                visitorId: trackingState.visitorId,
                campaignCd: trackingState.cd,
                timeSpent: trackingState.timeSpent + ' giây',
                clicks: trackingState.clicks + ' lần',
                entryPoint: trackingState.entryPoint,
                fullName: document.getElementById('fullName').value.trim(),
                age: document.getElementById('age').value.trim(),
                phone: document.getElementById('phoneNumber').value.trim(),
                youtubeExperience: youtubeExperienceEl ? youtubeExperienceEl.value.trim() : '',
                incomePotential: incomePotential ? incomePotential.value : '',
                expertQuestion: expertQuestion || 'Không có câu hỏi',
                acknowledgement: document.getElementById('acknowledgement').checked,
                // Giữ các khóa cũ để Google Apps Script hiện tại vẫn có thể xử lý tương thích.
                email: 'Không thu thập',
                message: expertQuestion || 'Không có câu hỏi',
                submittedAt: new Date().toLocaleString('vi-VN')
            };

            const webAppUrl = "https://script.google.com/macros/s/AKfycbxutSomf-NS02ZhPuhcPsI9KhmbMJf7eDFHNdkt4BrF5ow8yCzI2GYLTbU6_yaGdcnj/exec";

            // Gửi dữ liệu thực tế tới Google Apps Script Web App sử dụng POST fetch api
            fetch(webAppUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8' // Sử dụng text/plain giúp bỏ qua bước kiểm tra preflight CORS từ Apps Script
                },
                body: JSON.stringify(formData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Mạng không ổn định hoặc lỗi máy chủ Apps Script.");
                }
                return response.json();
            })
            .then(result => {
                if (result.status === "success") {
                    trackingState.isFormCompleted = true;
                    localStorage.setItem('mdh_form_completed', 'true');
                    updateDevConsoleUI();

                    closeRegisterModal();
                    document.getElementById('enrollmentForm').reset();
                    
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalContent;

                    showToast(
                        "Đăng ký thành công!",
                        "Chúng tôi sẽ sớm liên hệ lại với bạn."
                    );
                } else {
                    throw new Error(result.message || "Không thể lưu dữ liệu.");
                }
            })
            .catch(error => {
                console.error("Lỗi gửi dữ liệu tuyển sinh:", error);
                
                // Khôi phục nút bấm về trạng thái gốc để người dùng có thể gửi lại khi mạng ổn định
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;

                showToast(
                    "Lỗi kết nối!",
                    "Không thể lưu thông tin vào Google Sheet. Hãy kiểm tra kết nối mạng hoặc quyền truy cập của Web App."
                );
            });

            return false;
        }

        // -------------------------------------------------------------
        // 2b. IMAGE LIGHTBOX (tap/click to zoom, tap outside to close)
        // -------------------------------------------------------------
        function isImageLightboxOpen() {
            const lightbox = document.getElementById('imageLightbox');
            return Boolean(lightbox && !lightbox.classList.contains('hidden'));
        }

        function isLightboxableImage(img) {
            if (!img || img.tagName !== 'IMG') return false;
            if (img.closest('#imageLightbox')) return false;
            if (img.hasAttribute('data-no-lightbox')) return false;
            if (img.closest('header.site-header, #siteHeader')) return false;
            if (img.classList.contains('p3-hero-logo')) return false;
            const src = img.currentSrc || img.getAttribute('src') || '';
            if (!src || src.endsWith('.svg')) return false;
            return true;
        }

        function openImageLightbox(img) {
            const lightbox = document.getElementById('imageLightbox');
            const lightboxImg = document.getElementById('imageLightboxImg');
            const caption = document.getElementById('imageLightboxCaption');
            if (!lightbox || !lightboxImg || !img) return;

            const src = img.currentSrc || img.src;
            if (!src) return;

            lightboxImg.src = src;
            lightboxImg.alt = img.alt || 'Ảnh xem chi tiết';
            if (caption) {
                caption.textContent = img.alt || '';
            }

            document.body.classList.add('modal-open');
            lightbox.hidden = false;
            lightbox.classList.remove('hidden');
            setFullPageScrolling(false);
            requestAnimationFrame(() => {
                lightbox.classList.add('is-open');
            });

            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }

        function closeImageLightbox() {
            const lightbox = document.getElementById('imageLightbox');
            const lightboxImg = document.getElementById('imageLightboxImg');
            if (!lightbox || lightbox.classList.contains('hidden')) return;

            lightbox.classList.remove('is-open');
            const finishClose = () => {
                lightbox.classList.add('hidden');
                lightbox.hidden = true;
                if (lightboxImg) {
                    lightboxImg.removeAttribute('src');
                    lightboxImg.alt = '';
                }
                if (!isRegisterModalOpen()) {
                    const videoModal = document.getElementById('videoModal');
                    const videoOpen = videoModal && !videoModal.classList.contains('hidden');
                    if (!videoOpen) {
                        document.body.classList.remove('modal-open');
                        setFullPageScrolling(true);
                    }
                }
            };

            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduceMotion) {
                finishClose();
                return;
            }
            window.setTimeout(finishClose, 220);
        }

        function initImageLightbox() {
            const lightbox = document.getElementById('imageLightbox');
            if (!lightbox) return;

            let pointerStart = null;

            document.addEventListener('pointerdown', (event) => {
                const img = event.target.closest('img');
                if (!img || !isLightboxableImage(img)) {
                    pointerStart = null;
                    return;
                }
                pointerStart = { x: event.clientX, y: event.clientY };
            }, { passive: true });

            document.addEventListener('click', (event) => {
                if (isImageLightboxOpen()) return;
                if (isRegisterModalOpen()) return;
                const videoModal = document.getElementById('videoModal');
                if (videoModal && !videoModal.classList.contains('hidden')) return;

                const img = event.target.closest('img');
                if (!img || !isLightboxableImage(img)) return;

                // Ignore swipe/drag gestures (carousel, scroll).
                if (pointerStart) {
                    const dx = Math.abs(event.clientX - pointerStart.x);
                    const dy = Math.abs(event.clientY - pointerStart.y);
                    pointerStart = null;
                    if (dx > 12 || dy > 12) return;
                }

                event.preventDefault();
                openImageLightbox(img);
            });

            lightbox.addEventListener('click', (event) => {
                if (event.target.closest('[data-lightbox-content]')) return;
                closeImageLightbox();
            });

            const closeBtn = lightbox.querySelector('[data-lightbox-close]');
            if (closeBtn) {
                closeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    closeImageLightbox();
                });
            }
        }

        // Expose for inline onsubmit/onclick (file:// + consistency with carousel bindings)
        window.openRegisterModal = openRegisterModal;
        window.closeRegisterModal = closeRegisterModal;
        window.handleFormSubmit = handleFormSubmit;
        window.closeImageLightbox = closeImageLightbox;

        // -------------------------------------------------------------
        // 3. PAGE 3 ACTIVITY + RECOGNITION CAROUSELS
        // -------------------------------------------------------------
        window.initPageThreeCarousels = function() {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

            document.querySelectorAll('[data-carousel]').forEach((carousel) => {
                const track = carousel.querySelector('.p3-carousel-track');
                const dots = Array.from(carousel.querySelectorAll('.p3-carousel-dot'));
                const previousButton = carousel.querySelector('[data-direction="prev"]');
                const nextButton = carousel.querySelector('[data-direction="next"]');
                if (!track || !previousButton || !nextButton) return;

                const originalSlides = Array.from(track.children);
                const slideCount = originalSlides.length;
                const autoplayDelay = Number(carousel.dataset.autoplay) || 0;
                let visibleSlides = 1;
                let internalIndex = 0;
                let logicalIndex = 0;
                let autoplayTimer = null;
                let resizeTimer = null;
                let pointerStartX = null;

                const getVisibleSlides = () => {
                    if (window.innerWidth >= 1024) return Number(carousel.dataset.desktopVisible) || 1;
                    if (window.innerWidth >= 640) return Number(carousel.dataset.tabletVisible) || 1;
                    return Number(carousel.dataset.mobileVisible) || 1;
                };

                const updateDots = () => {
                    dots.forEach((dot, index) => {
                        const active = index === logicalIndex;
                        dot.setAttribute('aria-current', active ? 'true' : 'false');
                    });
                };

                const positionTrack = (animate = true) => {
                    track.style.transition = animate ? '' : 'none';
                    track.style.transform = `translate3d(-${internalIndex * (100 / visibleSlides)}%, 0, 0)`;
                    if (!animate) {
                        track.getBoundingClientRect();
                        track.style.transition = '';
                    }
                    updateDots();
                };

                const stopAutoplay = () => {
                    if (autoplayTimer) {
                        window.clearInterval(autoplayTimer);
                        autoplayTimer = null;
                    }
                };

                const move = (direction, userInitiated = false) => {
                    if (userInitiated) stopAutoplay();
                    internalIndex += direction;
                    logicalIndex = (logicalIndex + direction + slideCount) % slideCount;
                    positionTrack(!reduceMotion.matches);
                };

                const startAutoplay = () => {
                    stopAutoplay();
                    if (!autoplayDelay || reduceMotion.matches || document.hidden) return;
                    autoplayTimer = window.setInterval(() => move(1), autoplayDelay);
                };

                const buildTrack = () => {
                    stopAutoplay();
                    track.querySelectorAll('[data-carousel-clone]').forEach((clone) => clone.remove());
                    visibleSlides = Math.min(getVisibleSlides(), slideCount);
                    carousel.style.setProperty('--carousel-visible', visibleSlides);

                    const prependFragment = document.createDocumentFragment();
                    originalSlides.slice(-visibleSlides).forEach((slide) => {
                        const clone = slide.cloneNode(true);
                        clone.dataset.carouselClone = 'true';
                        clone.setAttribute('aria-hidden', 'true');
                        prependFragment.appendChild(clone);
                    });
                    track.insertBefore(prependFragment, track.firstChild);

                    originalSlides.slice(0, visibleSlides).forEach((slide) => {
                        const clone = slide.cloneNode(true);
                        clone.dataset.carouselClone = 'true';
                        clone.setAttribute('aria-hidden', 'true');
                        track.appendChild(clone);
                    });

                    internalIndex = visibleSlides + logicalIndex;
                    positionTrack(false);
                    startAutoplay();
                };

                const goToSlide = (index) => {
                    stopAutoplay();
                    logicalIndex = index;
                    internalIndex = visibleSlides + logicalIndex;
                    positionTrack(!reduceMotion.matches);
                };

                previousButton.addEventListener('click', () => move(-1, true));
                nextButton.addEventListener('click', () => move(1, true));
                dots.forEach((dot, index) => dot.addEventListener('click', () => goToSlide(index)));

                track.addEventListener('transitionend', () => {
                    if (internalIndex >= visibleSlides + slideCount) {
                        internalIndex = visibleSlides;
                        positionTrack(false);
                    } else if (internalIndex < visibleSlides) {
                        internalIndex = visibleSlides + slideCount - 1;
                        positionTrack(false);
                    }
                });

                carousel.addEventListener('mouseenter', stopAutoplay);
                carousel.addEventListener('mouseleave', startAutoplay);
                carousel.addEventListener('focusin', stopAutoplay);
                carousel.addEventListener('focusout', (event) => {
                    if (!carousel.contains(event.relatedTarget)) startAutoplay();
                });
                carousel.addEventListener('pointerdown', (event) => {
                    pointerStartX = event.clientX;
                });
                carousel.addEventListener('pointerup', (event) => {
                    if (pointerStartX === null) return;
                    const distance = event.clientX - pointerStartX;
                    pointerStartX = null;
                    if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1, true);
                });
                carousel.addEventListener('pointercancel', () => {
                    pointerStartX = null;
                });

                window.addEventListener('resize', () => {
                    window.clearTimeout(resizeTimer);
                    resizeTimer = window.setTimeout(buildTrack, 160);
                });
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) stopAutoplay();
                    else startAutoplay();
                });
                reduceMotion.addEventListener('change', startAutoplay);

                buildTrack();
            });
        };

        window.addEventListener('DOMContentLoaded', () => {
            initTracking();
            window.initPageThreeCarousels();
            initImageLightbox();
            syncAppHeight();
            initPageOneVideoLifecycle();
            initFullPageScroll();
            lucide.createIcons();

            window.addEventListener('resize', () => {
                syncAppHeight();
                scheduleFullPageRebuild();
            });
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', () => {
                    syncAppHeight();
                    scheduleFullPageRebuild();
                });
                window.visualViewport.addEventListener('scroll', syncAppHeight);
            }

            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                const registerModal = document.getElementById('registerModal');
                const videoModal = document.getElementById('videoModal');
                if (isImageLightboxOpen()) {
                    closeImageLightbox();
                } else if (registerModal && !registerModal.classList.contains('hidden')) {
                    closeRegisterModal();
                } else if (videoModal && !videoModal.classList.contains('hidden')) {
                    closeIntroVideo();
                }
            });

            const fullNameInput = document.getElementById('fullName');
            if (fullNameInput) {
                fullNameInput.addEventListener('input', () => {
                    clearFieldError('fullName', 'fullNameError');
                });
            }
            const ageInput = document.getElementById('age');
            if (ageInput) {
                ageInput.addEventListener('input', () => {
                    clearFieldError('age', 'ageError');
                });
            }
            const phoneInput = document.getElementById('phoneNumber');
            if (phoneInput) {
                phoneInput.addEventListener('input', () => {
                    clearFieldError('phoneNumber', 'phoneError');
                });
            }
            const enrollmentForm = document.getElementById('enrollmentForm');
            const preserveEnrollmentScroll = () => {
                if (!enrollmentForm) return;
                const top = enrollmentForm.scrollTop;
                requestAnimationFrame(() => {
                    enrollmentForm.scrollTop = top;
                    requestAnimationFrame(() => {
                        enrollmentForm.scrollTop = top;
                    });
                });
            };
            const youtubeExperienceSelect = document.getElementById('youtubeExperience');
            if (youtubeExperienceSelect) {
                youtubeExperienceSelect.addEventListener('change', () => {
                    clearFieldError('youtubeExperience', 'youtubeExperienceError');
                });
            }
            document.querySelectorAll('input[name="incomePotential"]').forEach((input) => {
                input.addEventListener('focus', preserveEnrollmentScroll);
                input.addEventListener('change', preserveEnrollmentScroll);
            });
            const acknowledgementInput = document.getElementById('acknowledgement');
            if (acknowledgementInput) {
                acknowledgementInput.addEventListener('change', () => {
                    clearGroupError('acknowledgementGroup', 'acknowledgementError');
                });
            }
        });
