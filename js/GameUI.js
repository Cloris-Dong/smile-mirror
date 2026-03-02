// Game UI Controller - Displays all game screens and UI elements

export class GameUI {
    constructor(container) {
        this.container = container;
        this.currentScreen = null;
        this.realTimeUpdateInterval = null;
        this.heatmapCanvas = null;
        this.heatmapCtx = null;
        this.observationFrameMetrics = null;
        this.scenarioRevealTimeout = null;
    }
    
    // Get balance color based on value (Apple-style minimal)
    getBalanceColor(balance) {
        if (balance > 70) return '#34C759'; // Apple green
        if (balance > 30) return '#FF9500'; // Apple orange
        if (balance > 10) return '#FF3B30'; // Apple red
        if (balance > 0) return '#FF3B30'; // Apple red
        return '#FF3B30'; // Apple red
    }
    
    // Display point balance with animation
    displayBalance(balance, previousBalance = null, animate = false) {
        const color = this.getBalanceColor(balance);
        const isNegative = balance < 0;
        let animationClass = '';
        const changeAmount = previousBalance !== null ? balance - previousBalance : 0;
        
        if (animate && previousBalance !== null && balance < previousBalance) {
            animationClass = 'balance-deduct';
        } else if (animate && previousBalance !== null && balance > previousBalance) {
            animationClass = 'balance-add';
        }
        
        // Calculate balance percentage for visual meter (assuming max 100)
        const balancePercent = Math.min(100, Math.max(0, (balance / 100) * 100));
        
        return `
            <div id="game-balance" class="${animationClass}" style="
                position: absolute;
                top: 36px;
                right: 48px;
                z-index: 1200;
                opacity: 0;
                will-change: opacity, transform;
                padding: 14px 28px;
                border-radius: 999px;
                background: rgba(30, 30, 30, 0.33);
                backdrop-filter: blur(20px);
                font-family: 'Courier New', 'Monaco', monospace;
                color: #fff;
                letter-spacing: 0.08em;
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 12px;
            ">
                <span style="
                    font-size: 12px;
                    text-transform: uppercase;
                    opacity: 0.7;
                    letter-spacing: 0.32em;
                    font-family: 'Courier New', 'Monaco', monospace;
                ">Balance</span>
                <span style="
                    font-size: 22px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                ">${balance}</span>
                ${changeAmount !== 0 ? `
                    <span id="balance-change" style="
                        font-size: 14px;
                        font-weight: 500;
                        color: ${changeAmount > 0 ? '#34C759' : '#FF3B30'};
                        opacity: 0;
                        animation: balanceChangePop 1s ease-out;
                    ">${changeAmount > 0 ? '+' : ''}${changeAmount}</span>
                ` : ''}
            </div>
        `;
    }
    
    // Display intro/welcome screen
    displayIntro() {
        return `
            <div id="game-intro" style="
                position: absolute;
                inset: 0;
                background: #000;
                display: flex;
                justify-content: center;
                align-items: center;
                color: #fff;
                font-family: 'Courier New', 'Monaco', monospace;
                padding: 60px 32px;
                text-align: center;
            ">
                <div style="
                    display: flex;
                    flex-direction: column;
                    max-width: min(720px, 82vw);
                    text-transform: uppercase;
                    align-items: center;
                    animation: introBlockScale 8s ease-out forwards;
                ">
                    <div style="
                        font-size: clamp(16px, 3vw, 24px);
                        letter-spacing: 0.24em;
                        line-height: 1.8;
                        text-align: left;
                        white-space: pre-line;
                        color: rgba(255, 255, 255, 0.85);
                    ">
                        <span id="intro-typed-text" style="
                            border-right: 2px solid rgba(255, 255, 255, 0.55);
                            padding-right: 6px;
                            display: inline-block;
                            animation: caretIntro 0.9s step-end infinite;
                        "></span>
                    </div>
                </div>
            </div>
        `;
    }
    
    runTypingSequence(targetEl, segments) {
        const queue = [];
        segments.forEach((segment, idx) => {
            const chars = segment.text.split('');
            chars.forEach((char) => {
                queue.push({
                    char,
                    pause: char === ' ' ? 80 : 0
                });
            });
            if (idx !== segments.length - 1) {
                queue.push({ char: '\n', pause: segment.pause || 300 });
            }
        });
        
        let index = 0;
        const baseDelay = 55;
        const typeNext = () => {
            if (index >= queue.length) return;
            const { char, pause } = queue[index];
            targetEl.textContent += char;
            const dynamicDelay = pause !== undefined ? pause : baseDelay + Math.random() * 25;
            index += 1;
            setTimeout(typeNext, dynamicDelay);
        };
        
        targetEl.textContent = '';
        typeNext();
    }
    
    // Update intro loading text
    updateIntroLoading(text) {
        const loadingEl = document.getElementById('intro-loading');
        if (loadingEl) {
            loadingEl.textContent = text;
        }
    }
    
    // Display scenario screen with balance, expression bar (3 zones), and prompt card
    displayScenario(scenario, balance, skipCallback) {
        const balanceHTML = this.displayBalance(balance);
        // Expression bar: three zones — no smile (0–20), smile detected (20–50), genuine smile (50–100). Width set to match prompt card in reveal timeout.
        const barHTML = `
            <div id="expression-progress-wrap" style="
                position: absolute;
                top: 108px;
                left: 50%;
                transform: translate(-50%, 0);
                width: min(74vw, 820px);
                z-index: 1199;
                opacity: 0;
                will-change: opacity;
                font-family: 'Courier New', 'Monaco', monospace;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                ">
                    <span style="
                        font-size: 12px;
                        letter-spacing: 0.32em;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, 0.95);
                    ">Expression score</span>
                    <span id="expression-score-value" style="
                        font-size: 22px;
                        font-weight: 600;
                        color: #fff;
                        letter-spacing: 0.02em;
                        min-width: 2ch;
                    ">--</span>
                </div>
                <div style="
                    height: 14px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.1);
                    overflow: hidden;
                    position: relative;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
                ">
                    <div id="expression-progress-fill" style="
                        position: absolute;
                        left: 0;
                        top: 0;
                        bottom: 0;
                        width: 0%;
                        background: #9EC0E0;
                        border-radius: 999px;
                        transition: width 0.2s ease-out;
                    "></div>
                    <div style="position: absolute; left: 20%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.45); pointer-events: none;"></div>
                    <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.45); pointer-events: none;"></div>
                </div>
                <div style="
                    display: flex;
                    justify-content: space-between;
                    margin-top: 6px;
                    padding: 0 2%;
                ">
                    <span style="font-size: 11px; letter-spacing: 0.04em; color: rgba(255,255,255,0.92); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">No smile</span>
                    <span style="font-size: 11px; letter-spacing: 0.04em; color: rgba(255,255,255,0.92); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">Smile detected</span>
                    <span style="font-size: 11px; letter-spacing: 0.04em; color: rgba(255,255,255,0.92); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;">Genuine smile</span>
                </div>
            </div>
        `;
        return `
            ${balanceHTML}
            ${barHTML}
            <div id="scenario-header" style="
                position: absolute;
                top: 44%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: min(88%, 920px);
                padding: 52px 56px 64px;
                min-height: 160px;
                border-radius: 36px;
                background: rgba(30, 30, 30, 0.43);
                box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
                font-family: 'Courier New', 'Monaco', monospace;
                color: #fff;
                letter-spacing: 0;
                z-index: 1001;
                opacity: 0;
                will-change: opacity, transform;
                text-align: left;
                backdrop-filter: blur(26px);
            ">
                <div data-role="persona-card" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 18px;
                ">
                    <div data-role="persona-orb" style="
                        width: 42px;
                        height: 42px;
                        border-radius: 50%;
                        background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.9), rgba(120, 170, 255, 0.35));
                        box-shadow: 0 0 18px rgba(120, 170, 255, 0.5);
                        animation: mirrorGlow 3s ease-in-out infinite alternate;
                    "></div>
                    <span data-role="persona-name" style="
                        font-size: 12px;
                        letter-spacing: 0.45em;
                        text-transform: uppercase;
                        color: rgba(255, 255, 255, 0.5);
                    ">
                        The Mirror
                    </span>
                </div>
                <div data-role="scenario-prompt" style="
                    font-size: 26px;
                    line-height: 1.55;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.96);
                ">
                    ${scenario.promptText}
                </div>
            </div>
        `;
    }
    
    // Update real-time status during observation — expression bar fill and live score
    updateRealTimeStatus(smilingScore, balance, previousBalance, isGenuine = false, thresholds = null) {
        const fillEl = document.getElementById('expression-progress-fill');
        const valueEl = document.getElementById('expression-score-value');
        const score = smilingScore === null || smilingScore === undefined ? null : Math.min(100, Math.max(0, Math.round(smilingScore)));
        if (fillEl) {
            fillEl.style.width = `${score ?? 0}%`;
        }
        if (valueEl) {
            valueEl.textContent = score === null ? '--' : String(score);
        }
    }

    // Animate charge as flying number from bar to Balance, then update Balance
    animateChargeToBalance(chargeAmount, newBalance) {
        const barWrap = document.getElementById('expression-progress-wrap');
        const balanceEl = document.getElementById('game-balance');
        if (!barWrap || !balanceEl) {
            const existing = document.getElementById('game-balance');
            if (existing) existing.outerHTML = this.displayBalance(newBalance);
            return;
        }
        const barRect = barWrap.getBoundingClientRect();
        const balanceRect = balanceEl.getBoundingClientRect();
        const fly = document.createElement('span');
        const sign = chargeAmount > 0 ? '+' : '';
        fly.textContent = `${sign}${chargeAmount}`;
        fly.id = 'charge-fly';
        fly.style.cssText = `
            position: fixed;
            left: ${barRect.left + barRect.width / 2}px;
            top: ${barRect.top + barRect.height / 2}px;
            transform: translate(-50%, -50%);
            z-index: 9999;
            font-family: 'Courier New', 'Monaco', monospace;
            font-size: 18px;
            font-weight: 600;
            color: ${chargeAmount >= 0 ? '#34C759' : '#FF3B30'};
            pointer-events: none;
            transition: none;
        `;
        document.body.appendChild(fly);
        const endX = balanceRect.left + balanceRect.width / 2;
        const endY = balanceRect.top + balanceRect.height / 2;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fly.style.transition = 'left 0.5s ease-out, top 0.5s ease-out, opacity 0.5s ease-out';
                fly.style.left = `${endX}px`;
                fly.style.top = `${endY}px`;
                fly.style.opacity = '0.7';
            });
        });
        setTimeout(() => {
            if (fly.parentNode) fly.parentNode.removeChild(fly);
            const newHTML = this.displayBalance(newBalance);
            if (balanceEl.parentNode) balanceEl.outerHTML = newHTML;
        }, 520);
    }
    
    // Store current scenario for status updates
    setCurrentScenario(scenario) {
        this.currentScenario = scenario;
    }
    
    // Ensure global observation bar exists at bottom edge
    ensureObservationBar() {
        if (!this.container) return;
        
        let bar = document.getElementById('global-observation-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'global-observation-bar';
            bar.style.cssText = `
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                top: 0;
                pointer-events: none;
                z-index: 1002;
            `;
            
            const frame = document.createElement('div');
            frame.id = 'observation-frame';
            frame.style.cssText = `
                position: absolute;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;
            
            frame.innerHTML = `
                <svg id="observation-frame-svg" width="0" height="0" style="display:block; overflow:visible;">
                    <rect id="observation-frame-rect" x="0" y="0" width="0" height="0" rx="28" ry="28"
                        fill="transparent" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
                </svg>
                <div id="observation-cursor" style="
                    position: absolute;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: radial-gradient(circle at center, rgba(158, 198, 255, 0.9), rgba(158, 198, 255, 0));
                    box-shadow: 0 0 18px rgba(158, 198, 255, 0.7);
                    transform: translate(-50%, -50%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                "></div>
                <div id="observation-caption" style="
                    display: none;
                "></div>
            `;
            
            bar.appendChild(frame);
            this.container.appendChild(bar);
        }
        
        this.observationFrameElement = bar;
    }
    
    positionObservationFrame(targetEl) {
        if (!targetEl) {
            this.observationFrameMetrics = null;
            return;
        }
        if (!this.container || !targetEl) return;
        const frameWrapper = document.getElementById('observation-frame');
        const svg = document.getElementById('observation-frame-svg');
        const rect = document.getElementById('observation-frame-rect');
        const cursor = document.getElementById('observation-cursor');
        const caption = document.getElementById('observation-caption');
        if (!frameWrapper || !svg || !rect || !cursor || !caption) return;
        
        const containerRect = this.container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        
        // Get computed style to extract border-radius and adjust for transforms
        let borderRadius = 36;
        const strokeWidth = 2;
        const clearance = 6;
        const layoutWidth = targetEl.offsetWidth || targetRect.width;
        const layoutHeight = targetEl.offsetHeight || targetRect.height;
        const scaleX = layoutWidth > 0 ? targetRect.width / layoutWidth : 1;
        const scaleY = layoutHeight > 0 ? targetRect.height / layoutHeight : 1;
        
        if (typeof window !== 'undefined' && window.getComputedStyle) {
            const computed = window.getComputedStyle(targetEl);
            if (computed && computed.borderRadius) {
                const parsed = parseFloat(computed.borderRadius);
                if (!isNaN(parsed)) {
                    const averageScale = (scaleX + scaleY) / 2 || 1;
                    borderRadius = parsed * averageScale;
                }
            }
        }
        
        // Position frame to sit just outside the visual border with even clearance
        const width = targetRect.width + 2 * (clearance + strokeWidth);
        const height = targetRect.height + 2 * (clearance + strokeWidth);
        
        const left = targetRect.left - containerRect.left - clearance - strokeWidth;
        const top = targetRect.top - containerRect.top - clearance - strokeWidth;
        
        frameWrapper.style.width = `${width}px`;
        frameWrapper.style.height = `${height}px`;
        frameWrapper.style.left = `${left}px`;
        frameWrapper.style.top = `${top}px`;
        
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        
        const inset = strokeWidth / 2;
        const innerWidth = width - inset * 2;
        const innerHeight = height - inset * 2;
        rect.setAttribute('x', inset);
        rect.setAttribute('y', inset);
        rect.setAttribute('width', innerWidth);
        rect.setAttribute('height', innerHeight);
        
        rect.setAttribute('rx', borderRadius);
        rect.setAttribute('ry', borderRadius);
        rect.setAttribute('stroke-width', strokeWidth);
        
        caption.style.left = `${Math.max(24, clearance + strokeWidth)}px`;
        
        const perimeter = 2 * (innerWidth + innerHeight);
        rect.style.strokeDasharray = `${perimeter}`;
        rect.style.strokeDashoffset = `${perimeter}`;
        
        this.observationFrameMetrics = {
            inset,
            innerWidth,
            innerHeight,
            rectLeft: inset,
            rectTop: inset,
            perimeter,
            frameLeft: left,
            frameTop: top,
            frameWidth: width,
            frameHeight: height,
            clearance,
            strokeWidth,
            targetRect: {
                left: targetRect.left - containerRect.left,
                top: targetRect.top - containerRect.top,
                width: targetRect.width,
                height: targetRect.height
            }
        };
    }
    
    // Attach skip button event listener after rendering
    attachSkipButton() {
        if (this.skipButtonId && this.skipCallback) {
            setTimeout(() => {
                const skipButton = document.getElementById(this.skipButtonId);
                if (skipButton) {
                    skipButton.addEventListener('click', this.skipCallback);
                }
            }, 100);
        }
    }
    
    // Update progress bar during observation with easing and pulse effects
    updateProgress(percent, duration, isActive = true) {
        const progressBar = document.getElementById('progress-bar');
        const glowEl = document.getElementById('progress-glow');
        const timeRemainingEl = document.getElementById('time-remaining');
        const frameWrapper = document.getElementById('observation-frame');
        const frameRect = document.getElementById('observation-frame-rect');
        const frameCursor = document.getElementById('observation-cursor');
        
        const easedPercent = 1 - Math.pow(1 - (percent / 100), 3);
        const easedWidth = (easedPercent * 100);
        
        if (progressBar) {
            progressBar.style.width = `${easedWidth}%`;
            progressBar.style.transition = isActive
                ? 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                : 'none';
        }
        
        if (glowEl) {
            if (isActive) {
                glowEl.style.width = `${Math.max(10, easedWidth)}%`;
                glowEl.style.opacity = '1';
                glowEl.style.transition = 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease';
            } else {
                glowEl.style.opacity = '0';
            }
        }
        
        if (timeRemainingEl && duration) {
            const remainingSeconds = Math.max(0, duration * (1 - percent / 100));
            timeRemainingEl.textContent = Math.ceil(remainingSeconds).toString();
        }
        // Update perimeter scan frame
        if (frameWrapper && frameRect && this.observationFrameMetrics) {
            const { perimeter, rectLeft, rectTop, innerWidth, innerHeight } = this.observationFrameMetrics;
            const dashLength = Math.max(60, perimeter * 0.07);
            const strokeActive = 'rgba(158, 198, 255, 0.85)';
            const strokeIdle = 'rgba(255, 255, 255, 0.2)';
            const strokeComplete = 'rgba(105, 115, 140, 0.25)';
            
            if (!isActive && percent === 0) {
                frameWrapper.style.opacity = '0';
                frameRect.style.strokeDasharray = `${perimeter}`;
                frameRect.style.strokeDashoffset = `${perimeter}`;
                frameRect.style.stroke = strokeIdle;
                if (frameCursor) frameCursor.style.opacity = '0';
            } else if (isActive) {
                frameWrapper.style.opacity = '1';
                const dashOffset = perimeter - easedPercent * perimeter;
                frameRect.style.strokeDasharray = `${dashLength} ${perimeter}`;
                frameRect.style.strokeDashoffset = `${dashOffset}`;
                frameRect.style.stroke = strokeActive;
                if (frameCursor) {
                    const travel = easedPercent * perimeter;
                    let remaining = travel;
                    let cursorX = rectLeft;
                    let cursorY = rectTop;
                    
                    if (remaining <= innerWidth) {
                        cursorX += remaining;
                    } else {
                        remaining -= innerWidth;
                        if (remaining <= innerHeight) {
                            cursorX += innerWidth;
                            cursorY += remaining;
                        } else {
                            remaining -= innerHeight;
                            if (remaining <= innerWidth) {
                                cursorX += innerWidth - remaining;
                                cursorY += innerHeight;
                            } else {
                                remaining -= innerWidth;
                                remaining = Math.min(innerHeight, remaining);
                                cursorX = rectLeft;
                                cursorY = rectTop + innerHeight - remaining;
                            }
                        }
                    }
                    
                    frameCursor.style.left = `${cursorX}px`;
                    frameCursor.style.top = `${cursorY}px`;
                    frameCursor.style.opacity = '1';
                }
            } else {
                frameWrapper.style.opacity = '0';
                frameRect.style.strokeDasharray = `${perimeter}`;
                frameRect.style.strokeDashoffset = `${perimeter}`;
                frameRect.style.stroke = strokeComplete;
                if (frameCursor) frameCursor.style.opacity = '0';
            }
        }
    }
    
    // Clear real-time update interval
    clearRealTimeUpdates() {
        if (this.realTimeUpdateInterval) {
            clearInterval(this.realTimeUpdateInterval);
            this.realTimeUpdateInterval = null;
        }
    }
    
    // Display brief transition (no detailed results)
    displayTransition(newBalance, scenarioCount) {
        const balanceHTML = this.displayBalance(newBalance);
        return `
            ${balanceHTML}
            <div id="game-transition" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 999;
                color: #000;
                text-align: center;
                font-family: 'Courier New', 'Monaco', monospace;
                font-size: 10px;
                opacity: 0;
                animation: fadeInOut 1.5s ease-in-out;
                font-weight: 400;
                letter-spacing: 0;
                text-transform: uppercase;
            ">
                NEXT SCENARIO...
            </div>
        `;
    }
    
    // Display results screen (kept for game over, but not used after each scenario)
    displayResults(result, scenario, newBalance) {
        const balanceHTML = this.displayBalance(newBalance);
        const { didSmile, measurements, verdict, score, pointsEarned, pointsDeducted, feedbackMessages } = result;
        
        const responseText = didSmile ? 'Smile detected' : 'No smile detected';
        const responseColor = didSmile ? '#4CAF50' : '#F44336';
        
        const measurementsHTML = measurements && didSmile ? `
            <div style="
                margin: 20px 0;
                padding: 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                text-align: left;
            ">
                <div style="font-weight: 600; margin-bottom: 10px;">TECHNICAL ANALYSIS:</div>
                <div style="font-size: 14px; line-height: 1.8; font-family: 'Courier New', monospace;">
                    ├─ Smile Intensity: ${Math.round(measurements.intensity || 0)}%<br>
                    ├─ Eye Involvement: ${Math.round(measurements.eyeInvolvement || 0)}%<br>
                    ├─ Symmetry: ${Math.round(measurements.symmetry || 0)}%<br>
                    ${measurements.onsetSpeed ? `├─ Onset Timing: ${Math.round(measurements.onsetSpeed)}ms<br>` : ''}
                    ${measurements.duration ? `└─ Duration: ${measurements.duration.toFixed(1)}s` : ''}
                </div>
            </div>
        ` : '';
        
        const feedbackHTML = feedbackMessages && feedbackMessages.length > 0 ? `
            <div style="
                margin: 20px 0;
                padding: 15px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                text-align: left;
                font-size: 14px;
                line-height: 1.6;
            ">
                ${feedbackMessages.map(msg => `<div style="margin: 5px 0;">${msg}</div>`).join('')}
            </div>
        ` : '';
        
        return `
            ${balanceHTML}
            <div id="game-results" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 85%;
                max-width: 700px;
                background: rgba(0, 0, 0, 0.9);
                padding: 40px;
                border-radius: 12px;
                z-index: 999;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <div style="
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 20px;
                    color: ${responseColor};
                ">
                    RESPONSE: ${responseText}
                </div>
                
                ${measurementsHTML}
                
                ${verdict ? `
                    <div style="
                        margin: 20px 0;
                        padding: 15px;
                        background: rgba(255, 255, 255, 0.1);
                        border-left: 4px solid ${responseColor};
                        border-radius: 4px;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px;">VERDICT: ${verdict}</div>
                        ${feedbackHTML}
                    </div>
                ` : ''}
                
                <div style="
                    margin: 20px 0;
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                ">
                    <div style="font-weight: 600; margin-bottom: 10px;">TRANSACTION:</div>
                    ${pointsDeducted ? `<div>Cost: ${pointsDeducted} points</div>` : ''}
                    ${pointsEarned ? `<div>Earned: +${pointsEarned} points</div>` : ''}
                    <div style="margin-top: 10px; font-weight: 700;">
                        Net: ${pointsDeducted - (pointsEarned || 0)} points
                    </div>
                    <div style="margin-top: 15px; font-size: 18px; font-weight: 700; color: ${this.getBalanceColor(newBalance)};">
                        NEW BALANCE: ${newBalance}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Display game over screen
    displayGameOver(finalBalance, scenariosCompleted, scenarioHistory) {
        const balanceHTML = this.displayBalance(finalBalance);
        
        // Analyze key moments
        const keyMoments = [];
        scenarioHistory.forEach((result, index) => {
            if (result.context && result.context.includes('emotional')) {
                keyMoments.push({
                    scenario: index + 1,
                    context: result.context,
                    didSmile: result.didSmile,
                    verdict: result.verdict
                });
            }
        });
        
        const momentsHTML = keyMoments.length > 0 ? `
            <div style="
                margin: 20px 0;
                padding: 20px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 8px;
                text-align: left;
            ">
                <div style="font-weight: 600; margin-bottom: 15px;">ANALYSIS:</div>
                ${keyMoments.map((moment, i) => `
                    <div style="margin: 10px 0; font-size: 14px; line-height: 1.6;">
                        • ${moment.didSmile ? 'You calculated' : 'You withheld'} emotion in scenario ${moment.scenario}
                        ${moment.verdict === 'COERCED' ? ' (under economic pressure)' : ''}
                    </div>
                `).join('')}
            </div>
        ` : '';
        
        return `
            ${balanceHTML}
            <div id="game-over" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 85%;
                max-width: 100%;
                background: rgba(10, 10, 10, 0.9);
                padding: 36px;
                border-radius: 24px;
                text-align: left;
                z-index: 1000;
                color: #fff;
                font-family: 'Courier New', 'Monaco', monospace;
                box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
            ">
                <div style="
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 24px;
                    color: rgba(255, 255, 255, 0.8);
                    letter-spacing: 0.4em;
                    text-transform: uppercase;
                ">
                    EMOTIONAL DEBT REACHED
                </div>
                
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 14px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.8);
                ">
                    <span>FINAL BALANCE:</span>
                    <span>${finalBalance}</span>
                </div>
                
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    margin-bottom: 28px;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.7);
                ">
                    <span>SCENARIOS COMPLETED:</span>
                    <span>${scenariosCompleted}</span>
                </div>
                
                ${momentsHTML ? momentsHTML.replace(/background: rgba\(255, 255, 255, 0\.05\);/g, 'background: rgba(255, 255, 255, 0.04);').replace(/border-radius: 8px;/g, 'border-radius: 16px;').replace(/color: #[a-f0-9]+/gi, 'color: rgba(255, 255, 255, 0.85)').replace(/border: 1px dotted #[a-f0-9]+;/gi, '').replace(/font-family: [^;]+;/g, "font-family: 'Courier New', 'Monaco', monospace;") : ''}
                
                <div style="
                    margin-top: 56px;
                    margin-bottom: 32px;
                    padding: 40px 32px;
                    font-size: 18px;
                    line-height: 1.5;
                    color: #fff;
                    font-weight: 800;
                    letter-spacing: 0.25em;
                    text-transform: uppercase;
                    text-align: center;
                    animation: pulse-danger 2s ease-in-out infinite;
                ">
                    THE SYSTEM NOW OWNS YOUR EMOTIONAL EXPRESSION.
                </div>
            </div>
        `;
    }
    
    // Create particle effect for balance changes
    createBalanceParticles(container, amount, color) {
        const particleCount = Math.min(8, Math.abs(Math.floor(amount / 5)));
        const particlesEl = document.getElementById('balance-particles');
        
        if (!particlesEl) return;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            const angle = (Math.PI * 2 * i) / particleCount;
            const distance = 40 + Math.random() * 20;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            
            particle.style.cssText = `
                position: absolute;
                width: 6px;
                height: 6px;
                background: ${color};
                border-radius: 50%;
                left: 50%;
                top: 50%;
                box-shadow: 0 0 10px ${color}80;
                opacity: 1;
                transform: translate(-50%, -50%) translate(0, 0) scale(1);
                transition: all 1.2s ease-out;
            `;
            
            particlesEl.appendChild(particle);
            
            // Animate particle
            requestAnimationFrame(() => {
                particle.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(0.3)`;
                particle.style.opacity = '0';
            });
            
            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1200);
        }
    }
    
    // Update heatmap silhouette
    updateHeatmapSilhouette(landmarks, faceBoundingBox, smilingScore, mirrorInstance = null) {
        if (!this.container) {
            console.log('Heatmap: No container');
            return;
        }
        
        // Debug logging
        console.log('Heatmap update:', {
            hasLandmarks: !!landmarks && landmarks.length > 0,
            landmarksCount: landmarks ? landmarks.length : 0,
            hasBoundingBox: !!faceBoundingBox,
            smilingScore: smilingScore
        });
        
        // Always try to get canvas from DOM (it might have been recreated)
        let canvas = document.getElementById('heatmap-silhouette');
        if (!canvas) {
            console.log('Heatmap: Canvas not found in DOM, creating it');
            // Try to find the scenario panel first
            const scenarioPanel = document.getElementById('game-scenario');
            if (scenarioPanel) {
                // Create canvas inside scenario panel
                canvas = document.createElement('canvas');
                canvas.id = 'heatmap-silhouette';
                canvas.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 1;
                    opacity: 0.75;
                    pointer-events: none;
                    mix-blend-mode: screen;
                `;
                scenarioPanel.insertBefore(canvas, scenarioPanel.firstChild);
            } else {
                // Fallback: insert at beginning of container
                canvas = document.createElement('canvas');
                canvas.id = 'heatmap-silhouette';
                canvas.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 1;
                    opacity: 0.75;
                    pointer-events: none;
                    mix-blend-mode: screen;
                `;
                this.container.insertBefore(canvas, this.container.firstChild);
            }
        }
        
        // Ensure canvas is visible
        canvas.style.display = 'block';
        canvas.style.opacity = '0.75';
        canvas.style.zIndex = '1';
        canvas.style.mixBlendMode = 'screen';
        
        this.heatmapCanvas = canvas;
        if (!this.heatmapCtx) {
            this.heatmapCtx = canvas.getContext('2d');
        }
        
        const ctx = this.heatmapCtx;
        
        // Get dimensions from scenario panel if canvas is inside it, otherwise use container
        const scenarioPanel = document.getElementById('game-scenario');
        let targetElement = scenarioPanel || this.container;
        const targetRect = targetElement.getBoundingClientRect();
        const newWidth = targetRect.width || targetElement.offsetWidth || 405;
        const newHeight = targetRect.height || targetElement.offsetHeight || 720;
        
        // Only resize canvas if dimensions changed (to avoid clearing on every frame unnecessarily)
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
        }
        
        // Clear canvas completely before redrawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fill with transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (!landmarks || landmarks.length === 0) {
            // Draw a simple test circle if no landmarks (for debugging)
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        
        if (!faceBoundingBox) {
            // Draw a simple test circle if no bounding box (for debugging)
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        
        // Get actual webcam dimensions if available, otherwise use container dimensions
        let videoWidth = this.container.offsetWidth || 405;
        let videoHeight = this.container.offsetHeight || 720;
        
        if (mirrorInstance && mirrorInstance.webcam) {
            if (mirrorInstance.webcam.videoWidth > 0 && mirrorInstance.webcam.videoHeight > 0) {
                videoWidth = mirrorInstance.webcam.videoWidth;
                videoHeight = mirrorInstance.webcam.videoHeight;
            }
        }
        
        // First, process landmarks to get their actual coordinates in video space
        // This ensures the ellipse and landmarks use the same coordinate system
        let landmarkCoords = [];
        if (landmarks.length > 0) {
            landmarks.forEach((landmark) => {
                if (landmark && landmark.length >= 2) {
                    let x = landmark[0];
                    let y = landmark[1];
                    
                    // If coordinates are normalized (0-1), convert to pixels
                    if (x <= 1 && y <= 1 && x >= 0 && y >= 0) {
                        x = x * videoWidth;
                        y = y * videoHeight;
                    }
                    // Otherwise, assume they're already in pixel coordinates
                    landmarkCoords.push({ x, y });
                }
            });
        }
        
        // Calculate center and size from landmarks (most accurate)
        let centerX, centerY, faceWidth, faceHeight;
        if (landmarkCoords.length > 0) {
            const xs = landmarkCoords.map(c => c.x);
            const ys = landmarkCoords.map(c => c.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            centerX = (minX + maxX) / 2;
            centerY = (minY + maxY) / 2;
            faceWidth = maxX - minX;
            faceHeight = maxY - minY;
        } else if (faceBoundingBox.xCenter !== undefined) {
            // Fallback: use bounding box if no landmarks
            centerX = faceBoundingBox.xCenter * videoWidth;
            centerY = faceBoundingBox.yCenter * videoHeight;
            faceWidth = faceBoundingBox.width * videoWidth;
            faceHeight = faceBoundingBox.height * videoHeight;
        } else if (faceBoundingBox.x !== undefined) {
            // Fallback: pixel coordinates
            centerX = faceBoundingBox.x + (faceBoundingBox.width / 2);
            centerY = faceBoundingBox.y + (faceBoundingBox.height / 2);
            faceWidth = faceBoundingBox.width;
            faceHeight = faceBoundingBox.height;
        } else {
            return; // No valid coordinates
        }
        
        // Scale to canvas dimensions while preserving aspect ratio
        // Use uniform scaling to prevent distortion
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let scaleX, scaleY;
        let offsetX = 0;
        let offsetY = 0;
        
        // Maintain video aspect ratio within canvas
        if (canvasAspect > videoAspect) {
            // Canvas is wider - fit height, center horizontally
            scaleY = canvas.height / videoHeight;
            scaleX = scaleY; // Uniform scaling
            offsetX = (canvas.width - (videoWidth * scaleX)) / 2;
        } else {
            // Canvas is taller - fit width, center vertically
            scaleX = canvas.width / videoWidth;
            scaleY = scaleX; // Uniform scaling
            offsetY = (canvas.height - (videoHeight * scaleY)) / 2;
        }
        
        // Scale center and dimensions using the same transformation
        centerX = (centerX * scaleX) + offsetX;
        centerY = (centerY * scaleY) + offsetY;
        faceWidth *= scaleX;
        faceHeight *= scaleY;
        
        // Determine intensity based on smile score (0-100)
        const intensity = Math.min(100, Math.max(0, smilingScore || 0)) / 100;
        
        // Create a more visible face contour visualization
        // Enlarge the face to fill majority of screen
        const scaleFactor = Math.min(canvas.width / faceWidth, canvas.height / faceHeight) * 1.5;
        
        // Color mapping: blue (cold/low) to red (hot/high smile)
        const r = Math.floor(100 + (intensity * 155)); // 100-255
        const g = Math.floor(50 + (intensity * 50));   // 50-100
        const b = Math.floor(150 - (intensity * 100)); // 150-50
        
        // Calculate the original face center in video coordinates (before scaling)
        const originalCenterX = (centerX - offsetX) / scaleX;
        const originalCenterY = (centerY - offsetY) / scaleY;
        
        if (landmarkCoords.length > 0) {
            const timeSeconds = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() / 1000
                : Date.now() / 1000;
            const focusPulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(timeSeconds * 2.4));
            const alertPulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(timeSeconds * 3.6));
            const breathingPulse = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(timeSeconds * 1.1));
            const attentionPulse = Math.abs(Math.sin(timeSeconds * 2.2));

            // Subtle face aura to create hierarchy
            const auraRadius = Math.max(faceWidth, faceHeight) * scaleFactor * Math.max(scaleX, scaleY) * 0.85;
            const auraGradient = ctx.createRadialGradient(
                centerX,
                centerY,
                auraRadius * 0.25 * breathingPulse,
                centerX,
                centerY,
                auraRadius
            );
            auraGradient.addColorStop(0, `rgba(255, 255, 255, ${0.08 * breathingPulse})`);
            auraGradient.addColorStop(0.4, `rgba(120, 170, 255, ${0.06 * breathingPulse})`);
            auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = auraGradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, auraRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            // Attention pulse ring to signal focus to participants
            const pulseRadius = auraRadius * (0.45 + 0.35 * attentionPulse);
            ctx.save();
            ctx.globalAlpha = 0.12 + 0.25 * attentionPulse;
            ctx.lineWidth = 2 + 5 * attentionPulse;
            ctx.shadowBlur = 25 * (0.6 + 0.4 * attentionPulse);
            ctx.shadowColor = `rgba(120, 200, 255, ${0.5 * (0.6 + 0.4 * attentionPulse)})`;
            ctx.strokeStyle = `rgba(90, 170, 255, ${0.35 + 0.35 * attentionPulse})`;
            ctx.beginPath();
            ctx.arc(centerX, centerY - auraRadius * 0.08, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            // Helper function to get center of a zone from landmark indices
            const getZoneCenter = (indices) => {
                const validCoords = indices
                    .filter(idx => idx < landmarkCoords.length)
                    .map(idx => landmarkCoords[idx])
                    .filter(coord => coord);
                
                if (validCoords.length === 0) return null;
                
                const avgX = validCoords.reduce((sum, coord) => sum + coord.x, 0) / validCoords.length;
                const avgY = validCoords.reduce((sum, coord) => sum + coord.y, 0) / validCoords.length;
                
                return { x: avgX, y: avgY };
            };
            
            // Helper function to get heat color based on intensity (0-100)
            const getHeatColor = (intensity) => {
                let r, g, b;
                // Increase base opacity for better visibility
                let opacity = 0.85;
                
                if (intensity <= 25) {
                    // Blue (0-25)
                    const t = intensity / 25;
                    r = Math.floor(0 + t * 50);
                    g = Math.floor(100 + t * 155);
                    b = 255;
                } else if (intensity <= 50) {
                    // Cyan to Green (25-50)
                    const t = (intensity - 25) / 25;
                    r = 0;
                    g = 255;
                    b = Math.floor(255 - t * 155);
                } else if (intensity <= 75) {
                    // Green to Yellow (50-75)
                    const t = (intensity - 50) / 25;
                    r = Math.floor(0 + t * 255);
                    g = 255;
                    b = Math.floor(100 - t * 100);
                } else {
                    // Yellow to Red (75-100)
                    const t = (intensity - 75) / 25;
                    r = 255;
                    g = Math.floor(255 - t * 205);
                    b = 0;
                }
                
                return { r, g, b, opacity };
            };
            
            // Define landmark indices for 3 zones
            const mouthLandmarks = [61, 291, 0, 17, 84, 314, 405, 321].filter(idx => idx < landmarkCoords.length);
            const leftEyeLandmarks = [33, 133, 159, 145, 153].filter(idx => idx < landmarkCoords.length);
            const rightEyeLandmarks = [362, 263, 386, 374, 380].filter(idx => idx < landmarkCoords.length);
            
            // Create zones array
            const zones = [];
            
            // Mouth zone - larger radius for visibility
            const mouthCenter = getZoneCenter(mouthLandmarks);
            if (mouthCenter) {
                zones.push({
                    center: mouthCenter,
                    radius: faceWidth * 0.5, // Increased from 0.3 to 0.5
                    intensity: smilingScore || 0
                });
            }
            
            // Left eye zone - larger radius for visibility
            const leftEyeCenter = getZoneCenter(leftEyeLandmarks);
            if (leftEyeCenter) {
                zones.push({
                    center: leftEyeCenter,
                    radius: faceWidth * 0.25, // Increased from 0.15 to 0.25
                    intensity: (smilingScore || 0) * 0.6
                });
            }
            
            // Right eye zone - larger radius for visibility
            const rightEyeCenter = getZoneCenter(rightEyeLandmarks);
            if (rightEyeCenter) {
                zones.push({
                    center: rightEyeCenter,
                    radius: faceWidth * 0.25, // Increased from 0.15 to 0.25
                    intensity: (smilingScore || 0) * 0.6
                });
            }
            
            // Draw each zone as a smooth radial gradient
            zones.forEach((zone, index) => {
                if (!zone || !zone.center) {
                    console.log('Zone missing center:', zone);
                    return;
                }
                
                // Transform zone center coordinates
                const relativeX = zone.center.x - originalCenterX;
                const relativeY = zone.center.y - originalCenterY;
                const scaledRelativeX = relativeX * scaleFactor;
                const scaledRelativeY = relativeY * scaleFactor;
                const zoneX = centerX + (scaledRelativeX * scaleX);
                const zoneY = centerY + (scaledRelativeY * scaleY);
                
                // Ensure minimum visible radius
                const baseRadius = zone.radius * scaleFactor;
                const scaledRadius = baseRadius * Math.max(scaleX, scaleY);
                const baseZoneRadius = Math.max(scaledRadius, 20); // Minimum 20px radius for visibility
                const pulseFactor = index === 0 ? focusPulse : alertPulse;
                const zoneRadius = baseZoneRadius * (1 + 0.18 * pulseFactor);
                
                // Debug log
                console.log('Drawing heat zone:', {
                    zoneType: zone === zones[0] ? 'mouth' : zone === zones[1] ? 'leftEye' : 'rightEye',
                    zoneX: Math.round(zoneX),
                    zoneY: Math.round(zoneY),
                    zoneRadius: Math.round(zoneRadius),
                    intensity: Math.round(zone.intensity),
                    canvasSize: `${canvas.width}x${canvas.height}`
                });
                
                // Get heat color for this zone
                // Ensure minimum intensity for visibility (at least 10 for blue)
                const minIntensity = Math.max(zone.intensity, 10) * (index === 0 ? breathingPulse : 1);
                const heatColor = getHeatColor(minIntensity);
                
                // Create radial gradient
                const gradient = ctx.createRadialGradient(
                    zoneX, zoneY, 0,
                    zoneX, zoneY, zoneRadius
                );
                
                // High opacity stops for maximum visibility
                gradient.addColorStop(0, `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, ${0.95 * pulseFactor})`); // Center: very bright
                gradient.addColorStop(0.2, `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, ${0.85 * pulseFactor})`);
                gradient.addColorStop(0.4, `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, ${0.65 * pulseFactor})`);
                gradient.addColorStop(0.6, `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, ${0.4 * pulseFactor})`);
                gradient.addColorStop(0.8, `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, ${0.18 * pulseFactor})`);
                gradient.addColorStop(1, `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, 0)`);
                
                // Draw smooth circular heat blob
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(zoneX, zoneY, zoneRadius, 0, Math.PI * 2);
                ctx.fill();
            });

            // Create face-like symmetric attention lights (eyes) to imply presence
            if (zones.length >= 3) {
                const eyeZones = zones.slice(1, 3);
                eyeZones.forEach((eyeZone, idx) => {
                    const relativeX = eyeZone.center.x - originalCenterX;
                    const relativeY = eyeZone.center.y - originalCenterY;
                    const scaledRelativeX = relativeX * scaleFactor;
                    const scaledRelativeY = relativeY * scaleFactor;
                    const eyeX = centerX + (scaledRelativeX * scaleX);
                    const eyeY = centerY + (scaledRelativeY * scaleY);

                    const pulse = 0.65 + 0.35 * Math.sin(timeSeconds * 5 + idx);
                    const eyeRadius = Math.max(18, Math.min(32, eyeZone.radius * scaleFactor * Math.max(scaleX, scaleY) * 0.8)) * pulse;
                    const eyeGlow = ctx.createRadialGradient(
                        eyeX, eyeY, eyeRadius * 0.1,
                        eyeX, eyeY, eyeRadius
                    );
                    eyeGlow.addColorStop(0, `rgba(255, 255, 255, ${0.55 * pulse})`);
                    eyeGlow.addColorStop(0.3, `rgba(160, 220, 255, ${0.4 * pulse})`);
                    eyeGlow.addColorStop(0.7, `rgba(40, 120, 255, ${0.25 * pulse})`);
                    eyeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

                    ctx.globalCompositeOperation = 'lighter';
                    ctx.save();
                    ctx.globalAlpha = 0.6 + 0.3 * attentionPulse;
                    ctx.fillStyle = eyeGlow;
                    ctx.beginPath();
                    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    ctx.globalCompositeOperation = 'source-over';

                    // Add a sharp pupil-like light to imply attention
                    ctx.save();
                    ctx.shadowBlur = 18;
                    ctx.shadowColor = `rgba(255, 255, 255, ${0.6 + 0.3 * pulse})`;
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 + 0.1 * pulse})`;
                    ctx.beginPath();
                    ctx.arc(eyeX, eyeY, eyeRadius * 0.18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }

            // Accent the mouth zone with a pulse ring to signal focus
            if (zones.length > 0 && zones[0].center) {
                const mouthZone = zones[0];
                const relativeX = mouthZone.center.x - originalCenterX;
                const relativeY = mouthZone.center.y - originalCenterY;
                const scaledRelativeX = relativeX * scaleFactor;
                const scaledRelativeY = relativeY * scaleFactor;
                const mouthX = centerX + (scaledRelativeX * scaleX);
                const mouthY = centerY + (scaledRelativeY * scaleY);
                const mouthRadius = Math.max(mouthZone.radius * scaleFactor * Math.max(scaleX, scaleY) * 0.65, 40) * focusPulse;

                ctx.lineWidth = Math.max(2, 4 * focusPulse);
                ctx.strokeStyle = `rgba(255, 180, 80, ${0.45 * focusPulse})`;
                ctx.beginPath();
                ctx.arc(mouthX, mouthY, mouthRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            // Optional: Add small tracking dots at key landmarks
            const keyLandmarkIndices = [61, 291, 33, 263, 1]; // mouth corners, eye corners, nose
            keyLandmarkIndices.forEach(idx => {
                if (idx < landmarkCoords.length) {
                    const coord = landmarkCoords[idx];
                    const relativeX = coord.x - originalCenterX;
                    const relativeY = coord.y - originalCenterY;
                    const scaledRelativeX = relativeX * scaleFactor;
                    const scaledRelativeY = relativeY * scaleFactor;
                    const x = centerX + (scaledRelativeX * scaleX);
                    const y = centerY + (scaledRelativeY * scaleY);
                    
                    // Get heat color based on smile intensity
                    const heatColor = getHeatColor(smilingScore || 0);
                    
                    // Draw small dot with glow
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, 0.6)`;
                    ctx.fillStyle = `rgba(${heatColor.r}, ${heatColor.g}, ${heatColor.b}, 0.8)`;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            });
        }
        
        // Ensure canvas is visible after drawing
        canvas.style.display = 'block';
    }
    
    // Clear all game UI
    clear() {
        this.clearRealTimeUpdates();
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.heatmapCanvas = null;
        this.heatmapCtx = null;
        this.observationFrameMetrics = null;
    }
    
    // Add CSS animations
    addStyles() {
        if (document.getElementById('game-ui-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'game-ui-styles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeInOut {
                0%, 100% { opacity: 0; }
                50% { opacity: 1; }
            }
            @keyframes typingIntroFull {
                0% { width: 0; opacity: 1; }
                100% { width: 100%; opacity: 1; }
            }
            @keyframes introBlockScale {
                0% { transform: scale(1); }
                100% { transform: scale(0.88); }
            }
            @keyframes caretIntro {
                from, to { border-color: rgba(255, 255, 255, 0.55); }
                50% { border-color: transparent; }
            }
            @keyframes balance-deduct {
                0% { transform: scale(1) translateX(0); }
                25% { transform: scale(1.1) translateX(-5px); color: #FF3B30 !important; }
                50% { transform: scale(1.15) translateX(0); }
                75% { transform: scale(1.1) translateX(5px); }
                100% { transform: scale(1) translateX(0); }
            }
            @keyframes balance-add {
                0% { transform: scale(1) translateY(0); }
                25% { transform: scale(1.1) translateY(-5px); }
                50% { transform: scale(1.15) translateY(0); }
                75% { transform: scale(1.1) translateY(5px); }
                100% { transform: scale(1) translateY(0); }
            }
            @keyframes pulse-danger {
                0%, 100% { 
                    opacity: 1;
                    transform: scale(1);
                }
                50% { 
                    opacity: 0.9;
                    transform: scale(1.05);
                }
            }
            @keyframes progressShimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            @keyframes scorePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
            @keyframes scoreChange {
                0% { 
                    opacity: 0;
                    transform: translateY(-50%) translateX(-20px) scale(0.5);
                }
                50% { 
                    opacity: 1;
                    transform: translateY(-50%) translateX(0) scale(1.2);
                }
                100% { 
                    opacity: 0;
                    transform: translateY(-50%) translateX(20px) scale(0.8);
                }
            }
            @keyframes balanceShimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            @keyframes balanceChangePop {
                0% { 
                    opacity: 0;
                    transform: translateY(0) scale(0.5);
                }
                30% { 
                    opacity: 1;
                    transform: translateY(-10px) scale(1.2);
                }
                70% { 
                    opacity: 1;
                    transform: translateY(-15px) scale(1);
                }
                100% { 
                    opacity: 0;
                    transform: translateY(-20px) scale(0.8);
                }
            }
            @keyframes balanceParticle {
                0% { 
                    opacity: 1;
                    transform: translate(-50%, -50%) translate(0, 0) scale(1);
                }
                100% { 
                    opacity: 0;
                    transform: translate(-50%, -50%) translate(var(--x, 0), var(--y, 0)) scale(0.3);
                }
            }
            @keyframes mirrorGlow {
                0% { box-shadow: 0 0 12px rgba(120, 170, 255, 0.35); transform: scale(0.96); }
                100% { box-shadow: 0 0 26px rgba(160, 210, 255, 0.7); transform: scale(1.04); }
            }
            .balance-deduct {
                animation: balance-deduct 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .balance-add {
                animation: balance-add 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `;
        document.head.appendChild(style);
    }
    
    // Render HTML to container
    render(html) {
        if (this.container) {
            // Ensure container has proper positioning context for absolute children
            // Container should be fixed/relative/absolute for absolute children to work
            const computedStyle = window.getComputedStyle(this.container);
            const position = computedStyle.position;
            if (position === 'static') {
                this.container.style.position = 'relative';
            }
            
            // Hide container content first to prevent flash
            this.container.style.visibility = 'hidden';
            
            // Clear any pending scenario reveal delays
            if (this.scenarioRevealTimeout) {
                clearTimeout(this.scenarioRevealTimeout);
                this.scenarioRevealTimeout = null;
            }
            
            // Render immediately
            this.container.innerHTML = html;
            
            // Ensure global observation bar exists after render
            this.ensureObservationBar();
            
            // Force layout recalculation with multiple passes
            void this.container.offsetHeight;
            void this.container.offsetWidth;
            
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
                // Force another reflow
                void this.container.offsetHeight;
                
                // Now calculate exact positions and show
                const scenarioHeader = document.getElementById('scenario-header');
                const balance = document.getElementById('game-balance');
                const expressionBar = document.getElementById('expression-progress-wrap');
                const containerWidth = this.container.offsetWidth;
                const containerHeight = this.container.offsetHeight;
                
                if (balance && this.container) {
                    balance.style.opacity = '0';
                    balance.style.transition = 'opacity 0.35s ease-out';
                    balance.style.transform = 'translate(0, 0)';
                }
                
                if (scenarioHeader && this.container) {
                    const headerWidth = Math.min(containerWidth * 0.74, 820);
                    const headerTop = Math.min(containerHeight * 0.48, Math.max(160, containerHeight * 0.42));
                    scenarioHeader.style.width = `${headerWidth}px`;
                    scenarioHeader.style.top = `${headerTop}px`;
                    scenarioHeader.style.left = '50%';
                    scenarioHeader.style.opacity = '1';
                    scenarioHeader.style.transition = 'opacity 0.4s ease-out, transform 0.6s ease, width 0.6s ease, top 0.6s ease';
                }
                
                if (expressionBar) {
                    expressionBar.style.opacity = '0';
                }
                
                // Show container
                this.container.style.visibility = 'visible';
                
                // Reveal balance + expression bar + prompt card after 6 seconds (prompt-only time)
                this.scenarioRevealTimeout = setTimeout(() => {
                    const currentBalance = document.getElementById('game-balance');
                    const currentHeader = document.getElementById('scenario-header');
                    const currentBar = document.getElementById('expression-progress-wrap');
                    const containerWidth = this.container ? this.container.offsetWidth : window.innerWidth;
                    const containerHeight = this.container ? this.container.offsetHeight : window.innerHeight;
                    const targetWidth = Math.min(containerWidth * 0.74, 820);
                    
                    if (currentBalance) {
                        currentBalance.style.top = '28px';
                        currentBalance.style.right = '40px';
                        currentBalance.style.transform = 'scale(0.94)';
                        currentBalance.style.opacity = '1';
                    }
                    if (currentBar) {
                        currentBar.style.width = `${targetWidth}px`;
                        currentBar.style.transition = 'opacity 0.35s ease-out';
                        currentBar.style.opacity = '1';
                    }
                    if (currentHeader) {
                        let targetTop;
                        if (currentBar && this.container) {
                            const barRect = currentBar.getBoundingClientRect();
                            const containerRect = this.container.getBoundingClientRect();
                            const gap = 48;
                            targetTop = (barRect.bottom - containerRect.top) + gap;
                        } else {
                            targetTop = Math.max(280, containerHeight * 0.58);
                        }
                        const promptWidth = Math.min(containerWidth * 0.78, 860);
                        currentHeader.style.width = `${promptWidth}px`;
                        currentHeader.style.top = `${targetTop}px`;
                        currentHeader.style.transform = 'translate(-50%, 0) scale(0.98)';
                        currentHeader.style.borderRadius = '26px';
                        currentHeader.style.padding = '56px 52px 72px';
                        currentHeader.style.minHeight = '180px';
                        
                        const promptLabelEl = currentHeader.querySelector('[data-role="scenario-label"]');
                        const promptTextEl = currentHeader.querySelector('[data-role="scenario-prompt"]');
                        const personaCardEl = currentHeader.querySelector('[data-role="persona-card"]');
                        const personaNameEl = currentHeader.querySelector('[data-role="persona-name"]');
                        const personaOrbEl = currentHeader.querySelector('[data-role="persona-orb"]');
                        if (promptLabelEl) {
                            promptLabelEl.style.fontSize = '12px';
                            promptLabelEl.style.marginBottom = '20px';
                            promptLabelEl.style.letterSpacing = '0.55em';
                        }
                        if (promptTextEl) {
                            promptTextEl.style.fontSize = '22px';
                            promptTextEl.style.lineHeight = '1.5';
                        }
                        if (personaCardEl) personaCardEl.style.marginBottom = '16px';
                        if (personaNameEl) {
                            personaNameEl.style.fontSize = '11px';
                            personaNameEl.style.letterSpacing = '0.38em';
                            personaNameEl.style.color = 'rgba(255, 255, 255, 0.45)';
                        }
                        if (personaOrbEl) {
                            personaOrbEl.style.width = '36px';
                            personaOrbEl.style.height = '36px';
                            personaOrbEl.style.boxShadow = '0 0 16px rgba(120, 170, 255, 0.45)';
                        }
                        
                        // Delay positioning the observation frame until after header is settled
                        if (this.framePositionTimeout) {
                            clearTimeout(this.framePositionTimeout);
                        }
                        this.framePositionTimeout = setTimeout(() => {
                            this.positionObservationFrame(currentHeader);
                        }, 840);
                    }
                    this.scenarioRevealTimeout = null;
                }, 6000);
            });
        }
    }
}

