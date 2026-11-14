(function () {
  "use strict";

  const auth = window.GiziApp.initAppShell("chat", "Konsultasi Gizi & Kesehatan AI");
  if (!auth) return;

  const { Storage, Voice, buildAIRequestHeaders, calculateHealthMetrics, escapeHtml, showToast } = window.GiziApp;
  const { biodata } = auth;
  const metrics = calculateHealthMetrics(biodata);
  const history = Storage.getHistory();
  const latestScan = history.length > 0 ? history[0] : null;

  const chatFeed = document.getElementById("chatMessagesFeed");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const sendChatBtn = document.getElementById("sendChatBtn");
  const voiceChatMicBtn = document.getElementById("voiceChatMicBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const contextBioBox = document.getElementById("chatContextBio");
  const contextScanBox = document.getElementById("chatContextScan");

  // Render Context Panel
  if (contextBioBox) {
    contextBioBox.innerHTML = `
      <div style="font-size:0.84rem; display:flex; flex-direction:column; gap:0.45rem;">
        <div><strong>Nama:</strong> ${escapeHtml(biodata.nama)} (${biodata.umur} thn)</div>
        <div><strong>BMI:</strong> ${metrics.bmi} (${metrics.bmiCategory})</div>
        <div><strong>Target Kalori:</strong> ~${metrics.targetCalories} kkal/hari</div>
        <div><strong>Tujuan:</strong> ${escapeHtml(biodata.tujuan)}</div>
        <div><strong>Alergi:</strong> ${biodata.punyaAlergi === "ya" ? escapeHtml(biodata.jenisAlergi) : "Tidak ada"}</div>
        <div><strong>Kondisi:</strong> ${biodata.punyaPenyakit === "ya" ? escapeHtml(biodata.namaPenyakit) : "Sehat / Tidak ada"}</div>
      </div>
    `;
  }

  if (contextScanBox) {
    if (latestScan) {
      const n = latestScan.nutrition || {};
      contextScanBox.innerHTML = `
        <div style="font-size:0.83rem;">
          <div style="font-weight:700; color:var(--emerald-800); margin-bottom:0.25rem;">🍽️ ${escapeHtml(latestScan.food_name)}</div>
          <div style="color:var(--slate-600);">Kalori: ${n.calories_kcal ?? 0} kkal • P: ${n.protein_g ?? 0}g • K: ${n.carbs_g ?? 0}g • L: ${n.fat_g ?? 0}g</div>
          <button type="button" class="btn btn-outline btn-sm btn-block" style="margin-top:0.65rem;" id="askLatestScanBtn">
            Evaluasi Makanan Ini
          </button>
        </div>
      `;
      const askScanBtn = document.getElementById("askLatestScanBtn");
      if (askScanBtn) {
        askScanBtn.addEventListener("click", () => {
          sendUserMessage(`Tolong evaluasi hasil scan makanan terakhir saya (${latestScan.food_name}) apakah cocok dengan tujuan kesehatan dan profil saya?`);
        });
      }
    } else {
      contextScanBox.innerHTML = `
        <p style="font-size:0.82rem; color:var(--slate-500);">Belum ada makanan dipindai. Anda tetap bisa berkonsultasi mengenai menu harian dan nutrisi.</p>
      `;
    }
  }

  let messages = Storage.getChatHistory();
  if (messages.length === 0) {
    messages = [
      {
        role: "assistant",
        content: `Halo ${biodata.nama}! Saya Dr. GiziAI, asisten konsultasi nutrisi personal Anda di GIZICAM.

Saya sudah terhubung dengan profil kesehatan Anda (Tujuan: ${biodata.tujuan}, target energi ±${metrics.targetCalories} kkal/hari). Silakan tanyakan ide menu sehat, porsi makan, substitusi bahan alergi, atau evaluasi makanan yang baru Anda pindai!`,
        timestamp: new Date().toISOString()
      }
    ];
    Storage.saveChatHistory(messages);
  }

  function renderMessages() {
    if (!chatFeed) return;
    chatFeed.innerHTML = messages
      .map((msg, idx) => {
        const isUser = msg.role === "user";
        const timeLabel = msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
          : "";
        return `
          <div class="chat-bubble-row ${isUser ? "user" : "assistant"}">
            <div class="chat-bubble">${escapeHtml(msg.content)}</div>
            <div class="chat-meta-row">
              <span>${isUser ? "Anda" : "Dr. GiziAI"} • ${timeLabel}</span>
              ${
                !isUser
                  ? `<button type="button" class="btn btn-ghost btn-sm" style="min-height:26px; padding:0.15rem 0.45rem; font-size:0.74rem;" data-speak-idx="${idx}">🔊 Dengarkan</button>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");

    chatFeed.querySelectorAll("[data-speak-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-speak-idx"));
        if (messages[idx]) {
          Voice.speak(messages[idx].content);
          showToast("Membacakan jawaban konsultan AI...");
        }
      });
    });

    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  renderMessages();

  async function sendUserMessage(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;

    messages.push({
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString()
    });
    Storage.saveChatHistory(messages);
    renderMessages();

    if (chatInput) chatInput.value = "";
    if (sendChatBtn) sendChatBtn.disabled = true;

    // Tambahkan indikator mengetik sementara
    const typingDiv = document.createElement("div");
    typingDiv.className = "chat-bubble-row assistant";
    typingDiv.id = "aiTypingIndicator";
    typingDiv.innerHTML = `<div class="chat-bubble" style="color:var(--slate-500); font-style:italic;">Dr. GiziAI sedang menyusun saran gizi...</div>`;
    chatFeed.appendChild(typingDiv);
    chatFeed.scrollTop = chatFeed.scrollHeight;

    try {
      const response = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: buildAIRequestHeaders(),
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          biodata,
          latestScan
        })
      });

      const data = await response.json().catch(() => ({}));
      const indicator = document.getElementById("aiTypingIndicator");
      if (indicator) indicator.remove();
      if (sendChatBtn) sendChatBtn.disabled = false;

      if (!response.ok) {
        const errMsg = data.error || "Gagal terhubung ke Konsultan AI. Pastikan API Key AI telah diatur.";
        messages.push({
          role: "assistant",
          content: `⚠️ ${errMsg}

Anda dapat mengatur atau mengganti API Key AI (OpenRouter Gratis, Groq, Mistral, atau OpenAI) melalui menu Profil → Pengaturan AI.`,
          timestamp: new Date().toISOString()
        });
        Storage.saveChatHistory(messages);
        renderMessages();
        return;
      }

      messages.push({
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString()
      });
      Storage.saveChatHistory(messages);
      renderMessages();
    } catch {
      const indicator = document.getElementById("aiTypingIndicator");
      if (indicator) indicator.remove();
      if (sendChatBtn) sendChatBtn.disabled = false;
      showToast("Gangguan koneksi jaringan.", "error");
    }
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendUserMessage(chatInput.value);
    });
  }

  // Quick prompt chips
  document.querySelectorAll("[data-quick-prompt]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const promptText = chip.getAttribute("data-quick-prompt");
      sendUserMessage(promptText);
    });
  });

  // Voice dictation in Chat
  if (voiceChatMicBtn) {
    voiceChatMicBtn.addEventListener("click", () => {
      if (!Voice.isSupportedSTT()) {
        showToast("Browser belum mendukung input suara.", "warning");
        return;
      }
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRec();
      rec.lang = "id-ID";
      rec.interimResults = false;

      voiceChatMicBtn.disabled = true;
      voiceChatMicBtn.textContent = "🎙️...";

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (chatInput) chatInput.value = transcript;
        sendUserMessage(transcript);
      };
      rec.onerror = () => showToast("Suara tidak terdeteksi jelas.", "warning");
      rec.onend = () => {
        voiceChatMicBtn.disabled = false;
        voiceChatMicBtn.textContent = "🎙️";
      };
      rec.start();
    });
  }

  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (confirm("Hapus seluruh riwayat percakapan konsultasi AI?")) {
        Voice.stop();
        Storage.clearChatHistory();
        messages = [
          {
            role: "assistant",
            content: `Sesi konsultasi baru dimulai. Ada yang bisa saya bantu terkait nutrisi atau pola makan Anda hari ini, ${biodata.nama}?`,
            timestamp: new Date().toISOString()
          }
        ];
        Storage.saveChatHistory(messages);
        renderMessages();
        showToast("Riwayat konsultasi dibersihkan.");
      }
    });
  }

  // Jika datang dari tombol "Konsultasikan Makanan Ini" di Scanner/Dashboard
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("fromScan") === "1" && latestScan) {
    window.history.replaceState({}, "", "chat.html");
    sendUserMessage(`Saya baru saja memindai "${latestScan.food_name}" (${latestScan.nutrition?.calories_kcal ?? 0} kkal). Bagaimana saran Anda agar makanan ini seimbang dengan target harian saya?`);
  }
})();
