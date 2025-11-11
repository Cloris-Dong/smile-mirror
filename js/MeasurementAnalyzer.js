// Measurement Analyzer - Enhances facial analysis with comprehensive metrics

import { CONFIG } from './config.js';

export class MeasurementAnalyzer {
    constructor(mirrorInstance) {
        this.mirror = mirrorInstance;
        this.eyeBaseline = null;
        this.baselineStartTime = null;
    }
    
    // Calculate comprehensive measurements during observation
    calculateComprehensiveMeasurements(intensityHistory, landmarks) {
        if (!landmarks || landmarks.length < 468) {
            return null;
        }
        
        const intensity = this.calculatePeakIntensity(intensityHistory);
        const eyeInvolvement = this.calculateEyeInvolvement(landmarks, intensityHistory);
        const symmetry = this.calculateSymmetry(landmarks);
        const onsetTiming = this.calculateOnsetTiming(intensityHistory);
        const duration = this.calculateDuration(intensityHistory);
        const microExpressions = this.detectMicroExpressions(intensityHistory);
        
        return {
            intensity: intensity,
            eyeInvolvement: eyeInvolvement,
            symmetry: symmetry,
            onsetSpeed: onsetTiming,
            duration: duration,
            didSmile: intensity > 40 && duration > 0.5,
            microExpressions: microExpressions
        };
    }
    
    calculatePeakIntensity(intensityHistory) {
        if (!intensityHistory || intensityHistory.length === 0) return 0;
        return Math.max(...intensityHistory.map(h => h.intensity || 0));
    }
    
    calculateEyeInvolvement(landmarks, intensityHistory) {
        const L = CONFIG.LANDMARKS;
        
        // Get eye landmarks
        const leftEyeTop = landmarks[L.LEFT_EYE_TOP];
        const leftEyeBottom = landmarks[L.LEFT_EYE_BOTTOM];
        const rightEyeTop = landmarks[L.RIGHT_EYE_TOP];
        const rightEyeBottom = landmarks[L.RIGHT_EYE_BOTTOM];
        
        if (!leftEyeTop || !leftEyeBottom || !rightEyeTop || !rightEyeBottom) {
            return 0;
        }
        
        // Calculate eye heights
        const leftEyeHeight = Math.abs(leftEyeTop[1] - leftEyeBottom[1]);
        const rightEyeHeight = Math.abs(rightEyeTop[1] - rightEyeBottom[1]);
        const avgEyeHeight = (leftEyeHeight + rightEyeHeight) / 2;
        
        // Establish baseline in first 0.5 seconds
        if (!this.eyeBaseline) {
            if (intensityHistory.length > 0) {
                const firstHalfSecond = intensityHistory.filter(h => h.elapsed <= 0.5);
                if (firstHalfSecond.length > 0) {
                    this.eyeBaseline = avgEyeHeight;
                    this.baselineStartTime = Date.now();
                }
            }
            return 0;
        }
        
        // Calculate reduction from baseline
        const reduction = this.eyeBaseline - avgEyeHeight;
        const reductionPercent = (reduction / this.eyeBaseline) * 100;
        
        // Convert to 0-100 score
        if (reductionPercent >= 20) return Math.min(100, 60 + (reductionPercent - 20) * 2);
        if (reductionPercent >= 10) return 30 + ((reductionPercent - 10) / 10) * 30;
        return Math.max(0, (reductionPercent / 10) * 30);
    }
    
    calculateSymmetry(landmarks) {
        const L = CONFIG.LANDMARKS;
        
        const leftMouth = landmarks[L.LEFT_MOUTH];
        const rightMouth = landmarks[L.RIGHT_MOUTH];
        const nose = landmarks[L.NOSE];
        
        if (!leftMouth || !rightMouth || !nose) {
            return 85; // Default reasonable symmetry
        }
        
        // Calculate distances from nose to mouth corners
        const leftDistance = this.distance(leftMouth, nose);
        const rightDistance = this.distance(rightMouth, nose);
        
        // Calculate asymmetry
        const asymmetry = Math.abs(leftDistance - rightDistance);
        const avgDistance = (leftDistance + rightDistance) / 2;
        
        // Convert to symmetry percentage (0-100)
        const asymmetryPercent = (asymmetry / avgDistance) * 100;
        const symmetry = Math.max(0, Math.min(100, 100 - (asymmetryPercent * 2)));
        
        return symmetry;
    }
    
    calculateOnsetTiming(intensityHistory) {
        if (!intensityHistory || intensityHistory.length < 2) return null;
        
        const threshold = 30; // Onset threshold
        let onsetFrame = null;
        let peakFrame = null;
        let peakIntensity = 0;
        
        // Find onset (first frame above threshold)
        for (let i = 0; i < intensityHistory.length; i++) {
            const frame = intensityHistory[i];
            if (onsetFrame === null && frame.intensity > threshold) {
                onsetFrame = i;
            }
            if (frame.intensity > peakIntensity) {
                peakIntensity = frame.intensity;
                peakFrame = i;
            }
        }
        
        if (onsetFrame === null || peakFrame === null) return null;
        
        // Calculate time from onset to peak
        const onsetTime = intensityHistory[onsetFrame].elapsed;
        const peakTime = intensityHistory[peakFrame].elapsed;
        const onsetSpeed = (peakTime - onsetTime) * 1000; // Convert to milliseconds
        
        return Math.max(0, onsetSpeed);
    }
    
    calculateDuration(intensityHistory) {
        if (!intensityHistory || intensityHistory.length === 0) return 0;
        
        const threshold = 40;
        let inSmile = false;
        let smileStart = null;
        let totalDuration = 0;
        
        for (const frame of intensityHistory) {
            if (frame.intensity > threshold) {
                if (!inSmile) {
                    inSmile = true;
                    smileStart = frame.elapsed;
                }
            } else {
                if (inSmile && smileStart !== null) {
                    totalDuration += frame.elapsed - smileStart;
                    inSmile = false;
                    smileStart = null;
                }
            }
        }
        
        // If still in smile at end, add final duration
        if (inSmile && smileStart !== null) {
            const lastFrame = intensityHistory[intensityHistory.length - 1];
            totalDuration += lastFrame.elapsed - smileStart;
        }
        
        return totalDuration;
    }
    
    detectMicroExpressions(intensityHistory) {
        if (!intensityHistory || intensityHistory.length < 2) return [];
        
        const microExpressions = [];
        const threshold = 40;
        const minDuration = 0.5;
        
        let currentPeriod = null;
        
        for (let i = 0; i < intensityHistory.length; i++) {
            const frame = intensityHistory[i];
            
            if (frame.intensity > threshold) {
                if (!currentPeriod) {
                    currentPeriod = { start: frame.elapsed, startIndex: i, end: frame.elapsed };
                } else {
                    currentPeriod.end = frame.elapsed;
                }
            } else {
                if (currentPeriod) {
                    const duration = currentPeriod.end - currentPeriod.start;
                    if (duration < minDuration) {
                        microExpressions.push({
                            type: 'suppressed',
                            timestamp: currentPeriod.start,
                            duration: duration
                        });
                    }
                    currentPeriod = null;
                }
            }
        }
        
        return microExpressions;
    }
    
    distance(point1, point2) {
        const dx = point1[0] - point2[0];
        const dy = point1[1] - point2[1];
        const dz = (point1[2] || 0) - (point2[2] || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    resetBaseline() {
        this.eyeBaseline = null;
        this.baselineStartTime = null;
    }
}

