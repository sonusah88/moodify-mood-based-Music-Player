// === CONFIG ===
// Always use local audio streaming via backend + yt_dlp
const useYouTubePlayer = false;  // MUST be false for local audio streaming

// === ELEMENTS ===
const detectMoodBtn = document.querySelector('.detect-mood-btn');
const emojiElement = document.querySelector('.emoji');
const moodTextElement = document.querySelector('.mood-text');
const confidenceTextElement = document.querySelector('.confidence-text');
const playPauseBtn = document.querySelector('.play-pause-btn');
const nextBtn = document.querySelector('.fa-step-forward');
const prevBtn = document.querySelector('.fa-step-backward');

const audioElement = document.getElementById('global-player');

let playlist = [];
let currentIndex = 0;
let isPlaying = false;

// === PLAYBACK FUNCTIONS ===
function playSong(index) {
  if (playlist.length === 0) return;
  currentIndex = index;

  const song = playlist[currentIndex];
  console.log(`🎧 Playing local audio: ${song.title}`);

  fetch('/audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: song.url })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch audio from backend");
      return res.blob();
    })
    .then(blob => {
      const audioUrl = URL.createObjectURL(blob);
      audioElement.src = audioUrl;
      audioElement.play();
      updateSongInfoUI(song);
      updatePlayPauseIcon(true);
      isPlaying = true;
    })
    .catch(err => {
      console.error("❌ Error playing local audio:", err);
      alert("Could not play this audio.");
    });
}

function nextSong() {
  currentIndex = (currentIndex + 1) % playlist.length;
  playSong(currentIndex);
}

function prevSong() {
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  playSong(currentIndex);
}

function updateSongInfoUI(song) {
  document.querySelector('footer .song-title').textContent = song.title;
  document.querySelector('footer .song-artist').textContent = song.artist;
}

function updatePlayPauseIcon(playing) {
  const icon = playPauseBtn.querySelector('i');
  if (playing) {
    icon.classList.remove('fa-play');
    icon.classList.add('fa-pause');
  } else {
    icon.classList.remove('fa-pause');
    icon.classList.add('fa-play');
  }
}

// === PLAY/PAUSE BUTTON ===
playPauseBtn.addEventListener('click', () => {
  if (audioElement.paused) {
    audioElement.play();
    updatePlayPauseIcon(true);
    isPlaying = true;
  } else {
    audioElement.pause();
    updatePlayPauseIcon(false);
    isPlaying = false;
  }
});

// === NEXT / PREV BUTTONS ===
nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);

// === AUTO NEXT for local audio ===
audioElement.addEventListener('ended', () => {
  nextSong();
});

// === RECOMMENDATION & UI ===
async function fetchPlaylist(mood) {
  try {
    const res = await fetch('/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood })
    });

    const data = await res.json();
    playlist = data.songs || [];

    if (playlist.length > 0) {
      updateRecommendedSongs();
      playSong(0);
    } else {
      console.warn("⚠️ No songs received for mood:", mood);
    }
  } catch (err) {
    console.error("❌ Error fetching playlist:", err);
  }
}

function updateRecommendedSongs() {
  const songList = document.querySelector('.song-list');
  songList.innerHTML = '';
  playlist.forEach((song, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="song-info">
        <div>
          <p class="song-title">${song.title}</p>
          <p class="song-artist">${song.artist}</p>
        </div>
      </div>
      <button class="play-btn" data-index="${idx}">Play</button>
    `;
    songList.appendChild(li);
  });

  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const index = parseInt(e.currentTarget.dataset.index);
      playSong(index);
    });
  });
}

// === MOOD DETECTION ===
detectMoodBtn.addEventListener('click', async () => {
  const frame = captureFrame();
  try {
    const response = await fetch('/detect_mood', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: frame })
    });

    const data = await response.json();

    if (data.mood) {
      updateMoodUI(data);
      fetchPlaylist(data.mood);
    } else {
      console.error("😕 Mood not detected");
    }
  } catch (err) {
    console.error("❌ Mood detection error:", err);
  }
});

function captureFrame() {
  const video = document.getElementById('webcam');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg');
}

function updateMoodUI(data) {
  const mood = data.mood;
  const confidence = Math.round(data.confidence * 100);

  emojiElement.textContent = getEmoji(mood);
  moodTextElement.textContent = `${capitalize(mood)} & Energetic`;
  confidenceTextElement.textContent = `${confidence}% confidence`;
  document.body.style.background = getMoodColor(mood);
}

function getEmoji(mood) {
  const map = {
    happy: '😄',
    sad: '😔',
    angry: '😡',
    surprise: '😲',
    neutral: '😐'
  };
  return map[mood] || '🙂';
}

function getMoodColor(mood) {
  const colors = {
    happy: 'linear-gradient(to right, #fbc531, #f5f6fa)',
    sad: 'linear-gradient(to right, #535c68, #95afc0)',
    angry: 'linear-gradient(to right, #e84118, #c23616)',
    surprise: 'linear-gradient(to right, #9c88ff, #f5f6fa)',
    neutral: 'linear-gradient(to right, #dcdde1, #f5f6fa)'
  };
  return colors[mood] || '#fff';
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// === START WEBCAM ===
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById('webcam');
    video.srcObject = stream;
  } catch (e) {
    console.error('📷 Webcam access error:', e);
  }
}
startWebcam();
