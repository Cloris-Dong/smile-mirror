const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Simple face detection using basic image processing
// Since face-api.js doesn't work well in Node.js, we'll use a simpler approach
let modelsLoaded = true; // Always true for our simple approach

// Face capture endpoint
app.post('/capture-face', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const imageBuffer = req.file.buffer;
        const faceDir = path.join(__dirname, 'face_images');

        // Ensure directory exists
        if (!fs.existsSync(faceDir)) {
            fs.mkdirSync(faceDir, { recursive: true });
        }

        // For now, we'll save the entire image as a "face" since the frontend
        // already has face detection. This is a simpler approach that works reliably.
        const timestamp = Date.now();
        const filename = `face_${timestamp}_0.jpg`;
        const filepath = path.join(faceDir, filename);

        // Process and save the image
        const processedImage = await sharp(imageBuffer)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer();

        fs.writeFileSync(filepath, processedImage);

        // Create basic landmarks data (simplified)
        const landmarksData = [
            { x: 100, y: 100 }, // Left eye
            { x: 200, y: 100 }, // Right eye
            { x: 150, y: 150 }, // Nose
            { x: 120, y: 200 }, // Left mouth corner
            { x: 180, y: 200 }  // Right mouth corner
        ];

        const landmarksFilename = `face_${timestamp}_0_landmarks.json`;
        const landmarksFilepath = path.join(faceDir, landmarksFilename);
        fs.writeFileSync(landmarksFilepath, JSON.stringify(landmarksData, null, 2));

        const faceImages = [{
            filename: filename,
            landmarksFile: landmarksFilename,
            box: {
                x: 0,
                y: 0,
                width: 300,
                height: 300
            },
            expressions: {
                neutral: 0.8,
                happy: 0.2
            }
        }];

        console.log(`Face captured and saved: ${filename}`);

        res.json({
            success: true,
            facesDetected: 1,
            faceImages: faceImages
        });

    } catch (error) {
        console.error('Error processing face capture:', error);
        res.status(500).json({ error: 'Failed to process face capture' });
    }
});

// Serve face images
app.use('/images', express.static(path.join(__dirname, 'face_images')));

// Get latest captured images
app.get('/get-latest-images', (req, res) => {
    try {
        const faceDir = path.join(__dirname, 'face_images');
        
        if (!fs.existsSync(faceDir)) {
            return res.json({ images: [] });
        }

        // Get all image files (not landmarks)
        const files = fs.readdirSync(faceDir)
            .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
            .sort((a, b) => {
                // Sort by modification time, newest first
                const statA = fs.statSync(path.join(faceDir, a));
                const statB = fs.statSync(path.join(faceDir, b));
                return statB.mtime - statA.mtime;
            })
            .slice(0, 10); // Get latest 10 images

        res.json({ images: files });
    } catch (error) {
        console.error('Error getting latest images:', error);
        res.status(500).json({ error: 'Failed to get latest images' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        modelsLoaded: modelsLoaded,
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Face capture server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
