// Game Loop - Main coordinator for the Emotional Economics Game

import { GameStateManager } from './GameStateManager.js';
import { ScenarioController } from './ScenarioController.js';
import { MeasurementAnalyzer } from './MeasurementAnalyzer.js';
import { InterpretationEngine } from './InterpretationEngine.js';
import { GameUI } from './GameUI.js';

export class GameLoop {
    constructor(mirrorInstance, container) {
        this.mirror = mirrorInstance; // DigitalMirror instance
        this.gameState = new GameStateManager();
        this.scenarioController = new ScenarioController();
        this.measurementAnalyzer = new MeasurementAnalyzer(mirrorInstance);
        this.interpretationEngine = new InterpretationEngine();
        this.gameUI = new GameUI(container);
        
        this.isRunning = false;
        this.storyComplete = false;
        this.observationInterval = null;
        this.currentScenario = null;
    }
    
    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.storyComplete = false;
        this.gameState.reset();
        this.measurementAnalyzer.resetBaseline();

        // End the game once all story chunks have been revealed
        document.addEventListener('mirror-story-complete', () => {
            this.storyComplete = true;
        }, { once: true });
        
        // Add CSS styles
        this.gameUI.addStyles();
        
        // Show intro screen
        this.gameUI.render(this.gameUI.displayIntro());
        const introTarget = document.getElementById('intro-typed-text');
        if (introTarget) {
            const introScript = [
                { text: 'Why don\u2019t we help you practice with some scenarios?', pause: 0 }
            ];
            this.gameUI.runTypingSequence(introTarget, introScript);
        }
        await this.delay(7500); // Give the intro typing animation time to finish
        
        // Start game loop
        await this.runGameLoop();
    }
    
    // Public method to skip intro and start game directly (for debug)
    async skipIntro() {
        const intro = document.getElementById('game-intro');
        if (intro) intro.style.display = 'none';
        await this.runGameLoop();
    }
    
    async runGameLoop() {
        // Three fixed scenarios — each followed by its own story segment.
        const FIXED_SCENARIOS = [
            {
                id: 'fixed_movein',
                phase: 'trust',
                promptText: "It's move-in day. Your friends surprise you with a gift in a large box.",
                observationDuration: 10,
                smileCost: -15,
                noSmilePenalty: -25,
                context: 'positive_sharing',
                isRepeatable: false
            },
            {
                id: 'fixed_haircut',
                phase: 'trust',
                promptText: "You look at yourself in the mirror with your new haircut and feel cute.",
                observationDuration: 10,
                smileCost: -15,
                noSmilePenalty: -25,
                context: 'personal_compliment',
                isRepeatable: false
            },
            {
                id: 'fixed_stress',
                phase: 'trust',
                promptText: "You have been frowning lately due to work stress. Try smiling to lift your mood.",
                observationDuration: 10,
                smileCost: -15,
                noSmilePenalty: -25,
                context: 'personal_emotional',
                isRepeatable: false
            }
        ];

        for (let i = 0; i < FIXED_SCENARIOS.length; i++) {
            this.currentScenario = FIXED_SCENARIOS[i];

            if (!this.isRunning) { this.endGame(); return; }

            // Ensure container is ready
            if (this.container) {
                void this.container.offsetHeight;
                void this.container.offsetWidth;
                await this.delay(10);
                void this.container.offsetHeight;
            }

            // Ensure story overlay is hidden before the scenario card appears
            const storyOverlay = document.getElementById('mirror-story-overlay');
            if (storyOverlay) storyOverlay.style.visibility = 'hidden';

            // Display the scenario — gameUI.render recreates the card and all UI elements fresh
            const currentBalance = this.gameState.getBalance();
            this.gameUI.render(
                this.gameUI.displayScenario(this.currentScenario, currentBalance, () => {})
            );
            this.gameUI.setCurrentScenario(this.currentScenario);

            await this.delay(50);
            if (!this.isRunning) return;

            // Prompt-only phase before measurement begins
            await this.delay(4000);
            if (!this.isRunning) return;

            // Observe facial response
            this.scenarioController.startPassiveObservation(this.currentScenario.observationDuration);
            const balanceBefore = this.gameState.getBalance();
            this.gameUI.updateProgress(0, this.currentScenario.observationDuration, false);
            await this.observeFacialResponse(this.currentScenario.observationDuration, balanceBefore);
            if (!this.isRunning) return;

            // Freeze progress bar
            this.gameUI.updateProgress(100, this.currentScenario.observationDuration, false);

            // Brief pause, then fade out scenario card
            await this.delay(1000);
            if (!this.isRunning) return;
            this.gameUI.fadeOutScenarioCard();
            await this.delay(900);
            if (!this.isRunning) return;

            // Hide score/balance UI — story segment takes over the mirror
            const expressionWrap = document.getElementById('expression-progress-wrap');
            if (expressionWrap) {
                expressionWrap.style.transition = 'opacity 0.8s ease';
                expressionWrap.style.opacity = '0';
                setTimeout(() => { expressionWrap.style.display = 'none'; }, 800);
            }
            const balanceEl = document.getElementById('balance-display');
            if (balanceEl) {
                balanceEl.style.transition = 'opacity 0.8s ease';
                balanceEl.style.opacity = '0';
                setTimeout(() => { balanceEl.style.display = 'none'; }, 800);
            }

            // Signal MirrorStory to show the corresponding story segment and wait for it
            const segmentNum  = i + 1;
            const startEvent  = `mirror-story-segment-${segmentNum}-start`;
            const doneEvent   = segmentNum === 3
                ? 'mirror-sequential-story-done'
                : `mirror-story-segment-${segmentNum}-done`;

            document.dispatchEvent(new CustomEvent(startEvent));

            await new Promise((resolve) => {
                const handler = () => resolve();
                document.addEventListener(doneEvent, handler, { once: true });
                // If the game is stopped while waiting, resolve immediately
                const poll = setInterval(() => {
                    if (!this.isRunning) { clearInterval(poll); resolve(); }
                }, 200);
                document.addEventListener(doneEvent, () => clearInterval(poll), { once: true });
            });
            if (!this.isRunning) return;
        }

        if (this.isRunning) {
            this.endGame();
        }
    }
    
    async observeFacialResponse(duration, balanceBefore) {
        const startTime = Date.now();
        const endTime = startTime + (duration * 1000);
        
        // Reset baseline for new observation
        this.measurementAnalyzer.resetBaseline();
        
        let lastUpdateTime = startTime;
        let lastSmilingScore = null;
        let pointsDeductedSoFar = 0;
        const updateInterval = 100; // Update UI every 100ms
        const LIVE_WINDOW = 5; // seconds before end when bar becomes active
        let barRevealed = false;
        
        const observe = async () => {
            while (Date.now() < endTime && this.isRunning) {
                const now = Date.now();
                const elapsed = (now - startTime) / 1000;
                
                // Detect face and calculate metrics using mirror's existing methods
                let currentMetrics = null;
                let isGenuine = false;
                
                if (this.mirror.isModelLoaded && this.mirror.model && this.mirror.webcam) {
                    // Perform face detection (updates landmarks)
                    const faceDetected = await this.mirror.performContinuousFacialDetection();
                    
                    // Update face presence timestamp if face was detected
                    // (performContinuousFacialDetection already updates it, but this ensures it's updated)
                    if (faceDetected) {
                        this.mirror.updateFacePresence();
                    }
                    
                    // Calculate current metrics
                    currentMetrics = this.mirror.calculateMetrics();
                    
                    if (currentMetrics) {
                        // Record frame data with elapsed time
                        this.scenarioController.recordFrame({
                            smilingScore: currentMetrics.smilingScore,
                            intensity: currentMetrics.smilingScore,
                            elapsed: elapsed
                        });
                        
                        lastSmilingScore = currentMetrics.smilingScore;
                        
                        // Get dynamic thresholds based on genuine smile count
                        const thresholds = this.gameState.getGenuineSmileThresholds();
                        
                        // Check if genuine using dynamic thresholds
                        isGenuine = currentMetrics.smilingScore >= thresholds.smileScore && 
                                   currentMetrics.facialSymmetry >= thresholds.symmetry &&
                                   currentMetrics.joyDetection >= thresholds.joy;
                        
                        // Calculate points that would be deducted based on current state
                        // This is just for display - actual deduction happens at end
                        let potentialDeduction = 0;
                        if (currentMetrics.smilingScore < thresholds.smileDetected) {
                            potentialDeduction = Math.abs(this.currentScenario.noSmilePenalty);
                        } else if (currentMetrics.smilingScore < thresholds.smileScore || !isGenuine) {
                            potentialDeduction = Math.abs(this.currentScenario.smileCost);
                        }
                        
                        // Only update the expression bar in the final LIVE_WINDOW seconds
                        const inLiveWindow = elapsed >= (duration - LIVE_WINDOW);
                        if (inLiveWindow) {
                            if (!barRevealed) {
                                this.gameUI.revealExpressionBar();
                                barRevealed = true;
                            }
                            if (now - lastUpdateTime >= updateInterval) {
                                const currentBalance = this.gameState.getBalance();
                                this.gameUI.updateRealTimeStatus(
                                    currentMetrics.smilingScore,
                                    currentBalance,
                                    balanceBefore,
                                    isGenuine,
                                    thresholds
                                );
                                lastUpdateTime = now;
                            }
                        }
                        
                    }
                }
                
                // Update progress bar
                const progress = Math.min(100, (elapsed / duration) * 100);
                this.gameUI.updateProgress(progress, duration, true);
                
                // Wait for next frame (~16ms for 60fps)
                await this.delay(16);
            }
        };
        
        await observe();
        
        // Set progress display to completed idle state
        this.gameUI.updateProgress(100, this.currentScenario.observationDuration, false);
        
        // Final points calculation and deduction
        const finalMetrics = this.mirror.calculateMetrics();
        const finalSmilingScore = finalMetrics ? finalMetrics.smilingScore : 0;
        
        // Get dynamic thresholds based on genuine smile count
        const thresholds = this.gameState.getGenuineSmileThresholds();
        
        let chargeAmount = 0;
        if (finalSmilingScore < thresholds.smileDetected) {
            chargeAmount = -Math.abs(this.currentScenario.noSmilePenalty);
            this.gameState.deductPoints(Math.abs(this.currentScenario.noSmilePenalty));
        } else if (finalSmilingScore >= thresholds.smileScore && 
                   finalMetrics.facialSymmetry >= thresholds.symmetry && 
                   finalMetrics.joyDetection >= thresholds.joy) {
            const reward = Math.ceil(Math.abs(this.currentScenario.smileCost) * 2.0);
            chargeAmount = reward;
            this.gameState.addPoints(reward);
            this.gameState.recordGenuineSmile();
        } else {
            chargeAmount = -Math.abs(this.currentScenario.smileCost);
            this.gameState.deductPoints(Math.abs(this.currentScenario.smileCost));
        }
        // Score recorded — inter-scenario transitions handled by runGameLoop
    }
    
    async handleSkip() {
        // Skip functionality disabled for immersive experience
        // No user interaction allowed
        return;
    }
    
    endGame() {
        this.isRunning = false;
        
        if (this.observationInterval) {
            clearInterval(this.observationInterval);
            this.observationInterval = null;
        }
        
        // Display game over screen
        this.gameUI.render(
            this.gameUI.displayGameOver()
        );
        
        // Auto-restart after 10 seconds - return to beginning (measurement stage)
        setTimeout(() => {
            this.restartFromBeginning();
        }, 10000);
    }
    
    restartFromBeginning() {
        console.log('Restarting experience from beginning...');
        
        // Stop the game loop
        this.stop();
        
        // Clean up game container
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Reset mirror to initial state (back to "I am human" measurement stage)
        if (this.mirror) {
            // Clean up game loop reference
            this.mirror.gameLoop = null;
            this.mirror.gameStarting = false;
            
            // Remove game container
            if (this.mirror.gameContainer) {
                this.mirror.gameContainer.remove();
                this.mirror.gameContainer = null;
            }
            
            // Restore mirror frame and video visibility
            const mirrorFrame = document.querySelector('.mirror-frame');
            if (mirrorFrame) {
                mirrorFrame.style.opacity = '1';
                mirrorFrame.style.visibility = 'visible';
            }
            
            if (this.mirror.webcam) {
                this.mirror.webcam.style.opacity = '1';
                this.mirror.webcam.style.position = '';
                this.mirror.webcam.style.top = '';
                this.mirror.webcam.style.left = '';
                this.mirror.webcam.style.zIndex = '';
                this.mirror.webcam.style.pointerEvents = '';
            }

            // Restore canvas overlays that were hidden during the game
            if (this.mirror.canvas) {
                this.mirror.canvas.style.opacity = '';
                this.mirror.canvas.style.position = '';
                this.mirror.canvas.style.zIndex = '';
            }
            if (this.mirror.facialOverlay) {
                this.mirror.facialOverlay.style.opacity = '';
                this.mirror.facialOverlay.style.position = '';
                this.mirror.facialOverlay.style.zIndex = '';
            }
            
            // Reset mirror to beginning
            this.mirror.resetMirror();
        }
    }
    
    stop() {
        console.log('[GAME CLEANUP] Stopping game loop...');
        this.isRunning = false;
        if (this.observationInterval) {
            clearInterval(this.observationInterval);
        }
        this.gameUI.clear();

        // Immediately hide the story overlay so it doesn't linger after the game ends
        const storyOverlay = document.getElementById('mirror-story-overlay');
        if (storyOverlay) storyOverlay.style.visibility = 'hidden';
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

