from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from fer import FER
import requests

app = Flask(__name__)
CORS(app)

# Initialize FER detector
detector = FER(mtcnn=True)

# Default fallback songs with Deezer preview URLs (30 sec clips)
default_songs = {
    "happy": [
        {
            "title": "Apna Time Aayega",
            "artist": "Divine",
            "url": "https://cdns-preview-6.dzcdn.net/stream/c-6b6ae12fda55e3a3d7e95d2acb834a68-3.mp3"
        },
        {
            "title": "Ilahi",
            "artist": "Arijit Singh",
            "url": "https://cdns-preview-d.dzcdn.net/stream/c-d5ee9820f68c4ebf85a1ed28f19262e8-3.mp3"
        }
    ],
    "sad": [
        {
            "title": "Channa Mereya",
            "artist": "Arijit Singh",
            "url": "https://cdns-preview-4.dzcdn.net/stream/c-4d1d084e411b0e8a9921c3f1c870d6dc-3.mp3"
        },
        {
            "title": "Tujhe Bhula Diya",
            "artist": "Mohit Chauhan",
            "url": "https://cdns-preview-f.dzcdn.net/stream/c-fdd95a34ae6d50bcd5a70a3a869b0c92-3.mp3"
        }
    ],
    "neutral": [
        {
            "title": "Raabta",
            "artist": "Arijit Singh",
            "url": "https://cdns-preview-7.dzcdn.net/stream/c-7b04941d7a785dbb2f6a3b2439ef4f0a-3.mp3"
        },
        {
            "title": "Ilahi",
            "artist": "Arijit Singh",
            "url": "https://cdns-preview-d.dzcdn.net/stream/c-d5ee9820f68c4ebf85a1ed28f19262e8-3.mp3"
        }
    ]
}

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
    query = f"{mood} hindi"
    songs = []

    try:
        # Deezer public search API
        url = "https://api.deezer.com/search"
        params = {"q": query, "limit": 10}
        response = requests.get(url, params=params)
        response.raise_for_status()
        results = response.json().get('data', [])

        for item in results:
            # Use only songs with preview (30 sec clip)
            preview_url = item.get('preview')
            if not preview_url:
                continue
            title = item.get('title', 'Unknown Title')
            artist = item.get('artist', {}).get('name', 'Unknown Artist')

            songs.append({
                "title": title,
                "artist": artist,
                "url": preview_url
            })

    except Exception as e:
        print(f"[ERROR] Deezer API failed: {e}")
        songs = default_songs.get(mood, default_songs['neutral'])

    if not songs:
        songs = default_songs.get(mood, default_songs['neutral'])

    return jsonify({"songs": songs})


if __name__ == '__main__':
    app.run(debug=True)
