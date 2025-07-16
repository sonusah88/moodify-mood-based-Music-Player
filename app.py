from flask import Flask, render_template, request, jsonify, send_file, Response
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from fer import FER
from ytmusicapi import YTMusic
from yt_dlp import YoutubeDL
import tempfile
import os
import threading

app = Flask(__name__)
CORS(app)

# Initialize FER and YTMusic
detector = FER(mtcnn=True)
yt = YTMusic()

# Cache dictionary to store {video_id: filepath}
audio_cache = {}
cache_lock = threading.Lock()

# Default fallback YouTube video links (used when API fails)
default_songs = {
    "happy": [
        {"title": "Apna Time Aayega", "artist": "Divine", "url": "https://www.youtube.com/watch?v=HhesaQXLuRY"},
        {"title": "Ilahi", "artist": "Arijit Singh", "url": "https://www.youtube.com/watch?v=JrHno2s33Mw"},
    ],
    "sad": [
        {"title": "Channa Mereya", "artist": "Arijit Singh", "url": "https://www.youtube.com/watch?v=284Ov7ysmfA"},
        {"title": "Tujhe Bhula Diya", "artist": "Mohit Chauhan", "url": "https://www.youtube.com/watch?v=F1DrsR4IuOY"},
    ],
    "neutral": [
        {"title": "Raabta", "artist": "Arijit Singh", "url": "https://www.youtube.com/watch?v=O8lRQDwMChw"},
        {"title": "Ilahi", "artist": "Arijit Singh", "url": "https://www.youtube.com/watch?v=JrHno2s33Mw"},
    ]
}

def extract_video_id(url):
    # Basic extraction of video ID from YouTube URL
    if "v=" in url:
        return url.split("v=")[1].split("&")[0]
    return None

def download_audio(url):
    video_id = extract_video_id(url)
    if not video_id:
        return None

    with cache_lock:
        if video_id in audio_cache and os.path.exists(audio_cache[video_id]):
            # Cached file exists, return path
            return audio_cache[video_id]

    # Download audio and cache
    temp_dir = tempfile.mkdtemp(prefix="moodify_")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
        'quiet': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'noplaylist': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            mp3_file = os.path.splitext(filename)[0] + ".mp3"

        with cache_lock:
            audio_cache[video_id] = mp3_file

        return mp3_file
    except Exception as e:
        print(f"[ERROR] yt_dlp download failed for {url}: {e}")
        return None


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/detect_mood', methods=['POST'])
def detect_mood():
    data = request.get_json()
    img_data = data.get('image', '')
    if not img_data or not img_data.startswith('data:image'):
        return jsonify({"error": "Invalid image data"}), 400

    try:
        header, encoded = img_data.split(",", 1)
        img_bytes = base64.b64decode(encoded)
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        frame = np.array(img)

        results = detector.detect_emotions(frame)

        if results:
            top_emotion = max(results[0]['emotions'], key=results[0]['emotions'].get)
            confidence = results[0]['emotions'][top_emotion]
        else:
            top_emotion = "neutral"
            confidence = 0.5

        print(f"[INFO] Mood Detected: {top_emotion} with {confidence*100:.2f}% confidence")
        return jsonify({"mood": top_emotion, "confidence": confidence})

    except Exception as e:
        print("[ERROR] Mood detection failed:", str(e))
        return jsonify({"error": "Mood detection failed"}), 500


@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    mood = data.get("mood", "neutral")
    songs = []

    try:
        search_results = yt.search(f"{mood} hindi songs", filter="songs", limit=5)

        for item in search_results:
            title = item.get('title', 'Unknown Title')
            artist = ", ".join([a['name'] for a in item.get('artists', [])]) or "Unknown Artist"
            video_id = item.get('videoId')

            if video_id:
                url = f"https://www.youtube.com/watch?v={video_id}"
                songs.append({"title": title, "artist": artist, "url": url})

    except Exception as e:
        print("[ERROR] YouTube API failed, falling back to default songs:", str(e))
        songs = default_songs.get(mood, default_songs['neutral'])

    if not songs:
        songs = default_songs.get(mood, default_songs['neutral'])

    return jsonify({"songs": songs})


@app.route('/audio', methods=['POST'])
def fetch_audio():
    data = request.get_json()
    url = data.get('url')

    if not url or not url.startswith("https://www.youtube.com"):
        return jsonify({"error": "Invalid YouTube URL"}), 400

    mp3_path = download_audio(url)

    if not mp3_path or not os.path.exists(mp3_path):
        return jsonify({"error": "Audio fetch failed"}), 500

    # Stream the mp3 file as response
    return send_file(mp3_path, mimetype="audio/mpeg")


if __name__ == '__main__':
    app.run(debug=True)
