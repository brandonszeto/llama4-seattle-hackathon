import whisper
import pyaudio
import numpy as np
import torch
from collections import deque

# Load Whisper
model = whisper.load_model("base")

# Audio config
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024  # ~64ms
SILENCE_THRESHOLD = 0.01  # Adjust depending on your mic/noise level
SILENCE_CHUNKS = int(0.8 / (CHUNK / RATE))  # ~0.8s of silence to stop

# Buffers
audio_buffer = []
silence_counter = 0
recording = False

# Audio stream
p = pyaudio.PyAudio()
stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True,
                frames_per_buffer=CHUNK)

print("🎤 Listening... Speak to start, pause to transcribe.")

try:
    while True:
        audio_data = stream.read(CHUNK, exception_on_overflow=False)
        audio_np = np.frombuffer(audio_data, np.int16).astype(np.float32) / 32768.0
        energy = np.sqrt(np.mean(audio_np**2))  # RMS energy
        print(f"Energy is {energy} vs. threshold {SILENCE_THRESHOLD} = {energy > SILENCE_THRESHOLD}")

        if energy > SILENCE_THRESHOLD:
            recording = True
            audio_buffer.extend(audio_np.tolist())
            silence_counter = 0
        elif recording:
            silence_counter += 1
            if silence_counter > SILENCE_CHUNKS:
                print("🔍 Transcribing...")
                audio_array = np.array(audio_buffer, dtype=np.float32)
                audio_padded = whisper.pad_or_trim(audio_array)
                mel = whisper.log_mel_spectrogram(audio_padded).to(model.device)
                result = model.decode(mel, whisper.DecodingOptions(language="en"))
                print("🗣️", result.text)
                # Reset for next utterance
                audio_buffer.clear()
                silence_counter = 0
                recording = False

except KeyboardInterrupt:
    print("\n⏹️ Exiting.")
    stream.stop_stream()
    stream.close()
    p.terminate()
