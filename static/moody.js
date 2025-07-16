// Elements
const detectMoodBtn = document.querySelector('.detect-mood-btn');
const emojiElement = document.querySelector('.emoji');
const moodTextElement = document.querySelector('.mood-text');
const confidenceTextElement = document.querySelector('.confidence-text');
const playPauseBtn = document.querySelector('.play-pause-btn');
const nextBtn = document.querySelector('.fa-step-forward');
const prevBtn = document.querySelector('.fa-step-backward');

let player;
let playlist = [];
let currentIndex = 0;
let isPlayerReady = false;

// Called by YouTube IFrame API
function onYouTubeIframeAPIReady() {
  console.log("🎥 YouTube IFrame API is ready");
  player = new YT.Player('youtube-player', {
    height: '0', // Hide player (audio only)
    width: '0',
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady() {
  isPlayerReady = true;
  console.log("✅ YouTube player is ready");
  if (playlist.length > 0) {
    playSong(currentIndex);
  }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    nextSong();
  }
}

function playSong(index) {
  if (!player || !isPlayerReady || playlist.length === 0) return;

  currentIndex = index;
  const videoId = extractVideoId(playlist[currentIndex].url);

  console.log(`🎶 Playing: ${playlist[currentIndex].title}, ID: ${videoId}`);

  if (videoId) {
    player.loadVideoById(videoId);
    updateSongInfoUI(playlist[currentIndex]);
    updatePlayPauseIcon(true);
  } else {
    console.error("❌ Invalid YouTube URL:", playlist[currentIndex].url);
  }
}

function nextSong() {
  currentIndex = (currentIndex + 1) % playlist.length;
  playSong(currentIndex);
}

function prevSong() {
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  playSong(currentIndex);
}

function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.has("v")) {
      return parsed.searchParams.get("v");
    }
  } catch (e) {
    console.error("❌ Invalid video URL:", url);
  }
  return null;
}

function updateSongInfoUI(song) {
  document.querySelector('footer .song-title').textContent = song.title;
  document.querySelector('footer .song-artist').textContent = song.artist;
}

function updatePlayPauseIcon(isPlaying) {
  const icon = playPauseBtn.querySelector('i');
  if (isPlaying) {
    icon.classList.remove('fa-play');
    icon.classList.add('fa-pause');
  } else {
    icon.classList.remove('fa-pause');
    icon.classList.add('fa-play');
  }
}

async function fetchPlaylist(mood) {
  const res = await fetch('/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mood })
  });

  const data = await res.json();
  playlist = data.songs || [];

  if (playlist.length > 0) {
    updateRecommendedSongs();
    if (isPlayerReady) {
      playSong(0);
    } else {
      console.log("⏳ Waiting for player to be ready...");
    }
  } else {
    console.warn("⚠️ No songs received for mood:", mood);
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

// Mood detection button
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

// Play/pause button
playPauseBtn.addEventListener('click', () => {
  if (!player) return;
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) {
    player.pauseVideo();
    updatePlayPauseIcon(false);
  } else {
    player.playVideo();
    updatePlayPauseIcon(true);
  }
});

// Next/Prev
nextBtn.addEventListener('click', () => nextSong());
prevBtn.addEventListener('click', () => prevSong());

// Start webcam on load
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
