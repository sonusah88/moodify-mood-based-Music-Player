from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from fer import FER
from ytmusicapi import YTMusic

app = Flask(__name__)
CORS(app)

# Initialize FER and YTMusic
detector = FER(mtcnn=True)
yt = YTMusic()

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


if __name__ == '__main__':
    app.run(debug=True)
