from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from fer import FER
import random
from ytmusicapi import YTMusic
import yt_dlp

# Initialize Flask
app = Flask(__name__)
CORS(app)

# Initialize FER detector
detector = FER()

# Initialize YTMusic
ytmusic = YTMusic()

# Track already played songs to avoid repetition
played_songs = {"happy": [], "sad": [], "neutral": []}


def get_audio_url(video_id):
    """Fetch direct audio URL using yt_dlp."""
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'noplaylist': True,
        'extract_flat': False
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return info['url']


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/detect_mood', methods=['POST'])
def detect_mood():
    """Detect mood from base64 image sent by the frontend."""
    data = request.get_json()
    img_data = data.get('image', '')

    if not img_data or not img_data.startswith('data:image'):
        print("[ERROR] Invalid or empty image data received.")
        return jsonify({"error": "Invalid image data"}), 400

    try:
        # Decode base64 image
        header, encoded = img_data.split(",", 1)
        img_bytes = base64.b64decode(encoded)
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        frame = np.array(img)

        # Detect emotions using FER
        results = detector.detect_emotions(frame)

        if results:
            top_emotion = max(results[0]['emotions'], key=results[0]['emotions'].get)
            confidence = results[0]['emotions'][top_emotion]
        else:
            top_emotion = "neutral"
            confidence = 0.5

        print(f"[INFO] Mood Detected: {top_emotion} ({confidence*100:.2f}% confidence)")
        return jsonify({"mood": top_emotion, "confidence": confidence})

    except Exception as e:
        print("[ERROR] Mood detection failed:", str(e))
        return jsonify({"error": "Mood detection failed"}), 500


@app.route('/recommend', methods=['POST'])
def recommend():
    """Recommend mood-based Hindi songs using YTMusic with fallback mappings."""
    data = request.get_json()
    mood = data.get("mood", "neutral").lower()

    # Mood keyword mapping for better searches
    mood_to_query = {
        "happy": "latest happy hindi songs",
        "sad": "sad hindi songs",
        "neutral": "relaxing hindi songs",
        "angry": "motivational hindi songs",
        "fear": "calm soothing hindi songs",
        "surprise": "party hindi songs"
    }
    query = mood_to_query.get(mood, "hindi songs")

    songs = []
    try:
        # Search for songs on YouTube Music
        results = ytmusic.search(query, filter='songs', limit=10)

        for r in results:
            if 'videoId' not in r:
                continue
            songs.append({
                "title": r['title'],
                "artist": ', '.join([a['name'] for a in r['artists']]),
                "videoId": r['videoId'],
                "thumbnail": r['thumbnails'][0]['url']
            })

        # Fallback check
        if not songs:
            # Default fallback to popular Hindi songs
            results = ytmusic.search("top hindi songs", filter='songs', limit=10)
            for r in results:
                if 'videoId' in r:
                    songs.append({
                        "title": r['title'],
                        "artist": ', '.join([a['name'] for a in r['artists']]),
                        "videoId": r['videoId'],
                        "thumbnail": r['thumbnails'][0]['url']
                    })

        # Randomly shuffle and pick top 5
        random.shuffle(songs)
        selected_songs = songs[:5]

    except Exception as e:
        print(f"[ERROR] YTMusic search failed: {e}")
        selected_songs = []

    return jsonify({"songs": selected_songs})


@app.route('/play/<video_id>')
def play(video_id):
    """Get direct audio URL of the selected song."""
    try:
        audio_url = get_audio_url(video_id)
        return jsonify({"audio_url": audio_url})
    except Exception as e:
        print(f"[ERROR] yt_dlp failed: {e}")
        return jsonify({"error": "Audio extraction failed"}), 500


if __name__ == '__main__':
    app.run(debug=True)
