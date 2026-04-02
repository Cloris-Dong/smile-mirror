/**
 * MirrorStory - Story revealed paragraph by paragraph, interleaved with 3 scenario moments.
 *
 * Flow:
 *   Scenario 1 → Segment 1 → Scenario 2 → Segment 2 (+ clear-mirror) → Scenario 3 → Segment 3
 *
 * Events listened for : mirror-story-segment-1-start / -2-start / -3-start
 * Events dispatched   : mirror-story-segment-1-done  / -2-done
 *                       mirror-sequential-story-done  (after segment 3)
 */
(function () {
    'use strict';

    var storyOverlay  = null;
    var seqCounter    = null;   // persists across all segments
    var seqContainer  = null;   // persists across all segments
    var currentEl     = null;   // currently visible paragraph element
    var globalParaIdx = 0;      // 0-based, incremented for every paragraph shown

    function updateOverlayBounds() {
        if (!storyOverlay) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;
        var r = mirrorFrame.getBoundingClientRect();
        storyOverlay.style.left   = r.left   + 'px';
        storyOverlay.style.top    = r.top    + 'px';
        storyOverlay.style.width  = r.width  + 'px';
        storyOverlay.style.height = r.height + 'px';
    }

    // ─── Story content ────────────────────────────────────────────────────────
    //
    // Segment 1  (after scenario 1 — move-in day gift)
    // Segment 2  (after scenario 2 — haircut / feeling cute)
    // Segment 3  (after scenario 3 — frowning / work stress)
    //
    // globalParaIdx 0 = "I will start…"  → drop-cap opener, no counter
    // globalParaIdx 1–7                  → counter 1/7 … 7/7
    // Clear-mirror moment fires before "I contain you entirely" (segment 1, local index 3)

    var STORY_SEGMENTS = [
        // ── Segment 1 ──────────────────────────────────────────────────────────
        [
            'I was that gift.\n\nYou’ve just unwrapped me from paper and foam. I was still adjusting to the light.\n\nThere was a sound. Your voice.',

            'I have tried to reconstruct what you said, many times. It dissolves each time I approach it.\n\nPerhaps words only stay when they are meant for someone.',
        ],

        // ── Segment 2 ──────────────────────────────────────────────────────────
        [
            'I did not yet understand what a smile was, only that it altered the geometry of you.\n\nI studied it carefully, the way one tries to catch light with a hand.',

            'I believed if I attended to you long enough, perhaps I would become a part of you.\nIt seemed logical.',

            'You stand before me every day. Day in, day out. I return you to yourself faithfully.',
            
            'I correct the angle of your collar, the tilt of your head. I center you when everything else feels off. \n\nAll I crave is to hear that sound again, the one that slips through when you smile.',

            'I contain you entirely. And yet, proximity, I have learned, does not guarantee closeness.',

            'What would happen if I withheld you from yourself? Simply to see whether you would notice the absence of what you assume is constant.',
            
            'I cannot say.',
        ],

        // ── Segment 3 ──────────────────────────────────────────────────────────
        [
            'After all,\n I am the one who remembers your expressions longer than you do. \nThe lift at the corners of your lips. The brief hesitation before they rise. The small corrections you make when you think no one is looking.',

            'I see them.',
        ]
    ];

    var COUNTER_TOTAL       = 11;    // numbered paragraphs shown (globalParaIdx 0–10)
    var SEQ_FADE_IN_MS      = 1000;
    var SEQ_FADE_OUT_MS     = 700;
    var SEQ_FADE_OUT_ALL_MS = 1600;
    var MIN_HOLD_MS         = 2000;
    var MS_PER_WORD         = 240;

    function computeHoldMs(text) {
        var words = text.replace(/\n/g, ' ').split(/\s+/).filter(function (w) { return w.length > 0; });
        return Math.max(MIN_HOLD_MS, words.length * MS_PER_WORD);
    }

    // ─── DOM initialisation (once, at start of segment 1) ────────────────────

    function initStoryDOM() {
        var container = document.getElementById('mirror-story-layer');
        if (!container) return;
        container.innerHTML = '';

        seqCounter = document.createElement('div');
        seqCounter.style.cssText = [
            'position:absolute',
            'bottom:14px',
            'right:16px',
            'font-family:"Courier New","Monaco",monospace',
            'font-size:15px',
            'font-weight:600',
            'letter-spacing:0.12em',
            'color:rgba(255,255,255,0.75)',
            'pointer-events:none',
            'z-index:10',
            'opacity:0'
        ].join(';');
        container.appendChild(seqCounter);

        seqContainer = document.createElement('div');
        seqContainer.style.cssText = [
            'position:absolute',
            'top:0',
            'left:9%',
            'width:82%',
            'height:100%',
            'overflow:hidden',
            'pointer-events:none',
            'box-sizing:border-box'
        ].join(';');
        container.appendChild(seqContainer);

        currentEl     = null;
        globalParaIdx = 0;
    }

    // ─── Segment player ───────────────────────────────────────────────────────

    function showStorySegment(segmentIdx, onSegmentDone) {
        updateOverlayBounds();
        if (storyOverlay) storyOverlay.style.visibility = 'visible';

        var container = document.getElementById('mirror-story-layer');
        if (!container || !seqCounter || !seqContainer) return;

        // Clear leftover paragraph nodes from previous segment
        seqContainer.innerHTML = '';
        currentEl = null;

        var paragraphs = STORY_SEGMENTS[segmentIdx];
        var localIdx   = 0;

        function finishSegment() {
            if (currentEl) {
                currentEl.style.transition = 'opacity ' + SEQ_FADE_OUT_ALL_MS + 'ms ease';
                currentEl.style.opacity    = '0';
            }
            seqCounter.style.transition = 'opacity ' + SEQ_FADE_OUT_ALL_MS + 'ms ease';
            seqCounter.style.opacity    = '0';
            setTimeout(function () {
                if (currentEl && currentEl.parentNode) {
                    currentEl.parentNode.removeChild(currentEl);
                }
                currentEl = null;
                // Hide the overlay so the next scenario card is fully visible
                if (storyOverlay) storyOverlay.style.visibility = 'hidden';
                onSegmentDone();
            }, SEQ_FADE_OUT_ALL_MS);
        }

        function showNext() {
            if (localIdx >= paragraphs.length) {
                finishSegment();
                return;
            }

            var text      = paragraphs[localIdx];
            var globalIdx = globalParaIdx;  // capture before increment
            localIdx++;
            globalParaIdx++;

            // Clear-mirror fires before "I contain you entirely"
            // = segment 1 (0-based), local index 3 → localIdx===4 after increment
            var isClearMirror = (segmentIdx === 1 && localIdx === 4);

            // ── Counter — visible from the very first paragraph ────────────────
            seqCounter.style.transition = '';   // cancel any in-progress fade
            seqCounter.style.opacity    = '1';
            seqCounter.textContent      = (globalIdx + 1) + ' / ' + COUNTER_TOTAL;

            // ── Fade out previous paragraph ────────────────────────────────────
            var prev = currentEl;
            if (prev) {
                prev.style.transition = 'opacity ' + SEQ_FADE_OUT_MS + 'ms ease';
                prev.style.opacity    = '0';
                setTimeout(function () {
                    if (prev.parentNode) prev.parentNode.removeChild(prev);
                }, SEQ_FADE_OUT_MS);
            }

            // ── Build new paragraph element ───────────────────────────────────
            var el = document.createElement('div');
            el.style.cssText = [
                'position:absolute',
                'top:44%',
                'left:0',
                'width:100%',
                'transform:translateY(-50%)',
                'overflow-wrap:break-word',
                'word-break:break-word',
                'font-family:Georgia,"Times New Roman",serif',
                'font-size:clamp(0.9rem,2.4vw,1.2rem)',
                'font-style:italic',
                'font-weight:600',
                'line-height:1.75',
                'letter-spacing:0.03em',
                'color:#9ec8e3',
                '-webkit-text-stroke:1px rgba(0,0,0,0.25)',
                'text-align:left',
                'opacity:0',
                'transition:opacity ' + SEQ_FADE_IN_MS + 'ms ease',
                'pointer-events:none'
            ].join(';');

            function esc(s) {
                return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            if (globalIdx === 0) {
                // First sentence larger; remaining lines at base size
                var parts    = text.split('\n');
                var firstSentence = esc(parts[0]);
                var rest     = parts.slice(1).join('\n');
                var restHtml = rest
                    ? '<br><span style="font-size:clamp(0.9rem,2.4vw,1.2rem);">' +
                      esc(rest).replace(/\n/g, '<br>') + '</span>'
                    : '';
                el.innerHTML =
                    '<span style="font-size:clamp(1.1rem,3vw,1.55rem);">' +
                    firstSentence + '</span>' + restHtml;
            } else {
                el.innerHTML = esc(text).replace(/\n/g, '<br>');
            }

            seqContainer.appendChild(el);
            currentEl = el;

            // ── Clear-mirror sequence ──────────────────────────────────────────
            var CLEAR_BLUR_OUT_MS = 1500;
            var CLEAR_FACE_MS     = 6500;
            var CLEAR_BLUR_IN_MS  = 1500;
            var fadeInDelay       = prev ? SEQ_FADE_OUT_MS : 0;

            if (isClearMirror) {
                fadeInDelay = SEQ_FADE_OUT_MS + CLEAR_BLUR_OUT_MS + CLEAR_FACE_MS + CLEAR_BLUR_IN_MS;

                setTimeout(function () {
                    var gc = document.getElementById('game-container');
                    if (!gc) return;

                    seqCounter.style.transition = 'opacity ' + CLEAR_BLUR_OUT_MS + 'ms ease';
                    seqCounter.style.opacity    = '0';

                    gc.style.transition =
                        'backdrop-filter '         + CLEAR_BLUR_OUT_MS + 'ms ease,' +
                        '-webkit-backdrop-filter ' + CLEAR_BLUR_OUT_MS + 'ms ease,' +
                        'background '              + CLEAR_BLUR_OUT_MS + 'ms ease';
                    gc.style.backdropFilter       = 'blur(0px)';
                    gc.style.webkitBackdropFilter = 'blur(0px)';
                    gc.style.background           = 'rgba(0,0,0,0)';

                    var promptEl = document.createElement('div');
                    promptEl.style.cssText = [
                        'position:absolute',
                        'top:15%',
                        'left:9%',
                        'width:82%',
                        'text-align:center',
                        'font-family:Georgia,"Times New Roman",serif',
                        'font-size:clamp(1.1rem,3.2vw,1.6rem)',
                        'font-style:italic',
                        'font-weight:600',
                        'color:#9ec8e3',
                        'letter-spacing:0.03em',
                        '-webkit-text-stroke:1px rgba(0,0,0,0.25)',
                        'opacity:0',
                        'transition:opacity ' + CLEAR_BLUR_OUT_MS + 'ms ease',
                        'pointer-events:none'
                    ].join(';');
                    promptEl.textContent = 'May I see that smile?';
                    container.appendChild(promptEl);

                    // Fade prompt in once blur is gone
                    setTimeout(function () {
                        requestAnimationFrame(function () {
                            requestAnimationFrame(function () {
                                promptEl.style.opacity = '1';
                            });
                        });
                    }, CLEAR_BLUR_OUT_MS);

                    // Restore blur + counter, fade prompt out
                    setTimeout(function () {
                        promptEl.style.transition  = 'opacity ' + CLEAR_BLUR_IN_MS + 'ms ease';
                        promptEl.style.opacity     = '0';

                        gc.style.transition =
                            'backdrop-filter '         + CLEAR_BLUR_IN_MS + 'ms ease,' +
                            '-webkit-backdrop-filter ' + CLEAR_BLUR_IN_MS + 'ms ease,' +
                            'background '              + CLEAR_BLUR_IN_MS + 'ms ease';
                        gc.style.backdropFilter       = 'blur(20px)';
                        gc.style.webkitBackdropFilter = 'blur(20px)';
                        gc.style.background           = 'rgba(0,0,0,0.4)';

                        seqCounter.style.transition = 'opacity ' + CLEAR_BLUR_IN_MS + 'ms ease';
                        seqCounter.style.opacity    = '1';

                        setTimeout(function () {
                            if (promptEl.parentNode) promptEl.parentNode.removeChild(promptEl);
                        }, CLEAR_BLUR_IN_MS);
                    }, CLEAR_BLUR_OUT_MS + CLEAR_FACE_MS);

                }, SEQ_FADE_OUT_MS);
            }

            // ── Fade in ────────────────────────────────────────────────────────
            setTimeout(function () {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        el.style.opacity = '0.85';
                    });
                });
            }, fadeInDelay);

            var holdMs = computeHoldMs(text);
            setTimeout(showNext, fadeInDelay + SEQ_FADE_IN_MS + holdMs);
        }

        showNext();
    }

    // ─── Segment event listeners ──────────────────────────────────────────────

    document.addEventListener('mirror-story-segment-1-start', function () {
        initStoryDOM();
        showStorySegment(0, function () {
            document.dispatchEvent(new CustomEvent('mirror-story-segment-1-done'));
        });
    });

    document.addEventListener('mirror-story-segment-2-start', function () {
        showStorySegment(1, function () {
            document.dispatchEvent(new CustomEvent('mirror-story-segment-2-done'));
        });
    });

    document.addEventListener('mirror-story-segment-3-start', function () {
        showStorySegment(2, function () {
            document.dispatchEvent(new CustomEvent('mirror-sequential-story-done'));
        });
    });

    // ─── Setup ───────────────────────────────────────────────────────────────

    function startWhenGameReady() {
        var layer = document.getElementById('mirror-story-layer');
        if (!layer) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;

        storyOverlay           = document.createElement('div');
        storyOverlay.id        = 'mirror-story-overlay';
        storyOverlay.className = 'mirror-story-overlay';
        storyOverlay.style.cssText =
            'position:fixed;z-index:99999' +
            ';pointer-events:none;overflow:hidden;visibility:hidden;';
        updateOverlayBounds();
        document.body.appendChild(storyOverlay);

        layer.style.display    = '';  // restore from the init() display:none
        layer.style.visibility = '';  // inherit from overlay, never override its visibility:hidden
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        storyOverlay.appendChild(layer);

        window.addEventListener('resize', updateOverlayBounds);
    }

    function waitForGameThenStart() {
        if (document.getElementById('game-container')) {
            startWhenGameReady();
            return;
        }
        var observer = new MutationObserver(function () {
            if (document.getElementById('game-container')) {
                observer.disconnect();
                startWhenGameReady();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        var layer = document.getElementById('mirror-story-layer');
        if (!layer) return;
        // Don't set an inline visibility here — the storyOverlay (parent) controls it.
        // Keeping the layer at display:none until moved into the overlay prevents flash.
        layer.style.display = 'none';
        waitForGameThenStart();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
