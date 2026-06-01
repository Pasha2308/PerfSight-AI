import json
import os
import time
import asyncio
from pathlib import Path
from moviepy.editor import VideoFileClip, AudioFileClip, concatenate_audioclips
from google.cloud import texttospeech
from playwright.async_api import async_playwright

# Configuration
SCRIPT_FILE = "script.json"
OUTPUT_DIR = "output"
VIDEOS_DIR = f"{OUTPUT_DIR}/videos"
AUDIO_DIR = f"{OUTPUT_DIR}/audio"
FINAL_VIDEO = f"{OUTPUT_DIR}/perfsight_demo.mp4"
BASE_URL = "http://localhost:5173"

def setup_dirs():
    Path(VIDEOS_DIR).mkdir(parents=True, exist_ok=True)
    Path(AUDIO_DIR).mkdir(parents=True, exist_ok=True)

def generate_tts(scenes):
    print("🎙️ Generating AI Voiceover using GCP Text-to-Speech...")
    client = texttospeech.TextToSpeechClient()
    
    audio_clips = {}
    for i, scene in enumerate(scenes):
        scene_id = scene["id"]
        text = scene["text"]
        out_path = f"{AUDIO_DIR}/{scene_id}.mp3"
        
        if not os.path.exists(out_path):
            synthesis_input = texttospeech.SynthesisInput(text=text)
            voice = texttospeech.VoiceSelectionParams(
                language_code="en-US",
                name="en-US-Journey-F", # Premium Journey voice
            )
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=0.95
            )
            response = client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            with open(out_path, "wb") as out:
                out.write(response.audio_content)
            print(f"  ✅ Generated audio for {scene_id}")
        else:
            print(f"  ⏭️ Audio for {scene_id} already exists. Skipping.")
            
        # Get duration
        clip = AudioFileClip(out_path)
        audio_clips[scene_id] = {
            "path": out_path,
            "duration": clip.duration,
            "clip": clip
        }
    return audio_clips

async def record_ui(scenes, audio_clips):
    print("\n🎬 Starting Playwright UI Recording...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            record_video_dir=VIDEOS_DIR,
            record_video_size={"width": 1280, "height": 720},
            viewport={"width": 1280, "height": 720}
        )
        page = await context.new_page()
        
        # Start at login page
        await page.goto(f"{BASE_URL}/login")
        
        for scene in scenes:
            scene_id = scene["id"]
            action = scene["ui_action"]
            duration = audio_clips[scene_id]["duration"]
            
            print(f"  🎥 Recording scene: {scene_id} (Duration: {duration:.1f}s)")
            start_time = time.time()
            
            # --- UI Automation Logic per Scene ---
            if action == "login":
                await page.fill("input[type='email']", "judge@feuji.com")
                await page.fill("input[type='password']", "password123")
                await page.click("button[type='submit']")
                await page.wait_for_selector(".layout-dashboard", timeout=10000)
                
            elif action == "parse_scenario":
                await page.goto(f"{BASE_URL}/")
                await page.click("text='AI Scenario Designer'")
                await page.fill("textarea", "Simulate a flash sale with a massive traffic burst instantly for the payment gateway.")
                await page.fill("input[placeholder='Project Name']", "Flash Sale Demo")
                await page.fill("input[placeholder='Target URL']", "https://payments.net")
                await page.click("button:has-text('Generate Execution Plan')")
                await page.wait_for_selector(".monaco-editor", timeout=15000)
                
            elif action == "generate_script":
                await page.goto(f"{BASE_URL}/")
                await page.click("text='Generate Script'")
                await page.select_option("select", "k6")
                await page.click("button:has-text('Generate Script')")
                await page.wait_for_selector(".monaco-editor", timeout=15000)
                
            elif action == "view_report":
                await page.goto(f"{BASE_URL}/")
                await page.click("text='Test Executions'")
                # Click the first report
                await page.click("tr.table-row")
                await page.wait_for_selector(".card", timeout=10000)
                
            # Pad the remaining time so video matches audio length exactly
            elapsed = time.time() - start_time
            if elapsed < duration:
                await asyncio.sleep(duration - elapsed)
            else:
                # Give a tiny buffer if UI took longer than audio
                await asyncio.sleep(1)
                
        print("  ✅ UI Recording complete. Saving video...")
        video_path = await page.video.path()
        await context.close()
        await browser.close()
        
    return video_path

def merge_video_audio(video_path, audio_clips, scenes):
    print(f"\n🎞️ Merging final video and audio... (Video: {video_path})")
    try:
        video = VideoFileClip(video_path)
        
        # Concatenate audio clips in order
        clips = [audio_clips[s["id"]]["clip"] for s in scenes]
        master_audio = concatenate_audioclips(clips)
        
        # Overlay audio
        final_video = video.set_audio(master_audio)
        
        # If UI recording is slightly longer/shorter than audio, crop to audio length
        final_video = final_video.subclip(0, master_audio.duration)
        
        final_video.write_videofile(
            FINAL_VIDEO, 
            codec="libx264", 
            audio_codec="aac", 
            temp_audiofile="temp-audio.m4a", 
            remove_temp=True,
            fps=24
        )
        print(f"\n🎉 SUCCESS! Final demo video saved to: {FINAL_VIDEO}")
    except Exception as e:
        print(f"❌ Error merging video: {str(e)}")

async def main():
    setup_dirs()
    
    with open(SCRIPT_FILE, "r") as f:
        scenes = json.load(f)["scenes"]
        
    # 1. Generate Voiceover
    try:
        audio_clips = generate_tts(scenes)
    except Exception as e:
        print(f"❌ GCP TTS Error: {str(e)}")
        print("Please ensure GOOGLE_APPLICATION_CREDENTIALS is set and the Cloud Text-to-Speech API is enabled.")
        return

    # 2. Record UI with Playwright
    try:
        video_path = await record_ui(scenes, audio_clips)
    except Exception as e:
        print(f"❌ Playwright Error: {str(e)}")
        return

    # 3. Merge Video and Audio
    merge_video_audio(video_path, audio_clips, scenes)

if __name__ == "__main__":
    asyncio.run(main())
