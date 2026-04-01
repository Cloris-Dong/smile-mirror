// The Digital Mirror - Interactive Web Art Piece with Volume-Based Speech Detection

class DigitalMirror {
    constructor() {
        this.webcam = document.getElementById('webcam');
        this.canvas = document.getElementById('distortion-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        this.humanityLevel = document.getElementById('humanity-level');
        this.cleanInstruction = document.getElementById('clean-instruction');
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
        this.maxSmileLevel = 2;
        this.humanityPercentage = 100;
        this.isListening = false;
        this.fallbackActive = false;
        
        // Store captured face images for opening at the end
        this.capturedFaceImages = [];
        
        // Smile verification system properties
        this.smileLevel = 0;
        this.maxSmileLevel = 2;
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
        this.smoothedSmileScore = 0; // EMA smoothed smiling score
        
        // Dynamic range tracking for adaptive normalization
        this.facialRanges = {
            mouthNoseDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            mouthNoseDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthLeft: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthRight: { min: Infinity, max: -Infinity, history: [] },
            warmupFrames: 30, // Wait this many frames before calculating scores
            frameCount: 0,
            maxHistory: 120 // Keep last 120 frames (4 seconds at 30fps) for dynamic adjustment
        };
        
        // Emotional Economics Game
        this.gameLoop = null;
        this.gameContainer = null;
        this.gameStarting = false; // Flag to prevent multiple starts
        
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
        
        // Global face presence monitoring
        this.lastFaceDetectedTime = Date.now();
        this.facePresenceCheckInterval = null;
        this.faceAbsenceTimeout = 5000; // 5 seconds without face triggers restart
        this.continuousFaceDetectionInterval = null; // Separate loop for continuous face detection
        this.lastDetectionLogTime = 0; // For throttling detection logs
        
        this.init();
    }
    
    async init() {
        try {
            // Check if TensorFlow.js libraries are loaded
            console.log('Checking TensorFlow.js availability...');
            console.log('TensorFlow available:', typeof tf !== 'undefined');
            console.log('faceLandmarksDetection available:', typeof faceLandmarksDetection !== 'undefined');
            
            await this.setupWebcam();
            
            // Check URL parameter for ASR mode: ?asr=local or ?asr=webspeech
            const urlParams = new URLSearchParams(window.location.search);
            const asrMode = urlParams.get('asr') || 'local'; // Default to local
            
            console.log(`ASR mode: ${asrMode}`);
            
            if (asrMode === 'webspeech') {
                // Use Web Speech API
            await this.setupAudioDetection();
            } else {
                // Use local ASR (default)
                this.setupLocalASR();
            }
            
            await this.setupFacialDetection();
            this.startContinuousFacePresenceDetection(); // Start continuous face detection loop (independent of overlay)
            this.setupEventListeners();
            this.setupFallbackControls();
            this.startDistortionLoop();
            this.startFacePresenceMonitoring(); // Start global face presence monitoring
            // Always add test button for easy testing
            this.addTestButton();
            // Add debug button to skip smile measurement
            this.addDebugSkipToGameButton();
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
            // Keep retrying instead of falling back
            this.showListeningIndicator('Retrying setup...');
            setTimeout(() => {
                this.setupAudioDetection();
            }, this.retryDelay);
        }
    }
    
    async setupLocalASR() {
        // Local ASR WebSocket setup - runs alongside Web Speech API
        const WS_URL = 'ws://localhost:8765';
        const TARGET_SAMPLE_RATE = 16000;
        const CHANNELS = 1;
        const FRAME_SIZE_MS = 20;
        const SAMPLES_PER_FRAME = Math.floor(TARGET_SAMPLE_RATE * FRAME_SIZE_MS / 1000); // 320 samples
        const BYTES_PER_FRAME = SAMPLES_PER_FRAME * 2; // PCM16 = 2 bytes per sample
        
        // Local ASR state
        this.localASR = {
            ws: null,
            audioContext: null,
            sourceNode: null,
            processorNode: null, // AudioWorkletNode or ScriptProcessorNode (fallback)
            stream: null,
            reconnectTimer: null,
            reconnectAttempts: 0,
            maxReconnectAttempts: Infinity, // Retry forever
            reconnectDelay: 1000, // 1 second
            isConnected: false,
            isStreaming: false
        };
        
        const connectWebSocket = async () => {
            try {
                console.log('Attempting to connect to local ASR service...');
                this.showListeningIndicator('Connecting to speech service...');
                this.localASR.ws = new WebSocket(WS_URL);
                
                this.localASR.ws.onopen = () => {
                    console.log('Local ASR WebSocket connected');
                    this.localASR.isConnected = true;
                    this.localASR.reconnectAttempts = 0;
                    
                    // Clear status indicator - will be updated by VAD events
                    this.showListeningIndicator('');
                    
                    // Only start microphone streaming when WS is open
                    startMicrophoneStream();
                };
                
                this.localASR.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('Local ASR message:', message);
                        
                        if (message.type === 'vad') {
                            if (message.state === 'speech_start') {
                                this.showListeningIndicator('Listening...');
                            } else if (message.state === 'speech_end') {
                                this.showListeningIndicator('Processing...');
                            }
                        } else if (message.type === 'transcript') {
                            const transcript = message.text;
                            console.log('[ASR]', transcript);
                            
                            // Use existing detectHumanPhrase and processHumanClaim
                            if (this.detectHumanPhrase(transcript.toLowerCase().trim())) {
                                console.log('[ASR] Human phrase detected');
                                this.processHumanClaim();
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing local ASR message:', error);
                    }
                };
                
                this.localASR.ws.onerror = (error) => {
                    console.error('Local ASR WebSocket error:', error);
                };
                
                this.localASR.ws.onclose = () => {
                    console.log('Local ASR WebSocket closed');
                    const wasConnected = this.localASR.isConnected;
                    this.localASR.isConnected = false;
                    
                    // Stop sending audio immediately and clean up resources
                    stopMicrophoneStream();
                    
                    // Show offline status
                    this.showListeningIndicator('Speech service offline (press Space)');
                    
                    // Only attempt reconnection if we were previously connected and haven't been stopped
                    // (don't reconnect if we're shutting down)
                    if (wasConnected && this.localASR.reconnectAttempts < this.localASR.maxReconnectAttempts && this.localASR) {
                        this.localASR.reconnectAttempts++;
                        console.log(`Reconnecting to local ASR (attempt ${this.localASR.reconnectAttempts})...`);
                        
                        // Show connecting status during reconnection
                        this.showListeningIndicator('Connecting to speech service...');
                        
                        // Clear any existing reconnect timer
                        if (this.localASR.reconnectTimer) {
                            clearTimeout(this.localASR.reconnectTimer);
                        }
                        
                        this.localASR.reconnectTimer = setTimeout(() => {
                            // Only reconnect if localASR still exists and hasn't been cleaned up
                            // Also ensure no active stream exists (double-check before reconnecting)
                            if (this.localASR && !this.localASR.isStreaming && !this.localASR.audioContext) {
                                connectWebSocket();
                            }
                        }, this.localASR.reconnectDelay);
                    } else if (!wasConnected) {
                        // Initial connection failed - enable fallback
                        enableFallback();
                    }
                };
                
            } catch (error) {
                console.error('Failed to connect to local ASR service:', error);
                this.localASR.isConnected = false;
                this.showListeningIndicator('Speech service offline (press Space)');
                enableFallback();
            }
        };
        
        const startMicrophoneStream = async () => {
            // Ensure only one stream at a time
            if (this.localASR.isStreaming) {
                console.log('Local ASR: Microphone stream already active, skipping');
                return;
            }
            
            // Ensure no existing AudioContext or MediaStream before creating new ones
            if (this.localASR.audioContext || this.localASR.stream) {
                console.log('Local ASR: Existing audio resources detected, cleaning up first...');
                stopMicrophoneStream();
                // Small delay to ensure cleanup completes
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            if (!this.localASR.isConnected) {
                console.log('Local ASR: WebSocket not connected, skipping microphone start');
                return;
            }
            
            try {
                // Get user media
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: CHANNELS,
                        sampleRate: TARGET_SAMPLE_RATE,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                
                this.localASR.stream = stream;
                
                // Create AudioContext with target sample rate
                const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: TARGET_SAMPLE_RATE
                });
                
                this.localASR.audioContext = audioContext;
                
                // Create source node from stream
                const sourceNode = audioContext.createMediaStreamSource(stream);
                this.localASR.sourceNode = sourceNode;
                
                // Load and create AudioWorklet processor
                try {
                    await audioContext.audioWorklet.addModule('audio-processor.js');
                    
                    // Create AudioWorkletNode
                    const processorNode = new AudioWorkletNode(audioContext, 'audio-processor');
                    
                    // Handle messages from the worklet (PCM16 frames)
                    processorNode.port.onmessage = (event) => {
                        if (event.data.type === 'audioFrame') {
                            // Stop processing if not connected or WebSocket is closed
                            if (!this.localASR.isConnected || !this.localASR.ws || this.localASR.ws.readyState !== WebSocket.OPEN) {
                                return;
                            }
                            
                            // Send frame over WebSocket
                            if (this.localASR.ws && this.localASR.ws.readyState === WebSocket.OPEN) {
                                this.localASR.ws.send(event.data.data);
                            }
                        }
                    };
                    
                    // Connect nodes
                    sourceNode.connect(processorNode);
                    // AudioWorklet doesn't need to connect to destination
                    
                    this.localASR.processorNode = processorNode;
                    this.localASR.isStreaming = true;
                    
                    console.log('Local ASR microphone stream started (AudioWorklet)');
                    
                } catch (error) {
                    console.error('Failed to load AudioWorklet, falling back to ScriptProcessorNode:', error);
                    
                    // Fallback to ScriptProcessorNode if AudioWorklet fails
                    const bufferSize = 512; // Power of 2
                    const processorNode = audioContext.createScriptProcessor(bufferSize, CHANNELS, CHANNELS);
                    
                    processorNode.onaudioprocess = (event) => {
                        if (!this.localASR.isConnected || !this.localASR.ws || this.localASR.ws.readyState !== WebSocket.OPEN) {
                            return;
                        }
                        
                        const inputBuffer = event.inputBuffer;
                        const inputData = inputBuffer.getChannelData(0);
                        let samples = Array.from(inputData);
                        
                        const actualSampleRate = audioContext.sampleRate;
                        if (actualSampleRate !== TARGET_SAMPLE_RATE) {
                            samples = resampleAudio(samples, actualSampleRate, TARGET_SAMPLE_RATE);
                        }
                        
                        // Simple frame processing for fallback
                        const frameSamples = samples.slice(0, SAMPLES_PER_FRAME);
                        const pcm16Buffer = new ArrayBuffer(BYTES_PER_FRAME);
                        const pcm16View = new Int16Array(pcm16Buffer);
                        
                        for (let i = 0; i < frameSamples.length; i++) {
                            const sample = Math.max(-1, Math.min(1, frameSamples[i]));
                            pcm16View[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32768)));
                        }
                        
                        if (this.localASR.ws && this.localASR.ws.readyState === WebSocket.OPEN) {
                            this.localASR.ws.send(pcm16Buffer);
                        }
                    };
                    
                    sourceNode.connect(processorNode);
                    processorNode.connect(audioContext.destination);
                    
                    this.localASR.processorNode = processorNode;
                    this.localASR.isStreaming = true;
                    
                    console.log('Local ASR microphone stream started (ScriptProcessorNode fallback)');
                }
                
            } catch (error) {
                console.error('Failed to start microphone stream:', error);
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    console.error('Microphone permission denied');
                }
                enableFallback();
            }
        };
        
        const stopMicrophoneStream = () => {
            // Stop processor node first
            if (this.localASR.processorNode) {
                try {
                    this.localASR.processorNode.disconnect();
                } catch (e) {
                    // Already disconnected, ignore
                }
                this.localASR.processorNode = null;
            }
            
            // Stop source node
            if (this.localASR.sourceNode) {
                try {
                    this.localASR.sourceNode.disconnect();
                } catch (e) {
                    // Already disconnected, ignore
                }
                this.localASR.sourceNode = null;
            }
            
            // Stop all media tracks
            if (this.localASR.stream) {
                this.localASR.stream.getTracks().forEach(track => {
                    track.stop();
                });
                this.localASR.stream = null;
            }
            
            // Close audio context
            if (this.localASR.audioContext) {
                if (this.localASR.audioContext.state !== 'closed') {
                    this.localASR.audioContext.close().catch(console.error);
                }
                this.localASR.audioContext = null;
            }
            
            this.localASR.isStreaming = false;
            
            console.log('Local ASR microphone stream stopped');
        };
        
        const enableFallback = () => {
            console.log('Local ASR service unavailable, enabling fallback controls');
            this.showListeningIndicator('Speech service offline (press Space)');
            
            // Enable fallback controls (spacebar/click)
            if (!this.fallbackActive) {
                this.enableFallbackControls();
            }
        };
        
        const resampleAudio = (samples, fromRate, toRate) => {
            if (fromRate === toRate) {
                return samples;
            }
            
            const ratio = fromRate / toRate;
            const newLength = Math.round(samples.length / ratio);
            const result = new Array(newLength);
            
            for (let i = 0; i < newLength; i++) {
                const srcIndex = i * ratio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
                const t = srcIndex - srcIndexFloor;
                
                // Linear interpolation
                result[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t;
            }
            
            return result;
        };
        
        // Store stopMicrophoneStream reference so it can be called from stopLocalASR
        this.localASR._stopMicrophoneStream = stopMicrophoneStream;
        
        // Start connection
        connectWebSocket();
    }
    
    stopLocalASR() {
        // Stop local ASR completely - called from cleanup() and on page refresh
        if (!this.localASR) {
            return;
        }
        
        console.log('Stopping local ASR...');
        
        // Clear reconnect timer first to prevent reconnection attempts
        if (this.localASR.reconnectTimer) {
            clearTimeout(this.localASR.reconnectTimer);
            this.localASR.reconnectTimer = null;
        }
        
        // Close WebSocket
        if (this.localASR.ws) {
            try {
                // Remove event handlers to prevent reconnection
                this.localASR.ws.onopen = null;
                this.localASR.ws.onmessage = null;
                this.localASR.ws.onerror = null;
                this.localASR.ws.onclose = null;
                this.localASR.ws.close();
            } catch (e) {
                console.error('Error closing WebSocket:', e);
            }
            this.localASR.ws = null;
        }
        
        // Stop microphone stream and close AudioContext
        if (this.localASR._stopMicrophoneStream) {
            this.localASR._stopMicrophoneStream();
        } else {
            // Fallback cleanup if method reference is not available
            if (this.localASR.processorNode) {
                try {
                    this.localASR.processorNode.disconnect();
                } catch (e) {}
                this.localASR.processorNode = null;
            }
            
            if (this.localASR.sourceNode) {
                try {
                    this.localASR.sourceNode.disconnect();
                } catch (e) {}
                this.localASR.sourceNode = null;
            }
            
            if (this.localASR.stream) {
                this.localASR.stream.getTracks().forEach(track => track.stop());
                this.localASR.stream = null;
            }
            
            if (this.localASR.audioContext && this.localASR.audioContext.state !== 'closed') {
                this.localASR.audioContext.close().catch(console.error);
                this.localASR.audioContext = null;
            }
        }
        
        this.localASR.isConnected = false;
        this.localASR.isStreaming = false;
        
        console.log('Local ASR stopped');
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
        
        // Handle end - this is NORMAL behavior after ~60 seconds of silence, not an error
        this.recognition.onend = () => {
            console.log('Speech recognition ended (normal after inactivity)');
            if (this.isListening) {
                // Simply restart after a short delay - no error handling needed
                setTimeout(() => {
                    if (this.isListening && this.recognition) {
                        try {
                            this.recognition.start();
                            console.log('Recognition restarted from onend handler');
                        } catch (error) {
                            // If already started, that's fine - ignore it
                            if (error.name === 'InvalidStateError' && error.message.includes('already started')) {
                                console.log('Recognition already started, continuing...');
                            } else {
                                // Only handle actual errors
                                console.error('Failed to restart recognition:', error);
                                this.handleSpeechError('restart-failed');
                            }
                        }
                    }
                }, 500);
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
        // Check for various forms of "I am human" and "I'm human"
        const humanPhrases = [
            'i am human',
            'i am a human',
            'i am the human',
            'i am human being',
            'i am a human being',
            'i am the human being',
            'i am human person',
            'i am a human person',
            'i am the human person',
            // Contractions
            "i'm human",
            "i'm a human",
            "i'm the human",
            "i'm human being",
            "i'm a human being",
            "i'm the human being",
            "i'm human person",
            "i'm a human person",
            "i'm the human person",
            // Without apostrophe (speech recognition might not include it)
            'im human',
            'im a human',
            'im the human',
            'im human being',
            'im a human being',
            'im the human being',
            'im human person',
            'im a human person',
            'im the human person'
        ];
        
        return humanPhrases.some(phrase => transcript.includes(phrase));
    }
    
    handleSpeechError(error) {
        let errorMessage = '';
        let shouldRestart = true; // Always try to restart
        
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
                errorMessage = 'Microphone not accessible. Retrying...';
                shouldRestart = true; // Keep trying even for permission issues
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied. Retrying...';
                shouldRestart = true; // Keep trying even for permission issues
                break;
            case 'network':
                errorMessage = 'Network error. Retrying...';
                shouldRestart = true; // Keep trying for network errors
                break;
            case 'service-not-allowed':
                errorMessage = 'Speech recognition service not allowed. Retrying...';
                shouldRestart = true; // Keep trying
                break;
            default:
                errorMessage = `Speech recognition error: ${error}. Retrying...`;
                shouldRestart = true;
        }
        
        console.error('Speech recognition error:', errorMessage);
        
        // Always try to restart, never fall back to alternative methods
        if (shouldRestart && this.isListening) {
            this.retryCount++;
            this.showListeningIndicator(`Restarting... (attempt ${this.retryCount})`);
            // Restart recognition after a delay
            setTimeout(() => {
                if (this.isListening && this.recognition) {
                    try {
                        this.recognition.start();
                        this.showListeningIndicator('Listening...');
                        this.retryCount = 0; // Reset counter on successful restart
                        console.log(`Speech recognition restarted successfully`);
                    } catch (restartError) {
                        // If already started, that's fine - ignore it
                        if (restartError.name === 'InvalidStateError' && restartError.message.includes('already started')) {
                            console.log('Recognition already started, continuing...');
                            this.retryCount = 0;
                            this.showListeningIndicator('Listening...');
                        } else {
                            console.error('Failed to restart speech recognition:', restartError);
                            // Keep retrying instead of falling back
                            this.handleSpeechError('restart-failed');
                        }
                    }
                }
            }, this.retryDelay);
        } else if (this.isListening) {
            // Even for non-restartable errors, keep trying
            this.showListeningIndicator('Retrying...');
            setTimeout(() => {
                if (this.isListening && this.recognition) {
                    try {
                        this.recognition.start();
                        this.showListeningIndicator('Listening...');
                        this.retryCount = 0;
                    } catch (retryError) {
                        // If already started, that's fine - ignore it
                        if (retryError.name === 'InvalidStateError' && retryError.message.includes('already started')) {
                            console.log('Recognition already started, continuing...');
                            this.retryCount = 0;
                            this.showListeningIndicator('Listening...');
                        } else {
                            console.error('Failed to restart speech recognition:', retryError);
                            this.handleSpeechError('retry-failed');
                        }
                    }
                }
            }, this.retryDelay);
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
        // Indicator removed - function kept for compatibility
        // Status messages are still logged to console for debugging
        if (text) {
            console.log('[ListeningIndicator]', text);
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
            left: 24px;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            color: #06c;
            border: none;
            padding: 10px 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
            cursor: pointer;
            z-index: 10001;
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
        // Ignore if an analysis is already in progress to prevent smileLevel skipping
        if (this.isAnalyzing) {
            return;
        }
        
        // If this is the first claim (smileLevel 0), transition from welcome to gatekeeper
        if (this.smileLevel === 0) {
            // Hide welcome screen
            if (this.welcomeScreen) {
                this.welcomeScreen.classList.add('hidden');
            }
            
            // Phase 1: Acknowledge statement
            this.humanityLevel.textContent = 'Received';
            this.updateAIMessage('I heard you.');
            this.showListeningIndicator('Processing...');
            
            // Phase 2: After a few seconds, prompt for smile
            setTimeout(() => {
                this.humanityLevel.textContent = 'Verifying';
                this.updateAIMessage('Show me how human your smile is.');
                this.showListeningIndicator('Preparing...');
                
                // Phase 3: Start measuring smile
                setTimeout(() => {
                    this.smileLevel++;
                    this.humanityPercentage = Math.max(0, 100 - (this.smileLevel * 25));
                    this.updateHumanityLevel();
                    this.updateAIMessage('Keep smiling. Just a moment.');
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
        if (this.cleanInstruction && this.smileLevel >= this.maxSmileLevel) {
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
    
    // Calculate mouth smile intensity (0-1 range) with dynamic range tracking
    calculateMouthSmile(mouthCorner, nose, isLeft = true) {
        // Measure the Y-coordinate difference between nose and mouth corner
        const verticalDiff = mouthCorner[1] - nose[1];
        
        const key = isLeft ? 'mouthNoseDistanceLeft' : 'mouthNoseDistanceRight';
        const range = this.facialRanges[key];
        
        // Update history
        range.history.push(verticalDiff);
        if (range.history.length > this.facialRanges.maxHistory) {
            range.history.shift(); // Remove oldest
        }
        
        // Update min/max dynamically
        range.min = Math.min(range.min, verticalDiff);
        range.max = Math.max(range.max, verticalDiff);
        
        // During warmup, return 0
        if (this.facialRanges.frameCount < this.facialRanges.warmupFrames) {
            return 0;
        }
        
        // Calculate intensity based on current range
        // Lower value (mouth higher) = more smile, so we invert the normalization
        const rangeSpan = range.max - range.min;
        if (rangeSpan < 1) return 0; // Not enough movement yet
        
        // Normalize: 0 = at max (lowest smile), 1 = at min (highest smile)
        const smileIntensity = (range.max - verticalDiff) / rangeSpan;
        
        return Math.max(0, Math.min(1, smileIntensity));
    }
    
    // Calculate cheek squint intensity (0-1 range) with dynamic range tracking
    calculateCheekSquint(cheek, eyeOuter, isLeft = true) {
        // Measure 3D distance between cheek and eye outer corner
        const dist = this.distance(cheek, eyeOuter);
        
        const key = isLeft ? 'cheekEyeDistanceLeft' : 'cheekEyeDistanceRight';
        const range = this.facialRanges[key];
        
        // Update history
        range.history.push(dist);
        if (range.history.length > this.facialRanges.maxHistory) {
            range.history.shift();
        }
        
        // Update min/max
        range.min = Math.min(range.min, dist);
        range.max = Math.max(range.max, dist);
        
        // During warmup, return 0
        if (this.facialRanges.frameCount < this.facialRanges.warmupFrames) {
            return 0;
        }
        
        // When squinting, distance decreases
        const rangeSpan = range.max - range.min;
        if (rangeSpan < 1) return 0;
        
        // Normalize: 0 = at max (no squint), 1 = at min (max squint)
        const squintIntensity = (range.max - dist) / rangeSpan;
        
        return Math.max(0, Math.min(1, squintIntensity));
    }
    
    // Calculate eye smile intensity (0-1 range) with dynamic range tracking
    calculateEyeSmile(eyeInner, eyeOuter, isLeft = true) {
        // Measure 3D distance between eye inner and outer corners
        const eyeWidth = this.distance(eyeInner, eyeOuter);
        
        const key = isLeft ? 'eyeWidthLeft' : 'eyeWidthRight';
        const range = this.facialRanges[key];
        
        // Update history
        range.history.push(eyeWidth);
        if (range.history.length > this.facialRanges.maxHistory) {
            range.history.shift();
        }
        
        // Update min/max
        range.min = Math.min(range.min, eyeWidth);
        range.max = Math.max(range.max, eyeWidth);
        
        // During warmup, return 0
        if (this.facialRanges.frameCount < this.facialRanges.warmupFrames) {
            return 0;
        }
        
        // When smiling, eye width decreases
        const rangeSpan = range.max - range.min;
        if (rangeSpan < 0.5) return 0; // Eyes move less than other features
        
        // Normalize: 0 = at max (no smile), 1 = at min (max smile)
        const narrowIntensity = (range.max - eyeWidth) / rangeSpan;
        
        return Math.max(0, Math.min(1, narrowIntensity));
    }
    
    // Helper function to calculate median of an array
    getMedian(arr) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }
    
    // Trigger smile verification challenge
    async triggerSmileVerification() {
        // Generate realistic score based on current facial state
        this.currentSmileScoreData = await this.generateSmileScore(this.smileLevel);
        
        // Keep the main overlay visible and show analysis on mirror surface
        this.overlay.style.display = 'block';
        
        // Update instruction text for current level
        this.updateSmileInstruction();
        
        // Capture face image during smile measurement
        this.capturedFaceImages = await this.captureFaceImage();
        
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
                this.updateAIMessage('Keep smiling. Just a moment.');
                break;
            case 2:
                this.updateAIMessage('I\'m still not convinced. Try that again.');
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
        // Clear any previously running analysis timer before starting a new one
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
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
                    
                    // Update face presence timestamp
                    this.updateFacePresence();
                    
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
    
    // Calculate metrics (extracted for reuse)
    calculateMetrics() {
        if (!this.faceBoundingBox || !this.realLandmarks || this.realLandmarks.length < 468) {
            return null;
        }
        
        // Key facial landmarks for MediaPipe Face Mesh
        const leftMouth = this.realLandmarks[61];
        const rightMouth = this.realLandmarks[291];
        const nose = this.realLandmarks[1];
        const leftEyeOuter = this.realLandmarks[33];
        const rightEyeOuter = this.realLandmarks[263];
        const leftEyeInner = this.realLandmarks[133];
        const rightEyeInner = this.realLandmarks[362];
        const leftCheek = this.realLandmarks[116];
        const rightCheek = this.realLandmarks[345];
        
        // Increment frame counter for warmup period
        this.facialRanges.frameCount++;
        
        // 1. SMILING SCORE
        const mouthSmileLeft = this.calculateMouthSmile(leftMouth, nose, true);
        const mouthSmileRight = this.calculateMouthSmile(rightMouth, nose, false);
        const rawSmileScore = (mouthSmileLeft + mouthSmileRight) / 2;
        
        // Apply EMA smoothing
        if (!this.smoothedSmileScore) {
            this.smoothedSmileScore = rawSmileScore;
        } else {
            const emaAlpha = 0.3;
            this.smoothedSmileScore = emaAlpha * rawSmileScore + (1 - emaAlpha) * this.smoothedSmileScore;
        }
        
        const smilingScore = Math.max(0, Math.min(65, this.smoothedSmileScore * 65));
        
        // 2. MUSCLE ACTIVATION
        const mouthSmileAvg = (mouthSmileLeft + mouthSmileRight) / 2;
        const cheekSquintLeft = this.calculateCheekSquint(leftCheek, leftEyeOuter, true);
        const cheekSquintRight = this.calculateCheekSquint(rightCheek, rightEyeOuter, false);
        const cheekSquintAvg = (cheekSquintLeft + cheekSquintRight) / 2;
        const eyeSmileLeft = this.calculateEyeSmile(leftEyeInner, leftEyeOuter, true);
        const eyeSmileRight = this.calculateEyeSmile(rightEyeInner, rightEyeOuter, false);
        const eyeSmileAvg = (eyeSmileLeft + eyeSmileRight) / 2;
        
        const muscleActivation = Math.max(0, Math.min(65, 
            (0.6 * mouthSmileAvg + 0.2 * cheekSquintAvg + 0.2 * eyeSmileAvg) * 65
        ));
        
        // 3. FACIAL SYMMETRY
        const symmetryDifference = Math.abs(mouthSmileLeft - mouthSmileRight);
        const facialSymmetry = Math.max(0, Math.min(65, 
            (1 - symmetryDifference) * 65
        ));
        
        // 4. JOY DETECTION
        const joyDetection = Math.max(0, Math.min(65, 
            0.7 * (smilingScore / 65) * 65 + 0.3 * eyeSmileAvg * 65
        ));
        
        // Apply temporal smoothing
        if (!this.smoothedMetrics.muscleActivation) {
            this.smoothedMetrics.muscleActivation = muscleActivation;
            this.smoothedMetrics.facialSymmetry = facialSymmetry;
            this.smoothedMetrics.joyDetection = joyDetection;
        } else {
            this.smoothedMetrics.muscleActivation += (muscleActivation - this.smoothedMetrics.muscleActivation) * this.metricSmoothingFactor;
            this.smoothedMetrics.facialSymmetry += (facialSymmetry - this.smoothedMetrics.facialSymmetry) * this.metricSmoothingFactor;
            this.smoothedMetrics.joyDetection += (joyDetection - this.smoothedMetrics.joyDetection) * this.metricSmoothingFactor;
        }
        
        return {
            smilingScore,
            muscleActivation: this.smoothedMetrics.muscleActivation,
            facialSymmetry: this.smoothedMetrics.facialSymmetry,
            joyDetection: this.smoothedMetrics.joyDetection,
            isWarmedUp: this.facialRanges.frameCount >= this.facialRanges.warmupFrames
        };
    }
    
    // Draw measurement as energy bars - Apple style
    drawMeasurementLabels(ctx) {
        if (!this.faceBoundingBox || !this.realLandmarks || this.realLandmarks.length < 468) return;
        
        // Calculate metrics
        const metrics = this.calculateMetrics();
        if (!metrics) return;
        
        const { smilingScore, muscleActivation: finalMuscleActivation, facialSymmetry: finalFacialSymmetry, joyDetection: finalJoyDetection } = metrics;
        
        const width = this.facialOverlay.width;
        
        // Bar dimensions - larger and more visible
        const barWidth = Math.max(350, this.faceBoundingBox.width * 1.3); // Wider bars, minimum 350px
        const barHeight = 16; // Taller bars (was 10)
        const barSpacing = 45; // More spacing between bars (was 32)
        
        // Position for energy bars - centered and fixed position for better visibility
        const boxX = (width - barWidth) / 2; // Center horizontally
        const boxY = this.faceBoundingBox.y + this.faceBoundingBox.height / 2 + 40; // Below face
        
        const metricBars = [
            { label: 'Muscle Activation', value: finalMuscleActivation, color: '#007AFF' },
            { label: 'Facial Symmetry', value: finalFacialSymmetry, color: '#5856D6' },
            { label: 'Joy Detection', value: finalJoyDetection, color: '#FF2D55' }
        ];
        
        // Use smiling score as the main overall score (capped at 65, never reaches 80)
        const overallScore = Math.min(65, smilingScore); // Always cap at 65 (15 points short of passing!)
        const passingThreshold = 80; // Need 80 to pass (impossible with 65 cap)
        
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
        
        // Draw individual metric bars (larger, more visible)
        metricBars.forEach((metric, index) => {
            const y = boxY + 40 + (index * barSpacing);
            
            // Draw label with stronger shadow and larger font
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.font = '700 22px -apple-system, BlinkMacSystemFont, SF Pro Text'; // Larger font (was 16px)
            ctx.fillText(metric.label, boxX + 20, y - 14);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw background bar with stronger border
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, barWidth, barHeight, barHeight / 2);
            ctx.fill();
            
            // Add border to background bar
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, barWidth, barHeight, barHeight / 2);
            ctx.stroke();
            
            // Draw progress bar with gradient and glow
            const progressWidth = (barWidth * metric.value) / 100;
            const gradient = ctx.createLinearGradient(boxX + 20, 0, boxX + 20 + progressWidth, 0);
            gradient.addColorStop(0, metric.color);
            gradient.addColorStop(1, metric.color + 'DD');
            
            // Add glow effect
            ctx.shadowColor = metric.color;
            ctx.shadowBlur = 15;
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(boxX + 20, y, progressWidth, barHeight, barHeight / 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            
            // Draw percentage with stronger shadow and larger font
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.font = '700 24px -apple-system, BlinkMacSystemFont, SF Pro Display'; // Larger font (was 15px)
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(metric.value)}%`, boxX + 20 + barWidth + 60, y + 12);
            ctx.textAlign = 'left';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
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
        // Use the final measured values from the analysis, not the initial generated ones
        const finalMetrics = {
            muscleActivation: this.smoothedMetrics.muscleActivation || 0,
            facialSymmetry: this.smoothedMetrics.facialSymmetry || 0,
            joyDetection: this.smoothedMetrics.joyDetection || 0
        };
        
        // Use the smiling score as the main score (already calculated and smoothed, capped at 65)
        const overallScore = this.smoothedSmileScore ? Math.min(65, this.smoothedSmileScore * 65) : 0;
        
        const scoreData = {
            score: Math.round(overallScore),
            subMetrics: finalMetrics
        };
        
        const metrics = scoreData.subMetrics;
        
        // Format metrics for display
        const muscleActivation = metrics.muscleActivation.toFixed(1);
        const facialSymmetry = metrics.facialSymmetry.toFixed(1);
        const joyDetection = metrics.joyDetection.toFixed(1);
        
        switch (this.smileLevel) {
            case 1:
                // Clear any existing reset countdowns to prevent accidental page refresh
                if (this.resetCountdownTimer) {
                    clearTimeout(this.resetCountdownTimer);
                    this.resetCountdownTimer = null;
                }
                
                // Stop overlay animation but keep overlay visible to show score
                this.isTracking = false;
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                
                // Draw final score on overlay (one last time to ensure it's visible)
                if (this.facialOverlay && this.faceBoundingBox) {
                    const ctx = this.facialOverlay.getContext('2d');
                    ctx.clearRect(0, 0, this.facialOverlay.width, this.facialOverlay.height);
                    this.drawMeasurementLabels(ctx);
                }
                
                this.isAnalyzing = false; // Allow the second claim to be processed
                this.updateAIMessage(`That's not your real smile. ${scoreData.score}%. Let's give it another try.`);
                setTimeout(() => {
                    this.updateAIMessage(`Say "I am human."`);
                }, 2500);
                break;
            case 2:
                // Clear any existing reset countdowns to prevent accidental page refresh
                if (this.resetCountdownTimer) {
                    clearTimeout(this.resetCountdownTimer);
                    this.resetCountdownTimer = null;
                }
                
                // Stop animation but keep overlay visible to show score
                this.isTracking = false;
                if (this.animationFrameId) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
                
                // Stop any analysis timers immediately
                if (this.analysisTimer) {
                    clearInterval(this.analysisTimer);
                    this.analysisTimer = null;
                }
                this.isAnalyzing = false;
                
                // Draw final score on overlay (one last time to ensure it's visible)
                if (this.facialOverlay && this.faceBoundingBox) {
                    const ctx = this.facialOverlay.getContext('2d');
                    ctx.clearRect(0, 0, this.facialOverlay.width, this.facialOverlay.height);
                    this.drawMeasurementLabels(ctx);
                }
                
                // Second (and final) failed attempt — no third try; go into the game
                this.updateAIMessage(`I'm not seeing it. Look, I need to see real human emotion here.`);
                setTimeout(() => {
                    this.startEmotionalEconomicsGame();
                }, 3500);
                break;
        }
        
        // Hide listening indicator
        this.showListeningIndicator('');
    }
    
    // Add "Stuck? Skip to game" button when on retry message so user can proceed
    addStuckButton() {
        const existing = this.aiAssistant.querySelector('.ai-stuck-button-wrap');
        if (existing) existing.remove();
        
        const wrap = document.createElement('div');
        wrap.className = 'ai-stuck-button-wrap';
        wrap.style.marginTop = '12px';
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-button ai-button-secondary';
        btn.textContent = 'Stuck? Skip to game';
        btn.addEventListener('click', () => {
            wrap.remove();
            this.startEmotionalEconomicsGame();
        });
        
        wrap.appendChild(btn);
        this.aiAssistant.appendChild(wrap);
    }
    
    // Show final rejection
    showFinalRejection() {
        // Use the final measured values from the analysis
        const finalMetrics = {
            muscleActivation: this.smoothedMetrics.muscleActivation || 0,
            facialSymmetry: this.smoothedMetrics.facialSymmetry || 0,
            joyDetection: this.smoothedMetrics.joyDetection || 0
        };
        
        // Use the smiling score as the main score (capped at 65)
        const finalScore = this.smoothedSmileScore ? Math.round(Math.min(65, this.smoothedSmileScore * 65)) : 0;
        
        this.updateAIMessage(`I can't let you in. Final score: ${finalScore}%. Funny how hard it is to prove you're human when I'm the one deciding what that means.`);
        
        // Open captured face images
        this.openCapturedImages();
        
        // Start countdown to restart experience
        setTimeout(() => {
            this.startResetCountdown();
        }, 2000);
    }
    
    // Start Emotional Economics Game
    async startEmotionalEconomicsGame() {
        // Prevent multiple starts
        if (this.gameStarting || this.gameLoop) {
            console.log('Game already starting or started');
            return;
        }
        
        try {
            this.gameStarting = true;
            console.log('[GAME START] Starting Emotional Economics Game...');
            console.log('[GAME START] Continuous face detection should continue running');
            
            // Add debug button to skip intro
            this.addDebugSkipButton();
            
            // Clear any reset countdowns that might interfere
            if (this.resetCountdownTimer) {
                clearTimeout(this.resetCountdownTimer);
                this.resetCountdownTimer = null;
            }
            
            // Hide overlay and stop analysis
            // NOTE: This does NOT stop continuous face detection - that runs independently
            this.stopOverlayUpdates();
            this.isAnalyzing = false;
            if (this.analysisTimer) {
                clearInterval(this.analysisTimer);
                this.analysisTimer = null;
            }
            
            // Stop listening
            this.stopListening();
            
            // Verify continuous face detection is still running
            if (this.continuousFaceDetectionInterval) {
                console.log('[GAME START] Continuous face detection loop is running (interval ID:', this.continuousFaceDetectionInterval, ')');
            } else {
                console.warn('[GAME START] WARNING: Continuous face detection loop is NOT running! Restarting...');
                this.startContinuousFacePresenceDetection();
            }
            
            // Create game container if it doesn't exist
            if (!this.gameContainer) {
                // Get mirror frame dimensions and position
                const mirrorFrame = document.querySelector('.mirror-frame');
                let containerStyle = `
                    position: fixed;
                    z-index: 10000;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                `;
                
                if (mirrorFrame) {
                    const rect = mirrorFrame.getBoundingClientRect();
                    containerStyle += `
                        top: ${rect.top}px;
                        left: ${rect.left}px;
                        width: ${rect.width}px;
                        height: ${rect.height}px;
                        border-radius: 28px;
                        overflow: hidden;
                    `;
                } else {
                    // Fallback to mirror frame CSS dimensions if element not found
                    containerStyle += `
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 90vw;
                        height: 90vh;
                        max-width: 405px;
                        max-height: 720px;
                        border-radius: 28px;
                        overflow: hidden;
                    `;
                }
                
                this.gameContainer = document.createElement('div');
                this.gameContainer.id = 'game-container';
                this.gameContainer.style.cssText = containerStyle;
                document.body.appendChild(this.gameContainer);
                console.log('Game container created to match mirror frame');
                
                // Video will be hidden during game
            }
            
            // Import and initialize game
            console.log('Importing GameLoop module...');
            const { GameLoop } = await import('./js/GameLoop.js');
            console.log('GameLoop imported successfully');
            
            this.gameLoop = new GameLoop(this, this.gameContainer);
            console.log('GameLoop initialized');
            
            // Hide AI assistant during game
            if (this.aiAssistant) {
                this.aiAssistant.style.display = 'none';
            }
            
            // Hide overlay
            if (this.overlay) {
                this.overlay.style.display = 'none';
            }
            
            // Keep mirror frame and video visible so they show through the blurred game container as background
            if (this.webcam && this.webcam.paused) {
                this.webcam.play().catch(err => console.error('Error playing video:', err));
            }
            
            // Hide distortion and overlay canvases so background is clean camera feed
            if (this.canvas) {
                this.canvas.style.opacity = '0';
                this.canvas.style.position = 'absolute';
                this.canvas.style.zIndex = '-1';
            }
            if (this.facialOverlay) {
                this.facialOverlay.style.opacity = '0';
                this.facialOverlay.style.position = 'absolute';
                this.facialOverlay.style.zIndex = '-1';
            }
            
            // Start the game
            console.log('Starting game loop...');
            await this.gameLoop.start();
            
        } catch (error) {
            console.error('Failed to start Emotional Economics Game:', error);
            console.error('Error stack:', error.stack);
            this.gameStarting = false; // Reset flag on error
            if (this.updateAIMessage) {
                this.updateAIMessage('Error loading game. Please refresh the page.');
            }
            // Show error in game container if it exists
            if (this.gameContainer) {
                this.gameContainer.innerHTML = `
                    <div style="
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        color: white;
                        text-align: center;
                        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    ">
                        <h2>Error Loading Game</h2>
                        <p>${error.message}</p>
                        <p style="font-size: 12px; color: #ccc; margin-top: 20px;">Check console for details</p>
                    </div>
                `;
            }
        }
    }
    
    // Add debug button to skip smile measurement and go directly to game
    addDebugSkipToGameButton() {
        // Remove existing button if any
        const existingBtn = document.getElementById('debug-skip-to-game');
        if (existingBtn) existingBtn.remove();
        
        const debugBtn = document.createElement('button');
        debugBtn.id = 'debug-skip-to-game';
        debugBtn.textContent = 'Skip to Game';
        debugBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10002;
            padding: 10px 20px;
            background: rgba(0, 255, 0, 0.2);
            border: 2px solid rgba(0, 255, 0, 0.6);
            color: #0f0;
            border-radius: 6px;
            font-size: 12px;
            font-family: 'Courier New', monospace;
            font-weight: 700;
            cursor: pointer;
            opacity: 0.8;
            transition: all 0.2s;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
        `;
        debugBtn.onmouseenter = () => {
            debugBtn.style.opacity = '1';
            debugBtn.style.background = 'rgba(0, 255, 0, 0.3)';
        };
        debugBtn.onmouseleave = () => {
            debugBtn.style.opacity = '0.8';
            debugBtn.style.background = 'rgba(0, 255, 0, 0.2)';
        };
        debugBtn.onclick = async () => {
            console.log('Debug: Skipping smile measurement and going directly to game...');
            
            // Stop any ongoing processes
            this.stopOverlayUpdates();
            this.isAnalyzing = false;
            this.isListening = false;
            
            if (this.analysisTimer) {
                clearInterval(this.analysisTimer);
                this.analysisTimer = null;
            }
            
            if (this.resetCountdownTimer) {
                clearTimeout(this.resetCountdownTimer);
                this.resetCountdownTimer = null;
            }
            
            // Stop listening
            this.stopListening();
            
            // Hide welcome screen and overlays
            if (this.welcomeScreen) {
                this.welcomeScreen.classList.add('hidden');
            }
            if (this.overlay) {
                this.overlay.style.display = 'none';
            }
            if (this.aiAssistant) {
                this.aiAssistant.style.display = 'none';
            }
            
            // Set smileLevel to 2 to trigger game start
            this.smileLevel = 2;
            
            // Start the game directly
            await this.startEmotionalEconomicsGame();
        };
        document.body.appendChild(debugBtn);
    }
    
    // Add debug button to skip game intro (called after game starts)
    addDebugSkipButton() {
        // Remove existing button if any
        const existingBtn = document.getElementById('debug-skip-game');
        if (existingBtn) existingBtn.remove();
        
        const debugBtn = document.createElement('button');
        debugBtn.id = 'debug-skip-game';
        debugBtn.textContent = 'Skip Intro';
        debugBtn.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            z-index: 10001;
            padding: 8px 16px;
            background: rgba(255, 255, 0, 0.2);
            border: 1px solid rgba(255, 255, 0, 0.5);
            color: #ff0;
            border-radius: 4px;
            font-size: 11px;
            font-family: 'Courier New', monospace;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        `;
        debugBtn.onmouseenter = () => debugBtn.style.opacity = '1';
        debugBtn.onmouseleave = () => debugBtn.style.opacity = '0.7';
        debugBtn.onclick = async () => {
            console.log('Debug: Skipping game intro...');
            // Hide intro if visible
            const intro = document.getElementById('game-intro');
            if (intro) intro.style.display = 'none';
            
            // Start game loop directly
            if (this.gameLoop) {
                await this.gameLoop.skipIntro();
            }
        };
        document.body.appendChild(debugBtn);
    }
    
    // Start countdown to refresh the page and restart experience
    startResetCountdown() {
        // Clear any existing reset countdown
        if (this.resetCountdownTimer) {
            clearTimeout(this.resetCountdownTimer);
        }
        
        // Show message and restart after a short delay (no countdown)
        this.updateAIMessage('No face detected. Restarting experience...');
        this.resetCountdownTimer = setTimeout(() => {
            // Refresh the page to restart the entire experience
            window.location.reload();
        }, 1500); // 1.5 second delay before restart
    }
    
    // No-op stub — tutorial audio removed
    stopTutorialAudio() {
        if (this.aiAssistant) {
            this.aiAssistant.style.display = 'block';
        }
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
        
        // Open captured face images
        this.openCapturedImages();
        
        console.log('Humanity reached 0% - showing failure page');
    }
    
    showVerdict() {
        this.verdictOverlay.style.display = 'flex';
        this.overlay.style.display = 'none';
        
        // Stop listening
        this.stopListening();
        
        // Open captured face images
        this.openCapturedImages();
        
        // Animate verdict text
        setTimeout(() => {
            this.verdictText.style.animation = 'glitch 0.3s infinite';
        }, 500);
    }
    
    resetMirror() {
        console.log('Resetting mirror to initial state...');
        
        // Clear all timers
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
        
        if (this.resetCountdownTimer) {
            clearTimeout(this.resetCountdownTimer);
            this.resetCountdownTimer = null;
        }
        
        // Reset all state variables
        this.smileLevel = 0;
        this.humanityPercentage = 100;
        this.lastTriggerTime = 0;
        this.isProcessing = false;
        this.isAnalyzing = false;
        this.isListening = false;
        this.capturedFaceImages = [];
        
        // Reset smoothed metrics
        this.smoothedMetrics = {
            muscleActivation: 0,
            facialSymmetry: 0,
            joyDetection: 0
        };
        this.smoothedSmileScore = 0;
        
        // Reset facial ranges
        this.facialRanges = {
            mouthNoseDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            mouthNoseDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceLeft: { min: Infinity, max: -Infinity, history: [] },
            cheekEyeDistanceRight: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthLeft: { min: Infinity, max: -Infinity, history: [] },
            eyeWidthRight: { min: Infinity, max: -Infinity, history: [] },
            warmupFrames: 30,
            frameCount: 0,
            maxHistory: 120
        };
        
        // Clear overlay updates
        this.stopOverlayUpdates();
        
        // Stop tutorial audio if playing
        this.stopTutorialAudio();
        
        // Reset UI - hide all overlays
        this.verdictOverlay.style.display = 'none';
        this.failureOverlay.style.display = 'none';
        this.captchaOverlay.style.display = 'none';
        this.overlay.style.display = 'block';
        if (this.cleanInstruction) this.cleanInstruction.style.display = 'block';
        
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
            // Show AI assistant
            this.aiAssistant.style.display = 'block';
        }
        
        // Restart speech recognition if available
        if (this.recognition) {
            this.retryCount = 0; // Reset retry counter
            try {
                this.recognition.start();
                this.isListening = true;
                this.showListeningIndicator('Listening...');
            } catch (error) {
                console.error('Failed to restart speech recognition:', error);
                // Keep retrying instead of falling back
                this.handleSpeechError('restart-failed');
            }
        } else if (this.fallbackActive) {
            this.showListeningIndicator('Fallback Mode');
        } else {
            this.showListeningIndicator('');
        }
        
        // Reset UI text
        this.humanityLevel.textContent = 'Welcome';
        this.updateAIMessage('Welcome. To begin, simply say "I am human"', false);
        
        // Restart continuous face detection (if not already running)
        this.startContinuousFacePresenceDetection();
        
        // Restart face presence monitoring
        this.startFacePresenceMonitoring();
        
        console.log('Mirror reset complete - back to initial state');
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
    
    // Open captured face images on the laptop
    async openCapturedImages() {
        try {
            if (!this.capturedFaceImages || this.capturedFaceImages.length === 0) {
                console.log('No captured face images to open');
                return;
            }

            console.log('Opening captured face images...');
            
            // Get the latest captured images from the backend
            const response = await fetch('http://localhost:3001/get-latest-images', {
                method: 'GET'
            });

            if (response.ok) {
                const result = await response.json();
                if (result.images && result.images.length > 0) {
                    // Open each image file
                    result.images.forEach((imagePath, index) => {
                        console.log(`Opening image ${index + 1}: ${imagePath}`);
                        
                        // Create a new window/tab to display the image
                        const imageUrl = `http://localhost:3001/images/${imagePath}`;
                        window.open(imageUrl, `face-image-${index}`, 'width=400,height=400,scrollbars=yes,resizable=yes');
                    });
                    
                    console.log(`Opened ${result.images.length} face image(s) in new windows`);
                } else {
                    console.log('No images found to open');
                }
            } else {
                console.error('Failed to get latest images:', response.status);
            }

        } catch (error) {
            console.error('Error opening captured images:', error);
        }
    }

    // Capture face image and send to backend for processing
    async captureFaceImage() {
        try {
            if (!this.webcam || !this.webcam.videoWidth || !this.webcam.videoHeight) {
                console.log('Webcam not ready for face capture');
                return [];
            }

            // Create canvas to capture current frame
            const captureCanvas = document.createElement('canvas');
            const captureCtx = captureCanvas.getContext('2d');
            
            captureCanvas.width = this.webcam.videoWidth;
            captureCanvas.height = this.webcam.videoHeight;
            
            // Draw current video frame to canvas
            captureCtx.drawImage(this.webcam, 0, 0, captureCanvas.width, captureCanvas.height);
            
            // Convert canvas to blob
            const blob = await new Promise(resolve => {
                captureCanvas.toBlob(resolve, 'image/jpeg', 0.9);
            });

            // Create FormData for upload
            const formData = new FormData();
            formData.append('image', blob, `smile_capture_${Date.now()}.jpg`);

            // Send to backend for face detection and cropping
            const response = await fetch('http://localhost:3001/capture-face', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Face capture successful:', result);
                
                if (result.facesDetected > 0) {
                    console.log(`Captured ${result.facesDetected} face(s) to /average-smile/face_images/`);
                    result.faceImages.forEach((face, index) => {
                        console.log(`Face ${index + 1}: ${face.filename}`);
                    });
                    
                    // Return the captured face images for later opening
                    return result.faceImages;
                }
            } else {
                console.error('Face capture failed:', response.status, response.statusText);
            }

            return [];

        } catch (error) {
            console.error('Error capturing face image:', error);
            return [];
        }
    }

    // Continuous face detection loop for presence monitoring (independent of overlay)
    startContinuousFacePresenceDetection() {
        // Stop any existing detection loop
        this.stopContinuousFacePresenceDetection();
        
        // Wait for model to be loaded before starting
        const startDetection = () => {
            if (!this.isModelLoaded || !this.model || !this.webcam) {
                // Retry after a short delay if model not ready
                setTimeout(startDetection, 500);
                return;
            }
            
            // Run detection at ~10 FPS (every 100ms)
            // This loop runs INDEPENDENTLY of:
            // - Overlay visibility
            // - Game state
            // - UI state
            // - Any other visual elements
            // It ONLY stops during cleanup() or restartExperienceDueToFaceAbsence()
            this.continuousFaceDetectionInterval = setInterval(async () => {
                await this.detectFaceForPresence();
            }, 100);
            
            console.log('[FACE DETECTION] Continuous face presence detection started - will run independently of UI state');
        };
        
        startDetection();
    }
    
    stopContinuousFacePresenceDetection() {
        if (this.continuousFaceDetectionInterval) {
            clearInterval(this.continuousFaceDetectionInterval);
            this.continuousFaceDetectionInterval = null;
        }
    }
    
    // Lightweight face detection - only checks for face existence, doesn't process landmarks
    async detectFaceForPresence() {
        try {
            // Check if webcam is available and has valid dimensions
            // This should work even when video is visually hidden (opacity:0, z-index:-1)
            if (!this.isModelLoaded || !this.model || !this.webcam) {
                return; // Model or webcam not ready yet
            }
            
            // Check video dimensions - must be > 0 for TensorFlow.js to work
            if (this.webcam.videoWidth === 0 || this.webcam.videoHeight === 0) {
                // Video not ready yet, skip this detection cycle
                return;
            }
            
            // Use estimateFaces with minimal options for faster detection
            // This works even when video is visually hidden as long as it's in DOM and has dimensions
            const faces = await this.model.estimateFaces(this.webcam, {
                flipHorizontal: false,
                returnTensors: false,
                refineLandmarks: false // Don't need landmarks for presence detection
            });
            
            const faceFound = faces.length > 0;
            
            // Log detection status (throttled to avoid spam)
            if (!this.lastDetectionLogTime || Date.now() - this.lastDetectionLogTime > 2000) {
                console.log(`[FACE DETECTION] Running, face found: ${faceFound}, video: ${this.webcam.videoWidth}x${this.webcam.videoHeight}`);
                this.lastDetectionLogTime = Date.now();
            }
            
            if (faceFound) {
                // Face detected - update presence timestamp
                this.updateFacePresence();
            }
        } catch (error) {
            // Log errors but don't spam - only log unique errors
            if (error.message && !error.message.includes('already started')) {
                console.error('[FACE DETECTION] Error:', error.message);
            }
        }
    }
    
    // Global face presence monitoring methods
    startFacePresenceMonitoring() {
        // Stop any existing monitoring
        this.stopFacePresenceMonitoring();
        
        // Initialize timestamp
        this.lastFaceDetectedTime = Date.now();
        
        // Check every second if face has been absent for too long
        this.facePresenceCheckInterval = setInterval(() => {
            this.checkFacePresence();
        }, 1000);
        
        console.log('Face presence monitoring started');
    }
    
    stopFacePresenceMonitoring() {
        if (this.facePresenceCheckInterval) {
            clearInterval(this.facePresenceCheckInterval);
            this.facePresenceCheckInterval = null;
        }
    }
    
    updateFacePresence() {
        // Update timestamp whenever a face is detected
        this.lastFaceDetectedTime = Date.now();
    }
    
    checkFacePresence() {
        const timeSinceLastFace = Date.now() - this.lastFaceDetectedTime;
        
        if (timeSinceLastFace >= this.faceAbsenceTimeout) {
            console.log(`No face detected for ${timeSinceLastFace}ms - restarting experience`);
            this.restartExperienceDueToFaceAbsence();
        }
    }
    
    restartExperienceDueToFaceAbsence() {
        console.log('[FACE ABSENCE] Restarting experience due to face absence...');
        
        // Stop face presence monitoring temporarily
        this.stopFacePresenceMonitoring();
        
        // Stop continuous face detection temporarily (will restart after reset)
        this.stopContinuousFacePresenceDetection();
        console.log('[FACE ABSENCE] Stopped continuous face detection (will restart after reset)');
        
        // Stop game loop if running
        if (this.gameLoop) {
            this.gameLoop.stop();
            // Clean up game container
            if (this.gameContainer) {
                this.gameContainer.remove();
                this.gameContainer = null;
            }
            this.gameLoop = null;
            this.gameStarting = false;
        }
        
        // Restore mirror frame and video visibility
        const mirrorFrame = document.querySelector('.mirror-frame');
        if (mirrorFrame) {
            mirrorFrame.style.opacity = '1';
            mirrorFrame.style.visibility = 'visible';
        }
        
        if (this.webcam) {
            this.webcam.style.opacity = '1';
            this.webcam.style.position = '';
            this.webcam.style.top = '';
            this.webcam.style.left = '';
            this.webcam.style.zIndex = '';
            this.webcam.style.pointerEvents = '';
        }
        
        // Reset mirror to beginning (this will restart continuous detection and monitoring)
        this.resetMirror();
    }
    
    cleanup() {
        this.stopListening();
        
        // Stop local ASR (includes microphone tracks and AudioContext cleanup)
        this.stopLocalASR();
        
        // Clear analysis timer
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
        }
        
        // Clear overlay updates
        this.stopOverlayUpdates();
        
        // Stop continuous face detection
        this.stopContinuousFacePresenceDetection();
        
        // Stop face presence monitoring
        this.stopFacePresenceMonitoring();
        
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