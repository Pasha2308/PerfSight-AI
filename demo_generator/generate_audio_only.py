import sys
sys.stdout.reconfigure(encoding='utf-8')
import json
import os
from google.cloud import texttospeech
from pathlib import Path

SCRIPT_FILE = "script.json"
AUDIO_DIR = "output/audio"

def generate_tts():
    Path(AUDIO_DIR).mkdir(parents=True, exist_ok=True)
    print("🎙️ Generating AI Voiceover using GCP Text-to-Speech...")
    
    try:
        client = texttospeech.TextToSpeechClient()
    except Exception as e:
        print(f"Auth Error: {e}")
        print("Make sure you have GOOGLE_APPLICATION_CREDENTIALS set.")
        return

    with open(SCRIPT_FILE, "r") as f:
        scenes = json.load(f)["scenes"]
        
    for scene in scenes:
        scene_id = scene["id"]
        text = scene["text"]
        out_path = f"{AUDIO_DIR}/{scene_id}.mp3"
        
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name="en-US-Journey-F", 
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=0.95
        )
        
        try:
            response = client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            with open(out_path, "wb") as out:
                out.write(response.audio_content)
            print(f"  ✅ Generated audio: {out_path}")
        except Exception as e:
            print(f"  ❌ Error generating {scene_id}: {e}")

if __name__ == "__main__":
    generate_tts()
