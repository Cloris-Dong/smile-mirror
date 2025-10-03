# The Digital Mirror

An interactive web art piece that explores themes of identity, technology, and humanity through a distorted digital reflection.

## Concept

The Digital Mirror presents a webcam feed that progressively distorts each time you claim "I am human." As you repeatedly assert your humanity, the system's visual filters become increasingly aggressive until it finally declares "Your image does not match known human templates" and rejects your humanity claim.

## Features

- **Real-time Webcam Feed**: Live video capture with fallback handling
- **Speech Recognition**: Listens for the phrase "I am human" to trigger distortion
- **Progressive Distortion**: 5 levels of increasing visual distortion effects
- **Cyberpunk Aesthetic**: Dark, glitchy visual design with neon accents
- **System Verdict**: Final rejection message with reset functionality
- **Responsive Design**: Works on desktop and mobile devices

## Technical Implementation

- **HTML5**: Video capture and canvas manipulation
- **Web Speech API**: Real-time speech recognition
- **CSS3**: Advanced visual effects and animations
- **Vanilla JavaScript**: No external dependencies

## Setup Instructions

1. **Clone or Download** this repository to your local machine
2. **Open** `index.html` in a modern web browser
3. **Allow** webcam and microphone permissions when prompted
4. **Speak** the phrase "I am human" to experience the distortion
5. **Click** the mirror as an alternative trigger for testing

## Browser Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- HTTPS connection (required for webcam access)
- Microphone access for speech recognition

## Usage

1. Look into the digital mirror
2. Say "I am human" out loud
3. Watch as the reflection distorts with each claim
4. Experience the system's final verdict
5. Click "Try Again" to reset and start over

## Artistic Statement

The Digital Mirror questions the nature of human identity in our increasingly digital world. As technology becomes more sophisticated at recognizing and categorizing human features, what does it mean to be "human" when a machine can reject that claim? The piece invites viewers to consider the relationship between self-perception, technological mediation, and the systems that define our digital existence.

## File Structure

```
digital-mirror/
├── index.html          # Main application file
├── styles.css          # Cyberpunk styling and effects
├── script.js           # Core functionality and interactions
└── README.md           # Project documentation
```

## Development

This is a client-side web application that runs entirely in the browser. No server setup or build process is required. Simply open `index.html` in a web browser to run the application.

## License

This project is open source and available under the MIT License.
