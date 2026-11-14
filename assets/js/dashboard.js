(function () {
  "use strict";

  const auth = window.GiziApp.initAppShell("dashboard", "Dashboard Kesehatan");
  if (!auth) return;

  const { Storage, calculateHealthMetrics, escapeHtml, formatDateID, showToast } = window.GiziApp;
  const { biodata } = auth;
  const metrics = calculateHealthMetrics(biodata);
  const history = Storage.getHistory();

  // Sapaan pengguna
  const greetingEl = document.getElementById("welcomeUserHeading");
  const goalSubtitleEl = document.getElementById("welcomeGoalSubtitle");
  if (greetingEl) greetingEl.textContent = `Halo, ${biodata.nama}! 👋`;
  if (goalSubtitleEl) {
    goalSubtitleEl.textContent = `Tujuan utama Anda: ${biodata.tujuan}. Target energi harian estimasi sekitar ${metrics.targetCalories} kkal.`;
  }

  // Stat cards
  document.getElementById("statTotalScans").textContent = `${history.length} Makanan`;
  document.getElementById("statBmiValue").textContent = `${metrics.bmi} (${metrics.bmiCategory})`;
  document.getElementById("statTargetCal").textContent = `${metrics.targetCalories} kkal`;

  function renderWaterWidget() {
    const programs = Storage.getPrograms();
    const todayKey = new Date().toISOString().slice(0, 10);
    const currentMl = programs.waterByDate[todayKey] || 0;
    const pct = Math.min(100, Math.round((currentMl / metrics.waterTargetMl) * 100));

    document.getElementById("statWaterText").textContent = `${currentMl} / ${metrics.waterTargetMl} ml`;
    document.getElementById("statWaterPct").textContent = `${pct}% target harian tercapai`;
    const dashWaterBar = document.getElementById("dashWaterProgress");
    if (dashWaterBar) dashWaterBar.style.width = `${pct}%`;
  }

  renderWaterWidget();

  const quickAddWaterBtn = document.getElementById("dashQuickAddWater");
  if (quickAddWaterBtn) {
    quickAddWaterBtn.addEventListener("click", () => {
      const programs = Storage.getPrograms();
      const todayKey = new Date().toISOString().slice(0, 10);
      programs.waterByDate[todayKey] = (programs.waterByDate[todayKey] || 0) + 250;
      Storage.savePrograms(programs);
      renderWaterWidget();
      showToast("+250 ml air putih dicatat!");
    });
  }

  // Ringkasan Biodata
  const bioContainer = document.getElementById("dashBiodataSummary");
  if (bioContainer) {
    bioContainer.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; font-size: 0.88rem;">
        <div class="nutri-mini-card" style="text-align:left;">
          <span>Umur & Gender</span>
          <strong>${escapeHtml(biodata.umur)} thn • ${escapeHtml(biodata.jenisKelamin)}</strong>
        </div>
        <div class="nutri-mini-card" style="text-align:left;">
          <span>Tinggi / Berat</span>
          <strong>${escapeHtml(biodata.tinggi)} cm / ${escapeHtml(biodata.berat)} kg</strong>
        </div>
        <div class="nutri-mini-card" style="text-align:left;">
          <span>Aktivitas Harian</span>
          <strong>${escapeHtml(biodata.aktivitas)}</strong>
        </div>
        <div class="nutri-mini-card" style="text-align:left;">
          <span>Alergi Makanan</span>
          <strong>${biodata.punyaAlergi === "ya" ? escapeHtml(biodata.jenisAlergi) : "Tidak ada"}</strong>
        </div>
      </div>
      ${
        biodata.punyaPenyakit === "ya"
          ? `<div class="alert alert-warning" style="margin-top:0.85rem;">
               <span>🩺</span>
               <div><strong>Catatan Kondisi:</strong> ${escapeHtml(biodata.namaPenyakit)}. Rekomendasi nutrisi disesuaikan sebagai panduan umum.</div>
             </div>`
          : ""
      }
    `;
  }

  // Ringkasan Nutrisi Hasil Scan Terakhir
  const latestScanBox = document.getElementById("dashLatestNutrition");
  if (latestScanBox) {
    if (history.length === 0) {
      latestScanBox.innerHTML = `
        <div style="text-align:center; padding: 1.5rem 0.5rem;">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">🍽️</div>
          <p style="color:var(--slate-600); font-size:0.9rem; margin-bottom:0.9rem;">
            Belum ada makanan yang dipindai. Gunakan kamera atau galeri untuk mengetahui estimasi nutrisinya.
          </p>
          <a href="scanner.html" class="btn btn-primary btn-sm">📸 Pindai Makanan Pertama</a>
        </div>
      `;
    } else {
      const last = history[0];
      const n = last.nutrition || {
        calories_kcal: last.calories || 0,
        protein_g: last.protein || 0,
        carbs_g: last.carbs || 0,
        fat_g: last.fat || 0,
        fiber_g: last.fiber || 0
      };
      const calPct = Math.min(100, Math.round((n.calories_kcal / metrics.targetCalories) * 100));
      const proPct = Math.min(100, Math.round((n.protein_g / metrics.targetProteinG) * 100));
      const carbPct = Math.min(100, Math.round((n.carbs_g / metrics.targetCarbsG) * 100));
      const fatPct = Math.min(100, Math.round((n.fat_g / metrics.targetFatG) * 100));

      latestScanBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; gap:0.5rem;">
          <div>
            <div style="font-weight:800; font-size:1.05rem; color:var(--slate-900);">${escapeHtml(last.food_name)}</div>
            <div style="font-size:0.78rem; color:var(--slate-500);">${formatDateID(last.scannedAt)} • ${escapeHtml(last.serving_size || "1 porsi")}</div>
          </div>
          <span class="badge badge-emerald">${n.calories_kcal} kkal</span>
        </div>
        <div class="macro-bars-list">
          <div>
            <div class="macro-bar-item-head"><span>Kalori (${n.calories_kcal} kkal)</span><span>${calPct}% target</span></div>
            <div class="macro-track"><div class="macro-fill fill-calories" style="width:${calPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Protein (${n.protein_g} g)</span><span>${proPct}% target</span></div>
            <div class="macro-track"><div class="macro-fill fill-protein" style="width:${proPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Karbohidrat (${n.carbs_g} g)</span><span>${carbPct}% target</span></div>
            <div class="macro-track"><div class="macro-fill fill-carbs" style="width:${carbPct}%"></div></div>
          </div>
          <div>
            <div class="macro-bar-item-head"><span>Lemak (${n.fat_g} g)</span><span>${fatPct}% target</span></div>
            <div class="macro-track"><div class="macro-fill fill-fat" style="width:${fatPct}%"></div></div>
          </div>
        </div>
        <div style="margin-top:1rem; display:flex; gap:0.6rem; flex-wrap:wrap;">
          <a href="chat.html?fromScan=1" class="btn btn-outline btn-sm">💬 Konsultasikan Makanan Ini</a>
          <a href="scanner.html" class="btn btn-primary btn-sm">📸 Scan Lagi</a>
        </div>
      `;
    }
  }

  // Riwayat Scan Terbaru (maks 3)
  const recentListEl = document.getElementById("dashRecentScans");
  if (recentListEl) {
    if (history.length === 0) {
      recentListEl.innerHTML = `<p style="color:var(--slate-500); font-size:0.88rem;">Belum ada riwayat pemindaian.</p>`;
    } else {
      recentListEl.innerHTML = history
        .slice(0, 3)
        .map((item) => {
          const n = item.nutrition || {};
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px solid var(--slate-100); gap:0.75rem;">
              <div>
                <div style="font-weight:700; color:var(--slate-800); font-size:0.92rem;">${escapeHtml(item.food_name)}</div>
                <div style="font-size:0.76rem; color:var(--slate-500);">${formatDateID(item.scannedAt)} • P: ${n.protein_g ?? 0}g | K: ${n.carbs_g ?? 0}g | L: ${n.fat_g ?? 0}g</div>
              </div>
              <span class="badge badge-lime">${n.calories_kcal ?? 0} kkal</span>
            </div>
          `;
        })
        .join("");
    }
  }

  // Rekomendasi Makanan Singkat Sesuai Tujuan & Alergi
  const dashRecEl = document.getElementById("dashQuickRecommendations");
  if (dashRecEl) {
    const allergyText = (biodata.jenisAlergi || "").toLowerCase();
    const goalText = (biodata.tujuan || "").toLowerCase();
    const suggestions = [];

    if (goalText.includes("protein")) {
      if (!allergyText.includes("telur")) {
        suggestions.push({ name: "Dada Ayam Panggang & Telur Rebus + Tumis Brokoli", tag: "Tinggi Protein (~38g)" });
      }
      if (!allergyText.includes("kedelai") && !allergyText.includes("tempe")) {
        suggestions.push({ name: "Pepes Tahu Tempe & Nasi Merah", tag: "Protein Nabati Seimbang" });
      }
    }
    suggestions.push(
      { name: "Gado-Gado / Pecel Sayur Segar (Bumbu Secukupnya)", tag: "Tinggi Serat & Vitamin" },
      { name: "Sup Ikan Kuah Bening & Labu Siam", tag: "Rendah Lemak Jenuh" }
    );

    dashRecEl.innerHTML = suggestions
      .slice(0, 3)
      .map(
        (s) => `
        <div style="padding:0.75rem; background:var(--slate-50); border:1px solid var(--slate-200); border-radius:var(--radius-md); margin-bottom:0.6rem;">
          <div style="font-weight:700; font-size:0.88rem; color:var(--slate-900);">${escapeHtml(s.name)}</div>
          <div style="font-size:0.76rem; color:var(--emerald-700); font-weight:600; margin-top:0.2rem;">✨ ${escapeHtml(s.tag)}</div>
        </div>
      `
      )
      .join("");
  }
})();
