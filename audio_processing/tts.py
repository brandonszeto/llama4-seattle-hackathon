import tempfile
import os
from dotenv import load_dotenv
import openai

# Load .env variables
load_dotenv()
openai.api_key = os.environ.get("OPEN_AI_KEY")

# Create a temporary file for the audio
with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_audio_file:
    response = openai.audio.speech.create(
        model="tts-1",         # Or "tts-1-hd"
        voice="echo",          # nova, shimmer, echo, onyx, fable
        input="Great job! I understood what you said!",
    )

    temp_audio_file.write(response.content)
    temp_audio_path = temp_audio_file.name  # Save path to play later

# Play the audio file (macOS)
os.system(f"afplay {temp_audio_path}")