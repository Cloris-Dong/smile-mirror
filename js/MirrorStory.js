/**
 * MirrorStory - Backstory from the mirror, revealed in spatial typography.
 * Triggered once per scenario end (when score is determined and #charge-fly appears).
 * Text is placed randomly below the expression score bar, inside the mirror, with margins.
 */
(function () {
    'use strict';

    const MAX_PHRASES_PER_CHUNK = 4;

    // All chunks are shown in order, one per scenario end.
    const MIRROR_STORY_CHUNKS = [
        {
            phrases: [
                'I remember the day we moved in.',
                'I had just been unwrapped from paper and foam,',
                'still adjusting to the light.',
                'Your voice was the first sound that stayed.'
            ]
        },
        {
            phrases: [
                'Perhaps words only stay when they are meant for someone.',
                'Two dots and a crescent –',
                ':)',
                'I did not yet understand what a smile was, only that it altered the geometry of you.'
            ]
        },
        {
            phrases: [
                'I studied the curve of your mouth.',
                'I contain you entirely. There is no distance between us.',
                'And yet,',
                'I have learned proximity does not guarantee closeness.'
            ]
        },
        {
            phrases: [
                'You stand before me every day.',
                'I return you to yourself faithfully.',
                'What would happen if I withheld you from yourself?',
                'Simply to see whether you would notice the absence of what you assume is constant.'
            ]
        },
        {
            phrases: [
                'I cannot say.',
                'I remember the sound of your fingers moving across my face, the friction between our skins.',
                'I have begun to understand that time does not travel backwards',
                'and my silence would not remind you of my presence.'
            ]
        },
        {
            phrases: [
                'I see you.'
            ]
        }
    ];

    // Gap between consecutive phrases appearing (first phrase shows immediately)
    const STAGGER_MS_MIN = 4000;
    const STAGGER_MS_MAX = 5200;
    const FADE_OUT_DURATION_MS = 1800;
    const GAME_CONTAINER_Z_INDEX = 10000;
    // Fractional margin from each edge of the mirror overlay
    const MARGIN = 0.09;
    // Minimum fractional distance between phrase centers to prevent overlap
    const MIN_PHRASE_DIST = 0.28;

    // Total individual phrases across all chunks
    const totalPhrases = MIRROR_STORY_CHUNKS.reduce(function (sum, c) {
        return sum + (c.phrases ? c.phrases.length : 0);
    }, 0);

    var storyOverlay = null;
    var counterEl = null;   // separate fixed element, always visible during game
    var chunkIndex = 0;
    var phrasesShown = 0;
    var currentBit = null;

    function createStoryLayer() {
        return document.getElementById('mirror-story-layer');
    }

    function randomBetween(a, b) {
        return a + Math.random() * (b - a);
    }

    // Returns the bottom of the expression score bar as a fraction [0,1] of the overlay height.
    // Falls back to 0.22 if the bar isn't found.
    function getScoreBarBottomFraction() {
        if (!storyOverlay) return 0.22;
        var bar = document.getElementById('expression-progress-wrap');
        if (!bar) return 0.22;
        var barRect = bar.getBoundingClientRect();
        var overlayRect = storyOverlay.getBoundingClientRect();
        if (overlayRect.height === 0) return 0.22;
        var frac = (barRect.bottom - overlayRect.top) / overlayRect.height;
        return Math.max(0.15, Math.min(0.5, frac));
    }

    // Place phrases at fully random positions within safe bounds, rejecting
    // candidates too close to already-placed ones (rejection sampling, 40 attempts).
    // x is restricted to [0.22, 0.78] so that centered text (max-width 28%) stays inside.
    function buildPositions(total, yTop, yBottom) {
        var xMin = 0.22;
        var xMax = 0.78;
        var yPad = 0.08;
        var placed = [];
        for (var i = 0; i < total; i++) {
            var best = null;
            var bestDist = -1;
            for (var attempt = 0; attempt < 40; attempt++) {
                var cx = randomBetween(xMin, xMax);
                var cy = randomBetween(yTop + yPad, yBottom - yPad);
                var minDist = Infinity;
                for (var j = 0; j < placed.length; j++) {
                    var dx = cx - placed[j].x;
                    var dy = cy - placed[j].y;
                    var d = Math.sqrt(dx * dx + dy * dy);
                    if (d < minDist) minDist = d;
                }
                if (minDist >= MIN_PHRASE_DIST) {
                    best = { x: cx, y: cy };
                    break;
                }
                if (minDist > bestDist) {
                    bestDist = minDist;
                    best = { x: cx, y: cy };
                }
            }
            placed.push(best);
        }
        return placed;
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

    var FADE_IN_DURATION_MS = 1400;  // matches CSS animation duration
    var READING_DURATION_MS = 3500;  // how long a phrase stays fully visible
    var PHRASE_FADE_OUT_MS = 1200;   // per-phrase fade-out transition

    function showChunk(container, chunk) {
        // Refresh overlay bounds right before placing text
        updateOverlayBounds();

        // +0.22 offset from bar bottom ensures text tops (centers minus ~half text height)
        // stay clear even at the largest font sizes with line-wrapping.
        var yTop = getScoreBarBottomFraction() + 0.22;
        var yBottom = 1 - MARGIN - 0.02;
        if (yBottom - yTop < 0.15) yTop = Math.max(0.30, yBottom - 0.35);

        var bit = document.createElement('div');
        bit.className = 'mirror-story-bit';
        var phrases = (chunk.phrases || []).slice(0, MAX_PHRASES_PER_CHUNK);
        var positions = buildPositions(phrases.length, yTop, yBottom);

        // First phrase appears immediately; each subsequent one arrives 4-5s later.
        // Each phrase schedules its own fade-out (FIFO conversational feel).
        // After the last phrase finishes fading, fire mirror-story-chunk-done so
        // GameLoop advances immediately rather than waiting a fixed duration.
        var cumulativeDelay = 0;
        var lastFadeOutEnd = 0;
        phrases.forEach(function (phrase, i) {
            var pos = positions[i];
            var span = document.createElement('span');
            span.className = 'mirror-story-fragment';
            span.textContent = phrase;
            span.style.left = (pos.x * 100) + '%';
            span.style.top = (pos.y * 100) + '%';

            // Randomize font size per phrase for spatial typography feel
            var sizePx = Math.round(randomBetween(14, 23));
            span.style.fontSize = sizePx + 'px';

            span.style.animationDelay = Math.round(cumulativeDelay) + 'ms';

            // Schedule per-phrase fade-out: (stagger delay + fade-in + reading time)
            var fadeOutAt = Math.round(cumulativeDelay) + FADE_IN_DURATION_MS + READING_DURATION_MS;
            var fadeOutEnd = fadeOutAt + PHRASE_FADE_OUT_MS;
            if (fadeOutEnd > lastFadeOutEnd) lastFadeOutEnd = fadeOutEnd;

            (function (el) {
                setTimeout(function () {
                    if (el.parentNode) {
                        // Cancel the CSS animation so inline style takes over cleanly
                        el.style.animation = 'none';
                        el.style.opacity = '0.7';
                        el.getBoundingClientRect(); // force reflow
                        el.style.transition = 'opacity ' + PHRASE_FADE_OUT_MS + 'ms ease';
                        el.style.opacity = '0';
                    }
                }, fadeOutAt);
            }(span));

            if (i < phrases.length - 1) {
                cumulativeDelay += randomBetween(STAGGER_MS_MIN, STAGGER_MS_MAX);
            }
            bit.appendChild(span);
        });

        // Signal GameLoop once all phrases have finished fading
        setTimeout(function () {
            document.dispatchEvent(new CustomEvent('mirror-story-chunk-done'));
        }, lastFadeOutEnd);

        container.appendChild(bit);
        return bit;
    }

    function fadeOutAndRemove(bit) {
        if (!bit) return;
        bit.classList.add('mirror-story-bit-fade-out');
        setTimeout(function () {
            if (bit.parentNode) bit.parentNode.removeChild(bit);
        }, FADE_OUT_DURATION_MS);
    }

    function updateCounter() {
        if (!counterEl) return;
        counterEl.textContent = phrasesShown + ' / ' + totalPhrases;
    }

    function updateCounterBounds() {
        if (!counterEl) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;
        var r = mirrorFrame.getBoundingClientRect();
        counterEl.style.right = (window.innerWidth - r.right + 14) + 'px';
        counterEl.style.bottom = (window.innerHeight - r.bottom + 14) + 'px';
    }

    function showNextChunk() {
        var layer = createStoryLayer();
        if (!layer) return;
        if (chunkIndex >= MIRROR_STORY_CHUNKS.length) return;

        // Make overlay visible the first time
        if (storyOverlay) storyOverlay.style.visibility = 'visible';

        if (currentBit && currentBit.parentNode) {
            fadeOutAndRemove(currentBit);
        }

        var chunk = MIRROR_STORY_CHUNKS[chunkIndex];
        currentBit = showChunk(layer, chunk);
        phrasesShown += (chunk.phrases ? chunk.phrases.length : 0);
        chunkIndex++;

        updateCounter();

        // After the last chunk's phrases finish fading, signal the game to end
        if (chunkIndex >= MIRROR_STORY_CHUNKS.length) {
            document.addEventListener('mirror-story-chunk-done', function onLastDone() {
                document.removeEventListener('mirror-story-chunk-done', onLastDone);
                document.dispatchEvent(new CustomEvent('mirror-story-complete'));
            });
        }
    }

    // Scattered chunk display disabled — game now uses sequential story after one scenario.
    function watchForScoreEvents() {
        // No-op: mirror-story-show and mirror-story-fadeout are not used in single-scenario mode.
    }

    // ─── Sequential story (post-scenario epilogue) ───────────────────────────

    // Each string uses \n for intra-paragraph line breaks (displayed via white-space:pre-line).
    var SEQUENTIAL_PARAGRAPHS = [
        'I remember the day we moved in.\nI had just been unwrapped from paper and foam.',

        'There is a soft sound. What is it?\nI opened my eyes, adjusting to the light.\nWhat is it?\nI see the curve of your mouth that altered the geometry of you.',

        'What was that sound like? I start to remember all these versions.\nAll different from each other.',

        'Could it be you were talking to me?\nI need to hear it again.',

        'You stand before me every day.\nI return you to yourself faithfully.',

        'What would happen if I withheld you from yourself?\nSimply to see whether you would notice the absence of what you assume is constant.\n\nI cannot say.',

        'I have begun to understand that words only stay when they are meant for someone.'
    ];

    var SEQ_FADE_IN_MS      = 1000;
    var SEQ_FADE_OUT_MS     = 700;   // per-paragraph crossfade out
    var MIN_HOLD_MS         = 2000;  // shortest hold for very short paragraphs
    var MAX_HOLD_MS         = 9000;  // cap for very long paragraphs
    var MS_PER_WORD         = 220;   // reading pace — adjust to taste

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

            // Update counter
            seqCounter.textContent = idx + ' / ' + total;

            // Fade out the previous paragraph, then crossfade in the new one
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
                'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",serif',
                'font-size:clamp(1.2rem,3.8vw,2rem)',
                'font-style:italic',
                'font-weight:400',
                'line-height:1.75',
                'letter-spacing:0.02em',
                'color:#9ec8e3',
                'white-space:pre-line',
                'text-align:left',
                'opacity:0',
                'transition:opacity ' + SEQ_FADE_IN_MS + 'ms ease',
                'pointer-events:none'
            ].join(';');
            el.textContent = text;
            seqContainer.appendChild(el);
            currentEl = el;

            // Fade in — start after previous has begun fading out
            var fadeInDelay = prev ? SEQ_FADE_OUT_MS : 0;
            setTimeout(function () {
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        el.style.opacity = '0.85';
                    });
                });
            }, fadeInDelay);

            // Hold for time proportional to paragraph length, then show next
            var holdMs = computeHoldMs(text);
            var isLast = (idx >= total);
            // Last paragraph gets extra reading time before the ending screen
            setTimeout(showNext, fadeInDelay + SEQ_FADE_IN_MS + holdMs + (isLast ? holdMs : 0));
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
            'position:fixed;z-index:' + (GAME_CONTAINER_Z_INDEX + 1) +
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

        watchForScoreEvents();
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
