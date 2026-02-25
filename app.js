// --- IMPORT AI ENGINE ---
import { GoogleGenerativeAI } from "@google/generative-ai";

let myChart;
let rawIncome = 0;

// KONFIGURASI AI
// Ganti dengan API Key milikmu sendiri dari https://aistudio.google.com/
// String hasil encode Base64
const obfuscatedKey = "QUl6YVN5QlQ4Rk9lZ1lJNU5HbUFiV0pnV0oxeFlwblYwRm1HVkNV";

// Fungsi untuk membuka kunci saat aplikasi jalan
const API_KEY = atob(obfuscatedKey);

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
// Opsi jika masih 404: Paksa menggunakan API version v1 (jika tersedia di SDK)
const genAI = new GoogleGenerativeAI(API_KEY);
// (SDK biasanya otomatis menentukan, tapi update importmap di atas adalah kunci utamanya)

// --- UTILITY: Formatting ---
const formatIDR = (num) => new Intl.NumberFormat("id-ID").format(num);
const parseIDR = (str) => parseFloat(str.replace(/\./g, "")) || 0;

// --- SOUND ENGINE ---
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "click") {
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.log("Audio disabled");
  }
};

// --- CORE: Navigation ---
// Karena menggunakan type="module", fungsi harus didaftarkan ke window agar bisa dipanggil dari atribut HTML onclick
window.nextStep = (step) => {
  if (step === 2 && rawIncome <= 0) return alert("Masukkan penghasilan dulu!");
  document
    .querySelectorAll(".step-content")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(`step-${step}`).classList.add("active");

  if (
    step === 2 &&
    document.getElementById("needs-inputs").children.length === 0
  ) {
    addItem("needs", true, "Sewa & Listrik");
    addItem("wants", true, "Belanja & Hobi");
    addItem("savings", true, "Dana Darurat");
  }
};

window.addItem = (category, isDefault = false, defaultName = "") => {
  const container = document.getElementById(`${category}-inputs`);
  const div = document.createElement("div");

  // Menambahkan 'items-center' agar input dan tombol sejajar secara vertikal
  div.className = "flex gap-2 mb-2 animate-slide-in items-center";

  div.innerHTML = `
        <input type="text" 
               class="neu-input text-xs flex-[1.5] w-0" 
               placeholder="Item" 
               value="${defaultName}">
        
        <div class="relative flex-1">
            <input type="text" 
                   class="neu-input text-xs nominal-input w-full" 
                   placeholder="0">
            <input type="hidden" type="number" class="nominal-raw ${category}-raw">
        </div>

        <div class="w-8 flex justify-center">
            ${!isDefault ? '<button class="text-red-400 font-bold px-2 hover:text-red-600">×</button>' : ""}
        </div>
    `;

  container.appendChild(div);

  const input = div.querySelector(".nominal-input");
  const raw = div.querySelector(".nominal-raw");

  input.addEventListener("input", (e) => {
    const val = parseIDR(e.target.value);
    e.target.value = formatIDR(val);
    raw.value = val;
    updateLiveProgress();
  });

  if (!isDefault) {
    div.querySelector("button").onclick = () => {
      div.remove();
      updateLiveProgress();
    };
  }
};
document.getElementById("penghasilan").addEventListener("input", (e) => {
  rawIncome = parseIDR(e.target.value);
  e.target.value = formatIDR(rawIncome);
});

function updateLiveProgress() {
  const categories = ["needs", "wants", "savings"];
  const targets = { needs: 50, wants: 30, savings: 20 }; // Target dalam persen

  categories.forEach((cat) => {
    const sum = Array.from(document.querySelectorAll(`.${cat}-raw`)).reduce(
      (a, b) => a + (parseFloat(b.value) || 0),
      0,
    );

    const percentage = rawIncome > 0 ? (sum / rawIncome) * 100 : 0;
    const badge = document.getElementById(`badge-${cat}`);

    if (badge) {
      badge.innerText = `${percentage.toFixed(1)}% / ${targets[cat]}%`;
    }
  });
}

// --- AI ENGINE: Gemini Integration ---
async function getAIAdvice(data, sisa, isDefisit) {
  const recsArea = document.getElementById("recommendations");
  recsArea.innerHTML =
    "<li class='ai-loading italic animate-pulse'>Professional Profin...</li>";

  // PERUBAHAN UTAMA: Menggunakan model versi 2.5 sesuai metadata akunmu
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Kamu adalah asisten keuangan atas nama Profin yang sangat profesional, semua yang kamu jelaskan memiliki sumber dari ahli atau artikel yang valid. Analisis data: Pemasukan Rp${rawIncome}, Kebutuhan Rp${data.needs.real}, Keinginan Rp${data.wants.real}, Tabungan Rp${data.savings.real}. Berikan 3 saran singkat dan praktis dalam format HTML li tanpa markdown.`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    // 2. Ambil Teks Saran Final (Gunakan efek mengetik)
    const aiText = result.candidates[0].content.parts.find((p) => p.text)?.text;
    if (aiText) {
      recsArea.innerHTML = ""; // Bersihkan teks loading
      typeWriter(aiText, recsArea, 30); // Kecepatan 30ms per karakter
    }
  } catch (error) {
    console.error("AI Error:", error);
    recsArea.innerHTML = `<li>Error: ${error.message}</li>`;
  }
}

// --- UTILITY: Typing Effect ---
function typeWriter(text, element, speed) {
  let i = 0;
  element.innerHTML = ""; // Pastikan elemen kosong sebelum mulai

  function typing() {
    if (i < text.length) {
      // Jika teks mengandung tag HTML (seperti <li>),
      // kita harus menampilkannya dengan hati-hati atau sekaligus.
      // Namun untuk teks sederhana/markdown, karakter demi karakter sudah oke:
      element.innerHTML = text.substring(0, i + 1);
      i++;
      setTimeout(typing, speed);

      // Auto-scroll ke bawah saat mengetik (opsional)
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  typing();
}

// --- ANALYTICS ---
function analyzeFinance() {
  document.getElementById("loading-area").classList.add("hidden");
  document.getElementById("result-content").classList.remove("hidden");
  playSound("success");

  const getSum = (cat) =>
    Array.from(document.querySelectorAll(`.${cat}-raw`)).reduce(
      (a, b) => a + (parseFloat(b.value) || 0),
      0,
    );

  const data = {
    needs: {
      real: getSum("needs"),
      target: rawIncome * 0.5,
      label: "Needs",
      color: "emerald",
    },
    wants: {
      real: getSum("wants"),
      target: rawIncome * 0.3,
      label: "Wants",
      color: "amber",
    },
    savings: {
      real: getSum("savings"),
      target: rawIncome * 0.2,
      label: "Savings",
      color: "blue",
    },
  };

  const totalSpent = data.needs.real + data.wants.real + data.savings.real;
  const sisa = rawIncome - totalSpent;
  const isDefisit = totalSpent > rawIncome;
  const isHealthy =
    !isDefisit &&
    data.needs.real <= data.needs.target &&
    data.savings.real >= data.savings.target;

  document.getElementById("res-income").innerText = `Rp${formatIDR(rawIncome)}`;
  document.getElementById("res-spending").innerText =
    `Rp${formatIDR(totalSpent)}`;

  const statusDisplay = document.getElementById("status-display");
  if (isDefisit) {
    statusDisplay.className = `mb-8 p-8 rounded-[40px] neu-card transition-all bg-red-50 border-red-300 border-2`;
    statusDisplay.innerHTML = `<div class="animate-pulse text-5xl mb-4">🚨</div><h2 class="text-3xl font-black text-red-600 uppercase">Gawat: Defisit!</h2><p class="text-xs text-red-700 font-medium mt-2">Pengeluaran melebihi pemasukan.</p>`;
  } else if (isHealthy) {
    statusDisplay.className = `mb-8 p-8 rounded-[40px] neu-card transition-all bg-emerald-50 border-emerald-200 border-2`;
    statusDisplay.innerHTML = `<div class="animate-bounce text-5xl mb-4">🏆</div><h2 class="text-3xl font-black text-emerald-600 uppercase">Financial Healthy</h2><p class="text-xs text-emerald-700 font-medium mt-2">Kondisi keuangan aman.</p>`;
  } else {
    statusDisplay.className = `mb-8 p-8 rounded-[40px] neu-card transition-all bg-amber-50 border-amber-200 border-2`;
    statusDisplay.innerHTML = `<div class="animate-pulse text-5xl mb-4">⚖️</div><h2 class="text-3xl font-black text-amber-600 uppercase">Perlu Evaluasi</h2><p class="text-xs text-amber-700 font-medium mt-2">Belum memenuhi standar 50/30/20.</p>`;
  }

  const barsContainer = document.getElementById("detailed-bars");
  barsContainer.innerHTML = Object.values(data)
    .map((item) => {
      const pct =
        rawIncome > 0 ? ((item.real / rawIncome) * 100).toFixed(1) : 0;
      return `
      <div class="space-y-2">
          <div class="flex justify-between text-[11px] font-bold uppercase">
              <span class="text-slate-500">${item.label}</span>
              <span class="text-slate-800">${pct}% (Rp${formatIDR(item.real)})</span>
          </div>
          <div class="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full bg-${item.color}-500 transition-all duration-1000" style="width: ${Math.min(pct, 100)}%"></div>
          </div>
      </div>`;
    })
    .join("");

  renderChart(data, sisa);
  getAIAdvice(data, sisa, isDefisit);
}

// --- BOOTSTRAP ---
function animateProfin() {
  const container = document.getElementById("profin-loader");
  container.innerHTML = "PROFIN"
    .split("")
    .map(
      (c, i) =>
        `<span class="letter-anim" style="animation-delay: ${i * 0.1}s">${c}</span>`,
    )
    .join("");
}

document.getElementById("analyze-btn").addEventListener("click", () => {
  playSound("click");
  window.nextStep(3);
  animateProfin();
  setTimeout(analyzeFinance, 2500);
});

function renderChart(data, sisa) {
  if (myChart) myChart.destroy();
  myChart = new Chart(document.getElementById("financeChart"), {
    type: "doughnut",
    data: {
      labels: ["Needs", "Wants", "Savings", "Sisa"],
      datasets: [
        {
          data: [
            data.needs.real,
            data.wants.real,
            data.savings.real,
            Math.max(0, sisa),
          ],
          backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#94a3b8"],
          borderWidth: 0,
        },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

document.getElementById("download-pdf").addEventListener("click", () => {
  const element = document.getElementById("result-content");
  html2pdf()
    .set({
      margin: 0.5,
      filename: "ProFin-Report.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    })
    .from(element)
    .save();
});
