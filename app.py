from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
import base64
from io import BytesIO
from PIL import Image
import numpy as np
from fer import FER
import random
from ytmusicapi import YTMusic
import yt_dlp
from models import db, User, Song, ListeningHistory, MoodLog
from datetime import datetime

# Initialize Flask
app = Flask(__name__)
CORS(app)

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///moodify.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'a_very_secret_key_that_you_should_change' # IMPORTANT: Change this

# --- Initialize Extensions ---
db.init_app(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)

# It tells Flask-Login that the 'login' function is the one that handles logins.
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# --- Initialize Other Components ---
detector = FER()
ytmusic = YTMusic()

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

# --- Main Routes (Authentication) ---

@app.route('/')
def index():
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()

        if user and bcrypt.check_password_hash(user.password, password):
            remember = request.form.get('remember') == 'on'
            login_user(user, remember=remember)
            return redirect(url_for('home'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')

    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('home'))

    if request.method == 'POST':
        username = request.form.get('name')
        email = request.form.get('email')
        password = request.form.get('password')
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

        user = User(username=username, email=email, password=hashed_password)
        db.session.add(user)
        db.session.commit()

        flash('Your account has been created! You can now log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/home')
@login_required # This decorator PROTECTS the dashboard. No one can access it without being logged in.
def home():
    return render_template('index.html')

@app.route('/history')
@login_required
def history():
    return render_template('history.html')

# --- API and Feature Routes ---

@app.route('/detect_mood', methods=['POST'])
@login_required
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

        mood_log = MoodLog(user_id=current_user.id, mood=top_emotion)
        db.session.add(mood_log)
        db.session.commit()

        return jsonify({"mood": top_emotion, "confidence": confidence})

    except Exception as e:
        print(f"[ERROR] Mood detection failed: {e}")
        return jsonify({"error": "Mood detection failed"}), 500

@app.route('/recommend', methods=['POST'])
@login_required
def recommend():
    data = request.get_json()
    mood = data.get("mood", "neutral").lower()

    mood_to_query = {
        "happy": "latest happy hindi songs", "sad": "sad hindi songs",
        "neutral": "relaxing hindi songs", "angry": "motivational hindi songs",
        "fear": "calm soothing hindi songs", "surprise": "party hindi songs"
    }
    query = mood_to_query.get(mood, "hindi songs")

    try:
        results = ytmusic.search(query, filter='songs', limit=10)
        songs = [
            {
                "title": r['title'],
                "artist": ', '.join([a['name'] for a in r.get('artists', [])]),
                "videoId": r['videoId'],
                "thumbnail": r['thumbnails'][0]['url']
            }
            for r in results if 'videoId' in r
        ]

        if not songs:
            results = ytmusic.search("top hindi songs", filter='songs', limit=10)
            songs = [
                {
                    "title": r['title'],
                    "artist": ', '.join([a['name'] for a in r.get('artists', [])]),
                    "videoId": r['videoId'],
                    "thumbnail": r['thumbnails'][0]['url']
                }
                for r in results if 'videoId' in r
            ]

        random.shuffle(songs)
        return jsonify({"songs": songs[:5]})
    except Exception as e:
        print(f"[ERROR] YTMusic search failed: {e}")
        return jsonify({"songs": []})

@app.route('/play/<video_id>')
@login_required
def play(video_id):
    try:
        audio_url = get_audio_url(video_id)
        song_info = request.args.get('song_info')
        if song_info:
            title, artist = song_info.split(' - ')
            song = Song.query.filter_by(title=title, artist=artist).first()
            if not song:
                song = Song(title=title, artist=artist, mood_tag=request.args.get('mood'), api_source_id=video_id)
                db.session.add(song)
                db.session.commit()

            history_entry = ListeningHistory(user_id=current_user.id, song_id=song.id)
            db.session.add(history_entry)
            db.session.commit()

        return jsonify({"audio_url": audio_url})
    except Exception as e:
        print(f"[ERROR] yt_dlp failed: {e}")
        return jsonify({"error": "Audio extraction failed"}), 500

@app.route('/mood_history')
@login_required
def mood_history():
    history = MoodLog.query.filter_by(user_id=current_user.id).order_by(MoodLog.detected_at.desc()).limit(5).all()
    history_data = [
        {"mood": item.mood, "detected_at": item.detected_at.strftime("%b %d, %I:%M %p")}
        for item in history
    ]
    return jsonify(history_data)

@app.route('/song_history')
@login_required
def song_history():
    """Fetch the last 5 played songs for the current user."""
    history = ListeningHistory.query.filter_by(user_id=current_user.id).order_by(ListeningHistory.played_at.desc()).limit(5).all()

    history_data = [
        {
            "title": item.song.title,
            "artist": item.song.artist,
            "played_at": item.played_at.strftime("%b %d, %I:%M %p")
        } for item in history
    ]
    return jsonify(history_data)

if __name__ == '__main__':
    app.run(debug=True)