// 設定はここだけ編集してください
const CONFIG = {
  gender: "boy",
  revealSeconds: 30,
  boyImageUrl: "./assets/boy.png",
  girlImageUrl: "./assets/girl.png",
  countdownImageUrls: [
    "./assets/wait-01.png",
    "./assets/wait-02.png",
    "./assets/wait-03.png",
    "./assets/wait-04.png",
    "./assets/wait-05.png",
    "./assets/wait-06.png",
  ],
  messagePool: [
    "ドキドキ…",
    "深呼吸…",
    "心の準備はOK？",
    "やっぱり男の子かな？",
    "まさかの女の子かな？",
    "どっちにしても、二人が仲良しだといいな",
    "いよいよ発表です！！",
    "目を閉じて想像してみて…",
    "拍手の準備はできた？",
    "家族の笑顔が浮かぶね",
    "カウントが進むたびにドキドキ…！",
    "あと少しでわかるよ！",
    "スマホをしっかり持っててね",
    "誰と祝うか思い浮かべてみて",
    "心臓の音が聞こえそう！",
    "幸せな時間を共有しよう",
    "あとちょっと、深呼吸…",
    "みんなのワクワクを感じるね",
    "準備はいい？",
    "光の中から生まれるよ",
    "最後まで見逃さないで！",
    "とびきりの瞬間が近づいてる",
  ],
  text: {
    boy: { revealTitle: "男の子です！", revealSub: "やっぱり～～！！！" },
    girl: { revealTitle: "女の子です！", revealSub: "まさかの女の子でした～～！！！" },
  },
  enableUrlParamOverride: false,
};

let selectedGender = null; // "boy" | "girl"
let countdownTimer = null;
let countdownStartMs = null;
let countdownEndMs = null;
let started = false;
let lastBucket = -1;
let lastMessage = "";
let messageQueue = [];
let paused = false;
let pausedMsLeft = 0;
let revealPending = false;

const screens = {
  start: document.getElementById("screen-start"),
  count: document.getElementById("screen-count"),
  reveal: document.getElementById("screen-reveal"),
};

const balloonStart = document.getElementById("balloon-start");
const secsHere = document.getElementById("secs-here");
const countTitle = document.getElementById("count-title");
const countNum = document.getElementById("count-num");
const countImg = document.getElementById("count-img");
const countPlaceholder = document.getElementById("count-placeholder");
const countAria = document.getElementById("count-aria");
const revealImg = document.getElementById("reveal-img");
const revealError = document.getElementById("reveal-error");
const btnRetry = document.getElementById("btn-retry");
const revealText = document.getElementById("reveal-text");
const revealSub = document.getElementById("reveal-sub");
const btnReset = document.getElementById("btn-reset");
const btnPause = document.getElementById("btn-pause");
const btnSkip = document.getElementById("btn-skip");
const confetti = document.getElementById("confetti");
const flash = document.getElementById("flash");

function goTo(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");

  document.body.classList.remove("bg-boy", "bg-girl", "bg-neutral");
  if (name === "reveal") {
    document.body.classList.add(selectedGender === "girl" ? "bg-girl" : "bg-boy");
  } else {
    document.body.classList.add("bg-neutral");
  }
  window.scrollTo(0, 0);
}

function preload(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => reject(new Error("image load failed: " + url));
    img.src = url;
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolveGender() {
  let g = CONFIG.gender;
  if (CONFIG.enableUrlParamOverride) {
    const params = new URLSearchParams(location.search);
    const query = params.get("gender");
    if (query === "boy" || query === "girl") g = query;
  }
  if (g !== "boy" && g !== "girl") {
    console.warn('CONFIG.gender is invalid. Use "boy" or "girl".');
    return null;
  }
  return g;
}

function init() {
  selectedGender = resolveGender();

  secsHere.textContent = String(CONFIG.revealSeconds);
  countNum.textContent = String(CONFIG.revealSeconds);
  countAria.textContent = `残り${CONFIG.revealSeconds}秒`;
  updateCountImageScale(CONFIG.revealSeconds * 1000);

  if (selectedGender) {
    const revealUrl = selectedGender === "boy" ? CONFIG.boyImageUrl : CONFIG.girlImageUrl;
    const waitUrls = Array.isArray(CONFIG.countdownImageUrls) ? CONFIG.countdownImageUrls : [];
    Promise.allSettled([preload(revealUrl), ...waitUrls.map(preload)]).catch(() => {});
  }

  goTo("start");
  setTimeout(() => balloonStart.focus(), 0);
}

balloonStart.addEventListener("click", () => {
  if (!selectedGender || started) return;
  started = true;
  startCountdown(CONFIG.revealSeconds);
});

function startCountdown(seconds) {
  const now = Date.now();
  countdownStartMs = now;
  countdownEndMs = now + seconds * 1000;
  lastBucket = -1;
  lastMessage = "";
  resetMessageQueue();
  paused = false;
  pausedMsLeft = 0;
  revealPending = false;
  updatePauseButton();
  setCountdownImage(0);
  updateCountImageScale(countdownEndMs - countdownStartMs);
  goTo("count");
  tickCountdown();
  countdownTimer = setInterval(tickCountdown, 100);
}

function resetMessageQueue() {
  const pool = Array.isArray(CONFIG.messagePool) ? CONFIG.messagePool.filter((s) => typeof s === "string" && s.trim() !== "") : [];
  messageQueue = [...pool]; // 順番通りに表示する
}

function pickNextMessage() {
  if (messageQueue.length === 0) resetMessageQueue();
  return messageQueue.shift() || "";
}

function updateCountImageScale(msLeft) {
  if (!countImg) return;
  const totalMs = Math.max(1, CONFIG.revealSeconds * 1000);
  const progress = Math.min(1, Math.max(0, 1 - (msLeft / totalMs)));
  const scale = 0.75 + (0.25 * progress);
  countImg.style.setProperty("--count-scale", scale.toFixed(4));
}

function setCountdownImage(bucket) {
  const list = Array.isArray(CONFIG.countdownImageUrls) ? CONFIG.countdownImageUrls : [];
  if (list.length === 0) {
    countImg.removeAttribute("src");
    countPlaceholder.hidden = false;
    countPlaceholder.textContent = "演出画像を設定してください";
    return;
  }

  countPlaceholder.hidden = true;
  const idx = Math.min(bucket, list.length - 1);
  const url = list[idx];
  if (!url || typeof url !== "string") return;

  countImg.onerror = () => {
    countImg.removeAttribute("src");
    countPlaceholder.hidden = false;
    countPlaceholder.textContent = "演出画像を読み込めませんでした";
  };

  if (countImg.dataset.src !== url) {
    countImg.dataset.src = url;
    countImg.src = url;
  }
}

function tickCountdown() {
  if (paused) return;
  const now = Date.now();
  const msLeft = Math.max(0, countdownEndMs - now);
  const secLeft = Math.ceil(msLeft / 1000);

  countNum.textContent = String(secLeft);
  countAria.textContent = `残り${secLeft}秒`;
  updateCountImageScale(msLeft);

  const elapsedMs = Math.max(0, now - countdownStartMs);
  const bucket = Math.floor(elapsedMs / 5000);

  if (bucket !== lastBucket) {
    lastBucket = bucket;
    lastMessage = pickNextMessage();
    countTitle.innerHTML = escapeHtml(lastMessage).replace(/\n/g, "<br>");
    setCountdownImage(bucket);
  }

  if (msLeft <= 0) {
    if (!revealPending) {
      revealPending = true;
      stopCountdown();
      flashThenReveal();
    }
  }
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function reveal() {
  const t = CONFIG.text[selectedGender] || {};
  revealText.textContent = t.revealTitle || "おめでとうございます！";
  revealSub.textContent = t.revealSub || "";
  revealError.hidden = true;

  const url = selectedGender === "boy" ? CONFIG.boyImageUrl : CONFIG.girlImageUrl;
  revealImg.onerror = () => { revealError.hidden = false; };
  revealImg.onload = () => { revealError.hidden = true; };
  revealImg.src = url;

  goTo("reveal");
  popConfetti();
}

btnRetry.addEventListener("click", () => {
  const baseUrl = selectedGender === "boy" ? CONFIG.boyImageUrl : CONFIG.girlImageUrl;
  revealError.hidden = true;
  revealImg.src = `${baseUrl}?t=${Date.now()}`;
});

btnPause.addEventListener("click", () => {
  if (!started) return;
  if (paused) {
    resumeCountdown();
  } else {
    pauseCountdown();
  }
});

btnSkip.addEventListener("click", () => {
  if (!selectedGender) return;
  stopCountdown();
  paused = false;
  revealPending = false;
  updateCountImageScale(0);
  reveal();
});

function flashThenReveal() {
  if (!flash) {
    reveal();
    revealPending = false;
    return;
  }
  flash.classList.add("show");
  setTimeout(() => {
    flash.classList.remove("show");
    reveal();
    revealPending = false;
  }, 500);
}

function pauseCountdown() {
  paused = true;
  pausedMsLeft = Math.max(0, countdownEndMs - Date.now());
  stopCountdown();
  countNum.textContent = String(Math.ceil(pausedMsLeft / 1000));
  countAria.textContent = `残り${Math.ceil(pausedMsLeft / 1000)}秒`;
  updateCountImageScale(pausedMsLeft);
  updatePauseButton();
}

function resumeCountdown() {
  if (!paused) return;
  paused = false;
  const now = Date.now();
  countdownStartMs = now;
  countdownEndMs = now + pausedMsLeft;
  pausedMsLeft = 0;
  updateCountImageScale(pausedMsLeft);
  tickCountdown();
  countdownTimer = setInterval(tickCountdown, 100);
  updatePauseButton();
}

function updatePauseButton() {
  if (!btnPause) return;
  btnPause.textContent = paused ? "再開" : "一時停止";
}

function popConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  confetti.innerHTML = "";
  const palette = ["#fff4d9", "#ffe0f0", "#cfe9ff", "#f7ffc7", "#ffd1a6"];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement("i");
    const left = Math.random() * 100;
    const delay = Math.random() * 0.25;
    const dur = 1.2 + Math.random() * 1.1;
    const size = 6 + Math.random() * 10;
    piece.style.left = `${left}vw`;
    piece.style.animationDelay = `${delay}s`;
    piece.style.animationDuration = `${dur}s`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 1.3}px`;
    piece.style.opacity = String(0.75 + Math.random() * 0.2);
    piece.style.background = palette[i % palette.length];
    confetti.appendChild(piece);
  }
  setTimeout(() => { confetti.innerHTML = ""; }, 2200);
}

btnReset.addEventListener("click", () => {
  stopCountdown();
  started = false;
  countdownStartMs = null;
  countdownEndMs = null;
  lastBucket = -1;
  lastMessage = "";
  paused = false;
  pausedMsLeft = 0;
  revealPending = false;
  updatePauseButton();
  updateCountImageScale(CONFIG.revealSeconds * 1000);

  document.body.classList.remove("bg-boy", "bg-girl");
  document.body.classList.add("bg-neutral");

  countTitle.textContent = "ドキドキ…";
  countNum.textContent = String(CONFIG.revealSeconds);
  countAria.textContent = `残り${CONFIG.revealSeconds}秒`;

  revealError.hidden = true;
  revealImg.removeAttribute("src");
  countImg.removeAttribute("src");
  countImg.dataset.src = "";
  countPlaceholder.hidden = true;

  goTo("start");
  setTimeout(() => balloonStart.focus(), 0);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && screens.count.classList.contains("active")) {
    stopCountdown();
    started = false;
    paused = false;
    pausedMsLeft = 0;
    revealPending = false;
    updatePauseButton();
    goTo("start");
    setTimeout(() => balloonStart.focus(), 0);
  }
});

function runSelfTests() {
  const assert = (cond, msg) => { if (!cond) throw new Error("TEST FAILED: " + msg); };
  assert(CONFIG.gender === "boy" || CONFIG.gender === "girl", "CONFIG.gender is boy|girl");
  assert(Number.isFinite(CONFIG.revealSeconds) && CONFIG.revealSeconds > 0, "revealSeconds > 0");
  assert(Array.isArray(CONFIG.messagePool), "messagePool is array");
  assert(CONFIG.messagePool.length >= 20, "messagePool has 20+ messages");
  assert(CONFIG.messagePool.every((s) => typeof s === "string"), "messagePool items are strings");
  assert(Array.isArray(CONFIG.countdownImageUrls), "countdownImageUrls is array");
  const escaped = escapeHtml("a<b>c\n");
  assert(escaped.includes("&lt;"), "escapeHtml works");
  console.log("[SelfTest] OK");
}

try { runSelfTests(); } catch (e) { console.error(e); }

init();
