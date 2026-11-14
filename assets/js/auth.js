(function () {
  "use strict";

  const { Storage, hashPassword, showToast } = window.GiziApp;

  function setFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const errEl = document.getElementById(errorId);
    if (input) {
      if (message) input.classList.add("is-invalid");
      else input.classList.remove("is-invalid");
    }
    if (errEl) {
      errEl.textContent = message || "";
      if (message) errEl.classList.add("visible");
      else errEl.classList.remove("visible");
    }
  }

  // Toggle show/hide password buttons
  document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-toggle-password");
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "Sembunyikan" : "Tampilkan";
    });
  });

  // ================= 1. HALAMAN BIODATA (biodata.html) =================
  const biodataForm = document.getElementById("biodataForm");
  if (biodataForm) {
    const punyaPenyakitEl = document.getElementById("punyaPenyakit");
    const boxPenyakitEl = document.getElementById("boxPenyakit");
    const punyaAlergiEl = document.getElementById("punyaAlergi");
    const boxAlergiEl = document.getElementById("boxAlergi");

    const syncConditionalFields = () => {
      if (boxPenyakitEl && punyaPenyakitEl) {
        boxPenyakitEl.classList.toggle("visible", punyaPenyakitEl.value === "ya");
      }
      if (boxAlergiEl && punyaAlergiEl) {
        boxAlergiEl.classList.toggle("visible", punyaAlergiEl.value === "ya");
      }
    };

    if (punyaPenyakitEl) punyaPenyakitEl.addEventListener("change", syncConditionalFields);
    if (punyaAlergiEl) punyaAlergiEl.addEventListener("change", syncConditionalFields);

    // Prefill jika pengguna kembali untuk mengedit biodata
    const existingBio = Storage.getBiodata();
    if (existingBio) {
      const fields = [
        "nama", "umur", "jenisKelamin", "tinggi", "berat",
        "aktivitas", "tujuan", "punyaPenyakit", "namaPenyakit",
        "punyaAlergi", "jenisAlergi"
      ];
      fields.forEach((f) => {
        const el = document.getElementById(f);
        if (el && existingBio[f] !== undefined) el.value = existingBio[f];
      });
      syncConditionalFields();
    }

    biodataForm.addEventListener("submit", (e) => {
      e.preventDefault();
      let valid = true;

      const nama = document.getElementById("nama").value.trim();
      const umur = Number(document.getElementById("umur").value);
      const jenisKelamin = document.getElementById("jenisKelamin").value;
      const tinggi = Number(document.getElementById("tinggi").value);
      const berat = Number(document.getElementById("berat").value);
      const aktivitas = document.getElementById("aktivitas").value;
      const tujuan = document.getElementById("tujuan").value;
      const punyaPenyakit = document.getElementById("punyaPenyakit").value;
      const namaPenyakit = document.getElementById("namaPenyakit").value.trim();
      const punyaAlergi = document.getElementById("punyaAlergi").value;
      const jenisAlergi = document.getElementById("jenisAlergi").value.trim();

      if (nama.length < 2) {
        setFieldError("nama", "err_nama", "Masukkan nama lengkap minimal 2 karakter.");
        valid = false;
      } else setFieldError("nama", "err_nama", "");

      if (!umur || umur < 5 || umur > 120) {
        setFieldError("umur", "err_umur", "Masukkan umur yang valid (5 - 120 tahun).");
        valid = false;
      } else setFieldError("umur", "err_umur", "");

      if (!jenisKelamin) {
        setFieldError("jenisKelamin", "err_jenisKelamin", "Pilih jenis kelamin.");
        valid = false;
      } else setFieldError("jenisKelamin", "err_jenisKelamin", "");

      if (!tinggi || tinggi < 80 || tinggi > 250) {
        setFieldError("tinggi", "err_tinggi", "Masukkan tinggi badan valid (80 - 250 cm).");
        valid = false;
      } else setFieldError("tinggi", "err_tinggi", "");

      if (!berat || berat < 20 || berat > 350) {
        setFieldError("berat", "err_berat", "Masukkan berat badan valid (20 - 350 kg).");
        valid = false;
      } else setFieldError("berat", "err_berat", "");

      if (!aktivitas) {
        setFieldError("aktivitas", "err_aktivitas", "Pilih tingkat aktivitas sehari-hari.");
        valid = false;
      } else setFieldError("aktivitas", "err_aktivitas", "");

      if (!tujuan) {
        setFieldError("tujuan", "err_tujuan", "Pilih tujuan kesehatan utama Anda.");
        valid = false;
      } else setFieldError("tujuan", "err_tujuan", "");

      if (punyaPenyakit === "ya" && namaPenyakit.length < 2) {
        setFieldError("namaPenyakit", "err_namaPenyakit", "Sebutkan nama kondisi/penyakit Anda.");
        valid = false;
      } else setFieldError("namaPenyakit", "err_namaPenyakit", "");

      if (punyaAlergi === "ya" && jenisAlergi.length < 2) {
        setFieldError("jenisAlergi", "err_jenisAlergi", "Sebutkan jenis alergi makanan Anda.");
        valid = false;
      } else setFieldError("jenisAlergi", "err_jenisAlergi", "");

      if (!valid) {
        showToast("Mohon lengkapi semua kolom biodata dengan benar.", "error");
        return;
      }

      Storage.saveBiodata({
        nama,
        umur,
        jenisKelamin,
        tinggi,
        berat,
        aktivitas,
        tujuan,
        punyaPenyakit,
        namaPenyakit: punyaPenyakit === "ya" ? namaPenyakit : "",
        punyaAlergi,
        jenisAlergi: punyaAlergi === "ya" ? jenisAlergi : ""
      });

      showToast("Biodata berhasil disimpan! Lanjutkan membuat akun.");
      const account = Storage.getAccount();
      setTimeout(() => {
        window.location.href = account ? "login.html" : "register.html";
      }, 650);
    });
  }

  // ================= 2. HALAMAN REGISTER (register.html) =================
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    const biodata = Storage.getBiodata();
    if (!biodata) {
      window.location.href = "biodata.html";
      return;
    }

    const bioBanner = document.getElementById("registerBioName");
    if (bioBanner) bioBanner.textContent = biodata.nama;

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      let valid = true;

      const username = document.getElementById("regUsername").value.trim();
      const email = document.getElementById("regEmail").value.trim().toLowerCase();
      const password = document.getElementById("regPassword").value;
      const confirmPassword = document.getElementById("regConfirmPassword").value;

      if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) {
        setFieldError("regUsername", "err_regUsername", "Username 3-24 karakter (huruf, angka, titik, atau garis bawah).");
        valid = false;
      } else setFieldError("regUsername", "err_regUsername", "");

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError("regEmail", "err_regEmail", "Masukkan alamat email yang valid.");
        valid = false;
      } else setFieldError("regEmail", "err_regEmail", "");

      if (password.length < 6) {
        setFieldError("regPassword", "err_regPassword", "Password minimal 6 karakter.");
        valid = false;
      } else setFieldError("regPassword", "err_regPassword", "");

      if (confirmPassword !== password) {
        setFieldError("regConfirmPassword", "err_regConfirmPassword", "Konfirmasi password tidak cocok.");
        valid = false;
      } else setFieldError("regConfirmPassword", "err_regConfirmPassword", "");

      if (!valid) return;

      const passwordHash = await hashPassword(password);
      Storage.saveAccount({
        username,
        email,
        passwordHash,
        createdAt: new Date().toISOString()
      });

      showToast("Akun berhasil dibuat! Silakan login ke GIZICAM.");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 700);
    });
  }

  // ================= 3. HALAMAN LOGIN (login.html) =================
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const biodata = Storage.getBiodata();
    const account = Storage.getAccount();

    if (!biodata) {
      window.location.href = "biodata.html";
      return;
    }
    if (!account) {
      window.location.href = "register.html";
      return;
    }

    const session = Storage.getSession();
    if (session && session.loggedIn) {
      window.location.href = "dashboard.html";
      return;
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const identifier = document.getElementById("loginIdentifier").value.trim().toLowerCase();
      const password = document.getElementById("loginPassword").value;

      if (!identifier) {
        setFieldError("loginIdentifier", "err_loginIdentifier", "Masukkan email atau username Anda.");
        return;
      } else setFieldError("loginIdentifier", "err_loginIdentifier", "");

      if (!password) {
        setFieldError("loginPassword", "err_loginPassword", "Masukkan password Anda.");
        return;
      } else setFieldError("loginPassword", "err_loginPassword", "");

      const inputHash = await hashPassword(password);
      const matchesIdentity =
        identifier === account.email.toLowerCase() ||
        identifier === account.username.toLowerCase();

      if (!matchesIdentity || inputHash !== account.passwordHash) {
        setFieldError("loginPassword", "err_loginPassword", "Email/username atau password salah.");
        showToast("Login gagal. Periksa kembali kredensial Anda.", "error");
        return;
      }

      Storage.setSession({
        loggedIn: true,
        username: account.username,
        email: account.email,
        loginAt: new Date().toISOString()
      });

      showToast(`Selamat datang kembali, ${biodata.nama}!`);
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 550);
    });
  }
})();
