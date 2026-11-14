(function () {
  "use strict";

  const auth = window.GiziApp.initAppShell("profile", "Profil Kesehatan & Pengaturan AI");
  if (!auth) return;

  const { Storage, buildAIRequestHeaders, checkAIStatusBadge, escapeHtml, showToast } = window.GiziApp;
  const { biodata, account } = auth;

  // ================= 1. FORM EDIT BIODATA =================
  const profileBioForm = document.getElementById("profileBioForm");
  const punyaPenyakitEl = document.getElementById("profPunyaPenyakit");
  const boxPenyakitEl = document.getElementById("profBoxPenyakit");
  const punyaAlergiEl = document.getElementById("profPunyaAlergi");
  const boxAlergiEl = document.getElementById("profBoxAlergi");

  const syncCond = () => {
    if (boxPenyakitEl && punyaPenyakitEl) {
      boxPenyakitEl.classList.toggle("visible", punyaPenyakitEl.value === "ya");
    }
    if (boxAlergiEl && punyaAlergiEl) {
      boxAlergiEl.classList.toggle("visible", punyaAlergiEl.value === "ya");
    }
  };

  if (punyaPenyakitEl) punyaPenyakitEl.addEventListener("change", syncCond);
  if (punyaAlergiEl) punyaAlergiEl.addEventListener("change", syncCond);

  if (profileBioForm) {
    document.getElementById("profNama").value = biodata.nama || "";
    document.getElementById("profUmur").value = biodata.umur || "";
    document.getElementById("profJenisKelamin").value = biodata.jenisKelamin || "Laki-laki";
    document.getElementById("profTinggi").value = biodata.tinggi || "";
    document.getElementById("profBerat").value = biodata.berat || "";
    document.getElementById("profAktivitas").value = biodata.aktivitas || "Sedang";
    document.getElementById("profTujuan").value = biodata.tujuan || "Menjaga pola makan sehat";
    punyaPenyakitEl.value = biodata.punyaPenyakit || "tidak";
    document.getElementById("profNamaPenyakit").value = biodata.namaPenyakit || "";
    punyaAlergiEl.value = biodata.punyaAlergi || "tidak";
    document.getElementById("profJenisAlergi").value = biodata.jenisAlergi || "";
    syncCond();

    profileBioForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nama = document.getElementById("profNama").value.trim();
      const umur = Number(document.getElementById("profUmur").value);
      const tinggi = Number(document.getElementById("profTinggi").value);
      const berat = Number(document.getElementById("profBerat").value);

      if (nama.length < 2 || !umur || !tinggi || !berat) {
        showToast("Pastikan nama, umur, tinggi, dan berat badan diisi dengan valid.", "error");
        return;
      }

      Storage.saveBiodata({
        nama,
        umur,
        jenisKelamin: document.getElementById("profJenisKelamin").value,
        tinggi,
        berat,
        aktivitas: document.getElementById("profAktivitas").value,
        tujuan: document.getElementById("profTujuan").value,
        punyaPenyakit: punyaPenyakitEl.value,
        namaPenyakit: punyaPenyakitEl.value === "ya" ? document.getElementById("profNamaPenyakit").value.trim() : "",
        punyaAlergi: punyaAlergiEl.value,
        jenisAlergi: punyaAlergiEl.value === "ya" ? document.getElementById("profJenisAlergi").value.trim() : ""
      });

      showToast("Biodata kesehatan berhasil diperbarui!");
    });
  }

  // Info akun demonstrasi
  const accountInfoEl = document.getElementById("accountDemoInfo");
  if (accountInfoEl && account) {
    accountInfoEl.innerHTML = `
      <div style="font-size:0.85rem; color:var(--slate-600);">
        <strong>Username:</strong> ${escapeHtml(account.username)} &nbsp;|&nbsp;
        <strong>Email:</strong> ${escapeHtml(account.email)}
      </div>
    `;
  }

  // ================= 2. PENGATURAN SUARA AI =================
  const voiceRateRange = document.getElementById("voiceRateRange");
  const voiceRateLabel = document.getElementById("voiceRateLabel");
  const testVoiceBtn = document.getElementById("testVoiceBtn");

  if (voiceRateRange) {
    const prefs = Storage.getVoicePrefs();
    voiceRateRange.value = prefs.rate || 1.02;
    if (voiceRateLabel) voiceRateLabel.textContent = `${voiceRateRange.value}x`;

    voiceRateRange.addEventListener("input", () => {
      if (voiceRateLabel) voiceRateLabel.textContent = `${voiceRateRange.value}x`;
      Storage.saveVoicePrefs({
        ...Storage.getVoicePrefs(),
        rate: Number(voiceRateRange.value)
      });
    });
  }

  if (testVoiceBtn) {
    testVoiceBtn.addEventListener("click", () => {
      window.GiziApp.Voice.speak(
        `Halo ${biodata.nama}, suara asisten kamera GIZICAM siap membantu menganalisis nutrisi makanan Anda.`
      );
    });
  }

  // ================= 3. KONFIGURASI API KEY AI MULTI-PROVIDER =================
  const aiProviderSelect = document.getElementById("aiProviderSelect");
  const aiApiKeyInput = document.getElementById("aiApiKeyInput");
  const aiVisionModelInput = document.getElementById("aiVisionModelInput");
  const aiChatModelInput = document.getElementById("aiChatModelInput");
  const aiBaseUrlInput = document.getElementById("aiBaseUrlInput");
  const customBaseUrlGroup = document.getElementById("customBaseUrlGroup");
  const saveAiConfigBtn = document.getElementById("saveAiConfigBtn");
  const testAiConnectionBtn = document.getElementById("testAiConnectionBtn");
  const clearAiConfigBtn = document.getElementById("clearAiConfigBtn");
  const aiTestFeedback = document.getElementById("aiTestFeedback");

  const PROVIDER_HINTS = {
    auto: { vision: "Otomatis (mis. qwen/qwen3.8-27b atau openrouter/free)", chat: "Otomatis sesuai prefix key" },
    openrouter: { vision: "openrouter/free", chat: "openrouter/free" },
    groq: { vision: "qwen/qwen3.8-27b", chat: "openai/gpt-oss-20b" },
    mistral: { vision: "pixtral-12b-2409", chat: "mistral-small-latest" },
    openai: { vision: "gpt-4o-mini", chat: "gpt-4o-mini" },
    together: { vision: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo", chat: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
    custom: { vision: "Nama model vision provider Anda", chat: "Nama model chat provider Anda" }
  };

  function syncProviderFields() {
    if (!aiProviderSelect) return;
    const val = aiProviderSelect.value;
    if (customBaseUrlGroup) {
      customBaseUrlGroup.style.display = val === "custom" ? "block" : "none";
    }
    const hint = PROVIDER_HINTS[val] || PROVIDER_HINTS.auto;
    if (aiVisionModelInput) aiVisionModelInput.placeholder = hint.vision;
    if (aiChatModelInput) aiChatModelInput.placeholder = hint.chat;
  }

  if (aiProviderSelect) {
    aiProviderSelect.addEventListener("change", syncProviderFields);
  }

  // Load existing BYOK session config if any
  const existingByok = Storage.getByokConfig();
  if (existingByok) {
    if (aiProviderSelect) aiProviderSelect.value = existingByok.provider || "auto";
    if (aiApiKeyInput) aiApiKeyInput.value = existingByok.apiKey || "";
    if (aiVisionModelInput) aiVisionModelInput.value = existingByok.visionModel || "";
    if (aiChatModelInput) aiChatModelInput.value = existingByok.chatModel || "";
    if (aiBaseUrlInput) aiBaseUrlInput.value = existingByok.baseUrl || "";
  }
  syncProviderFields();

  if (saveAiConfigBtn) {
    saveAiConfigBtn.addEventListener("click", () => {
      const apiKey = (aiApiKeyInput?.value || "").trim();
      if (!apiKey) {
        showToast("Masukkan API Key AI terlebih dahulu atau gunakan Environment Variable di Netlify.", "warning");
        return;
      }

      Storage.saveByokConfig({
        provider: aiProviderSelect?.value || "auto",
        apiKey,
        visionModel: (aiVisionModelInput?.value || "").trim(),
        chatModel: (aiChatModelInput?.value || "").trim(),
        baseUrl: (aiBaseUrlInput?.value || "").trim()
      });

      checkAIStatusBadge();
      showToast("Konfigurasi API Key AI aktif untuk sesi ini!");
      if (aiTestFeedback) {
        aiTestFeedback.innerHTML = `<div class="alert alert-emerald" style="margin-top:0.75rem;"><span>✅</span><div>API Key disimpan di sesi browser (<code>sessionStorage</code>) dan dikirim aman ke Netlify Function. Klik <strong>Uji Koneksi AI</strong> untuk memverifikasi.</div></div>`;
      }
    });
  }

  if (clearAiConfigBtn) {
    clearAiConfigBtn.addEventListener("click", () => {
      Storage.saveByokConfig(null);
      if (aiApiKeyInput) aiApiKeyInput.value = "";
      if (aiVisionModelInput) aiVisionModelInput.value = "";
      if (aiChatModelInput) aiChatModelInput.value = "";
      if (aiBaseUrlInput) aiBaseUrlInput.value = "";
      checkAIStatusBadge();
      showToast("API Key sesi dihapus. Kembali menggunakan konfigurasi server Netlify.");
      if (aiTestFeedback) aiTestFeedback.innerHTML = "";
    });
  }

  if (testAiConnectionBtn) {
    testAiConnectionBtn.addEventListener("click", async () => {
      // Simpan dulu jika pengguna mengetik di input sebelum klik Test
      const typedKey = (aiApiKeyInput?.value || "").trim();
      if (typedKey) {
        Storage.saveByokConfig({
          provider: aiProviderSelect?.value || "auto",
          apiKey: typedKey,
          visionModel: (aiVisionModelInput?.value || "").trim(),
          chatModel: (aiChatModelInput?.value || "").trim(),
          baseUrl: (aiBaseUrlInput?.value || "").trim()
        });
      }

      testAiConnectionBtn.disabled = true;
      testAiConnectionBtn.textContent = "⏳ Menguji Koneksi...";

      try {
        const res = await fetch("/.netlify/functions/chat", {
          method: "POST",
          headers: buildAIRequestHeaders(),
          body: JSON.stringify({ testOnly: true })
        });
        const data = await res.json().catch(() => ({}));
        testAiConnectionBtn.disabled = false;
        testAiConnectionBtn.textContent = "🔌 Uji Koneksi AI";

        if (res.ok && data.ok) {
          checkAIStatusBadge();
          showToast(data.message || "Koneksi AI berhasil!");
          if (aiTestFeedback) {
            aiTestFeedback.innerHTML = `<div class="alert alert-emerald" style="margin-top:0.75rem;"><span>🎉</span><div><strong>Berhasil!</strong> ${escapeHtml(data.message)}</div></div>`;
          }
        } else {
          const err = data.error || "Gagal terhubung ke penyedia AI.";
          showToast("Uji koneksi gagal.", "error");
          if (aiTestFeedback) {
            aiTestFeedback.innerHTML = `<div class="alert alert-danger" style="margin-top:0.75rem;"><span>⚠️</span><div><strong>Gagal:</strong> ${escapeHtml(err)}</div></div>`;
          }
        }
      } catch {
        testAiConnectionBtn.disabled = false;
        testAiConnectionBtn.textContent = "🔌 Uji Koneksi AI";
        showToast("Tidak dapat menjangkau Netlify Function.", "error");
      }
    });
  }
})();
