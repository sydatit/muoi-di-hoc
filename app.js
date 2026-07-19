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
            syncRegisterModalViewport();
            
            setTimeout(() => {
                modal.classList.add('hidden');
                syncRegisterModalViewport();
            }, 300);
        }

        function playIntroVideo() {
            document.getElementById('videoModal').classList.remove('hidden');
        }
        function closeIntroVideo() {
            document.getElementById('videoModal').classList.add('hidden');
        }

        function syncHeaderHeight() {
            const header = document.querySelector('header');
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

        function initFullPageScroll() {
            const scroller = document.getElementById('pageScroll');
            const track = document.getElementById('pageScrollTrack');
            const pages = Array.from(track ? track.querySelectorAll(':scope > .snap-page') : []);
            if (!scroller || !track || pages.length === 0) return;

            scroller.classList.add('js-fullpage');

            const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            const INTERNAL_SCROLL_EPSILON = 14;
            const WHEEL_COOLDOWN_MS = 420;
            const TRANSITION_MS = 700;
            // fullPage.js default easeInOutCubic ≈ cubic-bezier(0.645, 0.045, 0.355, 1)
            const easeFullPage = createCubicBezier(0.645, 0.045, 0.355, 1);
            const navLinks = Array.from(document.querySelectorAll('a[href^="#"]')).filter((link) => {
                const id = link.getAttribute('href').slice(1);
                return pages.some((page) => page.id === id);
            });
            let activeIndex = 0;
            let animationFrame = null;
            let transitionLocked = false;
            let wheelCooldownUntil = 0;
            let wheelDelta = 0;
            let wheelDirection = 0;
            let lastWheelAt = 0;
            let resizeTimer = null;
            let touchState = null;
            let currentOffsetY = 0;

            const clampIndex = (index) => Math.max(0, Math.min(pages.length - 1, index));

            const pageHeight = () => scroller.clientHeight;

            const syncPageHeights = () => {
                const height = pageHeight();
                pages.forEach((page) => {
                    page.style.height = `${height}px`;
                    page.style.minHeight = `${height}px`;
                });
            };

            const offsetForIndex = (index) => -clampIndex(index) * pageHeight();

            const applyTrackOffset = (offsetY) => {
                currentOffsetY = offsetY;
                track.style.transform = `translate3d(0, ${offsetY}px, 0)`;
            };

            const nearestPageIndex = () => {
                const height = pageHeight();
                if (height <= 0) return activeIndex;
                return clampIndex(Math.round(-currentOffsetY / height));
            };

            const updateActivePage = (index, updateHash = true) => {
                activeIndex = clampIndex(index);
                const activePage = pages[activeIndex];

                pages.forEach((page, pageIndex) => {
                    page.classList.toggle('is-active', pageIndex === activeIndex);
                    page.setAttribute('aria-hidden', pageIndex === activeIndex ? 'false' : 'true');
                });

                navLinks.forEach((link) => {
                    const isActive = link.getAttribute('href') === `#${activePage.id}`;
                    if (isActive) link.setAttribute('aria-current', 'page');
                    else link.removeAttribute('aria-current');
                });

                if (updateHash && activePage.id && window.location.hash !== `#${activePage.id}`) {
                    const nextUrl = `${window.location.pathname}${window.location.search}#${activePage.id}`;
                    window.history.replaceState(null, '', nextUrl);
                }
            };

            const preparePageScroll = (index, fromIndex) => {
                const page = pages[index];
                if (!page) return;
                const maxScroll = page.scrollHeight - page.clientHeight;
                if (maxScroll <= INTERNAL_SCROLL_EPSILON) {
                    page.scrollTop = 0;
                    return;
                }
                // Entering from above → top; from below → bottom so reverse swipe can leave immediately.
                page.scrollTop = fromIndex > index ? maxScroll : 0;
            };

            let cooldownTimer = null;
            const finishTransition = (index) => {
                if (animationFrame !== null) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                applyTrackOffset(offsetForIndex(index));
                transitionLocked = true;
                wheelDelta = 0;
                const unlockAt = performance.now() + WHEEL_COOLDOWN_MS;
                wheelCooldownUntil = unlockAt;
                updateActivePage(index);
                if (cooldownTimer !== null) window.clearTimeout(cooldownTimer);
                cooldownTimer = window.setTimeout(() => {
                    cooldownTimer = null;
                    if (wheelCooldownUntil !== unlockAt) return;
                    transitionLocked = false;
                    wheelDelta = 0;
                    wheelCooldownUntil = 0;
                }, WHEEL_COOLDOWN_MS);
            };

            const goToPage = (index, { instant = false } = {}) => {
                const fromIndex = activeIndex;
                const nextIndex = clampIndex(index);
                const destination = offsetForIndex(nextIndex);

                if (animationFrame !== null) cancelAnimationFrame(animationFrame);
                transitionLocked = true;
                wheelCooldownUntil = Number.POSITIVE_INFINITY;
                preparePageScroll(nextIndex, fromIndex);

                if (instant || reduceMotionQuery.matches) {
                    finishTransition(nextIndex);
                    return;
                }

                const start = currentOffsetY;
                const distance = destination - start;
                if (Math.abs(distance) < 1) {
                    finishTransition(nextIndex);
                    return;
                }

                const startedAt = performance.now();
                const animate = (now) => {
                    const progress = Math.min(1, (now - startedAt) / TRANSITION_MS);
                    const eased = easeFullPage(progress);
                    applyTrackOffset(start + distance * eased);

                    if (progress < 1) {
                        animationFrame = requestAnimationFrame(animate);
                    } else {
                        finishTransition(nextIndex);
                    }
                };
                animationFrame = requestAnimationFrame(animate);
            };

            const canPageScrollInternally = (page, direction) => {
                if (!page) return false;
                const maxScroll = page.scrollHeight - page.clientHeight;
                if (maxScroll <= INTERNAL_SCROLL_EPSILON) return false;
                return direction > 0
                    ? page.scrollTop < maxScroll - INTERNAL_SCROLL_EPSILON
                    : page.scrollTop > INTERNAL_SCROLL_EPSILON;
            };

            const pageForEvent = (target) => {
                const page = target instanceof Element ? target.closest('.snap-page') : null;
                return page && page.parentElement === track ? page : pages[nearestPageIndex()];
            };

            const isInputLocked = () =>
                transitionLocked || performance.now() < wheelCooldownUntil;

            scroller.addEventListener('wheel', (event) => {
                if (document.body.classList.contains('modal-open')) return;
                if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

                const direction = Math.sign(event.deltaY);
                const page = pageForEvent(event.target);
                const pageIndex = pages.indexOf(page);
                if (direction === 0 || pageIndex < 0) return;

                if (!isInputLocked() && canPageScrollInternally(page, direction)) {
                    wheelDelta = 0;
                    return;
                }

                event.preventDefault();
                if (isInputLocked()) return;

                const nextIndex = clampIndex(pageIndex + direction);
                if (nextIndex === pageIndex) {
                    // At first/last page: swallow residual inertia without thrashing wheelDelta.
                    wheelDelta = 0;
                    wheelDirection = direction;
                    lastWheelAt = performance.now();
                    return;
                }

                const now = performance.now();
                if (direction !== wheelDirection || now - lastWheelAt > 180) wheelDelta = 0;
                wheelDirection = direction;
                lastWheelAt = now;
                const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
                    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scroller.clientHeight
                    : 1;
                wheelDelta += event.deltaY * multiplier;

                if (Math.abs(wheelDelta) >= 40) {
                    goToPage(nextIndex);
                }
            }, { passive: false });

            scroller.addEventListener('touchstart', (event) => {
                if (event.touches.length !== 1 || document.body.classList.contains('modal-open')) {
                    touchState = null;
                    return;
                }
                const touch = event.touches[0];
                touchState = {
                    page: pageForEvent(event.target),
                    lastX: touch.clientX,
                    lastY: touch.clientY,
                    edgeDelta: 0,
                    triggered: false
                };
            }, { passive: true });

            scroller.addEventListener('touchmove', (event) => {
                if (!touchState || touchState.triggered || event.touches.length !== 1) return;
                const touch = event.touches[0];
                const deltaX = touchState.lastX - touch.clientX;
                const deltaY = touchState.lastY - touch.clientY;
                touchState.lastX = touch.clientX;
                touchState.lastY = touch.clientY;

                if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
                    touchState.edgeDelta = 0;
                    return;
                }

                const direction = Math.sign(deltaY);
                if (direction === 0 || canPageScrollInternally(touchState.page, direction)) {
                    touchState.edgeDelta = 0;
                    return;
                }

                event.preventDefault();
                touchState.edgeDelta += deltaY;
                if (Math.abs(touchState.edgeDelta) < 48 || isInputLocked()) return;

                const pageIndex = pages.indexOf(touchState.page);
                const nextIndex = clampIndex(pageIndex + Math.sign(touchState.edgeDelta));
                touchState.triggered = true;
                if (nextIndex !== pageIndex) goToPage(nextIndex);
            }, { passive: false });

            const clearTouchState = () => {
                touchState = null;
            };
            scroller.addEventListener('touchend', clearTouchState, { passive: true });
            scroller.addEventListener('touchcancel', clearTouchState, { passive: true });

            document.addEventListener('keydown', (event) => {
                if (event.defaultPrevented || document.body.classList.contains('modal-open')) return;
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                if (event.target instanceof Element && event.target.closest(
                    'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]'
                )) return;

                let direction = 0;
                if (['ArrowDown', 'PageDown'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) direction = 1;
                if (['ArrowUp', 'PageUp'].includes(event.key) || (event.key === ' ' && event.shiftKey)) direction = -1;

                if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    if (!isInputLocked()) goToPage(event.key === 'Home' ? 0 : pages.length - 1);
                    return;
                }
                if (direction === 0) return;

                const pageIndex = nearestPageIndex();
                const page = pages[pageIndex];
                if (canPageScrollInternally(page, direction)) {
                    event.preventDefault();
                    const shortStep = event.key === 'ArrowDown' || event.key === 'ArrowUp';
                    const distance = shortStep ? 64 : page.clientHeight * 0.82;
                    page.scrollBy({
                        top: distance * direction,
                        behavior: reduceMotionQuery.matches ? 'auto' : 'smooth'
                    });
                    return;
                }
                event.preventDefault();
                if (!isInputLocked()) goToPage(pageIndex + direction);
            });

            navLinks.forEach((link) => {
                link.addEventListener('click', (event) => {
                    const id = link.getAttribute('href').slice(1);
                    const index = pages.findIndex((page) => page.id === id);
                    if (index < 0) return;
                    event.preventDefault();
                    if (!isInputLocked() || index !== activeIndex) goToPage(index);
                });
            });

            const resyncPagePosition = () => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    syncAppHeight();
                    syncPageHeights();
                    // Do not re-snap the page under an open modal (focus/keyboard viewport churn).
                    if (document.body.classList.contains('modal-open') || isRegisterModalOpen()) return;
                    goToPage(nearestPageIndex(), { instant: true });
                }, 120);
            };

            window.addEventListener('resize', resyncPagePosition);
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', resyncPagePosition);
            }

            syncPageHeights();
            const hashIndex = pages.findIndex((page) => `#${page.id}` === window.location.hash);
            goToPage(hashIndex >= 0 ? hashIndex : 0, { instant: true });
        }

        /** CSS cubic-bezier → unit easing (t in [0,1] → eased progress). */
        function createCubicBezier(p1x, p1y, p2x, p2y) {
            const cx = 3 * p1x;
            const bx = 3 * (p2x - p1x) - cx;
            const ax = 1 - cx - bx;
            const cy = 3 * p1y;
            const by = 3 * (p2y - p1y) - cy;
            const ay = 1 - cy - by;

            const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
            const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;
            const sampleCurveDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

            const solveCurveX = (x) => {
                let t2 = x;
                for (let i = 0; i < 8; i += 1) {
                    const x2 = sampleCurveX(t2) - x;
                    if (Math.abs(x2) < 1e-6) return t2;
                    const d2 = sampleCurveDerivativeX(t2);
                    if (Math.abs(d2) < 1e-6) break;
                    t2 -= x2 / d2;
                }
                let t0 = 0;
                let t1 = 1;
                t2 = x;
                while (t0 < t1) {
                    const x2 = sampleCurveX(t2);
                    if (Math.abs(x2 - x) < 1e-6) return t2;
                    if (x > x2) t0 = t2;
                    else t1 = t2;
                    t2 = (t1 - t0) * 0.5 + t0;
                }
                return t2;
            };

            return (t) => {
                if (t <= 0) return 0;
                if (t >= 1) return 1;
                return sampleCurveY(solveCurveX(t));
            };
        }

        function initPageOneVideoLifecycle() {
            const video = document.getElementById('pageOneVideo');
            const section = document.getElementById('chuong-trinh');
            if (!video || !section || !('IntersectionObserver' in window)) return;

            let sectionVisible = false;
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

            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    sectionVisible = entry.isIntersecting && entry.intersectionRatio > 0.45;
                    if (sectionVisible) {
                        tryPlay();
                    } else {
                        video.pause();
                    }
                });
            }, { threshold: [0.45, 0.7] });

            observer.observe(section);

            // Tap the video itself to toggle sound: mute → unmute → mute → …
            // Document-level pointerdown used to unmute on any page touch; on Chrome
            // Android that pauses muted autoplay, leaving the clip stuck until scroll-back.
            const toggleSoundFromVideoTap = () => {
                if (!sectionVisible) return;

                if (!video.muted) {
                    video.muted = true;
                    return;
                }

                video.muted = false;
                video.volume = 1;

                const recoverMutedPlayback = () => {
                    video.muted = true;
                    if (sectionVisible) tryPlay();
                };

                const playPromise = tryPlay();
                if (playPromise && typeof playPromise.then === 'function') {
                    playPromise.then(() => {
                        // Some Android Chrome builds unmute + pause without rejecting play().
                        if (sectionVisible && video.paused) {
                            recoverMutedPlayback();
                        }
                    }).catch(() => {
                        recoverMutedPlayback();
                    });
                } else {
                    requestAnimationFrame(() => {
                        if (sectionVisible && video.paused) {
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
                if (!tapStart) {
                    return;
                }
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

        // Expose for inline onsubmit/onclick (file:// + consistency with carousel bindings)
        window.openRegisterModal = openRegisterModal;
        window.closeRegisterModal = closeRegisterModal;
        window.handleFormSubmit = handleFormSubmit;

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
            syncAppHeight();
            initFullPageScroll();
            initPageOneVideoLifecycle();
            lucide.createIcons();

            window.addEventListener('resize', syncAppHeight);
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', syncAppHeight);
                window.visualViewport.addEventListener('scroll', syncAppHeight);
            }

            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape') return;
                const registerModal = document.getElementById('registerModal');
                const videoModal = document.getElementById('videoModal');
                if (registerModal && !registerModal.classList.contains('hidden')) {
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
