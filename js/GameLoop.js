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
        this.observationInterval = null;
        this.currentScenario = null;
    }
    
    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.gameState.reset();
        this.measurementAnalyzer.resetBaseline();
        
        // Add CSS styles
        this.gameUI.addStyles();
        
        // Show intro screen
        this.gameUI.render(this.gameUI.displayIntro());
        const introTarget = document.getElementById('intro-typed-text');
        if (introTarget) {
            const introScript = [
                { text: 'I see that you are having some troubles here.', pause: 500 },
                { text: 'How about let\'s try some scenarios?', pause: 0 }
            ];
            this.gameUI.runTypingSequence(introTarget, introScript);
        }
        await this.delay(9000); // Give the intro typing animation time to finish
        
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
        // Game ends when balance goes negative or after 5 rounds
        // With increased deductions, should naturally end in 3-5 rounds
        while (this.isRunning && !this.gameState.isGameOver()) {
            // Select scenario
            this.currentScenario = this.scenarioController.selectScenario(this.gameState);
            
            if (!this.currentScenario) {
                break; // No more scenarios
            }
            
            // Display scenario
            const skipHandler = () => this.handleSkip();
            const currentBalance = this.gameState.getBalance();
            
            // Ensure container is ready before rendering
            if (this.container) {
                // Force multiple reflows to ensure container is properly sized and positioned
                void this.container.offsetHeight;
                void this.container.offsetWidth;
                // Double-check dimensions after a micro-delay
                await this.delay(10);
                void this.container.offsetHeight;
            }
            
            this.gameUI.render(
                this.gameUI.displayScenario(
                    this.currentScenario,
                    currentBalance,
                    skipHandler
                )
            );
            
            // Store scenario for real-time updates
            this.gameUI.setCurrentScenario(this.currentScenario);
            
            // No skip button - immersive experience, no user interaction
            // this.gameUI.attachSkipButton();
            
            // Wait for elements to be positioned before showing them
            await this.delay(50);
            
            // Allow scenario prompt to display alone for 3 seconds before starting countdown
            await this.delay(3000);
            
            // Start passive observation
            const observationData = this.scenarioController.startPassiveObservation(
                this.currentScenario.observationDuration
            );
            
            // Observe for specified duration with real-time updates
            const balanceBefore = this.gameState.getBalance();
            
            // Prime progress bar in idle state before observation begins
            this.gameUI.updateProgress(0, this.currentScenario.observationDuration, false);
            await this.observeFacialResponse(this.currentScenario.observationDuration, balanceBefore);
            
            // Get observation data before ending (endObservation clears it)
            const finalObservationData = this.scenarioController.currentObservationData;
            
            // End observation and analyze
            const observationResult = this.scenarioController.endObservation();
            
            // Get comprehensive measurements
            const measurements = finalObservationData && finalObservationData.intensityHistory 
                ? this.measurementAnalyzer.calculateComprehensiveMeasurements(
                    finalObservationData.intensityHistory,
                    this.mirror.realLandmarks
                )
                : null;
            
            // Determine if smiled
            const didSmile = observationResult.didSmile || (measurements && measurements.didSmile);
            
            // Calculate final points (calculate but don't apply yet - already done in real-time)
            let pointsDeducted = 0;
            let pointsEarned = 0;
            
            if (didSmile) {
                pointsDeducted = Math.abs(this.currentScenario.smileCost);
            } else {
                pointsDeducted = Math.abs(this.currentScenario.noSmilePenalty);
            }
            
            // Get interpretation for genuine smile
            let interpretation = null;
            if (didSmile && measurements) {
                interpretation = this.interpretationEngine.evaluateSmile(
                    measurements,
                    this.gameState.getCurrentPhase(),
                    this.currentScenario.context,
                    this.gameState.getParticipantPattern()
                );
                
                pointsEarned = interpretation.pointsEarned || 0;
            }
            
            // Apply points (if not already applied in real-time)
            // In real-time version, points are deducted continuously, so we just ensure final state
            const finalBalance = this.gameState.getBalance();
            
            // Update participant pattern
            this.gameState.updateParticipantPattern(
                didSmile,
                measurements ? measurements.intensity : 0
            );
            
            // Prepare result for recording
            const result = {
                didSmile,
                measurements: measurements || null,
                verdict: interpretation ? interpretation.verdict : 'NO_SMILE',
                score: interpretation ? interpretation.score : 0,
                pointsEarned,
                pointsDeducted,
                feedbackMessages: interpretation 
                    ? interpretation.feedbackMessages 
                    : (observationResult.edgeCases || ['No smile detected.'])
            };
            
            // Record scenario result
            this.gameState.recordScenarioResult({
                scenarioId: this.currentScenario.id,
                ...result,
                category: this.currentScenario.category
            });
            
            // No transition screen - go directly to next scenario
            // Clear heatmap canvas before moving to next scenario
            const heatmapCanvas = document.getElementById('heatmap-silhouette');
            if (heatmapCanvas) {
                const ctx = heatmapCanvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);
                }
            }
            
            // Check if game over (balance negative or 5 rounds reached)
            if (this.gameState.isGameOver()) {
                this.endGame();
                return;
            }
        }
        
        // If we exit the loop but haven't reached game over, end the game
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
                        
                        // Check if genuine (simplified - intensity > 50 and symmetry > 40)
                        isGenuine = currentMetrics.smilingScore > 50 && 
                                   currentMetrics.facialSymmetry > 40 &&
                                   currentMetrics.joyDetection > 45;
                        
                        // Calculate points that would be deducted based on current state
                        // This is just for display - actual deduction happens at end
                        let potentialDeduction = 0;
                        if (currentMetrics.smilingScore < 20) {
                            potentialDeduction = Math.abs(this.currentScenario.noSmilePenalty);
                        } else if (currentMetrics.smilingScore < 50 || !isGenuine) {
                            potentialDeduction = Math.abs(this.currentScenario.smileCost);
                        }
                        
                        // Update UI in real-time
                        if (now - lastUpdateTime >= updateInterval) {
                            const currentBalance = this.gameState.getBalance();
                            this.gameUI.updateRealTimeStatus(
                                currentMetrics.smilingScore,
                                currentBalance,
                                balanceBefore,
                                isGenuine
                            );
                            
                            lastUpdateTime = now;
                        }
                        
                        // Update heatmap silhouette continuously (every frame) for smooth animation
                        if (this.mirror.realLandmarks && this.mirror.realLandmarks.length > 0 && this.mirror.faceBoundingBox) {
                            try {
                                this.gameUI.updateHeatmapSilhouette(
                                    this.mirror.realLandmarks,
                                    this.mirror.faceBoundingBox,
                                    currentMetrics.smilingScore,
                                    this.mirror
                                );
                            } catch (error) {
                                console.error('Error updating heatmap:', error);
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
        
        // Determine final state and deduct points once
        if (finalSmilingScore < 20) {
            // No smile - apply penalty
            this.gameState.deductPoints(Math.abs(this.currentScenario.noSmilePenalty));
            
            // Update UI with penalty
            this.gameUI.updateRealTimeStatus(
                finalSmilingScore,
                this.gameState.getBalance(),
                balanceBefore,
                false
            );
            } else if (finalSmilingScore >= 50 && finalMetrics.facialSymmetry > 40 && finalMetrics.joyDetection > 45) {
                // Genuine smile - deduct cost FIRST, then add reward
                // Step 1: Deduct cost (show the risk)
                this.gameState.deductPoints(Math.abs(this.currentScenario.smileCost));
                const balanceAfterCost = this.gameState.getBalance();
                
                // Show cost deduction first
                this.gameUI.updateRealTimeStatus(
                    finalSmilingScore,
                    balanceAfterCost,
                    balanceBefore,
                    false // Show as not genuine first to display cost
                );
                
                // Step 2: Wait a moment, then add reward
                await this.delay(800); // Show cost for 800ms
                
                // More effective reward for genuine (25% of cost, increased from 8% to make rewards meaningful)
                const reward = Math.ceil(Math.abs(this.currentScenario.smileCost) * 0.25);
                this.gameState.addPoints(reward);
                
                // Show reward addition
                this.gameUI.updateRealTimeStatus(
                    finalSmilingScore,
                    this.gameState.getBalance(),
                    balanceAfterCost,
                    true // Now show as genuine to display reward
                );
            } else {
                // Insufficient smile - deduct cost
                this.gameState.deductPoints(Math.abs(this.currentScenario.smileCost));
                
                // Update UI with cost deduction
                this.gameUI.updateRealTimeStatus(
                    finalSmilingScore,
                    this.gameState.getBalance(),
                    balanceBefore,
                    false
                );
            }
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
            this.gameUI.displayGameOver(
                this.gameState.getBalance(),
                this.gameState.scenariosCompleted,
                this.gameState.getScenarioHistory()
            )
        );
    }
    
    stop() {
        this.isRunning = false;
        if (this.observationInterval) {
            clearInterval(this.observationInterval);
        }
        this.gameUI.clear();
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

