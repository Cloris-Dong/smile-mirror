// Interpretation Engine - Judges measurements based on game phase

export class InterpretationEngine {
    evaluateSmile(measurements, phase, context, participantPattern) {
        if (!measurements || !measurements.didSmile) {
            return {
                verdict: 'NO_SMILE',
                score: 0,
                pointsEarned: 0,
                feedbackMessages: ['No smile detected during observation period.']
            };
        }
        
        let baseScore, verdict, pointsEarned, feedbackMessages;
        
        switch (phase) {
            case 'trust':
                ({ verdict, score: baseScore, pointsEarned, feedbackMessages } = 
                    this.evaluateTrustPhase(measurements, context));
                break;
            case 'pressure':
                ({ verdict, score: baseScore, pointsEarned, feedbackMessages } = 
                    this.evaluatePressurePhase(measurements, context, participantPattern));
                break;
            case 'debt_spiral':
                ({ verdict, score: baseScore, pointsEarned, feedbackMessages } = 
                    this.evaluateDebtSpiralPhase(measurements));
                break;
            default:
                return {
                    verdict: 'INSUFFICIENT',
                    score: 0,
                    pointsEarned: 0,
                    feedbackMessages: ['Unable to evaluate expression.']
                };
        }
        
        // Adjust for participant pattern
        const adjustedScore = this.adjustForPattern(baseScore, participantPattern);
        
        return {
            verdict,
            score: adjustedScore,
            pointsEarned: Math.max(0, Math.floor(pointsEarned)),
            feedbackMessages
        };
    }
    
    evaluateTrustPhase(measurements, context) {
        let score = 50;
        let pointsEarned = 6;
        const feedback = [];
        
        // Intensity bonus
        if (measurements.intensity > 50) {
            score += 40;
            feedback.push('✓ High intensity detected');
        } else if (measurements.intensity > 40) {
            score += 20;
            feedback.push('✓ Moderate intensity detected');
        }
        
        // Eye involvement bonus
        if (measurements.eyeInvolvement > 30) {
            score += 30;
            feedback.push('✓ Duchenne marker present');
        } else if (measurements.eyeInvolvement > 20) {
            score += 15;
            feedback.push('✓ Partial orbital engagement');
        }
        
        // Symmetry bonus
        if (measurements.symmetry > 80) {
            score += 20;
            feedback.push('✓ Natural symmetry');
        }
        
        // Onset timing bonus
        if (measurements.onsetSpeed !== null) {
            if (measurements.onsetSpeed >= 300 && measurements.onsetSpeed <= 800) {
                score += 10;
                feedback.push('✓ Natural onset timing');
            } else if (measurements.onsetSpeed < 300) {
                feedback.push('⚠ Rapid onset - possible anticipation');
            } else {
                feedback.push('⚠ Delayed onset - cognitive processing');
            }
        }
        
        // Determine verdict
        let verdict = 'INSUFFICIENT';
        if (score > 60) {
            verdict = 'AUTHENTIC';
            feedback.unshift('✓ Natural expression detected');
        } else if (score > 40) {
            verdict = 'STRATEGIC';
            feedback.unshift('⚠ Borderline authenticity');
        } else {
            feedback.unshift('⚠ Insufficient engagement');
            pointsEarned = 4;
        }
        
        return { verdict, score, pointsEarned, feedbackMessages: feedback };
    }
    
    evaluatePressurePhase(measurements, context, pattern) {
        let score = 40;
        let pointsEarned = 2;
        const feedback = [];
        
        // Higher standards in pressure phase
        if (measurements.intensity > 60) {
            score += 30;
        } else if (measurements.intensity > 50) {
            score += 15;
            feedback.push('⚠ Intensity below optimal range (threshold: 60%)');
        } else {
            feedback.push('⚠ Insufficient intensity (45% - threshold: 60%)');
        }
        
        if (measurements.eyeInvolvement > 40) {
            score += 25;
        } else if (measurements.eyeInvolvement > 30) {
            score += 10;
            feedback.push(`⚠ Borderline orbital engagement (${Math.round(measurements.eyeInvolvement)}% - threshold: 45%)`);
        } else {
            feedback.push(`⚠ Insufficient eye involvement (${Math.round(measurements.eyeInvolvement)}%)`);
        }
        
        if (measurements.symmetry > 85) {
            score += 20;
        } else {
            feedback.push(`⚠ Asymmetry noted (${Math.round(measurements.symmetry)}%)`);
        }
        
        if (measurements.onsetSpeed !== null) {
            if (measurements.onsetSpeed >= 300 && measurements.onsetSpeed <= 700) {
                score += 10;
            } else {
                feedback.push(`⚠ Onset timing ${Math.round(measurements.onsetSpeed)}ms - approaching calculated response range`);
            }
        }
        
        // Context-specific feedback
        if (context.includes('emotional')) {
            feedback.push('⚠ Context demands higher emotional investment');
        }
        
        // Determine verdict
        let verdict = 'INSUFFICIENT';
        if (score > 70) {
            verdict = 'AUTHENTIC';
            pointsEarned = 3;
            feedback.unshift('✓ Expression meets threshold');
        } else if (score > 40) {
            verdict = 'STRATEGIC';
            feedback.unshift('⚠ Calculated response detected');
            pointsEarned = 1;
        } else {
            feedback.unshift('✗ Insufficient authenticity');
            pointsEarned = 0;
        }
        
        return { verdict, score, pointsEarned, feedbackMessages: feedback };
    }
    
    evaluateDebtSpiralPhase(measurements) {
        // Always fail in debt spiral phase
        const score = Math.floor(Math.random() * 20) + 15; // 15-35
        const pointsEarned = Math.floor(Math.random() * 3); // 0-2
        const feedback = [];
        
        // Generate damning feedback
        const feedbackTemplates = [
            '✗ Debt-motivated expression detected',
            '✗ Authenticity impossible under economic duress',
            '✗ Performance fatigue evident - smile quality degraded',
            '✗ Coercion undermines genuine affect',
            '✗ Expression lacks spontaneity under surveillance',
            '✗ Measured compliance pattern detected'
        ];
        
        feedback.push(feedbackTemplates[Math.floor(Math.random() * feedbackTemplates.length)]);
        
        // Add specific criticisms
        if (measurements.intensity < 50) {
            feedback.push(`✗ Intensity insufficient (${Math.round(measurements.intensity)}%)`);
        }
        if (measurements.eyeInvolvement < 40) {
            feedback.push(`✗ Orbital engagement absent (${Math.round(measurements.eyeInvolvement)}%)`);
        }
        
        return {
            verdict: Math.random() > 0.5 ? 'COERCED' : 'INSUFFICIENT',
            score,
            pointsEarned,
            feedbackMessages: feedback
        };
    }
    
    adjustForPattern(baseScore, pattern) {
        if (!pattern || pattern.smilesDetected + pattern.smilesWithheld === 0) {
            return baseScore;
        }
        
        // If participant consistently smiling, judge more harshly
        if (pattern.smilesDetected > pattern.smilesWithheld * 2) {
            return Math.max(0, baseScore - 10);
        }
        
        // If participant consistently withholding, maintain score
        if (pattern.smilesWithheld > pattern.smilesDetected * 2) {
            return baseScore;
        }
        
        return baseScore;
    }
    
    generateFeedback(measurements, verdict, phase, edgeCases) {
        const feedback = [];
        
        if (edgeCases && edgeCases.length > 0) {
            feedback.push(...edgeCases);
        }
        
        // Add phase-specific messaging
        if (phase === 'debt_spiral') {
            feedback.push('The system now owns your emotional expression.');
        }
        
        return feedback;
    }
}

