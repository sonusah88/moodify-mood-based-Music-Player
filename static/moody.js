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
const songListTitle = document.getElementById('song-list-title');
const historyList = document.querySelector('.history-list');

// Webcam elements
const video = document.getElementById('webcam');
const webcamStatus = document.getElementById('webcam-status');


let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let currentMood = 'neutral'; // Keep track of the last detected mood

// === PLAYBACK FUNCTIONS ===
async function playSong(index) {
  if (!playlist.length) return;
  currentIndex = index;
  const song = playlist[currentIndex];

  try {
    const res = await fetch(`/play/${song.videoId}?song_info=${song.title} - ${song.artist}&mood=${currentMood}`);
    const data = await res.json();
    if (data.audio_url) {
      audioElement.src = data.audio_url;
      audioElement.currentTime = 0;
      await audioElement.play();
      updateSongInfoUI(song);
      updatePlayPauseIcon(true);
      isPlaying = true;
      // After playing a new song, refresh the song history
      fetchSongHistory();
    } else {
      throw new Error("Audio URL not found");
    }
  } catch (err) {
    console.error("❌ Error playing audio:", err);
    alert("Could not play this song. Trying the next one...");
    nextSong();
  }
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
  playerAlbumArt.src = song.thumbnail || "https://via.placeholder.com/50";
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
    currentMood = mood; // Update the current mood
  try {
    songListTitle.textContent = "Recommended For You"; // Change title
    const res = await fetch('/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood })
    });
    const data = await res.json();
    playlist = data.songs || [];
    if (playlist.length > 0) {
      updateRecommendedSongsUI();
      playSong(0);
    } else {
      alert("No songs found for this mood.");
    }
  } catch (err) {
    console.error("❌ Error fetching playlist:", err);
    alert("Could not fetch songs. Please try again.");
  }
}

function updateRecommendedSongsUI() {
  songList.innerHTML = '';
  playlist.forEach((song, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="song-info">
        <img src="${song.thumbnail || 'https://via.placeholder.com/40'}" alt="Album Art" />
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
  if (!frame) return;
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
      fetchMoodHistory(); // Refresh mood history
    } else {
      alert("Mood not detected. Try again!");
    }
  } catch (err) {
    console.error("❌ Mood detection error:", err);
    alert("Could not detect mood. Please try again.");
  }
});

function captureFrame() {
  if (!video || video.readyState < 2) {
    console.error("❌ Webcam not ready for capture");
    alert("Webcam is not ready or permission was denied. Please check your browser settings.");
    return null;
  }
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
  moodTextElement.textContent = `${capitalize(mood)} Mood`;
  confidenceTextElement.textContent = `${confidence}% confidence`;
  document.body.style.background = getMoodColor(mood);
}

// === HISTORY FUNCTIONS ===
async function fetchMoodHistory() {
    try {
        const res = await fetch('/mood_history');
        const historyData = await res.json();
        updateMoodHistoryUI(historyData);
    } catch (err) {
        console.error("❌ Error fetching mood history:", err);
    }
}

function updateMoodHistoryUI(history) {
    historyList.innerHTML = ''; // Clear existing list
    if (history.length === 0) {
        historyList.innerHTML = '<li><p>No mood history yet.</p></li>';
        return;
    }

    history.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="history-emoji">${getEmoji(item.mood)}</div>
            <div>
                <p>${capitalize(item.mood)} Mood</p>
                <small>${item.detected_at}</small>
            </div>
        `;
        historyList.appendChild(li);
    });
}

async function fetchSongHistory() {
    try {
        songListTitle.textContent = "Recently Played"; // Set title
        const res = await fetch('/song_history');
        const historyData = await res.json();
        updateSongHistoryUI(historyData);
    } catch (err) {
        console.error("❌ Error fetching song history:", err);
    }
}

function updateSongHistoryUI(history) {
    songList.innerHTML = ''; // Clear existing list
    if (history.length === 0) {
        songList.innerHTML = '<li><p>No songs played yet.</p></li>';
        return;
    }

    history.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="song-info">
                <div>
                  <p class="song-title">${item.title}</p>
                  <p class="song-artist">${item.artist}</p>
                </div>
            </div>
            <div class="song-meta">
                <small>${item.played_at}</small>
            </div>
        `;
        songList.appendChild(li);
    });
}


function getEmoji(mood) {
  const map = {
    happy: '😄', sad: '😔', angry: '😡',
    surprise: '😲', neutral: '😐', fear: '😨'
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        webcamStatus.innerHTML = "<p>❌ Your browser does not support camera access.</p>";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.style.display = 'block';
        webcamStatus.style.display = 'none';
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
    } catch (err) {
        console.error("📷 Webcam access error:", err);
        let errorMessage = "❌ Could not access webcam.";
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            errorMessage = "❌ Webcam access was denied. Please enable camera permissions in your browser settings.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            errorMessage = "❌ No camera was found on your device.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            errorMessage = "❌ Your camera is already in use by another application.";
        }
        webcamStatus.innerHTML = `<p>${errorMessage}</p>`;
    }
}


// === INIT ===
window.addEventListener('DOMContentLoaded', () => {
  startWebcam(); // Start the camera
  fetchMoodHistory(); // Fetch mood history
  fetchSongHistory(); // Fetch song history on page load
  updatePlayPauseIcon(false);
  updateSongInfoUI({ title: "No song playing", artist: "", thumbnail: "" });
  progress.style.width = "0%";
  progressStart.textContent = "0:00";
  progressEnd.textContent = "0:00";
});