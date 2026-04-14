# Smile Mirror - Face Capture System

A digital mirror application that measures smiles and captures face images of people being measured.

## Features

- Real-time face detection and smile measurement
- Automatic face capture during smile verification
- Backend processing to crop and save individual faces
- Support for multiple people in frame (captures all detected faces)
- Face images saved to `/face_images/` directory (project root)
- **NEW**: Automatically opens captured face images in new browser windows when the experience is complete

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the backend server:
```bash
npm start
```

3. Open `index.html` in a web browser

### Development

For development with auto-reload:
```bash
npm run dev
```

## How It Works

1. When a user says "I am human", the system triggers smile verification
2. During each smile measurement level, the camera captures the current frame
3. The image is sent to the backend server at `http://localhost:3001/capture-face`
4. The backend processes the image and saves it as a face capture
5. Each detected face is cropped and saved as a separate image file
6. Face landmarks data is also saved for each face
7. Only faces of people being measured are captured (not others in the frame)
8. **When the experience is complete** (failure, tutorial end, or final rejection), captured face images automatically open in new browser windows

## API Endpoints

- `POST /capture-face` - Upload image and get cropped face images
- `GET /get-latest-images` - Get list of latest captured face images
- `GET /images/*` - Serve face images for viewing
- `GET /health` - Health check endpoint

## File Structure

```
smile-mirror/
├── server.js              # Backend server
├── package.json           # Dependencies
├── index.html            # Frontend HTML
├── script.js             # Frontend JavaScript
├── styles.css            # Frontend CSS
├── js/                   # Game + story modules (GameLoop, GameUI, MirrorStory, …)
└── face_images/          # Saved face images and landmarks (created on first capture)
    ├── face_TIMESTAMP_0.jpg
    ├── face_TIMESTAMP_0_landmarks.json
    └── ...
```

## Configuration

The face capture system automatically:
- Captures the current camera frame during smile measurement
- Resizes images to 300x300 pixels
- Saves faces as JPEG images with 90% quality
- Generates unique filenames with timestamps
- Saves basic facial landmarks data as JSON files

## Browser Compatibility

- Requires camera and microphone permissions
- Works best in Chrome, Firefox, Safari, and Edge
- Requires HTTPS for camera access in production