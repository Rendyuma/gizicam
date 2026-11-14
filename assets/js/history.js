(function () {
  "use strict";

  const auth = window.GiziApp.initAppShell("history", "Riwayat Pemindaian Makanan");
  if (!auth) return;

  const { Storage, Voice, escapeHtml, formatDateID, showToast } = window.GiziApp;

  const historyListContainer = document.getElementById("historyListContainer");
  const clearAllHistoryBtn = document.getElementById("clearAllHistoryBtn");
  const searchHistoryInput = document.getElementById("searchHistoryInput");
  const detailModal = document.getElementById("scanDetailModal");
  const detailModalBody = document.getElementById("scanDetailModalBody");
  const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");

  function renderHistoryList(filterText = "") {
    const allItems = Storage.getHistory();
    const query = filterText.trim().toLowerCase();
    const items = query
      ? allItems.filter((it) => (it.food_name || "").toLowerCase().includes(query))
      : allItems;

    if (clearAllHistoryBtn) {
      clearAllHistoryBtn.style.display = allItems.length > 0 ? "inline-flex" : "none";
    }

    if (!historyListContainer) return;

    if (items.length === 0) {
      historyListContainer.innerHTML = `
        <div class="card" style="text-align:center; padding: 3rem 1.25rem;">
          <div style="font-size:2.6rem; margin-bottom:0.65rem;">📭</div>
          <h3 style="font-size:1.15rem; font-weight:700; color:var(--slate-900); margin-bottom:0.4rem;">
            ${allItems.length === 0 ? "Belum Ada Riwayat Scan Makanan" : "Makanan Tidak Ditemukan"}
          </h3>
          <p style="color:var(--slate-500); font-size:0.9rem; max-width:420px; margin:0 auto 1.15rem;">
            ${
              allItems.length === 0
                ? "Semua makanan yang Anda pindai melalui kamera atau galeri akan tersimpan otomatis di browser perangkat ini."
                : "Coba gunakan kata kunci pencarian nama makanan yang berbeda."
            }
          </p>
          <a href="scanner.html" class="btn btn-primary">📸 Mulai Scan Makanan</a>
        </div>
      `;
      return;
    }

    historyListContainer.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 1rem;">
        ${items
          .map((item) => {
            const n = item.nutrition || {};
            return `
              <div class="card card-hover" style="display:flex; flex-direction:column; justify-content:space-between; gap:0.85rem;">
                <div>
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.45rem;">
                    <span class="badge badge-emerald">${n.calories_kcal ?? 0} kkal</span>
                    <span style="font-size:0.75rem; color:var(--slate-400);">${formatDateID(item.scannedAt)}</span>
                  </div>
                  <h3 style="font-size:1.05rem; font-weight:800; color:var(--slate-900); margin-bottom:0.3rem;">
                    ${escapeHtml(item.food_name)}
                  </h3>
                  <p style="font-size:0.83rem; color:var(--slate-600); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    ${escapeHtml(item.description || item.voice_summary || "")}
                  </p>
                </div>

                <div>
                  <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.45rem; background:var(--slate-50); padding:0.55rem; border-radius:var(--radius-sm); font-size:0.78rem; text-align:center; margin-bottom:0.8rem;">
                    <div><strong>${n.protein_g ?? 0}g</strong><br/><span style="color:var(--slate-500);">Protein</span></div>
                    <div><strong>${n.carbs_g ?? 0}g</strong><br/><span style="color:var(--slate-500);">Karbo</span></div>
                    <div><strong>${n.fat_g ?? 0}g</strong><br/><span style="color:var(--slate-500);">Lemak</span></div>
                  </div>
                  <div style="display:flex; gap:0.5rem;">
                    <button type="button" class="btn btn-outline btn-sm" style="flex:1;" data-view-id="${item.id}">👁️ Detail</button>
                    <button type="button" class="btn btn-danger btn-sm" data-delete-id="${item.id}" aria-label="Hapus Riwayat">🗑️</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    historyListContainer.querySelectorAll("[data-view-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-view-id");
        const found = Storage.getHistory().find((it) => it.id === id);
        if (found) openDetailModal(found);
      });
    });

    historyListContainer.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete-id");
        Storage.deleteScanHistory(id);
        renderHistoryList(searchHistoryInput ? searchHistoryInput.value : "");
        showToast("Riwayat scan dihapus.");
      });
    });
  }

  function openDetailModal(item) {
    if (!detailModal || !detailModalBody) return;
    const n = item.nutrition || {};
    detailModalBody.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; margin-bottom:0.85rem;">
        <div>
          <span class="badge badge-slate">${formatDateID(item.scannedAt)}</span>
          <h2 style="font-size:1.3rem; font-weight:800; color:var(--slate-900); margin-top:0.35rem;">${escapeHtml(item.food_name)}</h2>
          <p style="font-size:0.84rem; color:var(--slate-500);">Porsi: ${escapeHtml(item.serving_size || "-")}</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="modalSpeakBtn">🔊 Bacakan</button>
      </div>
      <p style="font-size:0.88rem; color:var(--slate-700); margin-bottom:1rem;">${escapeHtml(item.description || "")}</p>
      <div class="nutrition-cards-mini">
        <div class="nutri-mini-card"><strong>${n.calories_kcal ?? 0} kkal</strong><span>Kalori</span></div>
        <div class="nutri-mini-card"><strong>${n.protein_g ?? 0} g</strong><span>Protein</span></div>
        <div class="nutri-mini-card"><strong>${n.carbs_g ?? 0} g</strong><span>Karbo</span></div>
        <div class="nutri-mini-card"><strong>${n.fat_g ?? 0} g</strong><span>Lemak</span></div>
      </div>
      <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:0.55rem; margin-top:0.85rem;">
        <div><strong>Serat / Gula / Natrium:</strong> ${n.fiber_g ?? 0}g serat • ${n.sugar_g ?? 0}g gula • ${n.sodium_mg ?? 0}mg natrium</div>
        <div><strong>Kesesuaian Tujuan:</strong> ${escapeHtml(item.goal_alignment || "-")}</div>
        <div><strong>Saran Porsi:</strong> ${escapeHtml(item.portion_advice || "-")}</div>
        <div><strong>Catatan Alergi:</strong> ${escapeHtml(item.allergy_note || "-")}</div>
      </div>
    `;
    detailModal.classList.add("active");

    const speakBtn = document.getElementById("modalSpeakBtn");
    if (speakBtn) {
      speakBtn.addEventListener("click", () => {
        Voice.speak(item.voice_summary || `${item.food_name}, estimasi ${n.calories_kcal ?? 0} kilokalori.`);
      });
    }
  }

  if (closeDetailModalBtn && detailModal) {
    closeDetailModalBtn.addEventListener("click", () => {
      Voice.stop();
      detailModal.classList.remove("active");
    });
    detailModal.addEventListener("click", (e) => {
      if (e.target === detailModal) {
        Voice.stop();
        detailModal.classList.remove("active");
      }
    });
  }

  if (searchHistoryInput) {
    searchHistoryInput.addEventListener("input", () => {
      renderHistoryList(searchHistoryInput.value);
    });
  }

  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin menghapus SELURUH riwayat pemindaian makanan?")) {
        Storage.clearAllHistory();
        renderHistoryList("");
        showToast("Seluruh riwayat pemindaian berhasil dihapus.");
      }
    });
  }

  renderHistoryList();
})();
