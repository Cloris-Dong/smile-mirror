// Scenario Controller - Manages passive observation during fixed scenarios

export class ScenarioController {
    constructor() {
        this.currentObservationData = null;
        this.observationStartTime = null;
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
}
