// ==========================================
// 1. VARIABEL GLOBAL & PENGATURAN AWAL
// ==========================================
let rawData = [];
let filteredData = [];
let currentAnomalies = [];
let barChartInstance = null;
let lineChartInstance = null;
let territoryChartInstance = null;
let productChartInstance = null;

const formatCurrency = (num) => "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatNumber = (num) => num.toLocaleString("en-US");

document.addEventListener("DOMContentLoaded", () => {
    loadData();
});

// ==========================================
// 2. PEMBACAAN DATA & FILTER
// ==========================================
function loadData() {
    Papa.parse("Sales_BY_Category_202606040914-1.csv", {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: function (results) {
            rawData = results.data.filter(row => row.SalesOrderID);
            filteredData = [...rawData];

            populateFilters();
            updateKPIs();
            updateCharts();
            generateInsights(); // <--- Panggil AI & Tabel saat pertama kali web dibuka

            document.getElementById("categoryFilter").addEventListener("change", applyFilters);
            document.getElementById("regionFilter").addEventListener("change", applyFilters);
        },
        error: function (err) {
            console.error("Error loading CSV:", err);
            alert("Gagal memuat data. Pastikan jalan lewat Live Server.");
        }
    });
}

function populateFilters() {
    const categoryFilter = document.getElementById("categoryFilter");
    const regionFilter = document.getElementById("regionFilter");

    const categories = [...new Set(rawData.map(row => row.Category).filter(Boolean))];
    const regions = [...new Set(rawData.map(row => row.Territory).filter(Boolean))];

    categories.forEach(cat => categoryFilter.add(new Option(cat, cat)));
    regions.forEach(region => regionFilter.add(new Option(region, region)));
}

function applyFilters() {
    const selectedCategory = document.getElementById("categoryFilter").value;
    const selectedRegion = document.getElementById("regionFilter").value;

    filteredData = rawData.filter(row => {
        const matchCategory = (selectedCategory === "All") || (row.Category === selectedCategory);
        const matchRegion = (selectedRegion === "All") || (row.Territory === selectedRegion);
        return matchCategory && matchRegion;
    });

    updateKPIs();
    updateCharts();
    generateInsights(); // <--- Update tabel & panggil AI lagi setiap filter diubah
}

// ==========================================
// 3. KALKULASI KPI & RENDER GRAFIK
// ==========================================
function updateKPIs() {
    let totalSales = 0, totalProfit = 0, totalQty = 0;

    filteredData.forEach(row => {
        totalSales += row.Sales || 0;
        totalProfit += row.Profit || 0;
        totalQty += row.Qty || 0;
    });

    let profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    document.getElementById("kpi-sales").innerText = formatCurrency(totalSales);
    document.getElementById("kpi-profit").innerText = formatCurrency(totalProfit);
    document.getElementById("kpi-margin").innerText = profitMargin.toFixed(2) + "%";
    document.getElementById("kpi-qty").innerText = formatNumber(totalQty);
}

function updateCharts() {
    Chart.defaults.color = "#718096";

    // 1. Bar Chart (Top 10 SubCategory)
    const salesBySubCat = {};
    filteredData.forEach(row => {
        if (row.SubCategory) {
            salesBySubCat[row.SubCategory] = (salesBySubCat[row.SubCategory] || 0) + (row.Sales || 0);
        }
    });
    const sortedSubCats = Object.entries(salesBySubCat).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: sortedSubCats.map(item => item[0]),
            datasets: [{ label: 'Total Sales ($)', data: sortedSubCats.map(item => item[1]), backgroundColor: '#4318ff', borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 2. Line Chart (Tren Sales & Profit)
    const trendData = {};
    filteredData.forEach(row => {
        if (row.OrderDate) {
            const date = new Date(row.OrderDate);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!trendData[monthYear]) trendData[monthYear] = { sales: 0, profit: 0 };
            trendData[monthYear].sales += row.Sales || 0;
            trendData[monthYear].profit += row.Profit || 0;
        }
    });
    const sortedDates = Object.keys(trendData).sort();
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                { label: 'Sales ($)', data: sortedDates.map(date => trendData[date].sales), borderColor: '#4318ff', backgroundColor: 'rgba(67, 24, 255, 0.1)', fill: true, tension: 0.4 },
                { label: 'Profit ($)', data: sortedDates.map(date => trendData[date].profit), borderColor: '#01b574', borderDash: [5, 5], tension: 0.4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false } }
    });

    // 3. Horizontal Bar (Territory Profit Margin)
    const territoryData = {};
    filteredData.forEach(row => {
        if (row.Territory) {
            if (!territoryData[row.Territory]) territoryData[row.Territory] = { sales: 0, profit: 0 };
            territoryData[row.Territory].sales += row.Sales || 0;
            territoryData[row.Territory].profit += row.Profit || 0;
        }
    });
    const calcTerritories = Object.entries(territoryData).map(([name, data]) => ({ name, margin: data.sales > 0 ? (data.profit / data.sales) * 100 : 0 })).sort((a, b) => b.margin - a.margin);
    const territoryCtx = document.getElementById('territoryChart').getContext('2d');
    if (territoryChartInstance) territoryChartInstance.destroy();
    territoryChartInstance = new Chart(territoryCtx, {
        type: 'bar',
        data: {
            labels: calcTerritories.map(item => item.name),
            datasets: [{ label: 'Profit Margin (%)', data: calcTerritories.map(item => item.margin), backgroundColor: '#01b574', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 4. Horizontal Bar (Top 10 Product by Profit)
    const productProfit = {};
    filteredData.forEach(row => {
        if (row.ProductName) {
            productProfit[row.ProductName] = (productProfit[row.ProductName] || 0) + (row.Profit || 0);
        }
    });
    const sortedProducts = Object.entries(productProfit).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const productCtx = document.getElementById('productChart').getContext('2d');
    if (productChartInstance) productChartInstance.destroy();
    productChartInstance = new Chart(productCtx, {
        type: 'bar',
        data: {
            labels: sortedProducts.map(item => item[0]),
            datasets: [{ label: 'Total Profit ($)', data: sortedProducts.map(item => item[1]), backgroundColor: '#ff9800', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

// ==========================================
// 5. FUNGSI TOMBOL ON-DEMAND NARASI AI 
// ==========================================
document.getElementById("btn-narasi-ai").addEventListener("click", fetchAnomalyNarrative);

async function fetchAnomalyNarrative() {
    const narrativeBox = document.getElementById("anomaly-narrative-box");

    narrativeBox.classList.remove("hidden");

    if (currentAnomalies.length === 0) {
        narrativeBox.innerHTML = "<p style='color: #01b574; font-weight: 600;'><i class='bx bx-check-circle'></i> Luar biasa! Tidak ada kebocoran margin atau anomali pada data saat ini. Tidak perlu evaluasi khusus.</p>";
        return;
    }

    narrativeBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #e74c3c; font-weight: 600;">
            <i class='bx bx-loader-alt bx-spin' style="font-size: 20px;"></i> 
            AI sedang menginvestigasi penyebab anomali...
        </div>`;

    let textAnomali = currentAnomalies.map(item =>
        `- ${item.category} (${item.name}): Penjualan ${formatCurrency(item.sales)}, tapi Rugi ${formatCurrency(Math.abs(item.profit))} (Margin ${item.margin}%)`
    ).join("\n");

    const promptData = `
    Sebagai analis keuangan senior, berikan penjelasan investigatif yang logis (maksimal 2 paragraf pendek) mengapa kelompok produk berikut mengalami anomali (Penjualan tinggi namun merugi):
    
    ${textAnomali}
    
    Berikan narasi deskriptif langsung ke intinya. Format MURNI tag HTML (Gunakan <p> dan <strong>). Jangan gunakan markdown. Gunakan bahasa Indonesia profesional.
    `;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptData: promptData, temperature: 0.5 })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghubungi backend.");

        let aiText = data.choices[0].message.content;

        aiText = aiText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // PASTIKAN MENCETAK KE NARRATIVE BOX, BUKAN INSIGHT BOX
        narrativeBox.innerHTML = aiText;

    } catch (error) {
        narrativeBox.innerHTML = `<p style="color: #c0392b;"><i class='bx bx-error'></i> Gagal memuat narasi AI: ${error.message}</p>`;
    }
}


// ==========================================
// 🚀 FUNGSI AI: EXECUTIVE SUMMARY & STRATEGY
// ==========================================
async function fetchAIInsights(totalSales, overallMargin, topPerformer, anomalyItem) {
    const insightBox = document.getElementById("insight-text");

    insightBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #4318ff; font-weight: 600;">
            <i class='bx bx-loader-alt bx-spin' style="font-size: 24px;"></i> 
            AI Agent sedang merangkai narasi dan storytelling bisnis...
        </div>`;

    const promptData = `
    Bertindaklah sebagai konsultan strategi bisnis senior. Buatlah analisis mendalam dengan pendekatan storytelling, ringkasan eksekutif, dan rencana aksi strategis berdasarkan data operasional berikut:
    - Gross Revenue: ${formatCurrency(totalSales)}
    - Blended Profit Margin: ${overallMargin}%
    - Produk Andalan (Cash Cow): ${topPerformer ? topPerformer[0] : '-'}
    - Anomali (Sales besar tapi merugi): ${anomalyItem ? `${anomalyItem.name} rugi ${formatCurrency(Math.abs(anomalyItem.profit))}` : 'Aman. Tidak ada yang rugi.'}

    Buatlah tepat 3 poin dalam format HTML <li> dengan ketentuan gaya bahasa sebagai berikut:
    1. <li><strong>📖 Business Storytelling:</strong> (Gunakan teknik penceritaan bisnis atau analogi untuk menggambarkan kondisi saat ini. Jika ada anomali produk merugi, ibaratkan seperti kapal besar yang melaju kencang berkat mesin utama [sebutkan nama Produk Andalan], namun kapal tersebut perlahan terhambat karena adanya kebocoran atau jangkar yang tersangkut akibat performa lini [sebutkan nama Produk Anomali]. Jika tidak ada anomali, ceritakan kurva pertumbuhan yang harmonis).</li>
    2. <li><strong>📊 Executive Summary:</strong> (Berikan ringkasan metrik finansial yang objektif, padat, dan jelas mengenai pencapaian gross revenue dan margin profit rata-rata saat ini).</li>
    3. <li><strong>💡 Strategic Action Plan:</strong> (Berikan rekomendasi aksi konkret dan taktis yang harus diambil oleh manajemen untuk mengamankan keuntungan bersih atau memperbaiki lini ekonomi yang rusak).</li>
    
    Format MURNI HANYA 3 baris tag HTML <li> saja. DILARANG menggunakan awalan/akhiran markdown HTML (seperti \`\`\`html). Gunakan bahasa Indonesia korporat yang sangat tajam dan profesional.
    `;

    try {
        // SUDAH DIUBAH MENEMBAK KE BACKEND VERCEL
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptData: promptData, temperature: 0.5 })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghubungi backend.");

        let aiText = data.choices[0].message.content;

        aiText = aiText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (!aiText.includes("<li>")) {
            const lines = aiText.split('\n').filter(line => line.trim() !== '');
            aiText = lines.map(line => `<li>${line.replace(/^[-*]\s*/, '')}</li>`).join('');
        }

        // PASTIKAN MENCETAK KE INSIGHT BOX
        insightBox.innerHTML = `<ul class="insight-list">${aiText}</ul>`;

    } catch (error) {
        console.error("Detail Error API Groq:", error);
        insightBox.innerHTML = `
            <div style="background-color: #ffe0e0; padding: 15px; border-radius: 8px; border-left: 5px solid #e74c3c;">
                <h4 style="color: #e74c3c; margin-bottom: 5px;"><i class='bx bx-error-circle'></i> API Error Detail:</h4>
                <p style="color: #c0392b; font-family: monospace; font-size: 13px;">${error.message}</p>
            </div>`;
    }
}


// ==========================================
// 6. LOGIKA FITUR PRE-DEFINED AI CHAT
// ==========================================
const promptPills = document.querySelectorAll('.prompt-pill');
const chatInput = document.getElementById('ai-chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const chatOutput = document.getElementById('ai-chat-output');

let selectedPromptType = "";

promptPills.forEach(pill => {
    pill.addEventListener('click', () => {
        promptPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        chatInput.value = pill.getAttribute('data-question');
        selectedPromptType = pill.innerText;
    });
});

btnSendChat.addEventListener('click', fetchChatInsight);

async function fetchChatInsight() {
    if (!chatInput.value) {
        alert("Silakan pilih salah satu pertanyaan cepat di bawah terlebih dahulu!");
        return;
    }

    chatOutput.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #4318ff; gap: 10px;">
            <i class='bx bx-loader-alt bx-spin' style="font-size: 32px;"></i>
            <strong>Menganalisis data spesifik...</strong>
        </div>`;

    const catSales = {}; const regionSales = {};
    filteredData.forEach(row => {
        if (row.Category) catSales[row.Category] = (catSales[row.Category] || 0) + (row.Profit || 0);
        if (row.Territory) regionSales[row.Territory] = (regionSales[row.Territory] || 0) + (row.Profit || 0);
    });

    const sortedCats = Object.entries(catSales).sort((a, b) => b[1] - a[1]);
    const sortedRegions = Object.entries(regionSales).sort((a, b) => b[1] - a[1]);

    let topCatContext = sortedCats.length > 0 ? `${sortedCats[0][0]} dengan profit ${formatCurrency(sortedCats[0][1])}` : "-";
    let topRegionContext = sortedRegions.length > 0 ? `${sortedRegions[0][0]} dengan profit ${formatCurrency(sortedRegions[0][1])}` : "-";

    let instruksiKhusus = "";
    if (selectedPromptType === "Prioritas profit?") {
        instruksiKhusus = `Fokuskan analisis untuk membandingkan profit margin antar Kategori produk. Diketahui kategori terbaik adalah ${topCatContext}. Jelaskan secara detail mengapa kategori ini harus diprioritaskan.`;
    } else if (selectedPromptType === "Masalah region?") {
        instruksiKhusus = `Fokuskan analisis pada performa antar Wilayah (Territory/Region). Diketahui region paling menguntungkan adalah ${topRegionContext}. Berikan insight mengenai logistik atau potensi pasar berdasarkan data ini.`;
    } else {
        instruksiKhusus = `Berikan rekomendasi taktis singkat mengenai strategi harga, diskon, atau promosi untuk bulan depan berdasarkan tren keseluruhan.`;
    }

    const promptData = `
    Anda adalah Asisten AI Dasbor Eksekutif. 
    Pengguna menanyakan hal berikut: "${chatInput.value}"
    
    Instruksi Khusus: ${instruksiKhusus}
    
    Berikan jawaban yang jelas, analitis, dan profesional. Gunakan format tag HTML untuk paragraf (<p>) dan daftar (<ul><li>). Jangan gunakan markdown. Hindari kata-kata pengantar yang tidak perlu.
    `;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptData: promptData, temperature: 0.4 })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal menghubungi backend.");

        let aiText = data.choices[0].message.content;

        aiText = aiText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // PASTIKAN MENCETAK KE CHAT OUTPUT, BUKAN INSIGHT BOX
        chatOutput.innerHTML = aiText;

    } catch (error) {
        chatOutput.innerHTML = `<p style="color: #e74c3c; font-weight: 600;"><i class='bx bx-error'></i> Gagal memuat jawaban AI: ${error.message}</p>`;
    }
}