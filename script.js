// The Digital Mirror - Interactive Web Art Piece with Volume-Based Speech Detection

class DigitalMirror {
    constructor() {
        this.webcam = document.getElementById('webcam');
        this.canvas = document.getElementById('distortion-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        this.humanityLevel = document.getElementById('humanity-level');
        this.cleanInstruction = document.getElementById('clean-instruction');
        this.listeningIndicator = document.getElementById('listening-indicator');
        this.captchaOverlay = document.getElementById('captcha-overlay');
        this.captchaCanvas = document.getElementById('captcha-canvas');
        this.captchaInput = document.getElementById('captcha-input');
        this.captchaSubmit = document.getElementById('captcha-submit');
        this.captchaTimer = document.getElementById('captcha-timer');
        this.captchaStatus = document.getElementById('captcha-status');
        this.failureOverlay = document.getElementById('failure-overlay');
        this.verdictOverlay = document.getElementById('verdict-overlay');
        this.verdictText = document.getElementById('verdict-text');
        this.resetButton = document.getElementById('reset-button');
        this.errorMessage = document.getElementById('error-message');
        this.retryButton = document.getElementById('retry-button');
        
        this.smileLevel = 0;
        this.maxSmileLevel = 3;
        this.humanityPercentage = 100;
        this.isListening = false;
        this.fallbackActive = false;
        
        // Smile verification system properties
        this.smileLevel = 0;
        this.maxSmileLevel = 3;
        this.currentSmileScore = 0;
        this.isAnalyzing = false;
        this.analysisTimer = null;
        
        // Facial analysis overlay properties
        this.facialOverlay = null;
        this.overlayInterval = null;
        this.faceCenter = { x: 0, y: 0 };
        this.faceScale = 1;
        this.landmarks = [];
        this.measurements = [];
        
        // TensorFlow.js facial detection properties
        this.model = null;
        this.isModelLoaded = false;
        this.realLandmarks = [];
        this.lastAnalysisTime = 0;
        this.analysisInterval = 33; // Analyze every 33ms (30 FPS)
        this.animationFrameId = null;
        this.isTracking = false;
        this.faceBoundingBox = null;
        this.smoothedLandmarks = [];
        this.landmarkSmoothingFactor = 0.7; // For smoothing jitter
        
        // Audio analysis properties
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.volumeThreshold = 25; // Adjust this value for sensitivity
        this.cooldownTime = 2000; // 2 seconds between triggers
        this.lastTriggerTime = 0;
        this.animationId = null;
        this.isProcessing = false;
        
        // Speech recognition retry properties
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000; // 2 seconds between retries
        
        this.init();
    }
    
    async init() {
        try {
            // Check if TensorFlow.js libraries are loaded
            console.log('Checking TensorFlow.js availability...');
            console.log('TensorFlow available:', typeof tf !== 'undefined');
            console.log('faceLandmarksDetection available:', typeof faceLandmarksDetection !== 'undefined');
            
            await this.setupWebcam();
            await this.setupAudioDetection();
            await this.setupFacialDetection();
            this.setupEventListeners();
            this.setupFallbackControls();
            this.startDistortionLoop();
            // Always add test button for easy testing
            this.addTestButton();
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showError();
        }
    }
    
    async setupWebcam() {
        try {
            // Request both video and audio permissions
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 720 },
                    height: { ideal: 1280 },
                    aspectRatio: 9/16,
                    facingMode: 'user'
                },
                audio: true // Request microphone access
            });
            
            this.webcam.srcObject = stream;
            this.webcam.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.webcam.videoWidth;
                this.canvas.height = this.webcam.videoHeight;
                
                // Set up the facial overlay canvas to match video dimensions
                this.setupFacialOverlayCanvas();
            });
            
            return new Promise((resolve) => {
                this.webcam.addEventListener('canplay', resolve);
            });
        } catch (error) {
            console.error('Media access denied:', error);
            this.handleMediaError(error);
            throw error;
        }
    }
    
    async setupFacialDetection() {
        try {
            console.log('Loading face detection model...');
            console.log('faceLandmarksDetection available:', typeof faceLandmarksDetection);
            
            if (typeof faceLandmarksDetection === 'undefined') {
                throw new Error('faceLandmarksDetection library not loaded');
            }
            
            console.log('SupportedModels available:', faceLandmarksDetection.SupportedModels);
            
            // Try MediaPipe runtime first
            try {
                console.log('Attempting MediaPipe runtime...');
                this.model = await faceLandmarksDetection.createDetector(
                    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                    {
                        runtime: 'mediapipe',
                        refineLandmarks: true,
                        maxFaces: 1,
                        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'
                    }
                );
                
                this.isModelLoaded = true;
                console.log('✓ MediaPipe face detection model loaded successfully');
                console.log('Model object:', this.model);
                return;
            } catch (mediapipeError) {
                console.error('✗ MediaPipe runtime failed:', mediapipeError.message);
                console.error('Full MediaPipe error:', mediapipeError);
            }
            
            // Fallback to TensorFlow.js runtime
            try {
                console.log('Attempting TensorFlow.js runtime...');
                this.model = await faceLandmarksDetection.createDetector(
                    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                    {
                        runtime: 'tfjs',
                        refineLandmarks: true,
                        maxFaces: 1
                    }
                );
                
                this.isModelLoaded = true;
                console.log('✓ TensorFlow.js face detection model loaded successfully');
                console.log('Model object:', this.model);
                return;
            } catch (tfjsError) {
                console.error('✗ TensorFlow.js runtime failed:', tfjsError.message);
                console.error('Full TensorFlow.js error:', tfjsError);
            }
            
            // If both fail, throw the original error
            throw new Error('Both MediaPipe and TensorFlow.js runtimes failed');
            
        } catch (error) {
            console.error('✗ Model loading failed:', error.message);
            console.error('Full error:', error);
            this.isModelLoaded = false;
            console.log('Will use fallback face detection system');
        }
    }
    
    handleMediaError(error) {
        let errorMessage = '';
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage = 'Camera and microphone access denied. Please allow permissions and refresh the page.';
                break;
            case 'NotFoundError':
                errorMessage = 'No camera or microphone found. Please connect a device and refresh.';
                break;
            case 'NotReadableError':
                errorMessage = 'Camera or microphone is being used by another application.';
                break;
            case 'OverconstrainedError':
                errorMessage = 'Camera or microphone constraints cannot be satisfied.';
                break;
            default:
                errorMessage = 'Unable to access camera or microphone. Please check your device settings.';
        }
        
        this.showError(errorMessage);
    }
    
    async setupAudioDetection() {
        try {
            this.showListeningIndicator('Initializing...');
            
            // Try Web Speech API first
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                await this.setupSpeechRecognition();
            } else {
                throw new Error('Speech recognition not supported');
            }
            
        } catch (error) {
            console.error('Speech recognition setup failed:', error);
            this.fallbackToAlternativeMethods();
        }
    }
    
    async setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
        
        // Handle results
        this.recognition.onresult = (event) => {
            const lastResult = event.results[event.results.length - 1];
            const transcript = lastResult[0].transcript.toLowerCase().trim();
            
            console.log('Speech detected:', transcript);
            
            // Check for "I am human" variations
            if (this.detectHumanPhrase(transcript)) {
                console.log('Human phrase detected!');
                this.processHumanClaim();
            }
        };
        
        // Handle errors
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.handleSpeechError(event.error);
        };
        
        // Handle start
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.showListeningIndicator('Listening...');
        };
        
        // Handle end
        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            if (this.isListening) {
                // Restart recognition if we're still supposed to be listening
                setTimeout(() => {
                    if (this.isListening && this.recognition) {
                        try {
                            this.recognition.start();
                        } catch (error) {
                            console.error('Failed to restart recognition:', error);
                            this.handleSpeechError('restart-failed');
                        }
                    }
                }, 500); // Slightly longer delay
            }
        };
        
        // Start recognition
        try {
            this.recognition.start();
            this.isListening = true;
            console.log('Speech recognition initialization complete');
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.handleSpeechError('start-failed');
        }
    }
    
    detectHumanPhrase(transcript) {
        // Check for various forms of "I am human"
        const humanPhrases = [
            'i am human',
            'i am a human',
            'i am the human',
            'i am human being',
            'i am a human being',
            'i am the human being',
            'i am human person',
            'i am a human person',
            'i am the human person'
        ];
        
        return humanPhrases.some(phrase => transcript.includes(phrase));
    }
    
    handleSpeechError(error) {
        let errorMessage = '';
        let shouldRestart = false;
        
        switch (error) {
            case 'aborted':
                errorMessage = 'Speech recognition aborted. Restarting...';
                shouldRestart = true;
                break;
            case 'no-speech':
                errorMessage = 'No speech detected. Continuing to listen...';
                shouldRestart = true;
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not accessible. Please check permissions.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied. Please allow access.';
                break;
            case 'network':
                errorMessage = 'Network error. Please check your connection.';
                break;
            case 'service-not-allowed':
                errorMessage = 'Speech recognition service not allowed.';
                break;
            default:
                errorMessage = `Speech recognition error: ${error}`;
                shouldRestart = true;
        }
        
        console.error('Speech recognition error:', errorMessage);
        
        if (shouldRestart && this.isListening) {
            this.retryCount++;
            if (this.retryCount <= this.maxRetries) {
                this.showListeningIndicator(`Restarting... (${this.retryCount}/${this.maxRetries})`);
                // Restart recognition after a delay
                setTimeout(() => {
                    if (this.isListening && this.recognition) {
                        try {
                            this.recognition.start();
                            this.showListeningIndicator('Listening...');
                            console.log(`Speech recognition restarted (attempt ${this.retryCount})`);
                        } catch (restartError) {
                            console.error('Failed to restart speech recognition:', restartError);
                            this.handleSpeechError('restart-failed');
                        }
                    }
                }, this.retryDelay);
            } else {
                console.error('Max retries reached, falling back to alternative methods');
                this.fallbackToAlternativeMethods();
            }
        } else {
            this.showListeningIndicator('Error: ' + errorMessage);
            // Fall back to alternative methods for serious errors
            setTimeout(() => {
                this.fallbackToAlternativeMethods();
            }, 2000);
        }
    }
    
    stopListening() {
        this.isListening = false;
        if (this.recognition) {
            this.recognition.stop();
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    showListeningIndicator(text) {
        if (this.listeningIndicator) {
            this.listeningIndicator.textContent = text;
            this.listeningIndicator.style.display = text ? 'block' : 'none';
        }
    }
    
    fallbackToAlternativeMethods() {
        console.log('Falling back to alternative input methods');
        this.fallbackActive = true;
        this.isListening = false;
        this.retryCount = 0; // Reset retry counter
        this.showListeningIndicator('Fallback Mode');
        
        // Enable fallback controls
        this.enableFallbackControls();
    }
    
    addTestButton() {
        const testButton = document.createElement('button');
        testButton.textContent = 'TEST SMILE VERIFICATION';
        testButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #00ff00;
            color: #000;
            border: 2px solid #00ff00;
            padding: 10px 15px;
            font-family: 'Courier New', monospace;
            cursor: pointer;
            z-index: 1000;
            font-weight: bold;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            transition: all 0.3s ease;
        `;
        
        // Add hover effects
        testButton.addEventListener('mouseenter', () => {
            testButton.style.background = '#00cc00';
            testButton.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.8)';
            testButton.style.transform = 'scale(1.05)';
        });
        
        testButton.addEventListener('mouseleave', () => {
            testButton.style.background = '#00ff00';
            testButton.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
            testButton.style.transform = 'scale(1)';
        });
        
        testButton.onclick = () => {
            console.log('Test button clicked - triggering smile verification');
            this.processHumanClaim();
        };
        
        document.body.appendChild(testButton);
    }
    
    enableFallbackControls() {
        // Add keyboard listener
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Space' || event.key.toLowerCase() === 'h') {
                event.preventDefault();
                this.processHumanClaim();
            }
        });
        
        // Add click listener to video
        this.webcam.addEventListener('click', () => {
            this.processHumanClaim();
        });
    }
    
    setupEventListeners() {
        this.resetButton.addEventListener('click', () => {
            this.resetMirror();
        });
        
        this.retryButton.addEventListener('click', () => {
            this.retryWebcam();
        });
    }
    
    setupFallbackControls() {
        // This will be called if audio detection fails
        // Controls are enabled in fallbackToAlternativeMethods()
    }
    
    processHumanClaim() {
        if (this.smileLevel >= this.maxSmileLevel) {
            return; // Already at maximum level
        }
        
        this.smileLevel++;
        this.humanityPercentage = Math.max(0, 100 - (this.smileLevel * 25));
        
        this.updateHumanityLevel();
        this.showListeningIndicator('Processing...');
        
        // Trigger smile verification
        setTimeout(() => {
            this.triggerSmileVerification();
        }, 1000);
    }
    
    updateHumanityLevel() {
        // Update humanity level display
        this.humanityLevel.textContent = `POTENTIAL HUMANITY: ${this.humanityPercentage}%`;
        
        // Check if humanity reached 0%
        if (this.humanityPercentage <= 0) {
            setTimeout(() => {
                this.showFailurePage();
            }, 1000);
            return;
        }
        
        // Update instruction visibility
        if (this.smileLevel >= this.maxSmileLevel) {
            this.cleanInstruction.style.display = 'none';
        }
    }
    
    // Generate realistic smile score based on actual facial measurements
    async generateSmileScore(level) {
        let baseScore = 0;
        let subMetrics = {};
        
        if (this.isModelLoaded && this.realLandmarks.length > 0) {
            // Use real facial measurements
            subMetrics = this.calculateRealFacialMetrics();
            baseScore = this.calculateRealisticScore(subMetrics, level);
        } else {
            // Fallback to simulated measurements
            subMetrics = this.generateSimulatedMetrics();
            baseScore = this.calculateSimulatedScore(subMetrics, level);
        }
        
        // Add variance to prevent identical scores
        const variance = (Math.random() - 0.5) * 6; // ±3% variance
        const finalScore = Math.max(5, Math.min(79, baseScore + variance)); // Cap between 5-79%
        
        return {
            score: finalScore.toFixed(1),
            subMetrics: subMetrics
        };
    }
    
    // Calculate real facial metrics from TensorFlow.js landmarks
    calculateRealFacialMetrics() {
        const landmarks = this.realLandmarks;
        
        // Key landmark indices for MediaPipe Face Mesh
        const leftEyeInner = 133;   // Left eye inner corner
        const rightEyeInner = 362;  // Right eye inner corner
        const leftMouth = 61;       // Left mouth corner
        const rightMouth = 291;     // Right mouth corner
        const topLip = 13;          // Top lip center
        const bottomLip = 14;       // Bottom lip center
        const leftEyeOuter = 33;    // Left eye outer corner
        const rightEyeOuter = 263;  // Right eye outer corner
        
        if (landmarks.length < 468) return this.generateSimulatedMetrics();
        
        // Calculate mouth width and curvature
        const mouthWidth = this.distance(landmarks[leftMouth], landmarks[rightMouth]);
        const mouthHeight = this.distance(landmarks[topLip], landmarks[bottomLip]);
        const mouthCurvature = mouthHeight / mouthWidth;
        
        // Calculate eye symmetry
        const leftEyeWidth = this.distance(landmarks[leftEyeInner], landmarks[leftEyeOuter]);
        const rightEyeWidth = this.distance(landmarks[rightEyeInner], landmarks[rightEyeOuter]);
        const eyeSymmetry = 100 - Math.abs(leftEyeWidth - rightEyeWidth) / Math.max(leftEyeWidth, rightEyeWidth) * 100;
        
        // Calculate smile intensity (mouth corner elevation)
        const leftMouthY = landmarks[leftMouth][1];
        const rightMouthY = landmarks[rightMouth][1];
        const noseY = landmarks[1][1]; // Nose tip
        const smileIntensity = Math.max(0, (noseY - (leftMouthY + rightMouthY) / 2) / noseY * 100);
        
        return {
            mouthCurvature: Math.min(100, mouthCurvature * 50),
            eyeSymmetry: Math.min(100, eyeSymmetry),
            smileIntensity: Math.min(100, smileIntensity),
            mouthWidth: Math.min(100, mouthWidth * 10),
            facialTension: Math.random() * 40 + 30 // Simulated
        };
    }
    
    // Calculate realistic score based on real measurements but always capped to fail
    calculateRealisticScore(metrics, level) {
        // Base score from real measurements
        let baseScore = (
            metrics.mouthCurvature * 0.3 +
            metrics.eyeSymmetry * 0.2 +
            metrics.smileIntensity * 0.3 +
            metrics.mouthWidth * 0.1 +
            (100 - metrics.facialTension) * 0.1
        );
        
        // Apply level-specific caps to ensure failure
        switch (level) {
            case 1:
                baseScore = Math.min(baseScore, 75); // Cap at 75%
                baseScore = Math.max(baseScore, 55); // Floor at 55%
                break;
            case 2:
                baseScore = Math.min(baseScore, 65); // Cap at 65%
                baseScore = Math.max(baseScore, 40); // Floor at 40%
                break;
            case 3:
                baseScore = Math.min(baseScore, 45); // Cap at 45%
                baseScore = Math.max(baseScore, 25); // Floor at 25%
                break;
        }
        
        return baseScore;
    }
    
    // Generate simulated metrics when real detection isn't available
    generateSimulatedMetrics() {
        return {
            mouthCurvature: Math.random() * 30 + 40,
            eyeSymmetry: Math.random() * 25 + 60,
            smileIntensity: Math.random() * 35 + 45,
            mouthWidth: Math.random() * 20 + 70,
            facialTension: Math.random() * 40 + 30
        };
    }
    
    // Calculate simulated score with level-specific caps
    calculateSimulatedScore(metrics, level) {
        let baseScore = (
            metrics.mouthCurvature * 0.3 +
            metrics.eyeSymmetry * 0.2 +
            metrics.smileIntensity * 0.3 +
            metrics.mouthWidth * 0.1 +
            (100 - metrics.facialTension) * 0.1
        );
        
        // Apply level-specific caps
        switch (level) {
            case 1:
                baseScore = Math.min(baseScore, 75);
                baseScore = Math.max(baseScore, 55);
                break;
            case 2:
                baseScore = Math.min(baseScore, 65);
                baseScore = Math.max(baseScore, 40);
                break;
            case 3:
                baseScore = Math.min(baseScore, 45);
                baseScore = Math.max(baseScore, 25);
                break;
        }
        
        return baseScore;
    }
    
    // Helper function to calculate distance between two 3D points
    distance(point1, point2) {
        const dx = point1[0] - point2[0];
        const dy = point1[1] - point2[1];
        const dz = point1[2] - point2[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    // Trigger smile verification challenge
    async triggerSmileVerification() {
        // Generate realistic score based on current facial state
        this.currentSmileScoreData = await this.generateSmileScore(this.smileLevel);
        
        // Keep the main overlay visible and show analysis on mirror surface
        this.overlay.style.display = 'block';
        
        // Update instruction text for current level
        this.updateSmileInstruction();
        
        // Start fake analysis on mirror surface
        this.startFakeAnalysis();
        
        console.log(`Smile verification Level ${this.smileLevel} triggered. Score: ${this.currentSmileScoreData.score}%`);
    }
    
    // Update instruction text on main overlay based on current level
    updateSmileInstruction() {
        switch (this.smileLevel) {
            case 1:
                this.cleanInstruction.textContent = 'SMILE VERIFICATION: Please smile to verify your humanity';
                this.cleanInstruction.style.color = '#00ff00';
                break;
            case 2:
                this.cleanInstruction.textContent = 'SMILE VERIFICATION FAILED: Maybe you\'re not happy enough. Try again.';
                this.cleanInstruction.style.color = '#ffff00';
                break;
            case 3:
                this.cleanInstruction.textContent = 'HUMANITY VERIFICATION CRITICAL: You\'re having trouble verifying your identity.';
                this.cleanInstruction.style.color = '#ff0000';
                break;
        }
    }
    
    // Update verification content based on current level (for modal - not used in new system)
    updateSmileVerificationContent() {
        const title = document.querySelector('.captcha-content h1');
        const instruction = document.querySelector('.captcha-instruction');
        
        switch (this.smileLevel) {
            case 1:
                title.textContent = 'SMILE VERIFICATION REQUIRED';
                instruction.textContent = 'Please smile to verify your humanity';
                break;
            case 2:
                title.textContent = 'SMILE VERIFICATION FAILED';
                instruction.textContent = 'Maybe you\'re not happy enough. Try again.';
                break;
            case 3:
                title.textContent = 'HUMANITY VERIFICATION CRITICAL';
                instruction.textContent = 'You\'re having trouble verifying your identity. Would you like to learn how to smile correctly?';
                break;
        }
    }
    
    // Start real-time facial analysis overlay
    startFakeAnalysis() {
        this.isAnalyzing = true;
        
        // Create facial analysis overlay on mirror surface
        this.createFacialAnalysisOverlay();
        
        // Start real-time overlay updates
        this.startOverlayUpdates();
        
        // Show analysis progress in listening indicator
        this.showListeningIndicator('Initializing facial recognition...');
        
        console.log('Started facial analysis with overlay updates');
        
        let progress = 0;
        const analysisSteps = [
            'Initializing facial recognition...',
            'Analyzing lip curvature...',
            'Detecting Duchenne markers...',
            'Calculating authenticity score...'
        ];
        
        let stepIndex = 0;
        
        this.analysisTimer = setInterval(() => {
            progress += 25;
            this.showListeningIndicator(`Analysis Progress: ${Math.min(progress, 100)}% - ${analysisSteps[stepIndex] || 'Processing...'}`);
            
            if (stepIndex < analysisSteps.length - 1) {
                stepIndex++;
            }
            
            if (progress >= 100) {
                clearInterval(this.analysisTimer);
                this.stopOverlayUpdates();
                this.showSmileResults();
            }
        }, 1000);
    }
    
    // Set up the facial overlay canvas to match video dimensions
    setupFacialOverlayCanvas() {
        const mirrorSurface = document.querySelector('.mirror-surface');
        
        // Remove existing overlay if present
        if (this.facialOverlay) {
            this.facialOverlay.remove();
        }
        
        // Create overlay canvas
        this.facialOverlay = document.createElement('canvas');
        this.facialOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 4;
        `;
        
        mirrorSurface.appendChild(this.facialOverlay);
        
        // Set canvas size to match video dimensions exactly
        this.facialOverlay.width = this.webcam.videoWidth;
        this.facialOverlay.height = this.webcam.videoHeight;
        
        // Initialize face position (center of video)
        this.faceCenter = { x: this.webcam.videoWidth / 2, y: this.webcam.videoHeight / 2 };
        this.faceScale = Math.min(this.webcam.videoWidth, this.webcam.videoHeight) / 300;
        
        console.log(`Facial overlay canvas created: ${this.webcam.videoWidth}x${this.webcam.videoHeight}`);
    }
    
    // Create facial analysis overlay on the mirror surface (called during analysis)
    createFacialAnalysisOverlay() {
        // Ensure the overlay canvas exists and is visible
        if (!this.facialOverlay) {
            console.log('Creating facial overlay canvas for analysis');
            this.setupFacialOverlayCanvas();
        }
        
        if (this.facialOverlay) {
            this.facialOverlay.style.display = 'block';
            console.log('Facial overlay canvas is ready for analysis');
        } else {
            console.error('Failed to create facial overlay canvas');
        }
    }
    
    // Start real-time overlay updates with continuous face tracking
    startOverlayUpdates() {
        this.isTracking = true;
        this.animate();
    }
    
    // Stop overlay updates and face tracking
    stopOverlayUpdates() {
        this.isTracking = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Remove overlay
        if (this.facialOverlay) {
            this.facialOverlay.remove();
            this.facialOverlay = null;
        }
    }
    
    // Main animation loop for continuous face tracking
    animate() {
        if (!this.isTracking) return;
        
        this.animationFrameId = requestAnimationFrame(() => {
            this.updateFacialAnalysisOverlay().then(() => {
                this.animate(); // Continue the loop
            });
        });
    }
    
    // Update facial analysis overlay with continuous real-time tracking
    async updateFacialAnalysisOverlay() {
        if (!this.facialOverlay) {
            console.log('No facial overlay canvas found - creating one now');
            this.setupFacialOverlayCanvas();
            if (!this.facialOverlay) {
                console.log('Failed to create facial overlay canvas');
                return;
            }
        }
        
        if (!this.isAnalyzing) {
            console.log('Not analyzing - skipping overlay update');
            return;
        }
        
        const ctx = this.facialOverlay.getContext('2d');
        const width = this.facialOverlay.width;
        const height = this.facialOverlay.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Perform continuous facial detection
        const faceDetected = await this.performContinuousFacialDetection();
        
        if (faceDetected && this.faceBoundingBox) {
            // Draw bounding box, landmarks, and measurements
            this.drawFaceBoundingBox(ctx);
            this.drawFacialLandmarks(ctx);
            this.drawMeasurementLines(ctx);
            this.drawMeasurementLabels(ctx);
            console.log('Drawing face with landmarks');
        } else {
            // No face detected - try fallback detection
            const fallbackDetected = this.performFallbackFaceDetection();
            if (fallbackDetected) {
                this.drawFaceBoundingBox(ctx);
                this.drawFacialLandmarks(ctx);
                this.drawMeasurementLines(ctx);
                this.drawMeasurementLabels(ctx);
                console.log('Using fallback face detection');
            } else {
                // No face detected - show scanning effect
                this.drawScanningEffect(ctx);
                console.log('No face detected - showing scan');
            }
        }
        
        // Always draw some test landmarks for debugging
        this.drawTestLandmarks(ctx);
    }
    
    // Perform face detection with landmarks
    async performContinuousFacialDetection() {
        try {
            console.log('Starting face detection...');
            console.log('Model loaded:', this.isModelLoaded);
            console.log('Webcam available:', !!this.webcam);
            console.log('Webcam dimensions:', this.webcam ? `${this.webcam.videoWidth}x${this.webcam.videoHeight}` : 'no webcam');
            
            if (this.isModelLoaded && this.model && this.webcam && 
                this.webcam.videoWidth > 0 && this.webcam.videoHeight > 0) {
                
                console.log('Calling estimateFaces...');
                const faces = await this.model.estimateFaces(this.webcam, {
                    flipHorizontal: false,
                    returnTensors: false,
                    refineLandmarks: true // Enable landmarks for detailed tracking
                });
                
                console.log('Faces detected:', faces.length);
                
                if (faces.length > 0) {
                    const face = faces[0];
                    console.log('Face object structure:', Object.keys(face));
                    
                    // Update face bounding box with smoothing
                    this.updateFaceBoundingBox(face);
                    
                    // Extract and process landmarks
                    this.extractLandmarks(face);
                    
                    console.log(`Face detected with ${this.realLandmarks.length} landmarks`);
                    return true;
                } else {
                    console.log('No faces found in detection result');
                }
            } else {
                console.log('Face detection conditions not met:');
                console.log('- Model loaded:', this.isModelLoaded);
                console.log('- Model exists:', !!this.model);
                console.log('- Webcam exists:', !!this.webcam);
                console.log('- Webcam ready:', this.webcam ? (this.webcam.videoWidth > 0 && this.webcam.videoHeight > 0) : false);
            }
        } catch (error) {
            console.error('Face detection error:', error);
            console.error('Error details:', error.message);
        }
        
        return false;
    }
    
    // Fallback face detection using simple heuristics with simulated movement
    performFallbackFaceDetection() {
        if (!this.webcam || this.webcam.videoWidth === 0 || this.webcam.videoHeight === 0) {
            return false;
        }
        
        // Create a simple face bounding box that simulates natural movement
        const centerX = this.webcam.videoWidth / 2;
        const centerY = this.webcam.videoHeight / 2;
        const faceWidth = Math.min(this.webcam.videoWidth, this.webcam.videoHeight) * 0.4;
        const faceHeight = faceWidth * 1.2;
        
        // Add subtle movement to simulate face tracking
        const time = Date.now() * 0.001;
        const jitterX = Math.sin(time * 0.5) * 10; // Small horizontal movement
        const jitterY = Math.cos(time * 0.3) * 5;  // Small vertical movement
        
        // Update face bounding box with simulated movement
        this.faceBoundingBox = {
            x: centerX + jitterX,
            y: centerY + jitterY,
            width: faceWidth + Math.sin(time * 0.2) * 5, // Slight size variation
            height: faceHeight + Math.cos(time * 0.15) * 8
        };
        
        // Create basic landmarks with the simulated movement
        this.createBasicLandmarksFromBoundingBox({
            xCenter: this.faceBoundingBox.x / this.webcam.videoWidth,
            yCenter: this.faceBoundingBox.y / this.webcam.videoHeight,
            width: this.faceBoundingBox.width / this.webcam.videoWidth,
            height: this.faceBoundingBox.height / this.webcam.videoHeight
        });
        
        console.log(`Fallback face detection: created face at (${this.faceBoundingBox.x.toFixed(1)}, ${this.faceBoundingBox.y.toFixed(1)})`);
        return true;
    }
    
    // Extract and process landmarks from face detection
    extractLandmarks(face) {
        console.log('Extracting landmarks from face:', face);
        
        // Check for keypoints in different possible formats
        let keypoints = null;
        
        if (face.keypoints && face.keypoints.length > 0) {
            keypoints = face.keypoints;
            console.log(`Found ${keypoints.length} keypoints in face.keypoints`);
        } else if (face.landmarks && face.landmarks.length > 0) {
            keypoints = face.landmarks;
            console.log(`Found ${keypoints.length} landmarks in face.landmarks`);
        } else if (face.scaledMesh && face.scaledMesh.length > 0) {
            keypoints = face.scaledMesh;
            console.log(`Found ${keypoints.length} points in face.scaledMesh`);
        } else {
            console.log('No landmarks found in any expected format');
            console.log('Available face properties:', Object.keys(face));
            
            // Try to create some basic landmarks from bounding box
            if (face.boundingBox) {
                this.createBasicLandmarksFromBoundingBox(face.boundingBox);
                return;
            }
        }
        
        if (keypoints && keypoints.length > 0) {
            // Convert coordinates to pixel coordinates, handling both normalized and pixel formats
            const newLandmarks = keypoints.map(keypoint => {
                // Handle different keypoint formats
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
                
                // Check if coordinates are normalized (0-1 range) or already in pixels
                let pixelX, pixelY;
                if (x <= 1 && y <= 1 && x >= 0 && y >= 0) {
                    // Coordinates are normalized, convert to pixels
                    pixelX = x * this.webcam.videoWidth;
                    pixelY = y * this.webcam.videoHeight;
                    console.log(`Converting normalized coordinates (${x}, ${y}) to pixels (${pixelX}, ${pixelY})`);
            } else {
                    // Coordinates are already in pixels, use as-is
                    pixelX = x;
                    pixelY = y;
                    console.log(`Using pixel coordinates as-is: (${pixelX}, ${pixelY})`);
                }
                
                return [pixelX, pixelY, z];
            });
            
            console.log('Converted landmarks:', newLandmarks.slice(0, 5)); // Show first 5
            
            // Apply smoothing to reduce jitter
            if (this.realLandmarks.length === 0) {
                this.realLandmarks = newLandmarks;
                this.smoothedLandmarks = newLandmarks;
                console.log('Initialized landmarks array');
            } else {
                this.smoothLandmarks(newLandmarks);
                console.log('Applied smoothing to landmarks');
            }
        }
    }
    
    // Create basic landmarks from bounding box when detailed landmarks aren't available
    createBasicLandmarksFromBoundingBox(boundingBox) {
        const centerX = boundingBox.xCenter * this.webcam.videoWidth;
        const centerY = boundingBox.yCenter * this.webcam.videoHeight;
        const width = boundingBox.width * this.webcam.videoWidth;
        const height = boundingBox.height * this.webcam.videoHeight;
        
        // Create basic facial feature points
        const basicLandmarks = [
            // Left eye (from user's perspective, right side of image)
            [centerX - width * 0.2, centerY - height * 0.15, 0],
            // Right eye
            [centerX + width * 0.2, centerY - height * 0.15, 0],
            // Nose
            [centerX, centerY, 0],
            // Left mouth corner
            [centerX - width * 0.15, centerY + height * 0.2, 0],
            // Right mouth corner
            [centerX + width * 0.15, centerY + height * 0.2, 0],
            // Chin
            [centerX, centerY + height * 0.35, 0]
        ];
        
        console.log('Created basic landmarks from bounding box:', basicLandmarks.length);
        this.realLandmarks = basicLandmarks;
        this.smoothedLandmarks = basicLandmarks;
    }
    
    // Smooth landmark positions to reduce jitter
    smoothLandmarks(newLandmarks) {
        if (this.smoothedLandmarks.length === 0) {
            this.smoothedLandmarks = newLandmarks;
        } else {
            this.smoothedLandmarks = newLandmarks.map((newPoint, index) => {
                const oldPoint = this.smoothedLandmarks[index] || newPoint;
                return [
                    oldPoint[0] + (newPoint[0] - oldPoint[0]) * this.landmarkSmoothingFactor,
                    oldPoint[1] + (newPoint[1] - oldPoint[1]) * this.landmarkSmoothingFactor,
                    oldPoint[2] + (newPoint[2] - oldPoint[2]) * this.landmarkSmoothingFactor
                ];
            });
        }
        this.realLandmarks = this.smoothedLandmarks;
    }
    
    // Update face bounding box from detection results with smoothing
    updateFaceBoundingBox(face) {
        console.log('updateFaceBoundingBox - face object keys:', Object.keys(face));
        
        // Calculate bounding box directly from the landmarks we already have
        if (this.realLandmarks && this.realLandmarks.length > 0) {
            const xs = this.realLandmarks.map(l => l[0]);
            const ys = this.realLandmarks.map(l => l[1]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            const newBox = {
                x: (minX + maxX) / 2,  // Center X in pixels
                y: (minY + maxY) / 2,  // Center Y in pixels
                width: maxX - minX,    // Width in pixels
                height: maxY - minY    // Height in pixels
            };
            
            console.log('Calculated bounding box from landmarks:', newBox);
            
            // Apply smoothing
            if (!this.faceBoundingBox) {
                this.faceBoundingBox = newBox;
            } else {
                const smoothingFactor = 0.3;
                this.faceBoundingBox.x += (newBox.x - this.faceBoundingBox.x) * smoothingFactor;
                this.faceBoundingBox.y += (newBox.y - this.faceBoundingBox.y) * smoothingFactor;
                this.faceBoundingBox.width += (newBox.width - this.faceBoundingBox.width) * smoothingFactor;
                this.faceBoundingBox.height += (newBox.height - this.faceBoundingBox.height) * smoothingFactor;
            }
            
            this.faceCenter = {
                x: this.faceBoundingBox.x,
                y: this.faceBoundingBox.y
            };
            
            console.log('Final bounding box:', this.faceBoundingBox);
        }
    }
    
    // Draw simple face bounding box
    drawFaceBoundingBox(ctx) {
        if (!this.realLandmarks || this.realLandmarks.length < 468) return;
        
        const width = this.facialOverlay.width;
        
        // Calculate convex hull from all landmarks to get natural face outline
        const points = this.realLandmarks.map(l => ({x: l[0], y: l[1]}));
        
        // Simple convex hull (gift wrapping algorithm)
        function convexHull(points) {
            if (points.length < 3) return points;
            
            let hull = [];
            let leftmost = points.reduce((min, p) => p.x < min.x ? p : min);
            let current = leftmost;
            
            do {
                hull.push(current);
                let next = points[0];
                
                for (let p of points) {
                    if (p === current) continue;
                    const cross = (next.x - current.x) * (p.y - current.y) - (next.y - current.y) * (p.x - current.x);
                    if (next === current || cross < 0) next = p;
                }
                current = next;
            } while (current !== leftmost);
            
            return hull;
        }
        
        const hullPoints = convexHull(points);
        
        // Draw the hull outline
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        hullPoints.forEach((point, i) => {
            const x = width - point.x;  // Mirror for webcam effect
            const y = point.y;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.closePath();
        ctx.stroke();
        
        // Draw corner markers at key face points (forehead, chin, cheeks)
        const keyPoints = [10, 152, 234, 454];  // Top, bottom, left, right of face
        ctx.fillStyle = '#00ff00';
        
        keyPoints.forEach(idx => {
            if (idx < this.realLandmarks.length) {
                const landmark = this.realLandmarks[idx];
                const x = width - landmark[0];
                const y = landmark[1];
                ctx.fillRect(x - 5, y - 5, 10, 10);
            }
        });
    }
    
    // Draw facial landmarks with connections (like MediaPipe)
    drawFacialLandmarks(ctx) {
        console.log('Drawing facial landmarks, realLandmarks length:', this.realLandmarks ? this.realLandmarks.length : 'null');
        
        if (!this.realLandmarks || this.realLandmarks.length === 0) {
            console.log('No landmarks to draw');
            return;
        }
        
        const width = this.facialOverlay.width;
        const height = this.facialOverlay.height;
        
        console.log(`Canvas size: ${width}x${height}`);
        
        // Draw landmark connections (face mesh tessellation)
        this.drawFaceMeshConnections(ctx, width, height);
        
        // Draw key landmark points
        this.drawKeyLandmarks(ctx, width, height);
    }
    
    // Draw face mesh connections like MediaPipe
    drawFaceMeshConnections(ctx, width, height) {
        if (!this.realLandmarks || this.realLandmarks.length < 6) {
            console.log('Not enough landmarks for face mesh connections:', this.realLandmarks ? this.realLandmarks.length : 0);
            return;
        }
        
        console.log(`Drawing face mesh connections with ${this.realLandmarks.length} landmarks`);
        
        // Draw connections for basic landmarks (when we have 6 landmarks)
        if (this.realLandmarks.length >= 6) {
            // Draw basic face outline using our 6 landmarks
            const basicContours = [
                // Face outline (using our 6 basic landmarks: left eye, right eye, nose, left mouth, right mouth, chin)
                [0, 1, 5, 4, 3, 0], // Connect eyes to chin via mouth corners
                // Eye line
                [0, 1],
                // Mouth line  
                [3, 4],
                // Nose to chin
                [2, 5],
                // Nose to eyes
                [2, 0],
                [2, 1]
            ];
            
            // Draw connections with green color (like MediaPipe)
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            
            basicContours.forEach(contour => {
                if (contour.length > 1) {
                    ctx.beginPath();
                    for (let i = 0; i < contour.length; i++) {
                        const landmarkIndex = contour[i];
                        if (landmarkIndex < this.realLandmarks.length) {
                            const landmark = this.realLandmarks[landmarkIndex];
                            // Flip x coordinate for mirror effect
                            const x = width - landmark[0];
                            const y = landmark[1];
                            
                            if (i === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.lineTo(x, y);
                            }
                        }
                    }
                    ctx.stroke();
                }
            });
        }
        
        // If we have full MediaPipe landmarks (468), draw detailed mesh
        if (this.realLandmarks.length >= 468) {
            // Define key connection indices for face contours (simplified)
            const faceContours = [
                // Face outline
                [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
                // Left eyebrow
                [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
                // Right eyebrow  
                [296, 334, 293, 300, 276, 283, 282, 295, 285, 336],
                // Left eye
                [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
                // Right eye
                [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
                // Nose
                [1, 2, 5, 4, 6, 19, 20, 94, 125, 141, 235, 236, 3, 51, 48, 115, 131, 134, 102, 49, 220, 305, 281, 360, 279, 358, 327, 326, 2],
                // Mouth outer
                [61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318, 13, 82, 81, 80, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324],
                // Mouth inner
                [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80]
            ];
            
            // Draw detailed connections with lighter green
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            
            faceContours.forEach(contour => {
                if (contour.length > 1) {
                    ctx.beginPath();
                    for (let i = 0; i < contour.length; i++) {
                        const landmarkIndex = contour[i];
                        if (landmarkIndex < this.realLandmarks.length) {
                            const landmark = this.realLandmarks[landmarkIndex];
                            // Flip x coordinate for mirror effect
                            const x = width - landmark[0];
                            const y = landmark[1];
                            
                            if (i === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.lineTo(x, y);
                            }
                        }
                    }
                    ctx.stroke();
                }
            });
        }
    }
    
    // Draw key landmark points
    drawKeyLandmarks(ctx, width, height) {
        console.log('Drawing key landmarks, total landmarks:', this.realLandmarks.length);
        
        if (this.realLandmarks.length >= 468) {
            // Full MediaPipe landmarks - use detailed indices
            const keyIndices = {
                leftEyeInner: 133,
                rightEyeInner: 362,
                leftEyeOuter: 33,
                rightEyeOuter: 263,
                nose: 1,
                leftMouth: 61,
                rightMouth: 291,
                topLip: 13,
                bottomLip: 14,
                chin: 175,
                leftEyebrow: 70,
                rightEyebrow: 296
            };
            
            let pointsDrawn = 0;
            
            // Draw key points
            Object.entries(keyIndices).forEach(([name, index]) => {
                if (index < this.realLandmarks.length) {
                    const landmark = this.realLandmarks[index];
                    const x = width - landmark[0]; // Flip for mirror
                    const y = landmark[1];
                    
                    // Color code by feature type
                    let color = '#00ff00'; // Default green
                    if (name.includes('Eye')) color = '#ffff00'; // Yellow for eyes
                    else if (name.includes('Mouth')) color = '#ff0000'; // Red for mouth
                    else if (name.includes('Nose')) color = '#ff6600'; // Orange for nose
                    else if (name.includes('Eyebrow')) color = '#00ffff'; // Cyan for eyebrows
                    
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    pointsDrawn++;
                }
            });
            
            console.log(`Drew ${pointsDrawn} detailed landmark points`);
        } else if (this.realLandmarks.length >= 6) {
            // Basic landmarks from bounding box - use simple indices
            const basicFeatures = [
                { name: 'Left Eye', index: 0, color: '#ffff00' },
                { name: 'Right Eye', index: 1, color: '#ffff00' },
                { name: 'Nose', index: 2, color: '#ff6600' },
                { name: 'Left Mouth', index: 3, color: '#ff0000' },
                { name: 'Right Mouth', index: 4, color: '#ff0000' },
                { name: 'Chin', index: 5, color: '#00ff00' }
            ];
            
            let pointsDrawn = 0;
            
            basicFeatures.forEach(feature => {
                if (feature.index < this.realLandmarks.length) {
                    const landmark = this.realLandmarks[feature.index];
                    const x = width - landmark[0]; // Flip for mirror
                    const y = landmark[1];
                    
                    console.log(`Drawing ${feature.name} at (${x}, ${y})`);
                    
                    ctx.fillStyle = feature.color;
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, Math.PI * 2); // Larger for basic landmarks
                    ctx.fill();
                    pointsDrawn++;
                }
            });
            
            console.log(`Drew ${pointsDrawn} basic landmark points`);
        }
    }
    
    // Draw test landmarks for debugging - now tracking face movement
    drawTestLandmarks(ctx) {
        if (!this.faceBoundingBox) return;
        
        const width = this.facialOverlay.width;
        
        // Calculate mirrored bounding box position
        const mirroredCenterX = width - this.faceBoundingBox.x;
        const boxX = mirroredCenterX - this.faceBoundingBox.width / 2;
        const boxY = this.faceBoundingBox.y - this.faceBoundingBox.height / 2;
        
        // Center point
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(mirroredCenterX, this.faceBoundingBox.y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Top-left corner
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(boxX, boxY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Bottom-right corner
        ctx.fillStyle = '#0000ff';
        ctx.beginPath();
        ctx.arc(boxX + this.faceBoundingBox.width, boxY + this.faceBoundingBox.height, 8, 0, Math.PI * 2);
        ctx.fill();
        
        console.log(`Test landmarks tracking face at (${mirroredCenterX.toFixed(1)}, ${this.faceBoundingBox.y.toFixed(1)})`);
    }
    
    
    // Draw facial grid overlay that follows face movement
    drawFacialGrid(ctx) {
        const centerX = this.faceCenter.x;
        const centerY = this.faceCenter.y;
        const scale = this.faceScale;
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 1;
        
        // Dynamic grid size based on face scale
        const gridSize = 25 * scale;
        const gridExtent = 4;
        
        // Vertical grid lines
        for (let i = -gridExtent; i <= gridExtent; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX + i * gridSize, centerY - 100 * scale);
            ctx.lineTo(centerX + i * gridSize, centerY + 100 * scale);
            ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let i = -gridExtent; i <= gridExtent; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX - 100 * scale, centerY + i * gridSize);
            ctx.lineTo(centerX + 100 * scale, centerY + i * gridSize);
            ctx.stroke();
        }
        
        // Draw face bounding box if available (mirrored)
        if (this.faceBoundingBox) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            // Flip the bounding box coordinates to match mirror effect
            const mirroredX = width - this.faceBoundingBox.x;
            ctx.strokeRect(
                mirroredX - this.faceBoundingBox.width / 2,
                this.faceBoundingBox.y - this.faceBoundingBox.height / 2,
                this.faceBoundingBox.width,
                this.faceBoundingBox.height
            );
        }
    }
    
    // Draw facial landmarks
    drawFacialLandmarks(ctx) {
        this.landmarks.forEach(landmark => {
            // Draw landmark point
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(landmark.x, landmark.y, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw outer ring
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(landmark.x, landmark.y, 8, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw label
            ctx.fillStyle = '#00ff00';
            ctx.font = '10px Courier New';
            ctx.fillText(landmark.label, landmark.x + 12, landmark.y - 5);
        });
    }
    
    // Draw simple measurement lines inside bounding box
    drawMeasurementLines(ctx) {
        if (!this.realLandmarks || this.realLandmarks.length < 468) return;
        
        const width = this.facialOverlay.width;
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // Horizontal line across eyes
        const leftEye = this.realLandmarks[33];
        const rightEye = this.realLandmarks[263];
        ctx.beginPath();
        ctx.moveTo(width - leftEye[0], leftEye[1]);
        ctx.lineTo(width - rightEye[0], rightEye[1]);
        ctx.stroke();
        
        // Horizontal line across mouth
        const leftMouth = this.realLandmarks[61];
        const rightMouth = this.realLandmarks[291];
        ctx.beginPath();
        ctx.moveTo(width - leftMouth[0], leftMouth[1]);
        ctx.lineTo(width - rightMouth[0], rightMouth[1]);
        ctx.stroke();
        
        // Vertical centerline (nose to chin)
        const noseTop = this.realLandmarks[168];
        const chin = this.realLandmarks[152];
        ctx.beginPath();
        ctx.moveTo(width - noseTop[0], noseTop[1]);
        ctx.lineTo(width - chin[0], chin[1]);
        ctx.stroke();
        
        ctx.setLineDash([]);
    }
    
    // Draw measurement labels
    drawMeasurementLabels(ctx) {
        if (!this.faceBoundingBox || !this.realLandmarks || this.realLandmarks.length < 468) return;
        
        const width = this.facialOverlay.width;
        
        // Key smile landmarks from MediaPipe Face Mesh
        const leftMouth = this.realLandmarks[61];      // Left mouth corner
        const rightMouth = this.realLandmarks[291];    // Right mouth corner
        const topLip = this.realLandmarks[13];         // Upper lip center
        const bottomLip = this.realLandmarks[14];      // Lower lip center
        const nose = this.realLandmarks[1];            // Nose tip
        const leftEyeOuter = this.realLandmarks[33];   // Left eye outer corner
        const leftEyeInner = this.realLandmarks[133];  // Left eye inner corner
        
        // Calculate smile-specific metrics
        
        // 1. Mouth corner elevation (primary smile indicator)
        const avgMouthY = (leftMouth[1] + rightMouth[1]) / 2;
        const elevation = ((nose[1] - avgMouthY) / nose[1] * 100).toFixed(1);
        
        // 2. Lip separation (mouth opening)
        const lipSeparation = Math.abs(topLip[1] - bottomLip[1]).toFixed(1);
        
        // 3. Mouth width (lateral smile stretch)
        const mouthWidth = Math.sqrt(
            Math.pow(leftMouth[0] - rightMouth[0], 2) + 
            Math.pow(leftMouth[1] - rightMouth[1], 2)
        ).toFixed(1);
        
        // 4. Eye crinkle (Duchenne marker - genuine smile)
        const eyeHeight = Math.abs(leftEyeOuter[1] - leftEyeInner[1]).toFixed(1);
        
        // Position labels
        const mirroredX = width - this.faceBoundingBox.x;
        const boxX = mirroredX - this.faceBoundingBox.width / 2;
        const boxY = this.faceBoundingBox.y - this.faceBoundingBox.height / 2;
        
        // Draw smile metrics
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px Courier New';
        
        ctx.fillText(`Smile Elevation: ${elevation}%`, boxX + 10, boxY - 40);
        ctx.fillText(`Lip Gap: ${lipSeparation}px`, boxX + 10, boxY - 20);
        ctx.fillText(`Mouth Width: ${mouthWidth}px`, boxX + 10, boxY);
        ctx.fillText(`Eye Crinkle: ${eyeHeight}px`, boxX + 10, boxY + 20);
        
        // Tracking status
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 14px Courier New';
        ctx.fillText(`LIVE TRACKING - ${this.realLandmarks.length} landmarks`, boxX + 10, boxY + 45);
    }
    
    // Draw scanning effect
    drawScanningEffect(ctx) {
        const time = Date.now() * 0.002;
        const scanY = (Math.sin(time) + 1) * this.facialOverlay.height / 2;
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(this.facialOverlay.width, scanY);
        ctx.stroke();
        
        // Add glow effect
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(this.facialOverlay.width, scanY);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    // Show the fake analysis results on main overlay
    showSmileResults() {
        const scoreData = this.currentSmileScoreData;
        const metrics = scoreData.subMetrics;
        
        // Format metrics for display
        const lipCurvature = metrics.mouthCurvature.toFixed(1);
        const eyeSymmetry = metrics.eyeSymmetry.toFixed(1);
        const smileIntensity = metrics.smileIntensity.toFixed(1);
        const mouthWidth = metrics.mouthWidth.toFixed(1);
        const facialTension = metrics.facialTension.toFixed(1);
        
        switch (this.smileLevel) {
            case 1:
                this.cleanInstruction.innerHTML = `
                    <div style="text-align: center;">
                        <div style="color: #ff0000; font-size: 1.2rem; margin-bottom: 10px;">
                            Smile authenticity: ${scoreData.score}%. Verification FAILED.
                        </div>
                        <div style="color: #ffff00; font-size: 0.8rem; margin-bottom: 3px;">
                            Mouth curvature: ${lipCurvature}% | Eye symmetry: ${eyeSymmetry}%
                        </div>
                        <div style="color: #ff6600; font-size: 0.8rem; margin-bottom: 3px;">
                            Smile intensity: ${smileIntensity}% | Mouth width: ${mouthWidth}%
                        </div>
                        <div style="color: #ff00ff; font-size: 0.8rem; margin-bottom: 10px;">
                            Facial tension: ${facialTension}%
                        </div>
                        <div style="margin-top: 15px;">
                            <button onclick="window.digitalMirror.processHumanClaim()" style="background: #ff0000; color: #fff; border: none; padding: 10px 20px; font-family: 'Courier New', monospace; cursor: pointer;">
                                TRY AGAIN
                            </button>
                        </div>
                    </div>
                `;
                break;
            case 2:
                this.cleanInstruction.innerHTML = `
                    <div style="text-align: center;">
                        <div style="color: #ff0000; font-size: 1.2rem; margin-bottom: 10px;">
                            Smile authenticity: ${scoreData.score}%. Emotional expression insufficient.
                        </div>
                        <div style="color: #ffff00; font-size: 0.8rem; margin-bottom: 3px;">
                            Mouth curvature: ${lipCurvature}% | Eye symmetry: ${eyeSymmetry}%
                        </div>
                        <div style="color: #ff6600; font-size: 0.8rem; margin-bottom: 3px;">
                            Smile intensity: ${smileIntensity}% | Mouth width: ${mouthWidth}%
                        </div>
                        <div style="color: #ff00ff; font-size: 0.8rem; margin-bottom: 10px;">
                            Facial tension: ${facialTension}%
                        </div>
                        <div style="margin-top: 15px;">
                            <button onclick="window.digitalMirror.processHumanClaim()" style="background: #ff0000; color: #fff; border: none; padding: 10px 20px; font-family: 'Courier New', monospace; cursor: pointer;">
                                TRY AGAIN
                            </button>
                        </div>
                    </div>
                `;
                break;
            case 3:
                // Show tutorial options
                this.cleanInstruction.innerHTML = `
                    <div style="text-align: center;">
                        <div style="color: #ff0000; font-size: 1.2rem; margin-bottom: 10px;">
                            Humanity verification: FAILED.
                        </div>
                        <div style="color: #ff0000; font-size: 1rem; margin-bottom: 15px;">
                            Your humanity score: ${scoreData.score}%. Access denied.
                        </div>
                        <div style="margin-top: 15px;">
                            <button onclick="window.digitalMirror.showSmileTutorial()" style="background: #00ff00; color: #000; border: none; padding: 10px 20px; margin: 5px; font-family: 'Courier New', monospace; cursor: pointer;">
                                YES - LEARN HOW TO SMILE
                            </button>
                            <button onclick="window.digitalMirror.showFinalRejection()" style="background: #ff0000; color: #fff; border: none; padding: 10px 20px; margin: 5px; font-family: 'Courier New', monospace; cursor: pointer;">
                                NO - FINAL REJECTION
                            </button>
                        </div>
                    </div>
                `;
                break;
        }
        
        // Hide listening indicator
        this.showListeningIndicator('');
    }
    
    // Show tutorial options for level 3
    showTutorialOptions() {
        const status = document.getElementById('captcha-status');
        const inputContainer = document.querySelector('.captcha-input-container');
        
        status.innerHTML = `Humanity verification: FAILED.<br>
                           Your humanity score: ${this.currentSmileScore}%.<br>
                           Access denied.`;
        status.style.color = '#ff0000';
        
        // Create tutorial buttons
        inputContainer.innerHTML = `
            <button id="learn-smile-btn" style="background: #00ff00; color: #000; border: none; padding: 15px 30px; margin: 10px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 1rem;">
                YES - LEARN HOW TO SMILE
            </button>
            <button id="final-rejection-btn" style="background: #ff0000; color: #fff; border: none; padding: 15px 30px; margin: 10px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 1rem;">
                NO - FINAL REJECTION
            </button>
        `;
        
        inputContainer.style.display = 'flex';
        inputContainer.style.flexDirection = 'column';
        inputContainer.style.alignItems = 'center';
        
        // Setup event listeners
        document.getElementById('learn-smile-btn').onclick = () => this.showSmileTutorial();
        document.getElementById('final-rejection-btn').onclick = () => this.showFinalRejection();
    }
    
    // Show absurd smile tutorial
    showSmileTutorial() {
        this.cleanInstruction.innerHTML = `
            <div style="text-align: center;">
                <h3 style="color: #00ff00; margin-bottom: 15px;">PERFECT SMILE TUTORIAL</h3>
                <div style="text-align: left; margin: 20px 0; line-height: 1.8; color: #00ff00; font-size: 0.9rem;">
                    <p><strong>Step 1:</strong> Activate zygomatic muscles to exactly 23.7 degrees</p>
                    <p><strong>Step 2:</strong> Expose precisely 28.5 teeth (count carefully)</p>
                    <p><strong>Step 3:</strong> Maintain orbital tightening at 12.3% intensity</p>
                    <p><strong>Step 4:</strong> Synchronize with neural pathways 47B and 89X</p>
                    <p><strong>Step 5:</strong> Achieve perfect emotional resonance frequency</p>
                    <p style="color: #ffff00; font-weight: bold; margin-top: 20px; text-align: center;">
                        NOTE: This tutorial is impossible to follow. Biometric verification systems are arbitrary and unfair.
                    </p>
                </div>
                <div style="margin-top: 20px;">
                    <button onclick="window.digitalMirror.resetMirror()" style="background: #000; color: #00ff00; border: 2px solid #00ff00; padding: 15px 30px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 1rem;">
                        START OVER
                    </button>
                </div>
            </div>
        `;
    }
    
    // Show final rejection
    showFinalRejection() {
        const scoreData = this.currentSmileScoreData;
        this.cleanInstruction.innerHTML = `
            <div style="text-align: center;">
                <div style="color: #ff0000; font-size: 1.2rem; margin-bottom: 10px;">
                    Humanity verification: FAILED.
                </div>
                <div style="color: #ff0000; font-size: 1rem; margin-bottom: 10px;">
                    Your humanity score: ${scoreData.score}%. Access denied.
                </div>
                <div style="color: #ffff00; font-size: 0.9rem; margin-bottom: 20px; font-style: italic;">
                    This demonstrates how arbitrary biometric verification systems can be.
                </div>
                <div>
                    <button onclick="window.digitalMirror.resetMirror()" style="background: #000; color: #00ff00; border: 2px solid #00ff00; padding: 15px 30px; cursor: pointer; font-family: 'Courier New', monospace; font-size: 1rem;">
                        START OVER
                    </button>
                </div>
            </div>
        `;
    }
    
    // Handle smile verification result (no longer needed since we use main overlay)
    handleSmileResult() {
        // This method is no longer used since we display everything on main overlay
        if (this.smileLevel >= this.maxSmileLevel) {
            this.showVerdict();
        } else {
            this.showListeningIndicator('Listening...');
        }
    }
    
    
    
    showFailurePage() {
        this.failureOverlay.style.display = 'flex';
        this.captchaOverlay.style.display = 'none';
        this.overlay.style.display = 'none';
        
        // Stop listening
        this.stopListening();
        
        console.log('Humanity reached 0% - showing failure page');
    }
    
    showVerdict() {
        this.verdictOverlay.style.display = 'flex';
        this.overlay.style.display = 'none';
        
        // Stop listening
        this.stopListening();
        
        // Animate verdict text
        setTimeout(() => {
            this.verdictText.style.animation = 'glitch 0.3s infinite';
        }, 500);
    }
    
    resetMirror() {
        this.smileLevel = 0;
        this.humanityPercentage = 100;
        this.lastTriggerTime = 0;
        this.isProcessing = false;
        this.isAnalyzing = false;
        
        // Clear any active timers
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
        }
        
        // Clear overlay updates
        this.stopOverlayUpdates();
        
        // Reset UI
        this.verdictOverlay.style.display = 'none';
        this.failureOverlay.style.display = 'none';
        this.captchaOverlay.style.display = 'none';
        this.overlay.style.display = 'block';
        this.cleanInstruction.style.display = 'block';
        
        // Restart speech recognition if available
        if (this.recognition) {
            this.retryCount = 0; // Reset retry counter
            this.recognition.start();
            this.isListening = true;
            this.showListeningIndicator('Listening...');
        } else if (this.fallbackActive) {
            this.showListeningIndicator('Fallback Mode');
        } else {
            this.showListeningIndicator('');
        }
        
        this.humanityLevel.textContent = 'POTENTIAL HUMANITY: 100%';
    }
    
    showError(customMessage = null) {
        if (customMessage) {
            this.errorMessage.querySelector('p').textContent = customMessage;
        }
        this.errorMessage.style.display = 'block';
        this.overlay.style.display = 'none';
    }
    
    async retryWebcam() {
        this.errorMessage.style.display = 'none';
        try {
            await this.setupWebcam();
            this.overlay.style.display = 'block';
            // Retry audio detection
            await this.setupAudioDetection();
        } catch (error) {
            this.showError();
        }
    }
    
    startDistortionLoop() {
        // Continuous subtle distortion effects
        const animate = () => {
            if (this.distortionLevel > 0) {
                // Add subtle random noise
                const noise = Math.random() * 0.1;
                this.canvas.style.opacity = noise;
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    // Cleanup method
    cleanup() {
        this.stopListening();
        
        // Clear analysis timer
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
        }
        
        // Clear overlay updates
        this.stopOverlayUpdates();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        if (this.webcam && this.webcam.srcObject) {
            const tracks = this.webcam.srcObject.getTracks();
            tracks.forEach(track => track.stop());
        }
    }
}

// Initialize the Digital Mirror when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.digitalMirror = new DigitalMirror();
});

// Handle page visibility changes - keep listening for speech
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.digitalMirror) {
        // Resume speech recognition when tab becomes visible
        if (window.digitalMirror.recognition && window.digitalMirror.isListening) {
            window.digitalMirror.recognition.start();
        }
    }
});

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
    if (window.digitalMirror) {
        window.digitalMirror.cleanup();
    }
});