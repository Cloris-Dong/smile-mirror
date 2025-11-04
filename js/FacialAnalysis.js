// Facial Analysis Module - Handles all face detection and smile calculations

import { CONFIG } from './config.js';

export class FacialAnalysis {
    constructor() {
        this.model = null;
        this.isModelLoaded = false;
        this.realLandmarks = [];
        this.smoothedLandmarks = [];
        this.faceBoundingBox = null;
        
        // Dynamic range tracking for adaptive normalization
        this.facialRanges = {
            mouthNoseDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            mouthNoseDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthLeft: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthRight: { min: Infinity, max: -Infinity, history: [] },
            warmupFrames: CONFIG.FACIAL_RANGES.WARMUP_FRAMES,
            frameCount: 0,
            maxHistory: CONFIG.FACIAL_RANGES.MAX_HISTORY
        };
        
        // Smoothed metrics
        this.smoothedMetrics = {
            muscleActivation: 0,
            facialSymmetry: 0,
            joyDetection: 0
        };
        this.smoothedSmileScore = 0;
    }
    
    // Initialize face detection model
    async setupFacialDetection() {
        try {
            console.log('Loading face detection model...');
            
            if (typeof faceLandmarksDetection === 'undefined') {
                throw new Error('faceLandmarksDetection library not loaded');
            }
            
            // Try MediaPipe runtime first
            try {
                console.log('Attempting MediaPipe runtime...');
                this.model = await faceLandmarksDetection.createDetector(
                    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                    {
                        runtime: 'mediapipe',
                        refineLandmarks: CONFIG.FACE_DETECTION.REFINE_LANDMARKS,
                        maxFaces: CONFIG.FACE_DETECTION.MAX_FACES,
                        solutionPath: CONFIG.FACE_DETECTION.MEDIAPIPE_PATH
                    }
                );
                
                this.isModelLoaded = true;
                console.log('✓ MediaPipe face detection model loaded successfully');
                return;
            } catch (mediapipeError) {
                console.error('✗ MediaPipe runtime failed:', mediapipeError.message);
            }
            
            // Fallback to TensorFlow.js runtime
            try {
                console.log('Attempting TensorFlow.js runtime...');
                this.model = await faceLandmarksDetection.createDetector(
                    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                    {
                        runtime: 'tfjs',
                        refineLandmarks: CONFIG.FACE_DETECTION.REFINE_LANDMARKS,
                        maxFaces: CONFIG.FACE_DETECTION.MAX_FACES
                    }
                );
                
                this.isModelLoaded = true;
                console.log('✓ TensorFlow.js face detection model loaded successfully');
                return;
            } catch (tfjsError) {
                console.error('✗ TensorFlow.js runtime failed:', tfjsError.message);
            }
            
            throw new Error('Both MediaPipe and TensorFlow.js runtimes failed');
            
        } catch (error) {
            console.error('✗ Model loading failed:', error.message);
            this.isModelLoaded = false;
            console.log('Will use fallback face detection system');
        }
    }
    
    // Perform face detection with landmarks
    async detectFace(webcam) {
        try {
            if (this.isModelLoaded && this.model && webcam && 
                webcam.videoWidth > 0 && webcam.videoHeight > 0) {
                
                const faces = await this.model.estimateFaces(webcam, {
                    flipHorizontal: false,
                    returnTensors: false,
                    refineLandmarks: true
                });
                
                if (faces.length > 0) {
                    const face = faces[0];
                    this.updateFaceBoundingBox(face);
                    this.extractLandmarks(face);
                    return true;
                }
            }
        } catch (error) {
            console.error('Face detection error:', error);
        }
        
        return false;
    }
    
    // Extract and process landmarks from face detection
    extractLandmarks(face) {
        let keypoints = null;
        
        if (face.keypoints && face.keypoints.length > 0) {
            keypoints = face.keypoints;
        } else if (face.scaledMesh && face.scaledMesh.length > 0) {
            keypoints = face.scaledMesh;
        }
        
        if (keypoints && keypoints.length > 0) {
            const newLandmarks = keypoints.map(keypoint => {
                let x, y, z = 0;
                
                if (typeof keypoint === 'object') {
                    if (keypoint.x !== undefined && keypoint.y !== undefined) {
                        x = keypoint.x;
                        y = keypoint.y;
                        z = keypoint.z || 0;
                    } else if (keypoint[0] !== undefined && keypoint[1] !== undefined) {
                        x = keypoint[0];
                        y = keypoint[1];
                        z = keypoint[2] || 0;
                    }
                }
                
                // Use pixel coordinates directly
                return [x, y, z];
            });
            
            // Apply smoothing to reduce jitter
            if (this.realLandmarks.length === 0) {
                this.realLandmarks = newLandmarks;
                this.smoothedLandmarks = newLandmarks;
            } else {
                this.smoothLandmarks(newLandmarks);
            }
        }
    }
    
    // Smooth landmark positions to reduce jitter
    smoothLandmarks(newLandmarks) {
        if (this.smoothedLandmarks.length === 0) {
            this.smoothedLandmarks = newLandmarks;
        } else {
            this.smoothedLandmarks = newLandmarks.map((newPoint, index) => {
                const oldPoint = this.smoothedLandmarks[index] || newPoint;
                return [
                    oldPoint[0] + (newPoint[0] - oldPoint[0]) * CONFIG.SMOOTHING.LANDMARK_FACTOR,
                    oldPoint[1] + (newPoint[1] - oldPoint[1]) * CONFIG.SMOOTHING.LANDMARK_FACTOR,
                    oldPoint[2] + (newPoint[2] - oldPoint[2]) * CONFIG.SMOOTHING.LANDMARK_FACTOR
                ];
            });
        }
        this.realLandmarks = this.smoothedLandmarks;
    }
    
    // Update face bounding box from detection results
    updateFaceBoundingBox(face) {
        if (this.realLandmarks && this.realLandmarks.length > 0) {
            const xs = this.realLandmarks.map(l => l[0]);
            const ys = this.realLandmarks.map(l => l[1]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            const newBox = {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                width: maxX - minX,
                height: maxY - minY
            };
            
            if (!this.faceBoundingBox) {
                this.faceBoundingBox = newBox;
            } else {
                const smoothingFactor = 0.3;
                this.faceBoundingBox.x += (newBox.x - this.faceBoundingBox.x) * smoothingFactor;
                this.faceBoundingBox.y += (newBox.y - this.faceBoundingBox.y) * smoothingFactor;
                this.faceBoundingBox.width += (newBox.width - this.faceBoundingBox.width) * smoothingFactor;
                this.faceBoundingBox.height += (newBox.height - this.faceBoundingBox.height) * smoothingFactor;
            }
        }
    }
    
    // Calculate all facial metrics
    calculateMetrics() {
        if (!this.realLandmarks || this.realLandmarks.length < 468) {
            return null;
        }
        
        const L = CONFIG.LANDMARKS;
        
        // Get key landmarks
        const leftMouth = this.realLandmarks[L.LEFT_MOUTH];
        const rightMouth = this.realLandmarks[L.RIGHT_MOUTH];
        const nose = this.realLandmarks[L.NOSE];
        const leftEyeInner = this.realLandmarks[L.LEFT_EYE_INNER];
        const rightEyeInner = this.realLandmarks[L.RIGHT_EYE_INNER];
        const leftEyeOuter = this.realLandmarks[L.LEFT_EYE_OUTER];
        const rightEyeOuter = this.realLandmarks[L.RIGHT_EYE_OUTER];
        const leftCheek = this.realLandmarks[L.LEFT_CHEEK];
        const rightCheek = this.realLandmarks[L.RIGHT_CHEEK];
        
        // Increment frame counter
        this.facialRanges.frameCount++;
        
        // Calculate smile score
        const mouthSmileLeft = this.calculateMouthSmile(leftMouth, nose, true);
        const mouthSmileRight = this.calculateMouthSmile(rightMouth, nose, false);
        const rawSmileScore = (mouthSmileLeft + mouthSmileRight) / 2;
        
        // Apply EMA smoothing
        if (!this.smoothedSmileScore) {
            this.smoothedSmileScore = rawSmileScore;
        } else {
            this.smoothedSmileScore = CONFIG.SMOOTHING.EMA_ALPHA * rawSmileScore + 
                                     (1 - CONFIG.SMOOTHING.EMA_ALPHA) * this.smoothedSmileScore;
        }
        
        const smilingScore = Math.max(0, Math.min(CONFIG.SCORING.MAX_SCORE, this.smoothedSmileScore * CONFIG.SCORING.MAX_SCORE));
        
        // Calculate muscle activation
        const mouthSmileAvg = (mouthSmileLeft + mouthSmileRight) / 2;
        const cheekSquintLeft = this.calculateCheekSquint(leftCheek, leftEyeOuter, true);
        const cheekSquintRight = this.calculateCheekSquint(rightCheek, rightEyeOuter, false);
        const cheekSquintAvg = (cheekSquintLeft + cheekSquintRight) / 2;
        const eyeSmileLeft = this.calculateEyeSmile(leftEyeInner, leftEyeOuter, true);
        const eyeSmileRight = this.calculateEyeSmile(rightEyeInner, rightEyeOuter, false);
        const eyeSmileAvg = (eyeSmileLeft + eyeSmileRight) / 2;
        
        const muscleActivation = Math.max(0, Math.min(CONFIG.SCORING.MAX_SCORE, 
            (0.6 * mouthSmileAvg + 0.2 * cheekSquintAvg + 0.2 * eyeSmileAvg) * CONFIG.SCORING.MAX_SCORE
        ));
        
        // Calculate facial symmetry
        const symmetryDifference = Math.abs(mouthSmileLeft - mouthSmileRight);
        const facialSymmetry = Math.max(0, Math.min(CONFIG.SCORING.MAX_SCORE, 
            (1 - symmetryDifference) * CONFIG.SCORING.MAX_SCORE
        ));
        
        // Calculate joy detection
        const joyDetection = Math.max(0, Math.min(CONFIG.SCORING.MAX_SCORE, 
            0.7 * (smilingScore / CONFIG.SCORING.MAX_SCORE) * CONFIG.SCORING.MAX_SCORE + 0.3 * eyeSmileAvg * CONFIG.SCORING.MAX_SCORE
        ));
        
        // Apply smoothing to metrics
        if (!this.smoothedMetrics.muscleActivation) {
            this.smoothedMetrics.muscleActivation = muscleActivation;
            this.smoothedMetrics.facialSymmetry = facialSymmetry;
            this.smoothedMetrics.joyDetection = joyDetection;
        } else {
            this.smoothedMetrics.muscleActivation += (muscleActivation - this.smoothedMetrics.muscleActivation) * CONFIG.SMOOTHING.METRIC_FACTOR;
            this.smoothedMetrics.facialSymmetry += (facialSymmetry - this.smoothedMetrics.facialSymmetry) * CONFIG.SMOOTHING.METRIC_FACTOR;
            this.smoothedMetrics.joyDetection += (joyDetection - this.smoothedMetrics.joyDetection) * CONFIG.SMOOTHING.METRIC_FACTOR;
        }
        
        return {
            smilingScore,
            muscleActivation: this.smoothedMetrics.muscleActivation,
            facialSymmetry: this.smoothedMetrics.facialSymmetry,
            joyDetection: this.smoothedMetrics.joyDetection,
            isWarmedUp: this.facialRanges.frameCount >= this.facialRanges.warmupFrames
        };
    }
    
    // Calculate mouth smile intensity with dynamic range tracking
    calculateMouthSmile(mouthCorner, nose, isLeft = true) {
        const verticalDiff = mouthCorner[1] - nose[1];
        
        const key = isLeft ? 'mouthNoseDistanceLeft' : 'mouthNoseDistanceRight';
        const range = this.facialRanges[key];
        
        range.history.push(verticalDiff);
        if (range.history.length > this.facialRanges.maxHistory) {
            range.history.shift();
        }
        
        range.min = Math.min(range.min, verticalDiff);
        range.max = Math.max(range.max, verticalDiff);
        
        if (this.facialRanges.frameCount < this.facialRanges.warmupFrames) {
            return 0;
        }
        
        const rangeSpan = range.max - range.min;
        if (rangeSpan < 1) return 0;
        
        const smileIntensity = (range.max - verticalDiff) / rangeSpan;
        return Math.max(0, Math.min(1, smileIntensity));
    }
    
    // Calculate cheek squint intensity with dynamic range tracking
    calculateCheekSquint(cheek, eyeOuter, isLeft = true) {
        const dist = this.distance(cheek, eyeOuter);
        
        const key = isLeft ? 'cheekEyeDistanceLeft' : 'cheekEyeDistanceRight';
        const range = this.facialRanges[key];
        
        range.history.push(dist);
        if (range.history.length > this.facialRanges.maxHistory) {
            range.history.shift();
        }
        
        range.min = Math.min(range.min, dist);
        range.max = Math.max(range.max, dist);
        
        if (this.facialRanges.frameCount < this.facialRanges.warmupFrames) {
            return 0;
        }
        
        const rangeSpan = range.max - range.min;
        if (rangeSpan < 1) return 0;
        
        const squintIntensity = (range.max - dist) / rangeSpan;
        return Math.max(0, Math.min(1, squintIntensity));
    }
    
    // Calculate eye smile intensity with dynamic range tracking
    calculateEyeSmile(eyeInner, eyeOuter, isLeft = true) {
        const eyeWidth = this.distance(eyeInner, eyeOuter);
        
        const key = isLeft ? 'eyeWidthLeft' : 'eyeWidthRight';
        const range = this.facialRanges[key];
        
        range.history.push(eyeWidth);
        if (range.history.length > this.facialRanges.maxHistory) {
            range.history.shift();
        }
        
        range.min = Math.min(range.min, eyeWidth);
        range.max = Math.max(range.max, eyeWidth);
        
        if (this.facialRanges.frameCount < this.facialRanges.warmupFrames) {
            return 0;
        }
        
        const rangeSpan = range.max - range.min;
        if (rangeSpan < 0.5) return 0;
        
        const narrowIntensity = (range.max - eyeWidth) / rangeSpan;
        return Math.max(0, Math.min(1, narrowIntensity));
    }
    
    // Helper function to calculate 3D distance between two points
    distance(point1, point2) {
        const dx = point1[0] - point2[0];
        const dy = point1[1] - point2[1];
        const dz = point1[2] - point2[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    // Reset all tracking data
    reset() {
        this.facialRanges = {
            mouthNoseDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            mouthNoseDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthLeft: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthRight: { min: Infinity, max: -Infinity, history: [] },
            warmupFrames: CONFIG.FACIAL_RANGES.WARMUP_FRAMES,
            frameCount: 0,
            maxHistory: CONFIG.FACIAL_RANGES.MAX_HISTORY
        };
        
        this.smoothedMetrics = {
            muscleActivation: 0,
            facialSymmetry: 0,
            joyDetection: 0
        };
        this.smoothedSmileScore = 0;
    }
}

