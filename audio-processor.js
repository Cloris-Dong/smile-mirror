// AudioWorklet processor for local ASR audio processing
// Processes audio and sends PCM16 frames to main thread

class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.samplesPerFrame = 320; // 20ms at 16kHz
        this.targetSampleRate = 16000;
        this.resampleBuffer = [];
    }

    process(inputs, outputs) {
        const input = inputs[0];
        
        // If no input, return
        if (!input || input.length === 0) {
            return true;
        }

        const inputChannel = input[0]; // Mono channel
        
        // Convert Float32Array to regular array for processing
        let samples = Array.from(inputChannel);
        
        // Resample if needed (usually already at 16kHz from getUserMedia)
        const actualSampleRate = sampleRate;
        if (actualSampleRate !== this.targetSampleRate) {
            samples = this.resampleAudio(samples, actualSampleRate, this.targetSampleRate);
        }
        
        // Accumulate samples in buffer
        this.resampleBuffer.push(...samples);
        
        // Process complete frames (320 samples = 640 bytes)
        while (this.resampleBuffer.length >= this.samplesPerFrame) {
            const frameSamples = this.resampleBuffer.splice(0, this.samplesPerFrame);
            
            // Convert float32 (-1.0 to 1.0) to PCM16 (int16: -32768 to 32767)
            const pcm16Buffer = new ArrayBuffer(this.samplesPerFrame * 2);
            const pcm16View = new Int16Array(pcm16Buffer);
            
            for (let i = 0; i < frameSamples.length; i++) {
                // Clamp to [-1, 1] and convert to int16
                const sample = Math.max(-1, Math.min(1, frameSamples[i]));
                pcm16View[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32768)));
            }
            
            // Send frame to main thread via message port
            // Convert ArrayBuffer to transferable format
            this.port.postMessage({
                type: 'audioFrame',
                data: pcm16Buffer
            }, [pcm16Buffer]);
        }
        
        return true; // Keep processor alive
    }

    resampleAudio(samples, fromRate, toRate) {
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
    }
}

registerProcessor('audio-processor', AudioProcessor);
