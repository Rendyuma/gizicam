(function () {
  "use strict";

  const auth = window.GiziApp.initAppShell("programs", "Program Kesehatan & Kebugaran");
  if (!auth) return;

  const { Storage, calculateHealthMetrics, escapeHtml, showToast } = window.GiziApp;
  const { biodata } = auth;
  const metrics = calculateHealthMetrics(biodata);

  // ================= 1. TRACKER HIDRASI HARIAN =================
  const waterTargetLabel = document.getElementById("progWaterTarget");
  const waterCurrentLabel = document.getElementById("progWaterCurrent");
  const waterPctLabel = document.getElementById("progWaterPct");
  const waterGlassFill = document.getElementById("waterGlassFill");

  function renderHydration() {
    const programs = Storage.getPrograms();
    const todayKey = new Date().toISOString().slice(0, 10);
    const currentMl = programs.waterByDate[todayKey] || 0;
    const pct = Math.min(100, Math.round((currentMl / metrics.waterTargetMl) * 100));

    if (waterTargetLabel) waterTargetLabel.textContent = `${metrics.waterTargetMl} ml`;
    if (waterCurrentLabel) waterCurrentLabel.textContent = `${currentMl} ml`;
    if (waterPctLabel) waterPctLabel.textContent = `${pct}%`;
    if (waterGlassFill) waterGlassFill.style.height = `${pct}%`;
  }

  renderHydration();

  document.querySelectorAll("[data-add-water]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const addMl = Number(btn.getAttribute("data-add-water")) || 250;
      const programs = Storage.getPrograms();
      const todayKey = new Date().toISOString().slice(0, 10);
      programs.waterByDate[todayKey] = (programs.waterByDate[todayKey] || 0) + addMl;
      Storage.savePrograms(programs);
      renderHydration();
      showToast(`+${addMl} ml air minum ditambahkan!`);
    });
  });

  const resetWaterBtn = document.getElementById("resetWaterTodayBtn");
  if (resetWaterBtn) {
    resetWaterBtn.addEventListener("click", () => {
      const programs = Storage.getPrograms();
      const todayKey = new Date().toISOString().slice(0, 10);
      programs.waterByDate[todayKey] = 0;
      Storage.savePrograms(programs);
      renderHydration();
      showToast("Catatan air minum hari ini direset.");
    });
  }

  // ================= 2. KALKULATOR BMI, BMR, TDEE & TARGET MAKRO =================
  const calcWeight = document.getElementById("calcWeight");
  const calcHeight = document.getElementById("calcHeight");
  const calcAge = document.getElementById("calcAge");
  const calcGender = document.getElementById("calcGender");
  const calcActivity = document.getElementById("calcActivity");
  const calcResultBox = document.getElementById("calcResultBox");

  if (calcWeight && calcHeight && calcAge && calcGender && calcActivity) {
    calcWeight.value = biodata.berat || 60;
    calcHeight.value = biodata.tinggi || 165;
    calcAge.value = biodata.umur || 25;
    calcGender.value = biodata.jenisKelamin || "Laki-laki";
    calcActivity.value = biodata.aktivitas || "Sedang";

    const updateCalculator = () => {
      const simMetrics = calculateHealthMetrics({
        berat: Number(calcWeight.value) || 60,
        tinggi: Number(calcHeight.value) || 165,
        umur: Number(calcAge.value) || 25,
        jenisKelamin: calcGender.value,
        aktivitas: calcActivity.value,
        tujuan: biodata.tujuan
      });

      if (calcResultBox) {
        calcResultBox.innerHTML = `
          <div class="nutrition-cards-mini" style="margin-top:0.85rem;">
            <div class="nutri-mini-card">
              <strong>${simMetrics.bmi}</strong>
              <span>BMI (${simMetrics.bmiCategory})</span>
            </div>
            <div class="nutri-mini-card">
              <strong>${simMetrics.bmr} kkal</strong>
              <span>BMR Basal</span>
            </div>
            <div class="nutri-mini-card">
              <strong>${simMetrics.targetCalories} kkal</strong>
              <span>Kebutuhan TDEE</span>
            </div>
            <div class="nutri-mini-card">
              <strong>${simMetrics.waterTargetMl} ml</strong>
              <span>Target Air</span>
            </div>
          </div>
          <div style="font-size:0.84rem; color:var(--slate-700); background:var(--emerald-50); padding:0.75rem; border-radius:var(--radius-md);">
            <strong>Distribusi Makro Harian Ideal:</strong> Protein <strong>${simMetrics.targetProteinG}g</strong> • Karbohidrat <strong>${simMetrics.targetCarbsG}g</strong> • Lemak <strong>${simMetrics.targetFatG}g</strong>
          </div>
        `;
      }
    };

    [calcWeight, calcHeight, calcAge, calcGender, calcActivity].forEach((el) => {
      el.addEventListener("input", updateCalculator);
      el.addEventListener("change", updateCalculator);
    });
    updateCalculator();
  }

  // ================= 3. TANTANGAN SEHAT 7 HARI (7-DAY WELLNESS CHALLENGE) =================
  const CHALLENGES = [
    { id: "day1", title: "Hari 1: Sarapan Seimbang & Sumber Protein", desc: "Mulai pagi dengan kombinasi karbohidrat kompleks dan protein (telur/tempe/oat)." },
    { id: "day2", title: "Hari 2: Bebas Minuman Manis Kemasan", desc: "Ganti minuman berpemanis dengan air putih atau teh tawar sepanjang hari." },
    { id: "day3", title: "Hari 3: Tambah 2 Porsi Sayur & Buah", desc: "Sertakan sayuran hijau atau buah segar pada makan siang dan malam." },
    { id: "day4", title: "Hari 4: Aktivitas Fisik Ringan 30 Menit", desc: "Jalan cepat, bersepeda santai, atau peregangan aktif minimal 30 menit." },
    { id: "day5", title: "Hari 5: Penuhi 100% Target Hidrasi", desc: "Capai target minum air putih harian sesuai berat badan Anda." },
    { id: "day6", title: "Hari 6: Makan Malam Teratur Sebelum Jam 20.00", desc: "Beri jeda 2-3 jam antara makan malam terakhir dan waktu tidur." },
    { id: "day7", title: "Hari 7: Pindai & Evaluasi Nutrisi Mingguan", desc: "Scan minimal 1 menu makanan dan konsultasikan polanya dengan Dr. GiziAI." }
  ];

  const challengeListEl = document.getElementById("wellnessChallengeList");
  const challengeProgressBar = document.getElementById("challengeProgressBar");
  const challengeProgressText = document.getElementById("challengeProgressText");

  function renderChallenges() {
    const programs = Storage.getPrograms();
    const doneSet = new Set(programs.completedChallenges || []);
    const pct = Math.round((doneSet.size / CHALLENGES.length) * 100);

    if (challengeProgressBar) challengeProgressBar.style.width = `${pct}%`;
    if (challengeProgressText) {
      challengeProgressText.textContent = `${doneSet.size} dari ${CHALLENGES.length} Misi Selesai (${pct}%)`;
    }

    if (challengeListEl) {
      challengeListEl.innerHTML = CHALLENGES.map((item) => {
        const checked = doneSet.has(item.id);
        return `
          <label class="challenge-item ${checked ? "completed" : ""}">
            <input type="checkbox" data-challenge-id="${item.id}" ${checked ? "checked" : ""} />
            <div>
              <div style="font-weight:700; font-size:0.9rem; color:var(--slate-900);">${escapeHtml(item.title)}</div>
              <div style="font-size:0.8rem; color:var(--slate-600);">${escapeHtml(item.desc)}</div>
            </div>
          </label>
        `;
      }).join("");

      challengeListEl.querySelectorAll("[data-challenge-id]").forEach((cb) => {
        cb.addEventListener("change", () => {
          const cid = cb.getAttribute("data-challenge-id");
          const current = Storage.getPrograms();
          const set = new Set(current.completedChallenges || []);
          if (cb.checked) {
            set.add(cid);
            showToast("Misi tantangan sehat ditandai selesai!");
          } else {
            set.delete(cid);
          }
          current.completedChallenges = Array.from(set);
          Storage.savePrograms(current);
          renderChallenges();
        });
      });
    }
  }

  renderChallenges();
})();
