(function () {
  "use strict";

  const auth = window.GiziApp.initAppShell("scanner", "AI Food Scanner & Kamera Suara");
  if (!auth) return;

  const { Storage, Voice, buildAIRequestHeaders, calculateHealthMetrics, escapeHtml, showToast } = window.GiziApp;
  const { biodata } = auth;
  const metrics = calculateHealthMetrics(biodata);

  // Elements
  const choiceGalleryBtn = document.getElementById("choiceGalleryBtn");
  const choiceCameraBtn = document.getElementById("choiceCameraBtn");
  const galleryInput = document.getElementById("galleryInput");

  const cameraStage = document.getElementById("cameraStage");
  const cameraPreview = document.getElementById("cameraPreview");
  const capturePhotoBtn = document.getElementById("capturePhotoBtn");
  const switchCameraBtn = document.getElementById("switchCameraBtn");
  const closeCameraBtn = document.getElementById("closeCameraBtn");
  const cameraErrorBox = document.getElementById("cameraErrorBox");

  const previewStage = document.getElementById("previewStage");
  const selectedFoodImage = document.getElementById("selectedFoodImage");
  const retakeOrChangeBtn = document.getElementById("retakeOrChangeBtn");
  const removePhotoBtn = document.getElementById("removePhotoBtn");
  const analyzeFoodBtn = document.getElementById("analyzeFoodBtn");

  const voiceAutoToggle = document.getElementById("voiceAutoToggle");
  const voiceAskBtn = document.getElementById("voiceAskBtn");
  const voiceQuestionPreview = document.getElementById("voiceQuestionPreview");
  const voiceQuestionText = document.getElementById("voiceQuestionText");
  const clearVoiceQuestionBtn = document.getElementById("clearVoiceQuestionBtn");
  const voiceWaveEl = document.getElementById("voiceWave");
  const voiceStatusLabel = document.getElementById("voiceStatusLabel");

  const loadingBox = document.getElementById("loadingScannerBox");
  const resultEmptyPlaceholder = document.getElementById("resultEmptyPlaceholder");
  const resultCardContainer = document.getElementById("resultCardContainer");

  let activeStream = null;
  let facingMode = "environment";
  let currentImageDataUrl = "";
  let currentMimeType = "image/jpeg";
  let lastSourceMode = "gallery"; // 'gallery' | 'camera'
  let capturedVoiceQuestion = "";
  let latestScanResult = null;

  // Load saved voice preference
  const voicePrefs = Storage.getVoicePrefs();
  if (voiceAutoToggle) {
    voiceAutoToggle.checked = voicePrefs.autoSpeak;
    voiceAutoToggle.addEventListener("change", () => {
      Storage.saveVoicePrefs({
        ...Storage.getVoicePrefs(),
        autoSpeak: voiceAutoToggle.checked
      });
      if (!voiceAutoToggle.checked) {
        Voice.stop();
        setSpeakingVisual(false, "Suara AI dimatikan");
      } else {
        showToast("Suara AI Otomatis diaktifkan!");
      }
    });
  }

  function setSpeakingVisual(isSpeaking, label) {
    if (voiceWaveEl) {
      voiceWaveEl.classList.toggle("speaking", isSpeaking);
    }
    if (voiceStatusLabel && label) {
      voiceStatusLabel.textContent = label;
    }
  }

  function stopCameraStream() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    if (cameraPreview) {
      cameraPreview.srcObject = null;
    }
    if (cameraStage) {
      cameraStage.classList.remove("active");
    }
  }

  window.addEventListener("beforeunload", () => {
    stopCameraStream();
    Voice.stop();
  });

  function showCameraError(msg) {
    if (!cameraErrorBox) return;
    cameraErrorBox.style.display = msg ? "flex" : "none";
    const span = cameraErrorBox.querySelector(".cam-err-text");
    if (span) span.textContent = msg;
  }

  // Compress & normalize image to <= 5MB JPEG/PNG/WebP
  function fileOrCanvasToPreparedDataUrl(sourceImgOrCanvas, preferredMime = "image/jpeg") {
    const maxDim = 1280;
    let width = sourceImgOrCanvas.videoWidth || sourceImgOrCanvas.naturalWidth || sourceImgOrCanvas.width;
    let height = sourceImgOrCanvas.videoHeight || sourceImgOrCanvas.naturalHeight || sourceImgOrCanvas.height;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(sourceImgOrCanvas, 0, 0, width, height);

    const outMime = ["image/jpeg", "image/png", "image/webp"].includes(preferredMime)
      ? preferredMime
      : "image/jpeg";
    const quality = outMime === "image/png" ? undefined : 0.86;
    const dataUrl = canvas.toDataURL(outMime, quality);
    return { dataUrl, mimeType: outMime };
  }

  function displaySelectedPreview(dataUrl, mimeType, sourceMode) {
    currentImageDataUrl = dataUrl;
    currentMimeType = mimeType;
    lastSourceMode = sourceMode;

    stopCameraStream();
    showCameraError("");

    if (selectedFoodImage) selectedFoodImage.src = dataUrl;
    if (previewStage) previewStage.classList.add("active");
    if (retakeOrChangeBtn) {
      retakeOrChangeBtn.textContent = sourceMode === "camera" ? "🔄 Ambil Ulang Foto" : "🖼️ Ganti Foto";
    }
  }

  // ================= 1. UPLOAD DARI GALERI =================
  if (choiceGalleryBtn && galleryInput) {
    choiceGalleryBtn.addEventListener("click", () => {
      stopCameraStream();
      galleryInput.click();
    });

    galleryInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        showToast("Format file tidak didukung. Pilih JPEG, PNG, atau WebP.", "error");
        galleryInput.value = "";
        return;
      }

      if (file.size > 12 * 1024 * 1024) {
        showToast("Ukuran foto terlalu besar. Maksimal 5 MB setelah kompresi.", "error");
        galleryInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const prepared = fileOrCanvasToPreparedDataUrl(img, file.type === "image/jpg" ? "image/jpeg" : file.type);
          displaySelectedPreview(prepared.dataUrl, prepared.mimeType, "gallery");
        };
        img.onerror = () => {
          showToast("Gagal membaca gambar yang dipilih.", "error");
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ================= 2. KAMERA LANGSUNG =================
  async function startCamera() {
    showCameraError("");
    if (previewStage) previewStage.classList.remove("active");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError("Browser atau perangkat ini tidak mendukung akses kamera langsung. Pastikan website dibuka melalui HTTPS atau localhost.");
      return;
    }

    stopCameraStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

      activeStream = stream;
      cameraPreview.srcObject = stream;
      cameraStage.classList.add("active");
    } catch (err) {
      let msg = "Gagal membuka kamera. ";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg += "Izin akses kamera ditolak oleh pengguna. Aktifkan izin kamera pada pengaturan browser Anda.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg += "Perangkat tidak memiliki kamera yang terdeteksi.";
      } else {
        msg += "Pastikan halaman diakses melalui HTTPS atau localhost dan kamera tidak sedang dipakai aplikasi lain.";
      }
      showCameraError(msg);
      showToast("Tidak dapat mengakses kamera.", "error");
    }
  }

  if (choiceCameraBtn) {
    choiceCameraBtn.addEventListener("click", startCamera);
  }

  if (switchCameraBtn) {
    switchCameraBtn.addEventListener("click", () => {
      facingMode = facingMode === "environment" ? "user" : "environment";
      startCamera();
    });
  }

  if (closeCameraBtn) {
    closeCameraBtn.addEventListener("click", () => {
      stopCameraStream();
    });
  }

  if (capturePhotoBtn) {
    capturePhotoBtn.addEventListener("click", () => {
      if (!cameraPreview || !cameraPreview.videoWidth) {
        showToast("Kamera belum siap, tunggu sebentar.", "warning");
        return;
      }
      const prepared = fileOrCanvasToPreparedDataUrl(cameraPreview, "image/jpeg");
      displaySelectedPreview(prepared.dataUrl, prepared.mimeType, "camera");
      showToast("Foto makanan berhasil diambil!");
    });
  }

  if (retakeOrChangeBtn) {
    retakeOrChangeBtn.addEventListener("click", () => {
      if (lastSourceMode === "camera") {
        startCamera();
      } else if (galleryInput) {
        galleryInput.value = "";
        galleryInput.click();
      }
    });
  }

  if (removePhotoBtn) {
    removePhotoBtn.addEventListener("click", () => {
      currentImageDataUrl = "";
      if (galleryInput) galleryInput.value = "";
      if (previewStage) previewStage.classList.remove("active");
      Voice.stop();
      setSpeakingVisual(false, "Siap membacakan hasil analisis");
    });
  }

  // ================= 3. VOICE INPUT (TANYA KAMERA VIA SUARA) =================
  if (voiceAskBtn) {
    voiceAskBtn.addEventListener("click", () => {
      if (!Voice.isSupportedSTT()) {
        showToast("Browser ini belum mendukung pengenalan suara (gunakan Chrome/Edge terbaru).", "warning");
        return;
      }
      Voice.stop();
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRec();
      recognition.lang = "id-ID";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      voiceAskBtn.disabled = true;
      voiceAskBtn.textContent = "🎙️ Mendengarkan...";
      setSpeakingVisual(true, "Silakan ucapkan pertanyaan Anda tentang makanan...");

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        capturedVoiceQuestion = transcript;
        if (voiceQuestionPreview && voiceQuestionText) {
          voiceQuestionText.textContent = `"${transcript}"`;
          voiceQuestionPreview.style.display = "flex";
        }
        showToast("Pertanyaan suara direkam!");
        // Jika foto sudah ada, langsung analisis dengan pertanyaan suara tersebut!
        if (currentImageDataUrl) {
          analyzeCurrentFood();
        }
      };

      recognition.onerror = () => {
        showToast("Suara tidak terdengar jelas. Coba ulangi.", "warning");
      };

      recognition.onend = () => {
        voiceAskBtn.disabled = false;
        voiceAskBtn.textContent = "🎙️ Tanya Kamera via Suara";
        setSpeakingVisual(false, "Siap membacakan hasil analisis");
      };

      recognition.start();
    });
  }

  if (clearVoiceQuestionBtn) {
    clearVoiceQuestionBtn.addEventListener("click", () => {
      capturedVoiceQuestion = "";
      if (voiceQuestionPreview) voiceQuestionPreview.style.display = "none";
    });
  }

  // ================= 4. ANALISIS MAKANAN KE NETLIFY FUNCTION =================
  async function analyzeCurrentFood() {
    if (!currentImageDataUrl) {
      showToast("Pilih foto dari galeri atau ambil foto dengan kamera terlebih dahulu.", "warning");
      return;
    }

    Voice.stop();
    if (analyzeFoodBtn) analyzeFoodBtn.disabled = true;
    if (resultEmptyPlaceholder) resultEmptyPlaceholder.style.display = "none";
    if (resultCardContainer) resultCardContainer.innerHTML = "";
    if (loadingBox) loadingBox.classList.add("active");

    try {
      const response = await fetch("/.netlify/functions/scan", {
        method: "POST",
        headers: buildAIRequestHeaders(),
        body: JSON.stringify({
          imageDataUrl: currentImageDataUrl,
          mimeType: currentMimeType,
          biodata,
          voiceQuestion: capturedVoiceQuestion
        })
      });

      const data = await response.json().catch(() => ({}));
      if (loadingBox) loadingBox.classList.remove("active");
      if (analyzeFoodBtn) analyzeFoodBtn.disabled = false;

      if (!response.ok) {
        const errMessage = data.error || "Gagal menganalisis makanan. Periksa koneksi dan API Key AI Anda.";
        if (resultCardContainer) {
          resultCardContainer.innerHTML = `
            <div class="alert alert-danger">
              <span>⚠️</span>
              <div>
                <strong>Analisis Gagal</strong><br/>
                ${escapeHtml(errMessage)}
                <div style="margin-top:0.65rem;">
                  <a href="profile.html#ai-config" class="btn btn-outline btn-sm">⚙️ Atur API Key AI</a>
                </div>
              </div>
            </div>
          `;
        }
        showToast("Analisis makanan gagal.", "error");
        return;
      }

      latestScanResult = data;
      // Simpan ke LocalStorage riwayat scan
      Storage.addScanHistory(data);
      renderAnalysisResult(data);
      showToast("Analisis nutrisi selesai & disimpan ke riwayat!");

      // Bacakan otomatis jika toggle suara aktif
      if (voiceAutoToggle && voiceAutoToggle.checked) {
        speakResultAloud(data);
      }
    } catch (err) {
      if (loadingBox) loadingBox.classList.remove("active");
      if (analyzeFoodBtn) analyzeFoodBtn.disabled = false;
      showToast("Terjadi gangguan jaringan saat menghubungi server.", "error");
    }
  }

  if (analyzeFoodBtn) {
    analyzeFoodBtn.addEventListener("click", analyzeCurrentFood);
  }

  function speakResultAloud(data) {
    if (!data) return;
    const parts = [];
    if (data.voice_answer) {
      parts.push(data.voice_answer);
    }
    parts.push(data.voice_summary);
    if (biodata.punyaAlergi === "ya" && data.allergy_note) {
      parts.push("Perhatian alergi: " + data.allergy_note);
    }
    const speechText = parts.filter(Boolean).join(" ");

    Voice.speak(speechText, {
      onStart: () => setSpeakingVisual(true, "Asisten GIZICAM sedang berbicara..."),
      onEnd: () => setSpeakingVisual(false, "Selesai membacakan analisis")
    });
  }

  function renderAnalysisResult(data) {
    if (!resultCardContainer) return;
    const n = data.nutrition || {};
    const calPct = Math.min(100, Math.round(((n.calories_kcal || 0) / metrics.targetCalories) * 100));
    const proPct = Math.min(100, Math.round(((n.protein_g || 0) / metrics.targetProteinG) * 100));
    const carbPct = Math.min(100, Math.round(((n.carbs_g || 0) / metrics.targetCarbsG) * 100));
    const fatPct = Math.min(100, Math.round(((n.fat_g || 0) / metrics.targetFatG) * 100));
    const fiberPct = Math.min(100, Math.round(((n.fiber_g || 0) / 30) * 100));

    const isUncertain = !data.is_food || String(data.confidence_level).toLowerCase().includes("rendah");

    resultCardContainer.innerHTML = `
      <div class="card" style="border-top: 4px solid var(--emerald-500);">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:0.75rem; margin-bottom:0.85rem;">
          <div>
            <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.4rem;">
              <span class="badge ${isUncertain ? "badge-warning" : "badge-emerald"}">
                ${isUncertain ? "⚠️ Identifikasi Belum Pasti" : `✓ Keyakinan: ${escapeHtml(data.confidence_level)} (${data.confidence_percent}%)`}
              </span>
              <span class="badge badge-slate">${escapeHtml(data.provider_used || "AI Vision")}</span>
            </div>
            <h2 style="font-size:1.35rem; font-weight:800; color:var(--slate-900);">${escapeHtml(data.food_name)}</h2>
            <p style="font-size:0.85rem; color:var(--slate-500);">Estimasi Porsi: <strong>${escapeHtml(data.serving_size)}</strong></p>
          </div>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-primary btn-sm" id="btnReplayVoice">🔊 Bacakan Hasil</button>
            <button type="button" class="btn btn-outline btn-sm" id="btnStopVoice">⏹️ Stop</button>
          </div>
        </div>

        <p style="font-size:0.9rem; color:var(--slate-700); margin-bottom:1rem;">${escapeHtml(data.description)}</p>

        ${
          data.voice_answer
            ? `<div class="alert alert-emerald" style="margin-bottom:1rem;">
                 <span>🎙️</span>
                 <div><strong>Jawaban Pertanyaan Suara Anda:</strong><br/>${escapeHtml(data.voice_answer)}</div>
               </div>`
            : ""
        }

        <div class="nutrition-cards-mini">
          <div class="nutri-mini-card">
            <strong>${n.calories_kcal ?? 0} kkal</strong>
            <span>Kalori</span>
          </div>
          <div class="nutri-mini-card">
            <strong>${n.protein_g ?? 0} g</strong>
            <span>Protein</span>
          </div>
          <div class="nutri-mini-card">
            <strong>${n.carbs_g ?? 0} g</strong>
            <span>Karbohidrat</span>
          </div>
          <div class="nutri-mini-card">
            <strong>${n.fat_g ?? 0} g</strong>
            <span>Lemak</span>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:0.65rem; margin-bottom:1.1rem; font-size:0.82rem;">
          <span class="badge badge-lime">🌿 Serat: ${n.fiber_g ?? 0} g</span>
          <span class="badge badge-slate">🍯 Gula: ${n.sugar_g ?? 0} g</span>
          <span class="badge badge-slate">🧂 Natrium: ${n.sodium_mg ?? 0} mg</span>
        </div>

        <div class="macro-bars-list" style="margin-bottom:1.25rem;">
          <div>
            <div class="macro-bar-item-head"><span>Kalori (${n.calories_kcal ?? 0} kkal)</span><span>${calPct}% kebutuhan harian</span></div>
            <div class="macro-track"><div class="macro-fill fill-calories" style="width:${calPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Protein (${n.protein_g ?? 0} g)</span><span>${proPct}% target harian</span></div>
            <div class="macro-track"><div class="macro-fill fill-protein" style="width:${proPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Karbohidrat (${n.carbs_g ?? 0} g)</span><span>${carbPct}% target harian</span></div>
            <div class="macro-track"><div class="macro-fill fill-carbs" style="width:${carbPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Lemak (${n.fat_g ?? 0} g)</span><span>${fatPct}% target harian</span></div>
            <div class="macro-track"><div class="macro-fill fill-fat" style="width:${fatPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Serat (${n.fiber_g ?? 0} g)</span><span>${fiberPct}% dari 30g</span></div>
            <div class="macro-track"><div class="macro-fill fill-fiber" style="width:${fiberPct}%"></div></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; margin-bottom:1rem; font-size:0.86rem;">
          <div style="background:var(--emerald-50); padding:0.85rem; border-radius:var(--radius-md);">
            <strong style="color:var(--emerald-900); display:block; margin-bottom:0.35rem;">✅ Kelebihan Makanan</strong>
            <ul style="padding-left:1.1rem; color:var(--slate-700);">
              ${(data.strengths || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
            </ul>
          </div>
          <div style="background:var(--warning-50); padding:0.85rem; border-radius:var(--radius-md);">
            <strong style="color:#92400e; display:block; margin-bottom:0.35rem;">⚠️ Perlu Diperhatikan</strong>
            <ul style="padding-left:1.1rem; color:var(--slate-700);">
              ${(data.watch_outs || []).map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
            </ul>
          </div>
        </div>

        <div style="font-size:0.88rem; display:flex; flex-direction:column; gap:0.65rem; margin-bottom:1rem;">
          <div><strong>🎯 Kesesuaian Tujuan (${escapeHtml(biodata.tujuan)}):</strong> ${escapeHtml(data.goal_alignment)}</div>
          <div><strong>🍽️ Saran Porsi Wajar:</strong> ${escapeHtml(data.portion_advice)}</div>
          <div><strong>🥗 Rekomendasi Pendamping:</strong> ${escapeHtml((data.recommended_pairings || []).join(", "))}</div>
        </div>

        <div class="alert ${biodata.punyaAlergi === "ya" ? "alert-danger" : "alert-warning"}" style="margin-bottom:0.85rem;">
          <span>🚨</span>
          <div>
            <strong>Catatan Alergi & Kesehatan:</strong> ${escapeHtml(data.allergy_note)}
            <br/><small>Konsultasikan dengan dokter atau ahli gizi terdaftar untuk kebutuhan medis atau alergi berat.</small>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:0.75rem; padding-top:0.75rem; border-top:1px solid var(--slate-200);">
          <small style="color:var(--slate-500); max-width:360px;">${escapeHtml(data.disclaimer)}</small>
          <a href="chat.html?fromScan=1" class="btn btn-primary btn-sm">💬 Tanya Lanjut ke Konsultan AI</a>
        </div>
      </div>
    `;

    const replayBtn = document.getElementById("btnReplayVoice");
    const stopBtn = document.getElementById("btnStopVoice");
    if (replayBtn) replayBtn.addEventListener("click", () => speakResultAloud(latestScanResult));
    if (stopBtn) {
      stopBtn.addEventListener("click", () => {
        Voice.stop();
        setSpeakingVisual(false, "Suara dihentikan");
      });
    }
  }
})();
