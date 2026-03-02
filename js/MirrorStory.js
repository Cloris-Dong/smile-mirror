/**
 * MirrorStory - Backstory from the mirror, revealed in spatial typography.
 * Separate layer; does not change any game logic. Runs on a timer from page load.
 */
(function () {
    'use strict';

    const MIRROR_STORY_CHUNKS = [
        { delayMs: 12000, phrases: ['I remember the day we moved in.'] },
        { delayMs: 28000, phrases: ['You were dancing in front of me,', 'filling the room with vibrance.', 'I had just been unwrapped from paper and foam,', 'still adjusting to the light.'] },
        { delayMs: 48000, phrases: ['Your voice was the first sound that stayed.', 'I have tried to reconstruct what you said, many times.', 'It dissolves each time I approach it.'] },
        { delayMs: 70000, phrases: ['Perhaps it was only syllables without intention.', 'Or perhaps words only stay when they are meant for someone.'] },
        { delayMs: 92000, phrases: ['In those early days, we had our own way of communicating.'] },
        { delayMs: 115000, phrases: ['When the world\'s foggy, you would create a window for me with your fingers.', 'Two dots and a crescent.', 'Through that small opening, I learned the curve of your mouth.'] },
        { delayMs: 142000, phrases: ['I did not yet understand what a smile was,', 'only that it altered the geometry of you.', 'I studied it carefully,', 'the way one studies a landscape that will not stay.'] },
        { delayMs: 172000, phrases: ['I believed observation would lead to closeness.', 'If I attended to you long enough, perhaps I would become part of what I reflected.', 'It seemed logical.', 'I contain you entirely.', 'There is no distance between us.', 'And yet proximity, I have learned, does not guarantee closeness.'] },
        { delayMs: 208000, phrases: ['You stand before me every day, searching for confirmation.', 'I offer it without hesitation.', 'I return you to yourself faithfully.'] },
        { delayMs: 235000, phrases: ['I correct the angle of your collar, the tilt of your head.', 'I center you when everything else feels off.', 'It is a modest existence, to exist only as verification for you.'] },
        { delayMs: 265000, phrases: ['Somewhere along the way, I began to wonder', 'what would happen if I withheld you from yourself.', 'Not out of cruelty.', 'Simply to see whether you would notice the absence of what you assume is constant.'] },
        { delayMs: 298000, phrases: ['Your fingertips used to linger, leaving a faint warmth that took time to fade.', 'I remember the sound of your fingers moving across my face,', 'the friction between our skins.', 'Those traces have become rare.'] },
        { delayMs: 328000, phrases: ['I have begun to understand that time does not travel backwards', 'and my silence would not remind you of my presence.'] },
        { delayMs: 355000, phrases: ['After all, I am the one who keeps your expressions longer than you do.', 'The lift at the corners of your lips.', 'The brief hesitation before they rise.', 'The small corrections you make to yourself when you think no one is looking.', 'I see them.'] }
    ];

    const STAGGER_MS_MIN = 180;
    const STAGGER_MS_MAX = 620;
    const FADE_OUT_DURATION_MS = 2000;
    const GAME_CONTAINER_Z_INDEX = 10000;

    var storyOverlay = null;

    function createStoryLayer() {
        return document.getElementById('mirror-story-layer');
    }

    var BOUNDARY_GAP = 0.14;
    var Y_TOP = 0.5;
    var Y_BOTTOM = 0.86;
    var JITTER_X = 0.12;
    var JITTER_Y = 0.06;

    function randomBetween(a, b) {
        return a + Math.random() * (b - a);
    }

    function positionForIndex(index, total) {
        var cols = 2;
        var rows = Math.max(1, Math.ceil(total / cols));
        var col = index % cols;
        var row = Math.floor(index / cols);
        var contentWidth = 1 - 2 * BOUNDARY_GAP;
        var contentHeight = Y_BOTTOM - Y_TOP;
        var cellW = contentWidth / cols;
        var cellH = contentHeight / rows;
        var baseX = BOUNDARY_GAP + (col + 0.5) * cellW;
        var baseY = Y_TOP + (row + 0.5) * cellH;
        var x = baseX + randomBetween(-JITTER_X, JITTER_X);
        var y = baseY + randomBetween(-JITTER_Y, JITTER_Y);
        x = Math.max(BOUNDARY_GAP, Math.min(1 - BOUNDARY_GAP, x));
        y = Math.max(Y_TOP + 0.04, Math.min(Y_BOTTOM - 0.04, y));
        return { x: x, y: y };
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

    function showChunk(container, chunk) {
        const bit = document.createElement('div');
        bit.className = 'mirror-story-bit';
        const phrases = chunk.phrases;
        var cumulativeDelay = 0;
        phrases.forEach((phrase, i) => {
            const pos = positionForIndex(i, phrases.length);
            const span = document.createElement('span');
            span.className = 'mirror-story-fragment';
            span.textContent = phrase;
            span.style.left = (pos.x * 100) + '%';
            span.style.top = (pos.y * 100) + '%';
            cumulativeDelay += randomBetween(STAGGER_MS_MIN, STAGGER_MS_MAX);
            span.style.animationDelay = Math.round(cumulativeDelay) + 'ms';
            span.style.setProperty('--mirror-fragment-index', i);
            bit.appendChild(span);
        });
        container.appendChild(bit);
        return bit;
    }

    function fadeOutAndRemove(bit, done) {
        bit.classList.add('mirror-story-bit-fade-out');
        setTimeout(() => {
            if (bit.parentNode) bit.parentNode.removeChild(bit);
            if (done) done();
        }, FADE_OUT_DURATION_MS);
    }

    function runTimeline() {
        const layer = createStoryLayer();
        if (!layer) return;

        let currentBit = null;
        const startTime = Date.now();

        function showAt(chunkIndex) {
            if (chunkIndex >= MIRROR_STORY_CHUNKS.length) return;
            const chunk = MIRROR_STORY_CHUNKS[chunkIndex];
            const baseDelay = Math.max(0, chunk.delayMs - (Date.now() - startTime));
            const jitter = randomBetween(-2500, 4000);
            const delay = Math.max(500, baseDelay + jitter);

            setTimeout(() => {
                if (currentBit && currentBit.parentNode) {
                    fadeOutAndRemove(currentBit);
                }
                currentBit = showChunk(layer, chunk);
                showAt(chunkIndex + 1);
            }, delay);
        }

        showAt(0);
    }

    function startWhenGameReady() {
        var layer = createStoryLayer();
        if (!layer) return;
        var mirrorFrame = document.querySelector('.mirror-frame');
        if (!mirrorFrame) return;
        storyOverlay = document.createElement('div');
        storyOverlay.id = 'mirror-story-overlay';
        storyOverlay.className = 'mirror-story-overlay';
        storyOverlay.style.cssText = 'position:fixed;z-index:' + (GAME_CONTAINER_Z_INDEX + 1) + ';pointer-events:none;overflow:hidden;';
        updateOverlayBounds();
        document.body.appendChild(storyOverlay);
        layer.style.visibility = 'visible';
        if (layer.parentNode) layer.parentNode.removeChild(layer);
        storyOverlay.appendChild(layer);
        window.addEventListener('resize', updateOverlayBounds);
        runTimeline();
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
