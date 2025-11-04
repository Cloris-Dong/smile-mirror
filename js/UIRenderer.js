// UI Renderer Module - Handles all canvas drawing and visual overlays

import { CONFIG } from './config.js';

export class UIRenderer {
    constructor(facialOverlay, webcam) {
        this.facialOverlay = facialOverlay;
        this.webcam = webcam;
    }
    
    // Draw the complete facial analysis overlay
    drawFacialAnalysis(facialAnalysis, metrics) {
        if (!this.facialOverlay || !metrics) return;
        
        const ctx = this.facialOverlay.getContext('2d');
        const width = this.facialOverlay.width;
        const height = this.facialOverlay.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw face bounding box if available
        if (facialAnalysis.faceBoundingBox && facialAnalysis.realLandmarks.length >= 468) {
            this.drawFaceBoundingBox(ctx, facialAnalysis.faceBoundingBox, facialAnalysis.realLandmarks, width);
            this.drawKeyLandmarks(ctx, facialAnalysis.realLandmarks, width);
        }
        
        // Draw measurement labels and bars
        if (facialAnalysis.faceBoundingBox) {
            this.drawMetricBars(ctx, facialAnalysis.faceBoundingBox, metrics, width);
        }
    }
    
    // Draw face bounding box with clean Apple style
    drawFaceBoundingBox(ctx, boundingBox, landmarks, width) {
        // Calculate bounding box from landmarks
        const xs = landmarks.map(l => l[0]);
        const ys = landmarks.map(l => l[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const boxWidth = maxX - minX;
        const boxHeight = maxY - minY;
        
        // Mirror coordinates for webcam effect
        const mirroredX = width - centerX;
        const boxX = mirroredX - boxWidth / 2;
        const boxY = centerY - boxHeight / 2;
        
        // Draw clean rounded rectangle outline
        ctx.strokeStyle = 'rgba(0, 122, 255, 0.6)';
        ctx.lineWidth = 2;
        const radius = 20;
        
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
        ctx.stroke();
        
        // Draw corner accents
        const cornerLength = 20;
        ctx.strokeStyle = 'rgba(0, 122, 255, 0.9)';
        ctx.lineWidth = 3;
        
        // Top-left
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + cornerLength, boxY);
        ctx.moveTo(boxX, boxY + radius);
        ctx.lineTo(boxX, boxY + cornerLength);
        ctx.stroke();
        
        // Top-right
        ctx.beginPath();
        ctx.moveTo(boxX + boxWidth - cornerLength, boxY);
        ctx.lineTo(boxX + boxWidth - radius, boxY);
        ctx.moveTo(boxX + boxWidth, boxY + radius);
        ctx.lineTo(boxX + boxWidth, boxY + cornerLength);
        ctx.stroke();
        
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(boxX, boxY + boxHeight - cornerLength);
        ctx.lineTo(boxX, boxY + boxHeight - radius);
        ctx.moveTo(boxX + radius, boxY + boxHeight);
        ctx.lineTo(boxX + cornerLength, boxY + boxHeight);
        ctx.stroke();
        
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(boxX + boxWidth, boxY + boxHeight - cornerLength);
        ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
        ctx.moveTo(boxX + boxWidth - cornerLength, boxY + boxHeight);
        ctx.lineTo(boxX + boxWidth - radius, boxY + boxHeight);
        ctx.stroke();
    }
    
    // Draw minimal key landmark points
    drawKeyLandmarks(ctx, landmarks, width) {
        const L = CONFIG.LANDMARKS;
        
        const keyIndices = {
            leftMouth: L.LEFT_MOUTH,
            rightMouth: L.RIGHT_MOUTH,
            topLip: L.TOP_LIP,
            bottomLip: L.BOTTOM_LIP
        };
        
        // Draw subtle dots
        Object.entries(keyIndices).forEach(([name, index]) => {
            if (index < landmarks.length) {
                const landmark = landmarks[index];
                const x = width - landmark[0];
                const y = landmark[1];
                
                // Draw outer glow
                ctx.fillStyle = 'rgba(0, 122, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw inner dot
                ctx.fillStyle = 'rgba(0, 122, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    // Draw metric bars with scores
    drawMetricBars(ctx, faceBoundingBox, metrics, width) {
        const { smilingScore, muscleActivation, facialSymmetry, joyDetection } = metrics;
        
        // Bar dimensions
        const barWidth = Math.max(CONFIG.UI.MIN_BAR_WIDTH, faceBoundingBox.width * CONFIG.UI.BAR_WIDTH_MULTIPLIER);
        const barHeight = CONFIG.UI.METRIC_BAR_HEIGHT;
        const barSpacing = CONFIG.UI.METRIC_BAR_SPACING;
        
        // Position for energy bars
        const boxX = (width - barWidth) / 2;
        const boxY = faceBoundingBox.y + faceBoundingBox.height / 2 + 40;
        
        const metricData = [
            { label: 'Muscle Activation', value: muscleActivation, color: CONFIG.UI.COLORS.MUSCLE_ACTIVATION },
            { label: 'Facial Symmetry', value: facialSymmetry, color: CONFIG.UI.COLORS.FACIAL_SYMMETRY },
            { label: 'Joy Detection', value: joyDetection, color: CONFIG.UI.COLORS.JOY_DETECTION }
        ];
        
        // Draw OVERALL SCORE BAR at top
        const overallScore = Math.min(CONFIG.SCORING.MAX_SCORE, smilingScore);
        const passingThreshold = CONFIG.SCORING.PASSING_THRESHOLD;
        
        const topMargin = CONFIG.UI.TOP_MARGIN;
        const overallBarWidth = width * CONFIG.UI.OVERALL_BAR_WIDTH_PERCENT;
        const overallBarX = (width - overallBarWidth) / 2;
        const overallY = topMargin;
        const overallBarHeight = CONFIG.UI.OVERALL_BAR_HEIGHT;
        
        // Overall score label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = CONFIG.UI.FONTS.TITLE;
        ctx.textAlign = 'center';
        ctx.fillText('SMILING SCORE', width / 2, overallY - 16);
        ctx.textAlign = 'left';
        
        // Background bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.roundRect(overallBarX, overallY, overallBarWidth, overallBarHeight, overallBarHeight / 2);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(overallBarX, overallY, overallBarWidth, overallBarHeight, overallBarHeight / 2);
        ctx.stroke();
        
        // Progress bar with color based on score
        const overallProgressWidth = (overallBarWidth * overallScore) / 100;
        let overallColor1 = CONFIG.UI.COLORS.SCORE_LOW;
        let overallColor2 = CONFIG.UI.COLORS.SCORE_LOW;
        if (overallScore >= passingThreshold) {
            overallColor1 = CONFIG.UI.COLORS.SCORE_HIGH;
            overallColor2 = CONFIG.UI.COLORS.SCORE_HIGH;
        } else if (overallScore >= 60) {
            overallColor1 = CONFIG.UI.COLORS.SCORE_MID;
            overallColor2 = CONFIG.UI.COLORS.SCORE_MID;
        }
        
        const overallGradient = ctx.createLinearGradient(overallBarX, 0, overallBarX + overallProgressWidth, 0);
        overallGradient.addColorStop(0, overallColor1);
        overallGradient.addColorStop(1, overallColor2);
        
        ctx.shadowColor = overallColor1;
        ctx.shadowBlur = 12;
        ctx.fillStyle = overallGradient;
        ctx.beginPath();
        ctx.roundRect(overallBarX, overallY, overallProgressWidth, overallBarHeight, overallBarHeight / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Percentage
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = CONFIG.UI.FONTS.PERCENTAGE;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(overallScore)}%`, width / 2, overallY + overallBarHeight + 24);
        ctx.textAlign = 'left';
        
        // Draw passing threshold line
        const thresholdX = overallBarX + (overallBarWidth * passingThreshold / 100);
        ctx.strokeStyle = CONFIG.UI.COLORS.PASS_LINE;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(thresholdX, overallY - 12);
        ctx.lineTo(thresholdX, overallY + overallBarHeight + 12);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw "PASS" marker
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(thresholdX - 22, overallY - 26, 44, 18, 9);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '700 13px -apple-system, BlinkMacSystemFont, SF Pro Text';
        ctx.textAlign = 'center';
        ctx.fillText('PASS', thresholdX, overallY - 14);
        ctx.textAlign = 'left';
        
        // Draw individual metric bars
        metricData.forEach((metric, index) => {
            const y = boxY + 40 + (index * barSpacing);
            
            // Draw label with shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.font = CONFIG.UI.FONTS.METRIC_LABEL;
            ctx.fillText(metric.label, boxX + 20, y - 14);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw background bar
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, barWidth, barHeight, barHeight / 2);
            ctx.fill();
            
            // Border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, barWidth, barHeight, barHeight / 2);
            ctx.stroke();
            
            // Progress bar with gradient
            const progressWidth = (barWidth * metric.value) / 100;
            const gradient = ctx.createLinearGradient(boxX + 20, 0, boxX + 20 + progressWidth, 0);
            gradient.addColorStop(0, metric.color);
            gradient.addColorStop(1, metric.color + 'DD');
            
            ctx.shadowColor = metric.color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, progressWidth, barHeight, barHeight / 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Draw percentage
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.font = CONFIG.UI.FONTS.METRIC_VALUE;
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(metric.value)}%`, boxX + 20 + barWidth + 60, y + 12);
            ctx.textAlign = 'left';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        });
    }
    
    // Draw scanning effect
    drawScanningEffect() {
        if (!this.facialOverlay) return;
        
        const ctx = this.facialOverlay.getContext('2d');
        const width = this.facialOverlay.width;
        const height = this.facialOverlay.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const time = Date.now() * 0.001;
        const scanY = (Math.sin(time) + 1) * height / 2;
        
        // Draw scanning line
        ctx.strokeStyle = 'rgba(0, 122, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
        
        // Add glow
        ctx.shadowColor = 'rgba(0, 122, 255, 0.6)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '510 14px -apple-system, BlinkMacSystemFont, SF Pro Text';
        ctx.textAlign = 'center';
        ctx.fillText('Searching for face...', width / 2, height / 2);
        ctx.textAlign = 'left';
    }
    
    // Clear the overlay
    clear() {
        if (!this.facialOverlay) return;
        const ctx = this.facialOverlay.getContext('2d');
        ctx.clearRect(0, 0, this.facialOverlay.width, this.facialOverlay.height);
    }
}

