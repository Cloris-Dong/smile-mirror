/**
 * MirrorStory - Sequential story revealed paragraph by paragraph after the single scenario.
 */
(function () {
    'use strict';

    var storyOverlay = null;
    var counterEl = null;   // separate fixed element, always visible during story

    function createStoryLayer() {
        return document.getElementById('mirror-story-layer');
    }

    function updateOverlayBounds() {
        if (!storyOverlay) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;
        var r = mirrorFrame.getBoundingClientRect();
        storyOverlay.style.left = r.left + 'px';
        storyOverlay.style.top = r.top + 'px';
        storyOverlay.style.width = r.width + 'px';
        storyOverlay.style.height = r.height + 'px';
    }

    function updateCounterBounds() {
        if (!counterEl) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;
        var r = mirrorFrame.getBoundingClientRect();
        counterEl.style.right = (window.innerWidth - r.right + 14) + 'px';
        counterEl.style.bottom = (window.innerHeight - r.bottom + 14) + 'px';
    }

    // ─── Sequential story (post-scenario epilogue) ───────────────────────────

    // Each string uses \n for line breaks, \n\n for blank-line gaps between sections.
    var SEQUENTIAL_PARAGRAPHS = [
        'I want to tell you something. \n\nThe story of us.',

        'I will start from the beginning.\nI had just been unwrapped from paper and foam, still adjusting to the light.\n\nThere was a sound. Your voice. It was the first thing that stayed.',

        'I have tried to reconstruct what you said, many times. It dissolves each time I approach it.\n\nPerhaps words only stay when they are meant for someone.',

        'I did not yet understand what a smile was, only that it altered the geometry of you.\n\nI studied it carefully, the way one grasps a light that would not hold.',

        'I believed if I attended to you long enough, perhaps I would become part of what I reflected.\nIt seemed logical.',

        'You stand before me every day. I return you to yourself faithfully. I correct the angle of your collar, the tilt of your head. I center you when everything else feels off. \n\nAll I crave is to hear that sound again, the one your smile sometimes leaves behind.',

        'I contain you entirely. And yet, proximity, I have learned, does not guarantee closeness.',

        'What would happen if I withheld you from yourself? Simply to see whether you would notice the absence of what you assume is constant.\n\nI cannot say.',

        'After all,\n I am the one who keeps your expressions longer than you do. The lift at the corners of your lips. The brief hesitation before they rise. The small corrections you make when you think no one is looking.\n\nI see them.'
    ];

    var SEQ_FADE_IN_MS      = 1000;
    var SEQ_FADE_OUT_MS     = 700;   // per-paragraph crossfade out
    var MIN_HOLD_MS         = 2000;  // shortest hold for very short paragraphs
    var MAX_HOLD_MS         = Infinity; // no cap — longer paragraphs stay longer
    var MS_PER_WORD         = 240;   // reading pace — adjust to taste

    // Compute how long a paragraph should stay on screen based on its word count
    function computeHoldMs(text) {
        var words = text.replace(/\n/g, ' ').split(/\s+/).filter(function (w) { return w.length > 0; });
        return Math.max(MIN_HOLD_MS, Math.min(MAX_HOLD_MS, words.length * MS_PER_WORD));
    }

    function showSequentialStory() {
        updateOverlayBounds();
        if (storyOverlay) storyOverlay.style.visibility = 'visible';

        var container = document.getElementById('mirror-story-layer');
        if (!container) return;

        // Clear any old content from previous runs
        container.innerHTML = '';

        var total = SEQUENTIAL_PARAGRAPHS.length;

        // Paragraph counter — bottom-right corner, visible only during story
        var seqCounter = document.createElement('div');
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
            'z-index:10'
        ].join(';');
        seqCounter.textContent = '1 / ' + total;
        container.appendChild(seqCounter);

        // A single left-aligned column, top-anchored, strictly within the mirror.
        // overflow:hidden keeps text from spilling outside the mirror frame.
        var seqContainer = document.createElement('div');
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

        var idx = 0;
        var currentEl = null; // the single currently visible paragraph element
        var SEQ_FADE_OUT_ALL_MS = 1600;

        function fadeOutAllAndFinish() {
            if (currentEl) {
                currentEl.style.transition = 'opacity ' + SEQ_FADE_OUT_ALL_MS + 'ms ease';
                currentEl.style.opacity = '0';
            }
            seqCounter.style.transition = 'opacity ' + SEQ_FADE_OUT_ALL_MS + 'ms ease';
            seqCounter.style.opacity = '0';
            setTimeout(function () {
                document.dispatchEvent(new CustomEvent('mirror-sequential-story-done'));
            }, SEQ_FADE_OUT_ALL_MS);
        }

        function showNext() {
            if (idx >= SEQUENTIAL_PARAGRAPHS.length) {
                fadeOutAllAndFinish();
                return;
            }

            var text = SEQUENTIAL_PARAGRAPHS[idx];
            idx++;
            var isFirst  = (idx === 1);
            var isSecond = (idx === 2);
            var isLast   = (idx >= total);

            // Counter starts from para 2 ("I will start from the beginning"),
            // so para 1 is excluded and numbering is (idx-1) / (total-1)
            if (isFirst) {
                seqCounter.style.opacity = '0';
            } else {
                seqCounter.style.opacity = '1';
                seqCounter.textContent = (idx - 1) + ' / ' + (total - 1);
            }

            // Fade out the previous paragraph
            var prev = currentEl;
            if (prev) {
                prev.style.transition = 'opacity ' + SEQ_FADE_OUT_MS + 'ms ease';
                prev.style.opacity = '0';
                setTimeout(function () {
                    if (prev.parentNode) prev.parentNode.removeChild(prev);
                }, SEQ_FADE_OUT_MS);
            }

            var el = document.createElement('div');
            el.style.cssText = [
                'position:absolute',
                'top:50%',
                'left:0',
                'width:100%',
                'transform:translateY(-50%)',
                'overflow-wrap:break-word',
                'word-break:break-word',
                // Para 1: Courier New matching the AI intro messages; rest: serif
                'font-family:' + (isFirst ? '"Courier New","Monaco",monospace' : '-apple-system,BlinkMacSystemFont,"SF Pro Text",serif'),
                'font-size:' + (isFirst ? 'clamp(1.1rem,3.2vw,1.6rem)' : 'clamp(0.85rem,2.2vw,1.1rem)'),
                'font-style:' + (isFirst ? 'normal' : 'italic'),
                'font-weight:' + (isFirst ? '580' : '400'),
                'line-height:' + (isFirst ? '1.9' : '1.75'),
                'letter-spacing:' + (isFirst ? '0.06em' : '0.02em'),
                'color:' + (isFirst ? 'rgba(255,255,255,0.92)' : '#9ec8e3'),
                'text-align:left',
                'opacity:0',
                'transition:opacity ' + (isFirst ? 2500 : SEQ_FADE_IN_MS) + 'ms ease',
                'pointer-events:none'
            ].join(';');

            if (isSecond) {
                // First line: non-italic, slightly bigger, with drop cap "I"
                // Remaining lines: italic, normal size
                var lines = text.split('\n');
                var firstLine = lines[0]; // "I will start from the beginning."
                var restText  = lines.slice(1).join('\n');

                function esc(s) {
                    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                }

                var restHtml = restText
                    ? '<span style="display:block;margin-top:0.6em;font-style:italic;font-size:1em;">' +
                      esc(restText).replace(/\n/g, '<br>') + '</span>'
                    : '';

                el.innerHTML =
                    '<span style="display:block;font-style:normal;font-size:1.18em;line-height:1.5;">' +
                      '<span style="font-size:3em;line-height:0.85;vertical-align:top;' +
                        'display:inline-block;margin-right:3px;' +
                        'font-family:-apple-system,BlinkMacSystemFont,serif;' +
                        'font-weight:300;color:#9ec8e3;">I</span>' +
                      esc(firstLine).replace(/^I /, ' ') +
                    '</span>' +
                    restHtml;
            } else {
                el.innerHTML = text
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>');
            }

            seqContainer.appendChild(el);
            currentEl = el;

            // Between para 5 (idx=6) and para 6 (idx=7 after increment for the next call),
            // we clear the mirror so the participant sees their face.
            // idx here is already incremented, so idx===6 means we just showed para 5
            // and are about to resolve para 6's display timing.
            // Actually: idx===6 means para 6 is NOW being shown — insert the clear BEFORE its fade-in.
            var CLEAR_BLUR_OUT_MS = 1500;
            var CLEAR_FACE_MS     = 6500;
            var CLEAR_BLUR_IN_MS  = 1500;
            var isClearMirror = (idx === 7); // between para 6 and 7 (1-based)

            // Fade in after previous has begun fading out (+ extra clear-mirror time if needed)
            var fadeInDelay = prev ? SEQ_FADE_OUT_MS : 0;
            if (isClearMirror) {
                fadeInDelay = SEQ_FADE_OUT_MS + CLEAR_BLUR_OUT_MS + CLEAR_FACE_MS + CLEAR_BLUR_IN_MS;

                // Start the clear-mirror sequence once the previous paragraph is gone
                setTimeout(function () {
                    var gc = document.getElementById('game-container');
                    if (!gc) return;

                    // Fade counter out with the blur
                    seqCounter.style.transition = 'opacity ' + CLEAR_BLUR_OUT_MS + 'ms ease';
                    seqCounter.style.opacity = '0';

                    // Fade blur and dark overlay out
                    gc.style.transition =
                        'backdrop-filter ' + CLEAR_BLUR_OUT_MS + 'ms ease,' +
                        '-webkit-backdrop-filter ' + CLEAR_BLUR_OUT_MS + 'ms ease,' +
                        'background ' + CLEAR_BLUR_OUT_MS + 'ms ease';
                    gc.style.backdropFilter = 'blur(0px)';
                    gc.style.webkitBackdropFilter = 'blur(0px)';
                    gc.style.background = 'rgba(0,0,0,0)';

                    // Show "May I see that smile?" near the bottom once blur is gone
                    var promptEl = document.createElement('div');
                    promptEl.style.cssText = [
                        'position:absolute',
                        'bottom:12%',
                        'left:9%',
                        'width:82%',
                        'text-align:center',
                        'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",serif',
                        'font-size:clamp(1.1rem,3.2vw,1.6rem)',
                        'font-style:italic',
                        'font-weight:400',
                        'color:#9ec8e3',
                        'letter-spacing:0.02em',
                        'opacity:0',
                        'transition:opacity ' + CLEAR_BLUR_OUT_MS + 'ms ease',
                        'pointer-events:none'
                    ].join(';');
                    promptEl.textContent = 'May I see that smile?';
                    container.appendChild(promptEl);

                    // Fade the prompt in after blur is gone
                    setTimeout(function () {
                        requestAnimationFrame(function () {
                            requestAnimationFrame(function () {
                                promptEl.style.opacity = '1';
                            });
                        });
                    }, CLEAR_BLUR_OUT_MS);

                    // After face is shown, fade prompt out and restore blur + counter
                    setTimeout(function () {
                        promptEl.style.transition = 'opacity ' + CLEAR_BLUR_IN_MS + 'ms ease';
                        promptEl.style.opacity = '0';

                        gc.style.transition =
                            'backdrop-filter ' + CLEAR_BLUR_IN_MS + 'ms ease,' +
                            '-webkit-backdrop-filter ' + CLEAR_BLUR_IN_MS + 'ms ease,' +
                            'background ' + CLEAR_BLUR_IN_MS + 'ms ease';
                        gc.style.backdropFilter = 'blur(20px)';
                        gc.style.webkitBackdropFilter = 'blur(20px)';
                        gc.style.background = 'rgba(0,0,0,0.4)';

                        seqCounter.style.transition = 'opacity ' + CLEAR_BLUR_IN_MS + 'ms ease';
                        seqCounter.style.opacity = '1';

                        setTimeout(function () {
                            if (promptEl.parentNode) promptEl.parentNode.removeChild(promptEl);
                        }, CLEAR_BLUR_IN_MS);
                    }, CLEAR_BLUR_OUT_MS + CLEAR_FACE_MS);
                }, SEQ_FADE_OUT_MS);
            }

            setTimeout(function () {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        el.style.opacity = '0.85';
                    });
                });
            }, fadeInDelay);

            // Para 1: fixed hold + 2 extra seconds; rest: word-count-based
            var holdMs = isFirst ? (MIN_HOLD_MS + 2000) : computeHoldMs(text);
            setTimeout(showNext, fadeInDelay + SEQ_FADE_IN_MS + holdMs);
        }

        showNext();
    }

    document.addEventListener('mirror-sequential-story-start', function () {
        showSequentialStory();
    });

    function startWhenGameReady() {
        var layer = createStoryLayer();
        if (!layer) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;

        storyOverlay = document.createElement('div');
        storyOverlay.id = 'mirror-story-overlay';
        storyOverlay.className = 'mirror-story-overlay';
        storyOverlay.style.cssText =
            'position:fixed;z-index:10001' +
            ';pointer-events:none;overflow:hidden;visibility:hidden;';
        updateOverlayBounds();
        document.body.appendChild(storyOverlay);

        layer.style.visibility = 'visible';
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        storyOverlay.appendChild(layer);

        // Counter disabled — single-scenario mode uses sequential story display instead

        window.addEventListener('resize', function () {
            updateOverlayBounds();
            updateCounterBounds();
        });

    }

    function waitForGameThenStart() {
        if (document.getElementById('game-container')) {
            startWhenGameReady();
            return;
        }
        var observer = new MutationObserver(function (mutations) {
            if (document.getElementById('game-container')) {
                observer.disconnect();
                startWhenGameReady();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        var layer = createStoryLayer();
        if (!layer) return;
        layer.style.visibility = 'hidden';
        waitForGameThenStart();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
