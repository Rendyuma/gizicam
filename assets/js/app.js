(function (window) {
  "use strict";

  const STORAGE_KEYS = {
    BIODATA: "gizicam_biodata",
    ACCOUNT: "gizicam_account",
    SESSION: "gizicam_session",
    HISTORY: "gizicam_history",
    CHAT: "gizicam_chat_history",
    PROGRAMS: "gizicam_programs",
    VOICE: "gizicam_voice_prefs"
  };

  const BYOK_SESSION_KEY = "gizicam_byok_config";

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (err) {
      console.warn("Data LocalStorage rusak untuk key:", key, err);
      return fallback;
    }
  }

  function safeWriteJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("Gagal menyimpan ke LocalStorage:", err);
      return false;
    }
  }

  const GiziStorage = {
    KEYS: STORAGE_KEYS,

    getBiodata() {
      return safeReadJSON(STORAGE_KEYS.BIODATA, null);
    },
    saveBiodata(data) {
      return safeWriteJSON(STORAGE_KEYS.BIODATA, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    },

    getAccount() {
      return safeReadJSON(STORAGE_KEYS.ACCOUNT, null);
    },
    saveAccount(accountObj) {
      return safeWriteJSON(STORAGE_KEYS.ACCOUNT, accountObj);
    },

    getSession() {
      return safeReadJSON(STORAGE_KEYS.SESSION, null);
    },
    setSession(sessionObj) {
      return safeWriteJSON(STORAGE_KEYS.SESSION, sessionObj);
    },
    clearSession() {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    },

    getHistory() {
      const list = safeReadJSON(STORAGE_KEYS.HISTORY, []);
      return Array.isArray(list) ? list : [];
    },
    addScanHistory(scanItem) {
      const list = this.getHistory();
      const entry = {
        id: "scan_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        scannedAt: new Date().toISOString(),
        ...scanItem
      };
      list.unshift(entry);
      // Simpan maksimal 50 riwayat terakhir agar kuota LocalStorage tetap ringan
      safeWriteJSON(STORAGE_KEYS.HISTORY, list.slice(0, 50));
      return entry;
    },
    deleteScanHistory(id) {
      const filtered = this.getHistory().filter((item) => item.id !== id);
      safeWriteJSON(STORAGE_KEYS.HISTORY, filtered);
      return filtered;
    },
    clearAllHistory() {
      safeWriteJSON(STORAGE_KEYS.HISTORY, []);
    },

    getChatHistory() {
      const msgs = safeReadJSON(STORAGE_KEYS.CHAT, []);
      return Array.isArray(msgs) ? msgs : [];
    },
    saveChatHistory(msgs) {
      safeWriteJSON(STORAGE_KEYS.CHAT, Array.isArray(msgs) ? msgs.slice(-40) : []);
    },
    clearChatHistory() {
      safeWriteJSON(STORAGE_KEYS.CHAT, []);
    },

    getPrograms() {
      const todayKey = new Date().toISOString().slice(0, 10);
      const data = safeReadJSON(STORAGE_KEYS.PROGRAMS, {});
      if (!data.waterByDate) data.waterByDate = {};
      if (typeof data.waterByDate[todayKey] !== "number") {
        data.waterByDate[todayKey] = 0;
      }
      if (!Array.isArray(data.completedChallenges)) {
        data.completedChallenges = [];
      }
      return data;
    },
    savePrograms(progData) {
      safeWriteJSON(STORAGE_KEYS.PROGRAMS, progData);
    },

    getVoicePrefs() {
      const prefs = safeReadJSON(STORAGE_KEYS.VOICE, null);
      return {
        autoSpeak: prefs && typeof prefs.autoSpeak === "boolean" ? prefs.autoSpeak : true,
        rate: prefs && typeof prefs.rate === "number" ? prefs.rate : 1.02
      };
    },
    saveVoicePrefs(prefs) {
      safeWriteJSON(STORAGE_KEYS.VOICE, prefs);
    },

    getByokConfig() {
      try {
        const raw = sessionStorage.getItem(BYOK_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    saveByokConfig(cfg) {
      try {
        if (!cfg || !cfg.apiKey) {
          sessionStorage.removeItem(BYOK_SESSION_KEY);
        } else {
          sessionStorage.setItem(BYOK_SESSION_KEY, JSON.stringify(cfg));
        }
      } catch (e) {
        console.warn("Gagal menyimpan konfigurasi sesi AI:", e);
      }
    }
  };

  // Helper untuk membuat header request AI (menggunakan Server Env atau BYOK user)
  function buildAIRequestHeaders(extra = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...extra
    };
    const byok = GiziStorage.getByokConfig();
    if (byok && byok.apiKey) {
      headers["X-Custom-AI-Key"] = byok.apiKey.trim();
      if (byok.provider) headers["X-AI-Provider"] = byok.provider;
      if (byok.visionModel) headers["X-AI-Vision-Model"] = byok.visionModel.trim();
      if (byok.chatModel) headers["X-AI-Chat-Model"] = byok.chatModel.trim();
      if (byok.baseUrl) headers["X-AI-Base-Url"] = byok.baseUrl.trim();
    }
    return headers;
  }

  // SHA-256 Password Hashing (menghindari penyimpanan password plain-text)
  async function hashPassword(password) {
    const salt = "GIZICAM_LOCAL_DEMO_SALT_2026";
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + ":" + password);
    if (window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback deterministic hash jika bukan HTTPS/localhost
    let h = 2166136261;
    const str = salt + ":" + password;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return "fallback_" + (h >>> 0).toString(16);
  }

  // Perhitungan Metrik Kesehatan & Gizi Harian (BMI, BMR, TDEE, Air, Makro)
  function calculateHealthMetrics(biodata) {
    const weight = Number(biodata?.berat) || 60;
    const heightCm = Number(biodata?.tinggi) || 165;
    const age = Number(biodata?.umur) || 25;
    const gender = (biodata?.jenisKelamin || "Laki-laki").toLowerCase();
    const activity = (biodata?.aktivitas || "Sedang").toLowerCase();
    const goal = (biodata?.tujuan || "Menjaga pola makan sehat").toLowerCase();

    const heightM = heightCm / 100;
    const bmi = heightM > 0 ? Number((weight / (heightM * heightM)).toFixed(1)) : 22.0;

    let bmiCategory = "Normal / Ideal";
    let bmiBadge = "badge-emerald";
    if (bmi < 18.5) {
      bmiCategory = "Berat Badan Kurang";
      bmiBadge = "badge-warning";
    } else if (bmi >= 25 && bmi < 30) {
      bmiCategory = "Berat Badan Berlebih";
      bmiBadge = "badge-warning";
    } else if (bmi >= 30) {
      bmiCategory = "Obesitas";
      bmiBadge = "badge-danger";
    }

    // Mifflin-St Jeor Equation
    const isFemale = gender.includes("perempuan") || gender.includes("wanita");
    const bmr = Math.round(10 * weight + 6.25 * heightCm - 5 * age + (isFemale ? -161 : 5));

    let multiplier = 1.375;
    if (activity.includes("ringan") || activity.includes("jarang")) multiplier = 1.2;
    else if (activity.includes("sedang")) multiplier = 1.45;
    else if (activity.includes("aktif") || activity.includes("berat") || activity.includes("tinggi")) multiplier = 1.65;

    let tdee = Math.round(bmr * multiplier);
    let proteinRatio = 0.2;
    let carbRatio = 0.5;
    let fatRatio = 0.3;

    if (goal.includes("protein")) {
      proteinRatio = 0.28;
      carbRatio = 0.45;
      fatRatio = 0.27;
    }

    const targetCalories = Math.max(1200, tdee);
    const targetProteinG = Math.round((targetCalories * proteinRatio) / 4);
    const targetCarbsG = Math.round((targetCalories * carbRatio) / 4);
    const targetFatG = Math.round((targetCalories * fatRatio) / 9);
    const waterTargetMl = Math.max(1500, Math.round(weight * 30));

    return {
      bmi,
      bmiCategory,
      bmiBadge,
      bmr,
      tdee,
      targetCalories,
      targetProteinG,
      targetCarbsG,
      targetFatG,
      waterTargetMl
    };
  }

  // Sistem Suara AI (Text-to-Speech & Speech-to-Text)
  const GiziVoice = {
    isSupportedTTS() {
      return "speechSynthesis" in window;
    },
    isSupportedSTT() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    },
    getIndonesianVoice() {
      if (!this.isSupportedTTS()) return null;
      const voices = window.speechSynthesis.getVoices();
      return (
        voices.find((v) => v.lang && v.lang.toLowerCase().includes("id-id")) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("id")) ||
        null
      );
    },
    speak(text, callbacks = {}) {
      if (!this.isSupportedTTS() || !text) {
        if (callbacks.onEnd) callbacks.onEnd();
        return false;
      }
      window.speechSynthesis.cancel();
      const prefs = GiziStorage.getVoicePrefs();
      const utterance = new SpeechSynthesisUtterance(text);
      const idVoice = this.getIndonesianVoice();
      if (idVoice) utterance.voice = idVoice;
      utterance.lang = "id-ID";
      utterance.rate = prefs.rate || 1.02;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (callbacks.onStart) callbacks.onStart();
      };
      utterance.onend = () => {
        if (callbacks.onEnd) callbacks.onEnd();
      };
      utterance.onerror = () => {
        if (callbacks.onEnd) callbacks.onEnd();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    },
    stop() {
      if (this.isSupportedTTS()) {
        window.speechSynthesis.cancel();
      }
    },
    pause() {
      if (this.isSupportedTTS() && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
      }
    },
    resume() {
      if (this.isSupportedTTS() && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  };

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      GiziVoice.getIndonesianVoice();
    };
  }

  // Toast UI
  function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "toast-error" : type === "warning" ? "toast-warning" : ""}`;
    const icon = type === "error" ? "⚠️" : type === "warning" ? "🔔" : "✅";
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => toast.remove(), 250);
    }, 3600);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateID(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString || "-";
    }
  }

  // Route Guard untuk halaman internal aplikasi
  function requireAuth() {
    const biodata = GiziStorage.getBiodata();
    const account = GiziStorage.getAccount();
    const session = GiziStorage.getSession();

    if (!biodata) {
      window.location.href = "biodata.html";
      return null;
    }
    if (!account) {
      window.location.href = "register.html";
      return null;
    }
    if (!session || !session.loggedIn) {
      window.location.href = "login.html";
      return null;
    }
    return { biodata, account, session };
  }

  // Render Sidebar, Topbar, dan Mobile Bottom Nav pada halaman terautentikasi
  function initAppShell(activePage, pageTitle) {
    const authData = requireAuth();
    if (!authData) return null;

    const { biodata, account } = authData;
    const displayName = biodata.nama || account.username || "Pengguna";
    const initials = displayName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "GZ";

    const navItems = [
      { id: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "📊" },
      { id: "scanner", label: "AI Food Scanner", href: "scanner.html", icon: "📸" },
      { id: "chat", label: "Konsultasi AI", href: "chat.html", icon: "💬" },
      { id: "programs", label: "Program Kesehatan", href: "programs.html", icon: "🏃" },
      { id: "history", label: "Riwayat Scan", href: "history.html", icon: "🗂️" },
      { id: "recommendations", label: "Rekomendasi", href: "recommendations.html", icon: "🥗" },
      { id: "profile", label: "Profil & API Key", href: "profile.html", icon: "⚙️" }
    ];

    const sidebarEl = document.getElementById("appSidebar");
    if (sidebarEl) {
      sidebarEl.innerHTML = `
        <div class="sidebar-header">
          <a href="dashboard.html" class="brand-logo">
            <img src="assets/images/logo.svg" alt="GIZICAM Logo" />
            <span>GIZI<em>CAM</em></span>
          </a>
          <button type="button" class="sidebar-close-btn" id="closeSidebarBtn" aria-label="Tutup Menu">✕</button>
        </div>
        <nav class="sidebar-nav" aria-label="Navigasi Utama">
          <div class="nav-section-label">Menu Utama</div>
          ${navItems
            .map(
              (item) => `
            <a href="${item.href}" class="sidebar-link ${activePage === item.id ? "active" : ""}">
              <span class="nav-icon">${item.icon}</span>
              <span>${item.label}</span>
            </a>`
            )
            .join("")}
        </nav>
        <div class="sidebar-footer">
          <button type="button" class="btn btn-danger btn-block btn-sm" id="logoutBtnSidebar">
            🚪 Logout
          </button>
        </div>
      `;
    }

    const topbarEl = document.getElementById("appTopbar");
    if (topbarEl) {
      topbarEl.innerHTML = `
        <div class="topbar-left">
          <button type="button" class="mobile-menu-btn" id="openSidebarBtn" aria-label="Buka Menu">☰</button>
          <div class="page-title-top">${escapeHtml(pageTitle)}</div>
        </div>
        <div class="topbar-right">
          <a href="profile.html#ai-config" class="ai-status-pill" id="aiStatusPill" title="Klik untuk melihat atau mengubah API Key AI">
            <span class="status-dot" id="aiStatusDot"></span>
            <span id="aiStatusText">Cek AI...</span>
          </a>
          <a href="profile.html" class="user-avatar-chip">
            <span class="avatar-circle">${escapeHtml(initials)}</span>
            <span class="user-name-label">${escapeHtml(displayName.split(" ")[0])}</span>
          </a>
        </div>
      `;
    }

    const bottomNavEl = document.getElementById("mobileBottomNav");
    if (bottomNavEl) {
      const mobileItems = [
        { id: "dashboard", label: "Beranda", href: "dashboard.html", icon: "📊" },
        { id: "chat", label: "Konsultasi", href: "chat.html", icon: "💬" },
        { id: "scanner", label: "Scan AI", href: "scanner.html", icon: "📸", center: true },
        { id: "programs", label: "Program", href: "programs.html", icon: "🏃" },
        { id: "profile", label: "Profil", href: "profile.html", icon: "⚙️" }
      ];
      bottomNavEl.innerHTML = `
        <div class="mobile-bottom-nav-inner">
          ${mobileItems
            .map(
              (m) => `
            <a href="${m.href}" class="bottom-nav-item ${activePage === m.id ? "active" : ""} ${m.center ? "scan-center" : ""}">
              <span class="b-icon">${m.icon}</span>
              <span>${m.label}</span>
            </a>`
            )
            .join("")}
        </div>
      `;
    }

    // Sidebar toggle events
    const overlay = document.getElementById("sidebarOverlay");
    const openBtn = document.getElementById("openSidebarBtn");
    const closeBtn = document.getElementById("closeSidebarBtn");
    const logoutBtn = document.getElementById("logoutBtnSidebar");

    if (openBtn && sidebarEl) {
      openBtn.addEventListener("click", () => {
        sidebarEl.classList.add("open");
        if (overlay) overlay.classList.add("active");
      });
    }
    const closeSidebar = () => {
      if (sidebarEl) sidebarEl.classList.remove("open");
      if (overlay) overlay.classList.remove("active");
    };
    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        GiziVoice.stop();
        GiziStorage.clearSession();
        window.location.href = "login.html";
      });
    }

    // Check AI status asynchronously
    checkAIStatusBadge();

    return authData;
  }

  async function checkAIStatusBadge() {
    const dot = document.getElementById("aiStatusDot");
    const text = document.getElementById("aiStatusText");
    if (!dot || !text) return;

    const byok = GiziStorage.getByokConfig();
    if (byok && byok.apiKey) {
      dot.classList.remove("offline");
      text.textContent = `AI Aktif (${(byok.provider || "Custom").toUpperCase()})`;
      return;
    }

    try {
      const res = await fetch("/.netlify/functions/chat", {
        method: "GET",
        headers: buildAIRequestHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          dot.classList.remove("offline");
          text.textContent = `AI Siap (${data.providerLabel || "Cloud"})`;
        } else {
          dot.classList.add("offline");
          text.textContent = "Set API Key AI";
        }
      } else {
        dot.classList.add("offline");
        text.textContent = "Atur API Key";
      }
    } catch {
      dot.classList.add("offline");
      text.textContent = "Mode Offline / Set Key";
    }
  }

  window.GiziApp = {
    Storage: GiziStorage,
    Voice: GiziVoice,
    buildAIRequestHeaders,
    hashPassword,
    calculateHealthMetrics,
    showToast,
    escapeHtml,
    formatDateID,
    requireAuth,
    initAppShell,
    checkAIStatusBadge
  };
})(window);
