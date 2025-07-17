// === ELEMENTS ===
const detectMoodBtn = document.querySelector('.detect-mood-btn');
const emojiElement = document.querySelector('.emoji');
const moodTextElement = document.querySelector('.mood-text');
const confidenceTextElement = document.querySelector('.confidence-text');
const playPauseBtn = document.querySelector('.play-pause-btn');
const nextBtn = document.querySelector('.fa-step-forward');
const prevBtn = document.querySelector('.fa-step-backward');
const shuffleBtn = document.querySelector('.fa-random');
const repeatBtn = document.querySelector('.fa-redo');
const progressBar = document.querySelector('.progress-bar');
const progress = document.querySelector('.progress');
const playerSongTitle = document.querySelector('footer .song-title');
const playerSongArtist = document.querySelector('footer .song-artist');
const playerAlbumArt = document.querySelector('footer .player-song-info img');
const audioElement = document.getElementById('global-player');
const volumeBar = document.querySelector('.volume-bar');
const volumeLevel = document.querySelector('.volume-level');
const progressStart = document.querySelector('.progress-bar-container span:first-child');
const progressEnd = document.querySelector('.progress-bar-container span:last-child');
const songList = document.querySelector('.song-list');

let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;

// === PLAYBACK FUNCTIONS ===
function playSong(index) {
  if (!playlist.length) return;
  currentIndex = index;
  const song = playlist[currentIndex];
  audioElement.src = song.url;
  audioElement.currentTime = 0;
  audioElement.play()
    .then(() => {
      updateSongInfoUI(song);
      updatePlayPauseIcon(true);
      isPlaying = true;
    })
    .catch(err => {
      console.error("❌ Error playing audio:", err);
      alert("Could not play this audio. Trying next song...");
      nextSong();
    });
}

function nextSong() {
  if (!playlist.length) return;
  if (isShuffle) {
    let nextIdx;
    do {
      nextIdx = Math.floor(Math.random() * playlist.length);
    } while (nextIdx === currentIndex && playlist.length > 1);
    currentIndex = nextIdx;
  } else {
    currentIndex = (currentIndex + 1) % playlist.length;
  }
  playSong(currentIndex);
}

function prevSong() {
  if (!playlist.length) return;
  if (audioElement.currentTime > 3) {
    audioElement.currentTime = 0;
    audioElement.play();
    return;
  }
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  playSong(currentIndex);
}

function updateSongInfoUI(song) {
  playerSongTitle.textContent = song.title || "Unknown Title";
  playerSongArtist.textContent = song.artist || "Unknown Artist";
  if (song.albumArt) {
    playerAlbumArt.src = song.albumArt;
  } else {
    playerAlbumArt.src = "https://via.placeholder.com/50";
  }
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

// === PLAYER CONTROLS ===
playPauseBtn.addEventListener('click', () => {
  if (!playlist.length) return;
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

nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
});

repeatBtn.addEventListener('click', () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle('active', isRepeat);
});

// === AUTO NEXT for audio ===
audioElement.addEventListener('ended', () => {
  if (isRepeat) {
    playSong(currentIndex);
  } else {
    nextSong();
  }
});

// === PROGRESS BAR ===
audioElement.addEventListener('timeupdate', () => {
  if (!audioElement.duration) return;
  const percent = (audioElement.currentTime / audioElement.duration) * 100;
  progress.style.width = percent + "%";
  progressStart.textContent = formatTime(audioElement.currentTime);
  progressEnd.textContent = formatTime(audioElement.duration);
});

progressBar.addEventListener('click', (e) => {
  if (!audioElement.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audioElement.currentTime = percent * audioElement.duration;
});

// === VOLUME CONTROL ===
volumeBar.addEventListener('click', (e) => {
  const rect = volumeBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audioElement.volume = percent;
  volumeLevel.style.width = (percent * 100) + "%";
});
audioElement.volume = 0.3; // Default volume
volumeLevel.style.width = "30%";

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
      alert("No songs found for this mood.");
    }
  } catch (err) {
    console.error("❌ Error fetching playlist:", err);
    alert("Could not fetch songs. Please try again.");
  }
}

function updateRecommendedSongs() {
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
      <button class="play-btn" data-index="${idx}"><i class="fas fa-play"></i></button>
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
      alert("Mood not detected. Try again!");
    }
  } catch (err) {
    console.error("❌ Mood detection error:", err);
    alert("Could not detect mood. Please try again.");
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

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// === START WEBCAM ===
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById('webcam');
    video.srcObject = stream;
  } catch (e) {
    console.error('📷 Webcam access error:', e);
    alert("Could not access webcam.");
  }
}
startWebcam();

// === INIT ===
window.addEventListener('DOMContentLoaded', () => {
  updatePlayPauseIcon(false);
  updateSongInfoUI({ title: "No song playing", artist: "", albumArt: "" });
  progress.style.width = "0%";
  progressStart.textContent = "0:00";
  progressEnd.textContent = "0:00";
});