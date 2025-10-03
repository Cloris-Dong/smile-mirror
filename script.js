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
        
        this.captchaLevel = 0;
        this.maxCaptchaLevel = 5;
        this.humanityPercentage = 100;
        this.isListening = false;
        this.fallbackActive = false;
        
        // CAPTCHA system properties
        this.currentCode = '';
        this.captchaTimerInterval = null;
        this.timeRemaining = 5.0;
        this.captchaAttempts = 0;
        this.baseCaptchaTime = 5.0; // Start at 5 seconds
        this.timeIncrement = 2.0;   // Add 2 seconds each time
        
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
            await this.setupWebcam();
            await this.setupAudioDetection();
            this.setupEventListeners();
            this.setupFallbackControls();
            this.startDistortionLoop();
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
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true // Request microphone access
            });
            
            this.webcam.srcObject = stream;
            this.webcam.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.webcam.videoWidth;
                this.canvas.height = this.webcam.videoHeight;
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
        
        // Add a test button for debugging
        this.addTestButton();
    }
    
    addTestButton() {
        const testButton = document.createElement('button');
        testButton.textContent = 'TEST DISTORTION';
        testButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6600;
            color: #000;
            border: 2px solid #ff6600;
            padding: 10px 15px;
            font-family: 'Courier New', monospace;
            cursor: pointer;
            z-index: 1000;
        `;
        testButton.onclick = () => {
            console.log('Test button clicked - triggering distortion');
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
        if (this.captchaLevel >= this.maxCaptchaLevel) {
            return; // Already at maximum level
        }
        
        this.captchaLevel++;
        this.humanityPercentage = Math.max(0, 100 - (this.captchaLevel * 20));
        
        this.updateHumanityLevel();
        this.showListeningIndicator('Processing...');
        
        // Trigger reverse CAPTCHA challenge
        setTimeout(() => {
            this.triggerReverseCAPTCHA();
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
        if (this.captchaLevel >= this.maxCaptchaLevel) {
            this.cleanInstruction.style.display = 'none';
        }
    }
    
    // Seven-segment digit patterns for machine-readable encoding
    getSevenSegmentPattern(digit) {
        const patterns = {
            '0': [1,1,1,0,1,1,1], // a,b,c,d,e,f
            '1': [0,0,1,0,0,1,0], // a,b,c,d,e,f
            '2': [1,0,1,1,1,0,1], // a,b,c,d,e,f
            '3': [1,0,1,1,0,1,1], // a,b,c,d,e,f
            '4': [0,1,1,1,0,1,0], // a,b,c,d,e,f
            '5': [1,1,0,1,0,1,1], // a,b,c,d,e,f
            '6': [1,1,0,1,1,1,1], // a,b,c,d,e,f
            '7': [1,0,1,0,0,1,0], // a,b,c,d,e,f
            '8': [1,1,1,1,1,1,1], // a,b,c,d,e,f
            '9': [1,1,1,1,0,1,1]  // a,b,c,d,e,f
        };
        return patterns[digit] || [0,0,0,0,0,0,0];
    }
    
    // Generate 8-digit random code
    generateRandomCode() {
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += Math.floor(Math.random() * 10).toString();
        }
        return code;
    }
    
    // Create steganographic bitmap with hidden code
    createSteganographicBitmap(code) {
        const canvas = this.captchaCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Create image data
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Fill with near-white background (254,254,254)
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 254;     // Red
            data[i + 1] = 254; // Green
            data[i + 2] = 254; // Blue
            data[i + 3] = 255; // Alpha
        }
        
        // Draw seven-segment digits in blue channel with minimal contrast
        const digitWidth = Math.floor(width / 8);
        const digitHeight = height;
        const segmentThickness = 2;
        
        for (let i = 0; i < code.length; i++) {
            const digit = code[i];
            const pattern = this.getSevenSegmentPattern(digit);
            const startX = i * digitWidth;
            
            // Draw segments based on pattern
            this.drawSevenSegmentDigit(data, width, startX, 0, digitWidth, digitHeight, pattern, segmentThickness);
        }
        
        // Put image data on canvas
        ctx.putImageData(imageData, 0, 0);
    }
    
    // Draw a seven-segment digit
    drawSevenSegmentDigit(data, width, startX, startY, digitWidth, digitHeight, pattern, thickness) {
        const centerX = startX + digitWidth / 2;
        const centerY = startY + digitHeight / 2;
        const segmentLength = Math.min(digitWidth, digitHeight) * 0.3;
        
        // Segment positions (a,b,c,d,e,f,g)
        const segments = [
            // a (top)
            { x1: centerX - segmentLength/2, y1: centerY - segmentLength/2, x2: centerX + segmentLength/2, y2: centerY - segmentLength/2 },
            // b (top-right)
            { x1: centerX + segmentLength/2, y1: centerY - segmentLength/2, x2: centerX + segmentLength/2, y2: centerY },
            // c (bottom-right)
            { x1: centerX + segmentLength/2, y1: centerY, x2: centerX + segmentLength/2, y2: centerY + segmentLength/2 },
            // d (bottom)
            { x1: centerX - segmentLength/2, y1: centerY + segmentLength/2, x2: centerX + segmentLength/2, y2: centerY + segmentLength/2 },
            // e (bottom-left)
            { x1: centerX - segmentLength/2, y1: centerY, x2: centerX - segmentLength/2, y2: centerY + segmentLength/2 },
            // f (top-left)
            { x1: centerX - segmentLength/2, y1: centerY - segmentLength/2, x2: centerX - segmentLength/2, y2: centerY },
            // g (middle)
            { x1: centerX - segmentLength/2, y1: centerY, x2: centerX + segmentLength/2, y2: centerY }
        ];
        
        // Draw active segments
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === 1) {
                this.drawSegment(data, width, segments[i], thickness);
            }
        }
    }
    
    // Draw a single segment line
    drawSegment(data, width, segment, thickness) {
        const { x1, y1, x2, y2 } = segment;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(length);
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(x1 + dx * t);
            const y = Math.round(y1 + dy * t);
            
            // Draw thickness around the point
            for (let dx = -thickness; dx <= thickness; dx++) {
                for (let dy = -thickness; dy <= thickness; dy++) {
                    const px = x + dx;
                    const py = y + dy;
                    if (px >= 0 && px < width && py >= 0 && py < data.length / (4 * width)) {
                        const index = (py * width + px) * 4;
                        // Set blue channel to 255 (code pixel)
                        data[index + 2] = 255;
                    }
                }
            }
        }
    }
    
    // Trigger reverse CAPTCHA challenge
    triggerReverseCAPTCHA() {
        // Generate new code
        this.currentCode = this.generateRandomCode();
        
        // Create steganographic image
        this.createSteganographicBitmap(this.currentCode);
        
        // Show CAPTCHA overlay
        this.captchaOverlay.style.display = 'flex';
        this.overlay.style.display = 'none';
        
        // Reset input and status
        this.captchaInput.value = '';
        this.captchaStatus.textContent = '';
        this.captchaInput.focus();
        
        // Start countdown timer
        this.startCaptchaTimer();
        
        // Setup event listeners
        this.setupCaptchaEventListeners();
        
        console.log('Reverse CAPTCHA triggered. Hidden code:', this.currentCode);
    }
    
    // Start countdown timer
    startCaptchaTimer() {
        // Calculate time for this level: 5s + (level-1) * 2s
        this.timeRemaining = this.baseCaptchaTime + ((this.captchaLevel - 1) * this.timeIncrement);
        
        this.captchaTimerInterval = setInterval(() => {
            this.timeRemaining -= 0.1;
            this.captchaTimer.textContent = `Time: ${this.timeRemaining.toFixed(1)}s`;
            
            if (this.timeRemaining <= 0) {
                this.handleCaptchaTimeout();
            }
        }, 100);
        
        console.log(`CAPTCHA Level ${this.captchaLevel}: ${this.timeRemaining.toFixed(1)} seconds allowed`);
    }
    
    // Setup CAPTCHA event listeners
    setupCaptchaEventListeners() {
        this.captchaSubmit.onclick = () => this.submitCaptcha();
        this.captchaInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                this.submitCaptcha();
            }
        };
    }
    
    // Submit CAPTCHA answer
    submitCaptcha() {
        const userInput = this.captchaInput.value.trim();
        
        if (userInput === this.currentCode) {
            this.handleCaptchaSuccess();
        } else {
            this.handleCaptchaFailure();
        }
    }
    
    // Handle successful CAPTCHA (machine behavior detected)
    handleCaptchaSuccess() {
        clearInterval(this.captchaTimerInterval);
        this.captchaStatus.textContent = 'VERIFICATION SUCCESSFUL - Machine behavior detected';
        this.captchaStatus.style.color = '#00ff00';
        
        setTimeout(() => {
            this.captchaOverlay.style.display = 'none';
            this.overlay.style.display = 'block';
            
            if (this.captchaLevel >= this.maxCaptchaLevel) {
                this.showVerdict();
            } else {
                this.showListeningIndicator('Listening...');
            }
        }, 2000);
    }
    
    // Handle failed CAPTCHA (human limitations detected)
    handleCaptchaFailure() {
        clearInterval(this.captchaTimerInterval);
        this.captchaStatus.textContent = 'VERIFICATION FAILED - Human limitations detected';
        this.captchaStatus.style.color = '#ff0000';
        
        setTimeout(() => {
            this.captchaOverlay.style.display = 'none';
            this.overlay.style.display = 'block';
            this.showListeningIndicator('Listening...');
        }, 2000);
    }
    
    // Handle CAPTCHA timeout
    handleCaptchaTimeout() {
        clearInterval(this.captchaTimerInterval);
        this.captchaStatus.textContent = 'TIME EXPIRED - Cognitive limitations confirmed';
        this.captchaStatus.style.color = '#ff0000';
        
        setTimeout(() => {
            this.captchaOverlay.style.display = 'none';
            this.overlay.style.display = 'block';
            this.showListeningIndicator('Listening...');
        }, 2000);
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
        this.captchaLevel = 0;
        this.humanityPercentage = 100;
        this.lastTriggerTime = 0;
        this.isProcessing = false;
        
        // Clear any active timers
        if (this.captchaTimerInterval) {
            clearInterval(this.captchaTimerInterval);
        }
        
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
        
        // Clear CAPTCHA timer
        if (this.captchaTimerInterval) {
            clearInterval(this.captchaTimerInterval);
        }
        
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