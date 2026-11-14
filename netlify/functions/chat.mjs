const REQUEST_TIMEOUT_MS = 30000;

function resolveChatConfig(reqHeaders) {
  const customKey = (reqHeaders["x-custom-ai-key"] || "").trim();
  const customProvider = (reqHeaders["x-ai-provider"] || "").trim().toLowerCase();
  const customChatModel = (reqHeaders["x-ai-chat-model"] || "").trim();
  const customBaseUrl = (reqHeaders["x-ai-base-url"] || "").trim();

  const apiKey =
    customKey ||
    process.env.AI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.MISTRAL_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  let provider = customProvider || (process.env.AI_PROVIDER || "auto").trim().toLowerCase();

  if (provider === "auto" || !provider) {
    if (apiKey.startsWith("gsk_")) {
      provider = "groq";
    } else if (apiKey.startsWith("sk-or-")) {
      provider = "openrouter";
    } else if (apiKey.startsWith("sk-")) {
      provider = "openai";
    } else if (process.env.GROQ_API_KEY && !customKey) {
      provider = "groq";
    } else if (process.env.OPENROUTER_API_KEY && !customKey) {
      provider = "openrouter";
    } else if (process.env.MISTRAL_API_KEY && !customKey) {
      provider = "mistral";
    } else {
      provider = "groq";
    }
  }

  const defaults = {
    groq: {
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      chatModel: process.env.AI_CHAT_MODEL || process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",
      label: "Groq Cloud"
    },
    openrouter: {
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      chatModel: process.env.AI_CHAT_MODEL || "openrouter/free",
      label: "OpenRouter AI"
    },
    mistral: {
      baseUrl: "https://api.mistral.ai/v1/chat/completions",
      chatModel: process.env.AI_CHAT_MODEL || "mistral-small-latest",
      label: "Mistral AI"
    },
    openai: {
      baseUrl: "https://api.openai.com/v1/chat/completions",
      chatModel: process.env.AI_CHAT_MODEL || "gpt-4o-mini",
      label: "OpenAI"
    },
    together: {
      baseUrl: "https://api.together.xyz/v1/chat/completions",
      chatModel: process.env.AI_CHAT_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      label: "Together AI"
    },
    custom: {
      baseUrl: customBaseUrl || process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions",
      chatModel: customChatModel || process.env.AI_CHAT_MODEL || "gpt-4o-mini",
      label: "Custom OpenAI-Compatible"
    }
  };

  const selected = defaults[provider] || defaults.groq;
  return {
    apiKey,
    provider,
    providerLabel: selected.label,
    baseUrl: customBaseUrl || process.env.AI_BASE_URL || selected.baseUrl,
    model: customChatModel || selected.chatModel,
    hasServerKey: Boolean(
      process.env.AI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.MISTRAL_API_KEY ||
      process.env.OPENAI_API_KEY
    )
  };
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Custom-AI-Key, X-AI-Provider, X-AI-Chat-Model, X-AI-Base-Url",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      },
      body: ""
    };
  }

  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(event.headers || {})) {
    normalizedHeaders[k.toLowerCase()] = v;
  }

  const config = resolveChatConfig(normalizedHeaders);

  // GET: status check for frontend badge
  if (event.httpMethod === "GET") {
    return jsonResponse(200, {
      configured: Boolean(config.apiKey),
      hasServerKey: config.hasServerKey,
      provider: config.provider,
      providerLabel: config.providerLabel,
      model: config.model
    });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Metode tidak diizinkan. Gunakan POST." });
  }

  if (!config.apiKey) {
    return jsonResponse(503, {
      error: "API Key AI belum terpasang. Atur AI_API_KEY di Netlify atau masukkan API Key Anda pada halaman Profil → Pengaturan AI."
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Format JSON tidak valid." });
  }

  const { messages, biodata, latestScan, testOnly } = body;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    };

    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://gizicam.netlify.app";
      headers["X-Title"] = "GIZICAM AI Consultation";
    }

    if (testOnly) {
      const testRes = await fetch(config.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          max_tokens: 30,
          messages: [{ role: "user", content: "Jawab singkat: Koneksi GIZICAM berhasil." }]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const testData = await testRes.json().catch(() => ({}));
      if (!testRes.ok) {
        const msg = testData?.error?.message || testData?.message || `HTTP ${testRes.status}`;
        return jsonResponse(testRes.status, {
          ok: false,
          error: `Koneksi ke ${config.providerLabel} gagal: ${msg}`
        });
      }
      return jsonResponse(200, {
        ok: true,
        providerLabel: config.providerLabel,
        model: config.model,
        message: `Terhubung sukses ke ${config.providerLabel} (${config.model})!`
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      clearTimeout(timeoutId);
      return jsonResponse(400, { error: "Pesan konsultasi tidak boleh kosong." });
    }

    const bioSummary = biodata && typeof biodata === "object"
      ? `Nama: ${biodata.nama || "Pengguna"}, Umur: ${biodata.umur || "-"} tahun, Jenis Kelamin: ${biodata.jenisKelamin || "-"}, Tinggi: ${biodata.tinggi || "-"} cm, Berat: ${biodata.berat || "-"} kg, Aktivitas: ${biodata.aktivitas || "-"}, Tujuan Kesehatan: ${biodata.tujuan || "-"}, Riwayat Kondisi: ${biodata.punyaPenyakit === "ya" ? biodata.namaPenyakit : "Tidak ada"}, Alergi Makanan: ${biodata.punyaAlergi === "ya" ? biodata.jenisAlergi : "Tidak ada"}.`
      : "Biodata pengguna belum diisi.";

    const scanSummary = latestScan && typeof latestScan === "object"
      ? `Makanan terakhir dipindai: ${latestScan.food_name} (${latestScan.serving_size || "-"}) — Estimasi Kalori: ${latestScan.nutrition?.calories_kcal ?? latestScan.calories ?? 0} kkal, Protein: ${latestScan.nutrition?.protein_g ?? latestScan.protein ?? 0}g, Karbohidrat: ${latestScan.nutrition?.carbs_g ?? latestScan.carbs ?? 0}g, Lemak: ${latestScan.nutrition?.fat_g ?? latestScan.fat ?? 0}g.`
      : "Belum ada riwayat pemindaian makanan terbaru.";

    const systemPrompt = `Anda adalah Dr. GiziAI (Asisten Konsultasi Gizi & Gaya Hidup Sehat GIZICAM) dalam Bahasa Indonesia.
Konteks Pengguna Saat Ini:
- ${bioSummary}
- ${scanSummary}

Pedoman Konsultasi:
1. Berikan jawaban yang hangat, terstruktur, praktis, mudah dipahami orang awam, dan berbasis prinsip gizi seimbang.
2. Sesuaikan saran menu, porsi, hidrasi, dan kebiasaan sehat dengan tujuan kesehatan serta alergi pengguna.
3. JANGAN memberikan diagnosis medis, resep obat, atau janji menyembuhkan penyakit. Jika pengguna memiliki kondisi penyakit atau alergi berat, ingatkan dengan sopan untuk berkonsultasi langsung dengan dokter atau ahli gizi klinik.
4. Hindari rekomendasi diet ekstrem atau kelaparan berlebihan.
5. Gunakan paragraf singkat dan poin-poin rapi agar nyaman dibaca di layar handphone maupun desktop.`;

    const trimmedHistory = messages
      .slice(-12)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 2000)
      }))
      .filter((m) => m.content.trim().length > 0);

    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.5,
        max_tokens: 1000,
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedHistory
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const upstreamMsg = data?.error?.message || data?.message || `HTTP ${response.status}`;
      return jsonResponse(response.status, {
        error: `Gagal mendapatkan jawaban dari ${config.providerLabel}: ${upstreamMsg}`
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return jsonResponse(502, {
        error: "AI mengembalikan respons kosong. Silakan coba kirim pertanyaan lagi."
      });
    }

    // Strip any <think> tags if reasoning model is used
    const cleanReply = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    return jsonResponse(200, {
      reply: cleanReply,
      providerLabel: config.providerLabel,
      model: config.model
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return jsonResponse(504, {
        error: "Waktu koneksi ke layanan AI habis (timeout). Silakan coba lagi."
      });
    }
    return jsonResponse(500, {
      error: `Terjadi kesalahan pada layanan konsultasi AI: ${err.message || "Unknown error"}`
    });
  }
}
