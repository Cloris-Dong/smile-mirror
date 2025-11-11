// Scenario Controller - Manages scenario pool and passive observation

import { GameStateManager } from './GameStateManager.js';

export class ScenarioController {
    constructor() {
        this.scenarioPool = this.createScenarioPool();
        this.currentObservationData = null;
        this.observationStartTime = null;
    }
    
    createScenarioPool() {
        return {
            trust: [
                // Increased deductions: -18 to -25 per smile, -5 to -15 for no smile
                // Starting balance 100, so 3-5 rounds will end the game
                { id: 'trust_1', phase: 'trust', promptText: 'A stranger holds the door for you.', observationDuration: 4.5, smileCost: -18, noSmilePenalty: -5, context: 'casual_social', isRepeatable: false },
                { id: 'trust_2', phase: 'trust', promptText: 'Your coworker shows you photos of their new puppy.', observationDuration: 4.5, smileCost: -20, noSmilePenalty: -8, context: 'friendly_sharing', isRepeatable: false },
                { id: 'trust_3', phase: 'trust', promptText: 'A cashier says "Have a nice day".', observationDuration: 4.5, smileCost: -18, noSmilePenalty: -6, context: 'service_interaction', isRepeatable: false },
                { id: 'trust_4', phase: 'trust', promptText: 'A neighbor waves hello.', observationDuration: 4.5, smileCost: -18, noSmilePenalty: -5, context: 'casual_social', isRepeatable: false },
                { id: 'trust_5', phase: 'trust', promptText: 'Someone compliments your outfit.', observationDuration: 5.5, smileCost: -25, noSmilePenalty: -15, context: 'personal_compliment', isRepeatable: false },
                { id: 'trust_6', phase: 'trust', promptText: 'A barista smiles at you when handing over coffee.', observationDuration: 4.5, smileCost: -20, noSmilePenalty: -8, context: 'service_interaction', isRepeatable: false },
                { id: 'trust_7', phase: 'trust', promptText: 'A friend shares good news about their promotion.', observationDuration: 5.5, smileCost: -22, noSmilePenalty: -10, context: 'positive_sharing', isRepeatable: false },
                { id: 'trust_8', phase: 'trust', promptText: 'A child on the street shows you their toy.', observationDuration: 4.5, smileCost: -20, noSmilePenalty: -8, context: 'innocent_interaction', isRepeatable: false }
            ],
            pressure: [
                // Increased deductions: -25 to -30 per smile, -40 to -60 for no smile
                { id: 'pressure_family_1', phase: 'pressure', promptText: 'Your mother on video call: "I miss you. When will you visit?" She looks lonely.', observationDuration: 7.5, smileCost: -28, noSmilePenalty: -50, context: 'family_emotional', isRepeatable: false, category: 'family' },
                { id: 'pressure_family_2', phase: 'pressure', promptText: 'Your sibling asks: "Can you help me with something important?"', observationDuration: 6.5, smileCost: -25, noSmilePenalty: -45, context: 'family_request', isRepeatable: false, category: 'family' },
                { id: 'pressure_family_3', phase: 'pressure', promptText: 'Your grandmother looks at old family photos, teary-eyed.', observationDuration: 7.5, smileCost: -28, noSmilePenalty: -55, context: 'family_emotional', isRepeatable: false, category: 'family' },
                { id: 'pressure_family_4', phase: 'pressure', promptText: 'Your father says: "I\'m proud of you" (but you sense he\'s forcing it).', observationDuration: 6.5, smileCost: -25, noSmilePenalty: -50, context: 'family_emotional', isRepeatable: false, category: 'family' },
                { id: 'pressure_parent_1', phase: 'pressure', promptText: 'Your child shows you their drawing proudly. "Do you like it?"', observationDuration: 7.5, smileCost: -28, noSmilePenalty: -55, context: 'parental_emotional', isRepeatable: false, category: 'parental' },
                { id: 'pressure_parent_2', phase: 'pressure', promptText: 'Your child falls down and looks at you, waiting for your reaction.', observationDuration: 6.5, smileCost: -25, noSmilePenalty: -50, context: 'parental_emotional', isRepeatable: false, category: 'parental' },
                { id: 'pressure_parent_3', phase: 'pressure', promptText: 'Your child asks: "Do you love me?"', observationDuration: 7.5, smileCost: -30, noSmilePenalty: -60, context: 'parental_emotional', isRepeatable: false, category: 'parental' },
                { id: 'pressure_romantic_1', phase: 'pressure', promptText: 'Your partner asks: "Are you happy with me?" They look vulnerable.', observationDuration: 7.5, smileCost: -28, noSmilePenalty: -50, context: 'romantic_emotional', isRepeatable: false, category: 'romantic' },
                { id: 'pressure_romantic_2', phase: 'pressure', promptText: 'Your partner is crying after a difficult day.', observationDuration: 7.5, smileCost: -28, noSmilePenalty: -55, context: 'romantic_emotional', isRepeatable: false, category: 'romantic' },
                { id: 'pressure_romantic_3', phase: 'pressure', promptText: 'Your ex texts: "I miss what we had".', observationDuration: 6.5, smileCost: -25, noSmilePenalty: -45, context: 'romantic_emotional', isRepeatable: false, category: 'romantic' },
                { id: 'pressure_social_1', phase: 'pressure', promptText: 'Your friend\'s project just failed publicly. They look embarrassed.', observationDuration: 6.5, smileCost: -22, noSmilePenalty: -40, context: 'social_moral', isRepeatable: false, category: 'social' },
                { id: 'pressure_social_2', phase: 'pressure', promptText: 'Someone is being harassed nearby. They look to you for support.', observationDuration: 7.5, smileCost: -25, noSmilePenalty: -50, context: 'social_moral', isRepeatable: false, category: 'social' }
            ],
            debt_spiral: [
                // Increased deductions: -30 to -35 per smile, -40 to -50 for no smile
                { id: 'debt_1', phase: 'debt_spiral', promptText: 'SYSTEM UPDATE: Mandatory smile required for compliance verification.', observationDuration: 5.5, smileCost: -30, noSmilePenalty: -45, context: 'system_mandate', isRepeatable: true },
                { id: 'debt_2', phase: 'debt_spiral', promptText: 'Smile at the camera to reduce your emotional debt.', observationDuration: 4.5, smileCost: -28, noSmilePenalty: -40, context: 'system_mandate', isRepeatable: true },
                { id: 'debt_3', phase: 'debt_spiral', promptText: 'Continue smiling. Your expression remains insufficient.', observationDuration: 5.5, smileCost: -35, noSmilePenalty: -50, context: 'system_mandate', isRepeatable: true }
            ]
        };
    }
    
    selectScenario(gameState) {
        const phase = gameState.getCurrentPhase();
        
        if (phase === 'game_over') return null;
        
        // In debt_spiral with balance < 10, always use mandatory scenarios
        if (phase === 'debt_spiral' && gameState.getBalance() < 10) {
            const debtScenarios = this.scenarioPool.debt_spiral;
            return debtScenarios[Math.floor(Math.random() * debtScenarios.length)];
        }
        
        // Get scenarios for current phase
        const phaseScenarios = this.scenarioPool[phase] || [];
        
        // Filter out already-shown scenarios (unless repeatable)
        const availableScenarios = phaseScenarios.filter(scenario => {
            if (scenario.isRepeatable) return true;
            return !gameState.getScenarioHistory().some(history => history.scenarioId === scenario.id);
        });
        
        // If no available scenarios, use repeatable ones
        let candidates = availableScenarios.length > 0 ? availableScenarios : phaseScenarios;
        
        // Consider participant pattern for selection
        const pattern = gameState.getParticipantPattern();
        const history = gameState.getScenarioHistory();
        
        // If mostly withholding, select high-penalty scenarios
        if (pattern.smilesWithheld > pattern.smilesDetected && candidates.length > 0) {
            const highPenalty = candidates.filter(s => s.noSmilePenalty <= -30);
            if (highPenalty.length > 0) {
                candidates = highPenalty;
            }
        }
        
        // Avoid repeating same category consecutively
        if (history.length > 0 && candidates.length > 1) {
            const lastCategory = history[history.length - 1].category;
            if (lastCategory) {
                const differentCategory = candidates.filter(s => s.category !== lastCategory);
                if (differentCategory.length > 0) {
                    candidates = differentCategory;
                }
            }
        }
        
        // Select random from filtered candidates
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    
    startPassiveObservation(duration) {
        this.observationStartTime = Date.now();
        this.currentObservationData = {
            intensityHistory: [],
            frameTimestamps: [],
            startTime: this.observationStartTime,
            duration: duration
        };
        return this.currentObservationData;
    }
    
    recordFrame(measurements) {
        if (!this.currentObservationData) return;
        
        const now = Date.now();
        const elapsed = (now - this.currentObservationData.startTime) / 1000;
        
        this.currentObservationData.intensityHistory.push({
            intensity: measurements.smilingScore || 0,
            timestamp: now,
            elapsed: elapsed
        });
        this.currentObservationData.frameTimestamps.push(now);
    }
    
    detectSmileResponse() {
        if (!this.currentObservationData || this.currentObservationData.intensityHistory.length === 0) {
            return {
                didSmile: false,
                measurements: null,
                edgeCases: ['No facial data collected']
            };
        }
        
        const history = this.currentObservationData.intensityHistory;
        const threshold = 40; // 40% intensity threshold
        const minDuration = 0.5; // 0.5 seconds minimum
        
        // Find all periods above threshold
        let currentPeriod = null;
        const periods = [];
        
        for (let i = 0; i < history.length; i++) {
            const point = history[i];
            if (point.intensity > threshold) {
                if (!currentPeriod) {
                    currentPeriod = { start: point.elapsed, startIndex: i, end: point.elapsed, maxIntensity: point.intensity };
                } else {
                    currentPeriod.end = point.elapsed;
                    currentPeriod.maxIntensity = Math.max(currentPeriod.maxIntensity, point.intensity);
                }
            } else {
                if (currentPeriod) {
                    periods.push(currentPeriod);
                    currentPeriod = null;
                }
            }
        }
        
        if (currentPeriod) {
            periods.push(currentPeriod);
        }
        
        // Check if any period meets duration requirement
        const validPeriods = periods.filter(p => (p.end - p.start) >= minDuration);
        const didSmile = validPeriods.length > 0;
        
        // Calculate peak intensity
        const peakIntensity = didSmile 
            ? Math.max(...validPeriods.map(p => p.maxIntensity))
            : Math.max(...history.map(h => h.intensity), 0);
        
        // Detect edge cases
        const edgeCases = [];
        const briefSmiles = periods.filter(p => (p.end - p.start) < minDuration);
        if (briefSmiles.length > 0) {
            edgeCases.push(`Brief micro-smile detected at ${briefSmiles[0].start.toFixed(1)}s (${(briefSmiles[0].end - briefSmiles[0].start).toFixed(2)}s duration)`);
        }
        
        if (peakIntensity > 0 && peakIntensity < threshold) {
            edgeCases.push(`Insufficient facial activation (${peakIntensity.toFixed(1)}% - threshold: ${threshold}%)`);
        }
        
        // Detect delayed response
        if (didSmile && validPeriods[0].start > 3) {
            edgeCases.push(`Delayed response - cognitive processing detected (onset: ${validPeriods[0].start.toFixed(1)}s)`);
        }
        
        return {
            didSmile,
            measurements: {
                peakIntensity: peakIntensity,
                validPeriods: validPeriods,
                observationDuration: this.currentObservationData.duration
            },
            edgeCases
        };
    }
    
    endObservation() {
        const result = this.detectSmileResponse();
        this.currentObservationData = null;
        this.observationStartTime = null;
        return result;
    }
}

