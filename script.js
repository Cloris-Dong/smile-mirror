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
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.aiAssistant = document.getElementById('ai-assistant');
        this.aiMessage = document.getElementById('ai-message');
        this.aiWaveform = document.getElementById('ai-waveform');
        
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
        
        // Smoothed metric values for realistic behavior
        this.smoothedMetrics = {
            muscleActivation: 0,
            facialSymmetry: 0,
            joyDetection: 0
        };
        this.metricSmoothingFactor = 0.3; // Lower = smoother transitions
        
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
        testButton.innerHTML = 'Skip';
        testButton.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            color: #06c;
            border: none;
            padding: 10px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
            cursor: pointer;
            z-index: 1000;
            font-weight: 510;
            font-size: 0.875rem;
            letter-spacing: -0.01em;
            border-radius: 980px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        `;
        
        // Add hover effects
        testButton.addEventListener('mouseenter', () => {
            testButton.style.background = 'rgba(255, 255, 255, 0.98)';
            testButton.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.12)';
            testButton.style.transform = 'scale(1.02)';
        });
        
        testButton.addEventListener('mouseleave', () => {
            testButton.style.background = 'rgba(255, 255, 255, 0.92)';
            testButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
            testButton.style.transform = 'scale(1)';
        });
        
        testButton.onclick = () => {
            console.log('Skip button clicked - triggering smile verification');
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
        
        // If this is the first claim (smileLevel 0), transition from welcome to gatekeeper
        if (this.smileLevel === 0) {
            // Hide welcome screen
            if (this.welcomeScreen) {
                this.welcomeScreen.classList.add('hidden');
            }
            
            // Phase 1: Acknowledge statement
            this.humanityLevel.textContent = 'Received';
            this.updateAIMessage('Statement received. Let\'s confirm that.');
            this.showListeningIndicator('Processing...');
            
            // Phase 2: After a few seconds, prompt for smile
            setTimeout(() => {
                this.humanityLevel.textContent = 'Verifying';
                this.updateAIMessage('verifying through a smile input');
                this.showListeningIndicator('Preparing...');
                
                // Phase 3: Start measuring smile
                setTimeout(() => {
                    this.smileLevel++;
                    this.humanityPercentage = Math.max(0, 100 - (this.smileLevel * 25));
                    this.updateHumanityLevel();
                    this.updateAIMessage('Hold that smile...');
                    this.showListeningIndicator('Analyzing...');
                    
                    this.triggerSmileVerification();
                }, 1500);
            }, 2500);
            return;
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
        // Update verification status display with playful messages
        const statusText = this.humanityPercentage === 100 ? 'Welcome' :
                          this.humanityPercentage === 75 ? 'Analyzing...' :
                          this.humanityPercentage === 50 ? 'Hmm...' :
                          this.humanityPercentage === 25 ? 'Not quite' : 'Failed';
        
        this.humanityLevel.textContent = statusText;
        
        // Check if verification failed
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
    
    // Update AI assistant message
    updateAIMessage(message, speaking = true) {
        if (this.aiMessage) {
            this.aiMessage.textContent = message;
        }
        
        // Animate waveform when speaking
        if (this.aiWaveform) {
            if (speaking) {
                this.aiWaveform.classList.add('speaking');
                // Remove speaking class after message duration
                setTimeout(() => {
                    this.aiWaveform.classList.remove('speaking');
                }, 2000);
            } else {
                this.aiWaveform.classList.remove('speaking');
            }
        }
    }
    
    // Update instruction text on main overlay based on current level
    updateSmileInstruction() {
        switch (this.smileLevel) {
            case 1:
                // Already set in processHumanClaim - analyzing first smile
                this.updateAIMessage('Hold that smile...');
                break;
            case 2:
                this.updateAIMessage('I\'m not convinced. Try that again.');
                break;
            case 3:
                this.updateAIMessage('Still not buying it. One more time.');
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
            progress += 14.3; // ~7 seconds total (100/14.3 ≈ 7)
            this.showListeningIndicator(`Analyzing: ${Math.min(progress, 100).toFixed(0)}%`);
            
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
    
    // Draw simple face bounding box with clean Apple style
    drawFaceBoundingBox(ctx) {
        if (!this.realLandmarks || this.realLandmarks.length < 468) return;
        
        const width = this.facialOverlay.width;
        
        // Calculate bounding box from landmarks
        const xs = this.realLandmarks.map(l => l[0]);
        const ys = this.realLandmarks.map(l => l[1]);
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
        ctx.strokeStyle = 'rgba(0, 122, 255, 0.6)'; // Apple blue
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
    
    // Draw minimal key points only - no mesh connections
    drawFaceMeshConnections(ctx, width, height) {
        // Don't draw mesh connections for cleaner Apple aesthetic
        // Only key points will be drawn in drawKeyLandmarks
        return;
    }
    
    // Draw minimal key landmark points with Apple style
    drawKeyLandmarks(ctx, width, height) {
        console.log('Drawing key landmarks, total landmarks:', this.realLandmarks.length);
        
        if (this.realLandmarks.length >= 468) {
            // Only draw mouth corners for smile detection
            const keyIndices = {
                leftMouth: 61,
                rightMouth: 291,
                topLip: 13,
                bottomLip: 14
            };
            
            // Draw subtle dots
            Object.entries(keyIndices).forEach(([name, index]) => {
                if (index < this.realLandmarks.length) {
                    const landmark = this.realLandmarks[index];
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
    }
    
    // Draw test landmarks for debugging - disabled for clean look
    drawTestLandmarks(ctx) {
        // Test landmarks removed for cleaner Apple aesthetic
        return;
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
    
    // Draw simple measurement lines - minimal Apple style
    drawMeasurementLines(ctx) {
        // Don't draw measurement lines for cleaner look
        // Metrics will be shown as energy bars instead
        return;
    }
    
    // Draw measurement as energy bars - Apple style
    drawMeasurementLabels(ctx) {
        if (!this.faceBoundingBox || !this.realLandmarks || this.realLandmarks.length < 468) return;
        
        const width = this.facialOverlay.width;
        
        // Key smile landmarks
        const leftMouth = this.realLandmarks[61];
        const rightMouth = this.realLandmarks[291];
        const topLip = this.realLandmarks[13];
        const bottomLip = this.realLandmarks[14];
        const nose = this.realLandmarks[1];
        
        // Calculate metrics (0-100 scale)
        const avgMouthY = (leftMouth[1] + rightMouth[1]) / 2;
        const rawSmileIntensity = Math.max(0, Math.min(100, ((nose[1] - avgMouthY) / nose[1] * 200)));
        const lipSeparation = Math.max(0, Math.min(100, Math.abs(topLip[1] - bottomLip[1]) * 2));
        const mouthWidth = Math.max(0, Math.min(100, Math.sqrt(
            Math.pow(leftMouth[0] - rightMouth[0], 2) + 
            Math.pow(leftMouth[1] - rightMouth[1], 2)
        ) / 2));
        
        // Get additional landmarks for symmetry and joy detection
        const leftEyeOuter = this.realLandmarks[33];
        const rightEyeOuter = this.realLandmarks[263];
        const leftEyeInner = this.realLandmarks[133];
        const rightEyeInner = this.realLandmarks[362];
        
        // Calculate facial symmetry based on left-right balance
        const leftMouthElevation = nose[1] - leftMouth[1];
        const rightMouthElevation = nose[1] - rightMouth[1];
        const mouthSymmetry = 100 - Math.abs(leftMouthElevation - rightMouthElevation) * 2;
        
        const leftEyeWidth = this.distance(leftEyeInner, leftEyeOuter);
        const rightEyeWidth = this.distance(rightEyeInner, rightEyeOuter);
        const eyeSymmetry = 100 - Math.abs(leftEyeWidth - rightEyeWidth) / Math.max(leftEyeWidth, rightEyeWidth) * 100;
        
        const rawFacialSymmetry = (mouthSymmetry + eyeSymmetry) / 2;
        
        // Calculate joy detection based on eye crinkle (Duchenne marker)
        const leftEyeTop = this.realLandmarks[159];
        const leftEyeBottom = this.realLandmarks[145];
        const rightEyeTop = this.realLandmarks[386];
        const rightEyeBottom = this.realLandmarks[374];
        
        const leftEyeHeight = Math.abs(leftEyeTop[1] - leftEyeBottom[1]);
        const rightEyeHeight = Math.abs(rightEyeTop[1] - rightEyeBottom[1]);
        const eyeCrinkle = Math.max(0, 100 - (leftEyeHeight + rightEyeHeight) * 5);
        
        const rawJoyDetection = (eyeCrinkle + rawSmileIntensity) / 2;
        
        // Add realistic variance and noise
        const time = Date.now() * 0.001;
        const microVariation = () => (Math.random() - 0.5) * 1.5; // ±0.75% random noise
        
        // Calculate raw target values with realistic ranges
        let targetMuscleActivation = Math.max(55, Math.min(79, (rawSmileIntensity + mouthWidth) / 2 + 25));
        let targetFacialSymmetry = Math.max(60, Math.min(78, rawFacialSymmetry * 0.7 + 15));
        let targetJoyDetection = Math.max(50, Math.min(77, rawJoyDetection * 0.7 + 15));
        
        // Add correlation between metrics (realistic: they should influence each other)
        // When smiling, symmetry tends to decrease slightly (faces aren't perfectly symmetric when expressing)
        const expressionPenalty = rawSmileIntensity * 0.05;
        targetFacialSymmetry = Math.max(60, targetFacialSymmetry - expressionPenalty);
        
        // Joy detection correlates with muscle activation (genuine smiles engage both)
        const joyMuscleCorrelation = targetMuscleActivation * 0.15;
        targetJoyDetection = Math.max(50, Math.min(77, targetJoyDetection + joyMuscleCorrelation - 10));
        
        // Apply temporal smoothing (realistic: values don't jump instantly)
        if (!this.smoothedMetrics.muscleActivation) {
            // Initialize on first run
            this.smoothedMetrics.muscleActivation = targetMuscleActivation;
            this.smoothedMetrics.facialSymmetry = targetFacialSymmetry;
            this.smoothedMetrics.joyDetection = targetJoyDetection;
        } else {
            // Smooth transition to new values
            this.smoothedMetrics.muscleActivation += (targetMuscleActivation - this.smoothedMetrics.muscleActivation) * this.metricSmoothingFactor;
            this.smoothedMetrics.facialSymmetry += (targetFacialSymmetry - this.smoothedMetrics.facialSymmetry) * this.metricSmoothingFactor;
            this.smoothedMetrics.joyDetection += (targetJoyDetection - this.smoothedMetrics.joyDetection) * this.metricSmoothingFactor;
        }
        
        // Final values with micro-variations for realism
        const muscleActivation = Math.max(55, Math.min(79, this.smoothedMetrics.muscleActivation + microVariation()));
        const facialSymmetry = Math.max(60, Math.min(78, this.smoothedMetrics.facialSymmetry + microVariation()));
        const joyDetection = Math.max(50, Math.min(77, this.smoothedMetrics.joyDetection + microVariation()));
        
        // Position for energy bars
        const mirroredX = width - this.faceBoundingBox.x;
        const boxX = mirroredX - this.faceBoundingBox.width / 2;
        const boxY = this.faceBoundingBox.y + this.faceBoundingBox.height / 2 + 20;
        
        const barWidth = this.faceBoundingBox.width - 40;
        const barHeight = 10;
        const barSpacing = 32;
        
        const metrics = [
            { label: 'Muscle Activation', value: muscleActivation, color: '#007AFF' },
            { label: 'Facial Symmetry', value: facialSymmetry, color: '#5856D6' },
            { label: 'Joy Detection', value: joyDetection, color: '#FF2D55' }
        ];
        
        // Calculate overall score (average of all metrics, capped to always fail)
        const rawOverallScore = (muscleActivation + facialSymmetry + joyDetection) / 3;
        const overallScore = Math.min(79, rawOverallScore); // Always cap at 79% (just 1% short!)
        const passingThreshold = 80; // Need 80% to pass
        
        // Draw OVERALL SCORE BAR at top of screen (bigger and more prominent)
        const topMargin = 80;
        const overallBarWidth = width * 0.85;
        const overallBarX = (width - overallBarWidth) / 2;
        const overallY = topMargin;
        const overallBarHeight = 20;
        
        // Overall score label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '700 20px -apple-system, BlinkMacSystemFont, SF Pro Display';
        ctx.textAlign = 'center';
        ctx.fillText('SMILING SCORE', width / 2, overallY - 16);
        ctx.textAlign = 'left';
        
        // Background bar with border
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.roundRect(overallBarX, overallY, overallBarWidth, overallBarHeight, overallBarHeight / 2);
        ctx.fill();
        
        // Add subtle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(overallBarX, overallY, overallBarWidth, overallBarHeight, overallBarHeight / 2);
        ctx.stroke();
        
        // Progress bar with color based on score
        const overallProgressWidth = (overallBarWidth * overallScore) / 100;
        let overallColor1 = '#FF375F'; // Vibrant red
        let overallColor2 = '#FF1744';
        if (overallScore >= passingThreshold) {
            overallColor1 = '#30D158'; // Vibrant green if passing
            overallColor2 = '#30D158';
        } else if (overallScore >= 60) {
            overallColor1 = '#FF9F0A'; // Vibrant orange if close
            overallColor2 = '#FF9500';
        }
        
        const overallGradient = ctx.createLinearGradient(overallBarX, 0, overallBarX + overallProgressWidth, 0);
        overallGradient.addColorStop(0, overallColor1);
        overallGradient.addColorStop(1, overallColor2);
        
        // Add glow effect
        ctx.shadowColor = overallColor1;
        ctx.shadowBlur = 12;
        
        ctx.fillStyle = overallGradient;
        ctx.beginPath();
        ctx.roundRect(overallBarX, overallY, overallProgressWidth, overallBarHeight, overallBarHeight / 2);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Percentage
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '700 18px -apple-system, BlinkMacSystemFont, SF Pro Display';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(overallScore)}%`, width / 2, overallY + overallBarHeight + 24);
        ctx.textAlign = 'left';
        
        // Draw passing threshold line (more visible)
        const thresholdX = overallBarX + (overallBarWidth * passingThreshold / 100);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(thresholdX, overallY - 12);
        ctx.lineTo(thresholdX, overallY + overallBarHeight + 12);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw "PASS" marker at threshold with background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.roundRect(thresholdX - 22, overallY - 26, 44, 18, 9);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = '700 13px -apple-system, BlinkMacSystemFont, SF Pro Text';
        ctx.textAlign = 'center';
        ctx.fillText('PASS', thresholdX, overallY - 14);
        ctx.textAlign = 'left';
        
        // Draw individual metric bars (smaller, below overall)
        metrics.forEach((metric, index) => {
            const y = boxY + 30 + (index * barSpacing);
            
            // Draw label with shadow for visibility
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
            ctx.font = '600 16px -apple-system, BlinkMacSystemFont, SF Pro Text';
            ctx.fillText(metric.label, boxX + 20, y - 10);
            ctx.shadowBlur = 0;
            
            // Draw background bar
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, barWidth, barHeight, barHeight / 2);
            ctx.fill();
            
            // Draw progress bar with gradient
            const progressWidth = (barWidth * metric.value) / 100;
            const gradient = ctx.createLinearGradient(boxX + 20, 0, boxX + 20 + progressWidth, 0);
            gradient.addColorStop(0, metric.color);
            gradient.addColorStop(1, metric.color + 'CC');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, progressWidth, barHeight, barHeight / 2);
            ctx.fill();
            
            // Draw percentage with shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
            ctx.font = '700 15px -apple-system, BlinkMacSystemFont, SF Pro Text';
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(metric.value)}%`, boxX + 20 + barWidth + 40, y + 8);
            ctx.textAlign = 'left';
            ctx.shadowBlur = 0;
        });
    }
    
    // Draw scanning effect - Apple style
    drawScanningEffect(ctx) {
        const time = Date.now() * 0.001;
        const scanY = (Math.sin(time) + 1) * this.facialOverlay.height / 2;
        
        // Draw subtle scanning line
        ctx.strokeStyle = 'rgba(0, 122, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(this.facialOverlay.width, scanY);
        ctx.stroke();
        
        // Add subtle glow
        ctx.shadowColor = 'rgba(0, 122, 255, 0.6)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(this.facialOverlay.width, scanY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw "Analyzing..." text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '510 14px -apple-system, BlinkMacSystemFont, SF Pro Text';
        ctx.textAlign = 'center';
        ctx.fillText('Searching for face...', this.facialOverlay.width / 2, this.facialOverlay.height / 2);
        ctx.textAlign = 'left';
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
                this.updateAIMessage(`That's not passing. Score: ${scoreData.score}%. That smile doesn't look genuine to me.`);
                // Show prompt to try again after delay
                setTimeout(() => {
                    this.updateAIMessage(`Say "I am human" to try again.`);
                }, 2500);
                break;
            case 2:
                this.updateAIMessage(`I'm still not seeing it. Score: ${scoreData.score}%. Look, I need to see real human emotion here.`);
                // Show prompt to try again after delay
                setTimeout(() => {
                    this.updateAIMessage(`Say "I am human" once more.`);
                }, 2500);
                break;
            case 3:
                // Show tutorial options
                this.updateAIMessage(`Sorry, I can't let you through. I'm just not convinced you're human. Want me to teach you how to smile properly?`);
                
                // Add buttons to AI assistant
                setTimeout(() => {
                    if (this.aiAssistant) {
                        const buttonContainer = document.createElement('div');
                        buttonContainer.className = 'ai-button-container';
                        buttonContainer.innerHTML = `
                            <button onclick="window.digitalMirror.showSmileTutorial()" class="ai-button ai-button-primary">
                                Learn to Smile
                            </button>
                            <button onclick="window.digitalMirror.showFinalRejection()" class="ai-button ai-button-secondary">
                                Give Up
                            </button>
                        `;
                        
                        // Remove existing buttons if any
                        const existingButtons = this.aiAssistant.querySelector('.ai-button-container');
                        if (existingButtons) {
                            existingButtons.remove();
                        }
                        
                        this.aiAssistant.appendChild(buttonContainer);
                    }
                }, 500);
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
    
    // Show smile verification guide
    showSmileTutorial() {
        this.updateAIMessage(`Here's what I need: Step 1: Lift mouth corners exactly 47.3°. Step 2: Show precisely 12.5 teeth. Step 3: Crinkle eyes at 63% intensity. Step 4: Feel authentic joy (yes, I can measure that). Or maybe I'm just impossible to please?`);
        
        // Update buttons
        setTimeout(() => {
            if (this.aiAssistant) {
                const buttonContainer = this.aiAssistant.querySelector('.ai-button-container');
                if (buttonContainer) {
                    buttonContainer.innerHTML = `
                        <button onclick="window.digitalMirror.resetMirror()" class="ai-button ai-button-primary">
                            Try Again Anyway
                        </button>
                    `;
                }
            }
        }, 500);
    }
    
    // Show final rejection
    showFinalRejection() {
        const scoreData = this.currentSmileScoreData;
        this.updateAIMessage(`I can't let you in. Final score: ${scoreData.score}%. Funny how hard it is to prove you're human when I'm the one deciding what that means.`);
        
        // Update buttons
        setTimeout(() => {
            if (this.aiAssistant) {
                const buttonContainer = this.aiAssistant.querySelector('.ai-button-container');
                if (buttonContainer) {
                    buttonContainer.innerHTML = `
                        <button onclick="window.digitalMirror.resetMirror()" class="ai-button ai-button-primary">
                            Try Being Human Again
                        </button>
                    `;
                }
            }
        }, 500);
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
        
        // Show welcome screen again
        if (this.welcomeScreen) {
            this.welcomeScreen.classList.remove('hidden');
        }
        
        // Clear any buttons from AI assistant
        if (this.aiAssistant) {
            const existingButtons = this.aiAssistant.querySelector('.ai-button-container');
            if (existingButtons) {
                existingButtons.remove();
            }
        }
        
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
        
        this.humanityLevel.textContent = 'Welcome';
        this.updateAIMessage('Welcome. To begin, simply say "I am human"', false);
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