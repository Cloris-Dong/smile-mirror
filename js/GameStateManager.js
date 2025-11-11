// Game State Manager - Tracks points, scenarios, and game phase

export class GameStateManager {
    constructor() {
        this.currentScenarioIndex = 0;
        this.pointBalance = 100;
        this.scenarioHistory = [];
        this.scenariosCompleted = 0;
        this.participantPattern = {
            smilesDetected: 0,
            smilesWithheld: 0,
            averageIntensity: 0,
            totalIntensity: 0,
            intensityCount: 0
        };
    }
    
    getCurrentPhase() {
        if (this.pointBalance > 70) return 'trust';
        if (this.pointBalance > 30) return 'pressure';
        if (this.pointBalance > 0) return 'debt_spiral';
        return 'game_over';
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
        // Game ends when balance goes negative (primary condition)
        // Or after maximum 5 rounds
        return this.pointBalance < 0 || this.scenariosCompleted >= 5;
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
        this.participantPattern = {
            smilesDetected: 0,
            smilesWithheld: 0,
            averageIntensity: 0,
            totalIntensity: 0,
            intensityCount: 0
        };
    }
}

