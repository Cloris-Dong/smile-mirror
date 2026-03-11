// Game State Manager - Tracks points, scenarios, and game phase

export class GameStateManager {
    constructor() {
        this.currentScenarioIndex = 0;
        this.pointBalance = 100;
        this.scenarioHistory = [];
        this.scenariosCompleted = 0;
        this.genuineSmilesCount = 0; // Track number of genuine smiles for dynamic thresholds
        this.participantPattern = {
            smilesDetected: 0,
            smilesWithheld: 0,
            averageIntensity: 0,
            totalIntensity: 0,
            intensityCount: 0
        };
    }
    
    getCurrentPhase() {
        // Round-based phase logic:
        // First 2 rounds (scenariosCompleted 0-1): trust phase
        // Next rounds (scenariosCompleted 2+): pressure phase
        // Last round (balance <= 20): debt_spiral phase
        if (this.pointBalance <= 0) return 'game_over';
        if (this.pointBalance <= 30) return 'debt_spiral'; // Last round territory
        if (this.scenariosCompleted < 2) return 'trust'; // First 2 rounds
        return 'pressure'; // All other rounds
    }
    
    deductPoints(amount) {
        this.pointBalance -= amount;
        return this.pointBalance;
    }
    
    addPoints(amount) {
        this.pointBalance += amount;
        return this.pointBalance;
    }
    
    getBalance() {
        return this.pointBalance;
    }
    
    isGameOver() {
        // Game ends when balance goes negative (no round cap)
        return this.pointBalance < 0;
    }
    
    getGenuineSmileThresholds() {
        // Base thresholds
        let smileScoreThreshold = 45;
        let symmetryThreshold = 35;
        let joyThreshold = 40;
        let smileDetectedThreshold = 25; // Minimum score to be considered "smile detected"
        
        // Raise thresholds after first genuine smile
        if (this.genuineSmilesCount >= 1) {
            smileScoreThreshold = 55;
            symmetryThreshold = 45;
            joyThreshold = 48;
            smileDetectedThreshold = 30;
        }
        
        return {
            smileScore: smileScoreThreshold,
            symmetry: symmetryThreshold,
            joy: joyThreshold,
            smileDetected: smileDetectedThreshold
        };
    }
    
    recordGenuineSmile() {
        this.genuineSmilesCount++;
    }
    
    recordScenarioResult(result) {
        this.scenarioHistory.push({
            ...result,
            timestamp: Date.now(),
            balanceBefore: this.pointBalance + (result.pointsDeducted || 0) - (result.pointsEarned || 0),
            balanceAfter: this.pointBalance
        });
        this.scenariosCompleted++;
    }
    
    updateParticipantPattern(didSmile, intensity) {
        if (didSmile) {
            this.participantPattern.smilesDetected++;
            this.participantPattern.totalIntensity += intensity || 0;
            this.participantPattern.intensityCount++;
        } else {
            this.participantPattern.smilesWithheld++;
        }
        
        if (this.participantPattern.intensityCount > 0) {
            this.participantPattern.averageIntensity = 
                this.participantPattern.totalIntensity / this.participantPattern.intensityCount;
        }
    }
    
    getParticipantPattern() {
        return { ...this.participantPattern };
    }
    
    getScenarioHistory() {
        return [...this.scenarioHistory];
    }
    
    reset() {
        this.currentScenarioIndex = 0;
        this.pointBalance = 100;
        this.scenarioHistory = [];
        this.scenariosCompleted = 0;
        this.genuineSmilesCount = 0;
        this.participantPattern = {
            smilesDetected: 0,
            smilesWithheld: 0,
            averageIntensity: 0,
            totalIntensity: 0,
            intensityCount: 0
        };
    }
}

