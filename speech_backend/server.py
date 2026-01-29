#!/usr/bin/env python3
"""
Speech Recognition WebSocket Server

This server receives raw PCM16 mono audio frames from the browser, uses VAD
to detect speech, and transcribes using whisper.cpp.

Usage:
    # Set environment variables (or use defaults)
    export WHISPER_BIN=/Users/handong/whisper.cpp/build/bin/whisper-cli
    export WHISPER_MODEL=/Users/handong/whisper.cpp/models/ggml-base.en.bin
    
    # Install dependencies
    pip install -r requirements.txt
    
    # Run the server
    python server.py

The server listens on ws://localhost:8765
"""

import asyncio
import json
import os
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Optional

import webrtcvad
import websockets
from websockets.server import serve


# Configuration
WS_HOST = "localhost"
WS_PORT = 8765
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes
FRAME_SIZE_MS = 20  # 20ms frames
SAMPLES_PER_FRAME = int(SAMPLE_RATE * FRAME_SIZE_MS / 1000)  # 320 samples
BYTES_PER_FRAME = SAMPLES_PER_FRAME * SAMPLE_WIDTH  # 640 bytes
VAD_MODE = 3  # Aggressiveness mode: 0-3, 3 is most aggressive
SILENCE_DURATION_MS = 600  # 600ms silence to end speech
SILENCE_FRAMES = int(SILENCE_DURATION_MS / FRAME_SIZE_MS)  # 30 frames


class SpeechSession:
    """Manages audio buffering and VAD for a single WebSocket connection."""
    
    def __init__(self, websocket):
        self.websocket = websocket
        self.vad = webrtcvad.Vad(VAD_MODE)
        self.audio_buffer = bytearray()
        self.is_speaking = False
        self.silence_frame_count = 0
        
    async def send_json(self, data: dict):
        """Send JSON message to client."""
        try:
            await self.websocket.send(json.dumps(data))
        except websockets.exceptions.ConnectionClosed:
            pass
    
    def process_frame(self, frame: bytes) -> tuple[bool, bool]:
        """
        Process a single audio frame with VAD.
        Returns (speech_started, speech_ended) tuple.
        """
        # Validate frame size
        if len(frame) != BYTES_PER_FRAME:
            return (False, False)
        
        # Check if this frame contains speech
        is_speech = self.vad.is_speech(frame, SAMPLE_RATE)
        speech_started = False
        
        if is_speech:
            self.silence_frame_count = 0
            if not self.is_speaking:
                # Speech just started
                self.is_speaking = True
                speech_started = True
            # Add frame to buffer
            self.audio_buffer.extend(frame)
        else:
            if self.is_speaking:
                # We're in speech, count silence frames
                self.silence_frame_count += 1
                # Still buffer silence frames (they might be part of speech)
                self.audio_buffer.extend(frame)
                
                # Check if we've reached silence threshold
                if self.silence_frame_count >= SILENCE_FRAMES:
                    # Speech has ended
                    self.is_speaking = False
                    return (False, True)
        
        return (speech_started, False)
    
    def clear_buffer(self):
        """Clear audio buffer and reset state."""
        self.audio_buffer.clear()
        self.is_speaking = False
        self.silence_frame_count = 0
    
    def save_to_wav(self, filepath: str) -> bool:
        """
        Save buffered audio to a WAV file.
        Returns True if successful.
        """
        try:
            with wave.open(filepath, 'wb') as wf:
                wf.setnchannels(CHANNELS)
                wf.setsampwidth(SAMPLE_WIDTH)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(self.audio_buffer)
            return True
        except Exception as e:
            print(f"Error saving WAV: {e}")
            return False


def transcribe_audio(wav_path: str, whisper_bin: str, whisper_model: str) -> Optional[str]:
    """
    Transcribe audio file using whisper.cpp CLI.
    Returns transcribed text or None on error.
    """
    try:
        cmd = [
            whisper_bin,
            "-m", whisper_model,
            "-f", wav_path,
            "--language", "en",
            "--no-timestamps"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=30  # 30 second timeout
        )
        
        # whisper-cli outputs text to stdout
        transcript = result.stdout.strip()
        return transcript if transcript else None
        
    except subprocess.TimeoutExpired:
        print(f"Whisper transcription timed out for {wav_path}")
        return None
    except subprocess.CalledProcessError as e:
        print(f"Whisper transcription failed: {e.stderr}")
        return None
    except Exception as e:
        print(f"Error running whisper: {e}")
        return None


async def handle_client(websocket, path, whisper_bin: str, whisper_model: str):
    """Handle a single WebSocket client connection."""
    remote_addr = websocket.remote_address
    print(f"Client connected: {remote_addr}")
    
    session = SpeechSession(websocket)
    
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # Process audio frame
                speech_started, speech_ended = session.process_frame(message)
                
                # Send speech_start event if we just detected speech
                if speech_started:
                    await session.send_json({
                        "type": "vad",
                        "state": "speech_start"
                    })
                
                # If speech ended, transcribe
                if speech_ended:
                    await session.send_json({
                        "type": "vad",
                        "state": "speech_end"
                    })
                    
                    # Save to temp WAV file
                    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                        wav_path = tmp.name
                    
                    if session.save_to_wav(wav_path):
                        # Transcribe
                        transcript = await asyncio.to_thread(
                            transcribe_audio, wav_path, whisper_bin, whisper_model
                        )
                        
                        # Clean up temp file
                        try:
                            os.unlink(wav_path)
                        except Exception:
                            pass
                        
                        # Send transcript if available
                        if transcript:
                            await session.send_json({
                                "type": "transcript",
                                "text": transcript
                            })
                    
                    # Clear buffer for next speech segment
                    session.clear_buffer()
                    
            elif isinstance(message, str):
                # Handle text messages (e.g., ping/pong)
                if message == "ping":
                    await websocket.send("pong")
                    
    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {remote_addr}")
    except Exception as e:
        print(f"Error handling client {remote_addr}: {e}")
    finally:
        # Clean up on disconnect
        session.clear_buffer()


def check_whisper_config():
    """Check and validate Whisper configuration from environment."""
    whisper_bin = os.getenv("WHISPER_BIN", "/Users/handong/whisper.cpp/build/bin/whisper-cli")
    whisper_model = os.getenv("WHISPER_MODEL", "/Users/handong/whisper.cpp/models/ggml-base.en.bin")
    
    print("=" * 60)
    print("Whisper Configuration:")
    print(f"  WHISPER_BIN: {whisper_bin}")
    print(f"  WHISPER_MODEL: {whisper_model}")
    print("=" * 60)
    
    # Check if binary exists and is executable
    if not os.path.exists(whisper_bin):
        print(f"ERROR: Whisper binary not found at: {whisper_bin}")
        print(f"  Please set WHISPER_BIN environment variable or check the path.")
        return None, None
    
    if not os.access(whisper_bin, os.X_OK):
        print(f"ERROR: Whisper binary is not executable: {whisper_bin}")
        return None, None
    
    # Check if model exists
    if not os.path.exists(whisper_model):
        print(f"ERROR: Whisper model not found at: {whisper_model}")
        print(f"  Please set WHISPER_MODEL environment variable or check the path.")
        return None, None
    
    print("✓ Configuration validated successfully")
    print()
    
    return whisper_bin, whisper_model


async def main():
    """Main server entry point."""
    print("Starting Speech Recognition WebSocket Server...")
    print()
    
    # Check configuration
    whisper_bin, whisper_model = check_whisper_config()
    if not whisper_bin or not whisper_model:
        print("\nFATAL: Invalid Whisper configuration. Exiting.")
        return
    
    # Start WebSocket server
    uri = f"ws://{WS_HOST}:{WS_PORT}"
    print(f"Listening on {uri}")
    print(f"Server ready. Waiting for connections...")
    print()
    
    async with serve(
        lambda ws, path: handle_client(ws, path, whisper_bin, whisper_model),
        WS_HOST,
        WS_PORT
    ):
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user.")