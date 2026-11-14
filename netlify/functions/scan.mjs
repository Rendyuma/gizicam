const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const REQUEST_TIMEOUT_MS = 35000;

function resolveProviderConfig(reqHeaders) {
  const customKey = (reqHeaders["x-custom-ai-key"] || "").trim();
  const customProvider = (reqHeaders["x-ai-provider"] || "").trim().toLowerCase();
  const customVisionModel = (reqHeaders["x-ai-vision-model"] || "").trim();
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
      visionModel: process.env.GROQ_MODEL || process.env.AI_VISION_MODEL || "qwen/qwen3.8-27b",
      label: "Groq Cloud"
    },
    openrouter: {
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      visionModel: process.env.AI_VISION_MODEL || "openrouter/free",
      label: "OpenRouter AI"
    },
    mistral: {
      baseUrl: "https://api.mistral.ai/v1/chat/completions",
      visionModel: process.env.AI_VISION_MODEL || "pixtral-12b-2409",
      label: "Mistral AI"
    },
    openai: {
      baseUrl: "https://api.openai.com/v1/chat/completions",
      visionModel: process.env.AI_VISION_MODEL || "gpt-4o-mini",
      label: "OpenAI"
    },
    together: {
      baseUrl: "https://api.together.xyz/v1/chat/completions",
      visionModel: process.env.AI_VISION_MODEL || "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      label: "Together AI"
    },
    custom: {
      baseUrl: customBaseUrl || process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions",
      visionModel: customVisionModel || process.env.AI_VISION_MODEL || "gpt-4o-mini",
      label: "Custom OpenAI-Compatible"
    }
  };

  const selected = defaults[provider] || defaults.groq;
  return {
    apiKey,
    provider,
    providerLabel: selected.label,
    baseUrl: customBaseUrl || process.env.AI_BASE_URL || selected.baseUrl,
    model: customVisionModel || selected.visionModel
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

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  let cleaned = rawText.trim();
  // Remove markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // Strip <think>...</think> reasoning blocks if model outputs them
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Custom-AI-Key, X-AI-Provider, X-AI-Vision-Model, X-AI-Base-Url",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      error: "Metode request tidak diizinkan. Gunakan POST."
    });
  }

  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(event.headers || {})) {
    normalizedHeaders[k.toLowerCase()] = v;
  }

  const config = resolveProviderConfig(normalizedHeaders);
  if (!config.apiKey) {
    return jsonResponse(503, {
      error: "API Key AI belum dikonfigurasi. Silakan atur AI_API_KEY / GROQ_API_KEY di Netlify Environment Variables atau masukkan API Key Anda pada menu Profil → Pengaturan AI."
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Format payload JSON tidak valid." });
  }

  const { imageDataUrl, mimeType, biodata, voiceQuestion } = body;

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return jsonResponse(400, { error: "Gambar makanan wajib disertakan." });
  }

  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return jsonResponse(400, { error: "Format data gambar tidak valid. Pastikan mengirim gambar JPEG, PNG, atau WebP." });
  }

  const detectedMime = (mimeType || match[1]).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(detectedMime)) {
    return jsonResponse(415, {
      error: "Format gambar tidak didukung. Gunakan foto berformat JPEG, PNG, atau WebP."
    });
  }

  const base64Content = match[2];
  const approxBytes = Math.ceil((base64Content.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return jsonResponse(413, {
      error: "Ukuran gambar melebihi batas maksimal 5 MB. Silakan pilih foto yang lebih kecil."
    });
  }

  // Sanitize biodata as non-medical context only
  const safeContext = biodata && typeof biodata === "object"
    ? {
        umur: Number(biodata.umur) || null,
        jenisKelamin: String(biodata.jenisKelamin || "").slice(0, 30),
        aktivitas: String(biodata.aktivitas || "").slice(0, 60),
        tujuan: String(biodata.tujuan || "").slice(0, 100),
        penyakit: biodata.punyaPenyakit === "ya" ? String(biodata.namaPenyakit || "").slice(0, 120) : "Tidak ada",
        alergi: biodata.punyaAlergi === "ya" ? String(biodata.jenisAlergi || "").slice(0, 120) : "Tidak ada"
      }
    : null;

  const systemPrompt = `Anda adalah GIZICAM, asisten analisis nutrisi makanan berbasis AI yang informatif, ramah, dan bertanggung jawab dalam Bahasa Indonesia.
ATURAN PENTING:
1. Semua nilai nutrisi adalah ESTIMASI visual, bukan hasil uji laboratorium.
2. DILARANG membuat klaim diagnosis medis atau menjanjikan penyembuhan penyakit apa pun.
3. Jika foto bukan makanan/minuman atau terlalu buram/gelap sehingga tidak dapat dikenali dengan yakin, set "is_food": false dan "confidence_level": "Rendah / Belum Pasti".
4. Periksa potensi alergen berdasarkan informasi alergi pengguna (jika ada) dan berikan peringatan jelas serta sarankan konsultasi dengan dokter atau ahli gizi terdaftar untuk kondisi medis/alergi.
5. Balas HANYA dengan objek JSON valid tanpa teks tambahan di luar JSON, mengikuti struktur tepat berikut:
{
  "is_food": true,
  "food_name": "Nama makanan dalam Bahasa Indonesia",
  "description": "Deskripsi singkat tampilan, bahan utama, dan cara pengolahan makanan",
  "confidence_level": "Tinggi | Sedang | Rendah / Belum Pasti",
  "confidence_percent": 85,
  "serving_size": "Contoh: 1 piring sedang (± 250 gram)",
  "nutrition": {
    "calories_kcal": 350,
    "protein_g": 20,
    "carbs_g": 45,
    "fat_g": 10,
    "fiber_g": 6,
    "sugar_g": 5,
    "sodium_mg": 480
  },
  "strengths": ["Kelebihan nutrisi 1", "Kelebihan nutrisi 2"],
  "watch_outs": ["Hal yang perlu diperhatikan 1", "Hal yang perlu diperhatikan 2"],
  "goal_alignment": "Penjelasan kesesuaian makanan dengan tujuan kesehatan pengguna",
  "recommended_pairings": ["Rekomendasi pendamping sehat 1", "Rekomendasi pendamping sehat 2"],
  "portion_advice": "Saran porsi yang wajar dan seimbang",
  "allergy_note": "Catatan peringatan alergi berdasarkan profil pengguna atau catatan umum bahan alergen",
  "voice_summary": "Ringkasan lisan singkat, hangat, dan jelas (2-4 kalimat) dalam Bahasa Indonesia yang siap dibacakan oleh asisten suara kamera, mencakup nama makanan, estimasi kalori, nutrisi utama, serta saran atau peringatan penting.",
  "voice_answer": "Jawaban langsung jika pengguna mengajukan pertanyaan lisan saat memindai, atau kosongkan string jika tidak ada pertanyaan."
}`;

  const userInstruction = [
    "Analisis foto makanan ini dan berikan estimasi kandungan nutrisinya.",
    safeContext
      ? `Konteks profil pengguna (gunakan hanya sebagai referensi umum, bukan diagnosis medis): Tujuan kesehatan: ${safeContext.tujuan || "Menjaga pola makan sehat"}, Aktivitas: ${safeContext.aktivitas || "-"}, Riwayat kondisi kesehatan: ${safeContext.penyakit}, Alergi makanan: ${safeContext.alergi}.`
      : "Profil pengguna belum lengkap; gunakan panduan gizi seimbang umum.",
    voiceQuestion
      ? `Pertanyaan suara pengguna saat memindai: "${String(voiceQuestion).slice(0, 300)}". Jawab pertanyaan ini secara khusus di field "voice_answer" dan masukkan intinya dalam "voice_summary".`
      : ""
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    };

    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://gizicam.netlify.app";
      headers["X-Title"] = "GIZICAM AI Food Scanner";
    }

    const upstreamPayload = {
      model: config.model,
      temperature: 0.25,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userInstruction },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ]
    };

    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(upstreamPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const rawResponseText = await response.text();
    let parsedUpstream = null;
    try {
      parsedUpstream = JSON.parse(rawResponseText);
    } catch {
      parsedUpstream = null;
    }

    if (!response.ok) {
      const upstreamMsg =
        parsedUpstream?.error?.message ||
        parsedUpstream?.message ||
        `HTTP ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        return jsonResponse(401, {
          error: `API Key ${config.providerLabel} tidak valid atau tidak memiliki izin akses (${upstreamMsg}). Periksa kembali API Key Anda.`
        });
      }
      if (response.status === 429) {
        return jsonResponse(429, {
          error: `Batas permintaan (rate limit) ${config.providerLabel} tercapai. Tunggu beberapa saat lalu coba lagi.`
        });
      }
      if (response.status === 404 || response.status === 400) {
        return jsonResponse(400, {
          error: `Model vision "${config.model}" pada ${config.providerLabel} tidak tersedia atau menolak gambar (${upstreamMsg}). Coba ganti model di Pengaturan AI.`
        });
      }
      return jsonResponse(502, {
        error: `Gagal berkomunikasi dengan layanan AI (${config.providerLabel}): ${upstreamMsg}`
      });
    }

    const aiText = parsedUpstream?.choices?.[0]?.message?.content || "";
    const resultJson = extractJsonObject(aiText);

    if (!resultJson || typeof resultJson !== "object") {
      return jsonResponse(502, {
        error: "Respons AI tidak dalam format struktur nutrisi yang valid. Silakan coba pindai ulang."
      });
    }

    const n = resultJson.nutrition || {};
    const sanitizedResult = {
      is_food: resultJson.is_food !== false,
      food_name: String(resultJson.food_name || "Makanan Belum Teridentifikasi Pasti"),
      description: String(resultJson.description || "Estimasi analisis visual berdasarkan foto yang diunggah."),
      confidence_level: String(resultJson.confidence_level || "Sedang"),
      confidence_percent: Math.min(100, Math.max(0, Number(resultJson.confidence_percent) || 75)),
      serving_size: String(resultJson.serving_size || "1 porsi saji"),
      nutrition: {
        calories_kcal: Math.max(0, Math.round(Number(n.calories_kcal) || 0)),
        protein_g: Math.max(0, Number(Number(n.protein_g || 0).toFixed(1))),
        carbs_g: Math.max(0, Number(Number(n.carbs_g || 0).toFixed(1))),
        fat_g: Math.max(0, Number(Number(n.fat_g || 0).toFixed(1))),
        fiber_g: Math.max(0, Number(Number(n.fiber_g || 0).toFixed(1))),
        sugar_g: Math.max(0, Number(Number(n.sugar_g || 0).toFixed(1))),
        sodium_mg: Math.max(0, Math.round(Number(n.sodium_mg) || 0))
      },
      strengths: Array.isArray(resultJson.strengths) ? resultJson.strengths.map(String) : ["Sumber energi harian"],
      watch_outs: Array.isArray(resultJson.watch_outs) ? resultJson.watch_outs.map(String) : ["Perhatikan ukuran porsi sesuai kebutuhan harian"],
      goal_alignment: String(resultJson.goal_alignment || "Dapat disesuaikan dengan pola makan seimbang Anda."),
      recommended_pairings: Array.isArray(resultJson.recommended_pairings) ? resultJson.recommended_pairings.map(String) : ["Air putih", "Sayuran segar"],
      portion_advice: String(resultJson.portion_advice || "Konsumsi dalam porsi wajar sesuai kebutuhan kalori harian."),
      allergy_note: String(resultJson.allergy_note || "Periksa kembali komposisi bahan jika Anda memiliki alergi makanan tertentu."),
      voice_summary: String(
        resultJson.voice_summary ||
        `Terdeteksi ${resultJson.food_name || "makanan"} dengan estimasi sekitar ${Math.round(Number(n.calories_kcal) || 0)} kilokalori, ${Number(n.protein_g || 0)} gram protein, ${Number(n.carbs_g || 0)} gram karbohidrat, dan ${Number(n.fat_g || 0)} gram lemak.`
      ),
      voice_answer: String(resultJson.voice_answer || ""),
      provider_used: config.providerLabel,
      model_used: config.model,
      disclaimer: "Estimasi nutrisi dihasilkan oleh AI berdasarkan analisis visual dan bukan merupakan hasil uji laboratorium maupun diagnosis medis."
    };

    return jsonResponse(200, sanitizedResult);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      return jsonResponse(504, {
        error: "Waktu koneksi ke layanan AI habis (timeout). Periksa koneksi internet Anda lalu coba lagi."
      });
    }
    return jsonResponse(500, {
      error: `Terjadi kesalahan internal server saat menganalisis gambar: ${err.message || "Unknown error"}`
    });
  }
}
