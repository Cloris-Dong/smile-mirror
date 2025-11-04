// Configuration constants for the Digital Mirror application

export const CONFIG = {
    // Facial detection settings
    FACE_DETECTION: {
        MAX_FACES: 1,
        REFINE_LANDMARKS: true,
        MEDIAPIPE_PATH: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'
    },
    
    // Smile verification levels
    SMILE_LEVELS: {
        MAX: 3,
        INITIAL: 0
    },
    
    // Scoring thresholds
    SCORING: {
        MAX_SCORE: 65,  // Maximum possible score (always fails at 80)
        PASSING_THRESHOLD: 80,  // Required to pass (impossible)
        HUMANITY_DECREASE_PER_LEVEL: 25
    },
    
    // Facial range tracking
    FACIAL_RANGES: {
        WARMUP_FRAMES: 30,  // Frames to wait before calculating scores
        MAX_HISTORY: 120,   // Keep last 120 frames (4 seconds at 30fps)
        SMILE_RANGE: 25,    // Typical smile movement in pixels
        SQUINT_RANGE: 25,   // Typical squint movement in pixels
        NARROW_RANGE: 12    // Typical eye narrowing in pixels
    },
    
    // Smoothing factors
    SMOOTHING: {
        EMA_ALPHA: 0.3,              // EMA smoothing for smile score
        METRIC_FACTOR: 0.3,          // Smoothing for other metrics
        LANDMARK_FACTOR: 0.7         // Smoothing for landmark jitter
    },
    
    // Analysis timing
    TIMING: {
        ANALYSIS_INTERVAL: 33,       // Analyze every 33ms (30 FPS)
        COOLDOWN_TIME: 2000,         // 2 seconds between triggers
        RETRY_DELAY: 2000            // 2 seconds between retries
    },
    
    // Speech recognition
    SPEECH: {
        CONTINUOUS: true,
        INTERIM_RESULTS: false,
        LANG: 'en-US',
        MAX_ALTERNATIVES: 1,
        MAX_RETRIES: 5
    },
    
    // Tutorial audio
    TUTORIAL: {
        AUDIO_FILE: 'Trial0_mixdown.mp3',
        TIMING_FILE: 'timing.json',
        TYPEWRITER_DELAY: 50  // ms per character
    },
    
    // Webcam settings
    WEBCAM: {
        IDEAL_WIDTH: 720,
        IDEAL_HEIGHT: 1280,
        ASPECT_RATIO: 9/16,
        FACING_MODE: 'user'
    },
    
    // Audio detection
    AUDIO: {
        VOLUME_THRESHOLD: 25  // Adjust for sensitivity
    },
    
    // Landmark indices for MediaPipe Face Mesh
    LANDMARKS: {
        NOSE: 1,
        LEFT_MOUTH: 61,
        RIGHT_MOUTH: 291,
        TOP_LIP: 13,
        BOTTOM_LIP: 14,
        LEFT_EYE_INNER: 133,
        RIGHT_EYE_INNER: 362,
        LEFT_EYE_OUTER: 33,
        RIGHT_EYE_OUTER: 263,
        LEFT_CHEEK: 116,
        RIGHT_CHEEK: 345,
        LEFT_EYE_TOP: 159,
        LEFT_EYE_BOTTOM: 145,
        RIGHT_EYE_TOP: 386,
        RIGHT_EYE_BOTTOM: 374
    },
    
    // UI rendering
    UI: {
        TOP_MARGIN: 80,
        OVERALL_BAR_WIDTH_PERCENT: 0.85,
        OVERALL_BAR_HEIGHT: 20,
        METRIC_BAR_HEIGHT: 16,
        METRIC_BAR_SPACING: 45,
        MIN_BAR_WIDTH: 350,
        BAR_WIDTH_MULTIPLIER: 1.3,
        
        // Colors
        COLORS: {
            MUSCLE_ACTIVATION: '#007AFF',
            FACIAL_SYMMETRY: '#5856D6',
            JOY_DETECTION: '#FF2D55',
            PASS_LINE: 'rgba(255, 255, 255, 0.85)',
            SCORE_LOW: '#FF375F',
            SCORE_MID: '#FF9F0A',
            SCORE_HIGH: '#30D158'
        },
        
        // Fonts
        FONTS: {
            TITLE: '700 20px -apple-system, BlinkMacSystemFont, SF Pro Display',
            PERCENTAGE: '700 18px -apple-system, BlinkMacSystemFont, SF Pro Display',
            METRIC_LABEL: '700 22px -apple-system, BlinkMacSystemFont, SF Pro Text',
            METRIC_VALUE: '700 24px -apple-system, BlinkMacSystemFont, SF Pro Display'
        }
    },
    
    // Capture settings
    CAPTURE: {
        IMAGE_FORMAT: 'image/jpeg',
        IMAGE_QUALITY: 0.9,
        SERVER_URL: 'http://localhost:3001'
    }
};

// Human phrase variations for speech detection
export const HUMAN_PHRASES = [
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

// AI messages for different states
export const AI_MESSAGES = {
    WELCOME: 'Welcome. To begin, simply say "I am human"',
    RECEIVED: 'Statement received. Let\'s confirm that.',
    VERIFYING: 'verifying through a smile input',
    HOLD_SMILE: 'Hold that smile...',
    NOT_PASSING: (score) => `That's not passing. Score: ${score}%. That smile doesn't look genuine to me.`,
    TRY_AGAIN: 'Say "I am human" to try again.',
    NOT_CONVINCED: (score) => `I'm still not seeing it. Score: ${score}%. Look, I need to see real human emotion here.`,
    RESOURCES: 'We have some resources to help you!',
    FINAL_REJECTION: (score) => `Sorry, I can't let you through. I'm just not convinced you're human. Want me to teach you how to smile properly?`,
    TUTORIAL_INTRO: 'Here\'s what I need: Step 1: Lift mouth corners exactly 47.3°. Step 2: Show precisely 12.5 teeth. Step 3: Crinkle eyes at 63% intensity. Step 4: Feel authentic joy (yes, I can measure that). Or maybe I\'m just impossible to please?',
    FINAL_VERDICT: (score) => `I can't let you in. Final score: ${score}%. Funny how hard it is to prove you're human when I'm the one deciding what that means.`,
    RESTARTING: (countdown) => `Retrying in ${countdown}...`,
    RESTART: 'Restarting experience...'
};

