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
            generateInsights();

            document.getElementById("categoryFilter").addEventListener("change", applyFilters);
            document.getElementById("regionFilter").addEventListener("change", applyFilters);
        },
        error: function (err) {
            console.error("Error loading CSV:", err);
            alert("Gagal memuat data CSV.");
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
    generateInsights();
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

    const salesBySubCat = {};
    filteredData.forEach(row => {
        if (row.SubCategory) salesBySubCat[row.SubCategory] = (salesBySubCat[row.SubCategory] || 0) + (row.Sales || 0);
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

    const productProfit = {};
    filteredData.forEach(row => {
        if (row.ProductName) productProfit[row.ProductName] = (productProfit[row.ProductName] || 0) + (row.Profit || 0);
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
// 4. TABEL ANOMALI & AI AGENT (VERCEL BACKEND)
// ==========================================

function generateInsights() {
    const tableBody = document.getElementById("anomaly-table-body");
    currentAnomalies = [];

    if (filteredData.length === 0) {
        document.getElementById("insight-text").innerHTML = "<p><i>Tidak ada data untuk dianalisis.</i></p>";
        tableBody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Tidak ada data tersedia</td></tr>";
        return;
    }

    const subCatStats = {};
    let totalSales = 0, totalProfit = 0;

    filteredData.forEach(row => {
        totalSales += row.Sales || 0;
        totalProfit += row.Profit || 0;
        if (row.SubCategory) {
            if (!subCatStats[row.SubCategory]) subCatStats[row.SubCategory] = { category: row.Category || '-', sales: 0, profit: 0 };
            subCatStats[row.SubCategory].sales += row.Sales || 0;
            subCatStats[row.SubCategory].profit += row.Profit || 0;
        }
    });

    const overallMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : 0;
    let tableHtml = "";
    let anomalyCount = 0;
    let anomalyItem = null;
    let highestLoss = 0;

    const sortedSubCatEntries = Object.entries(subCatStats).sort((a, b) => a[1].profit - b[1].profit);
    let topPerformer = Object.entries(subCatStats).sort((a, b) => b[1].profit - a[1].profit)[0];

    sortedSubCatEntries.forEach(([subCat, stats]) => {
        if (stats.profit < 0) {
            anomalyCount++;
            const margin = stats.sales > 0 ? ((stats.profit / stats.sales) * 100).toFixed(2) : 0;
            currentAnomalies.push({ category: stats.category, name: subCat, sales: stats.sales, profit: stats.profit, margin: margin });

            tableHtml += `
                <tr>
                    <td>${stats.category}</td>
                    <td><strong>${subCat}</strong></td>
                    <td>${formatCurrency(stats.sales)}</td>
                    <td style="color: #e74c3c; font-weight: bold;">${formatCurrency(stats.profit)}</td>
                    <td style="color: #e74c3c; font-weight: bold;">${margin}%</td>
                    <td><span class="badge badge-danger">High Loss Anomaly</span></td>
                </tr>
            `;

            if (stats.profit < highestLoss) {
                highestLoss = stats.profit;
                anomalyItem = { name: subCat, sales: stats.sales, profit: stats.profit };
            }
        }
    });

    document.getElementById("anomaly-narrative-box").classList.add("hidden");

    if (anomalyCount === 0) {
        tableHtml = `<tr><td colspan='6' style='text-align: center; color: #01b574; font-weight: 600; padding: 24px;'>✅ Unit Ekonomi Stabil. Tidak ditemukan kebocoran margin.</td></tr>`;
    }
    tableBody.innerHTML = tableHtml;

    fetchAIInsights(totalSales, overallMargin, topPerformer, anomalyItem);
}

// AI: EXECUTIVE SUMMARY
async function fetchAIInsights(totalSales, overallMargin, topPerformer, anomalyItem) {
    const insightBox = document.getElementById("insight-text");
    insightBox.innerHTML = `<div style="color: #4318ff; font-weight: 600;"><i class='bx bx-loader-alt bx-spin'></i> AI Agent sedang merangkai narasi...</div>`;

    const promptData = `
    Bertindaklah sebagai konsultan strategi bisnis senior. Buatlah analisis mendalam berdasarkan data operasional berikut:
    - Gross Revenue: ${formatCurrency(totalSales)}
    - Blended Profit Margin: ${overallMargin}%
    - Produk Andalan: ${topPerformer ? topPerformer[0] : '-'}
    - Anomali: ${anomalyItem ? `${anomalyItem.name} rugi ${formatCurrency(Math.abs(anomalyItem.profit))}` : 'Aman.'}

    Buatlah tepat 3 poin dalam format HTML <li>:
    1. <li><strong>📖 Business Storytelling:</strong> (Gunakan analogi bisnis untuk kondisi saat ini).</li>
    2. <li><strong>📊 Executive Summary:</strong> (Ringkasan metrik).</li>
    3. <li><strong>💡 Strategic Action Plan:</strong> (Rekomendasi aksi).</li>
    Format MURNI HANYA 3 baris tag HTML <li> saja.
    `;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptData: promptData, temperature: 0.5 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat dari backend Vercel.");

        let aiText = data.choices[0].message.content;
        aiText = aiText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        if (!aiText.includes("<li>")) {
            aiText = aiText.split('\n').filter(line => line.trim() !== '').map(line => `<li>${line.replace(/^[-*]\s*/, '')}</li>`).join('');
        }
        insightBox.innerHTML = `<ul class="insight-list">${aiText}</ul>`;
    } catch (error) {
        insightBox.innerHTML = `<p style="color: #e74c3c;"><i class='bx bx-error'></i> Error: ${error.message}</p>`;
    }
}

// AI: NARASI TABEL ANOMALI
document.getElementById("btn-narasi-ai").addEventListener("click", fetchAnomalyNarrative);

async function fetchAnomalyNarrative() {
    const narrativeBox = document.getElementById("anomaly-narrative-box");
    narrativeBox.classList.remove("hidden");

    if (currentAnomalies.length === 0) {
        narrativeBox.innerHTML = "<p style='color: #01b574;'><i class='bx bx-check-circle'></i> Aman. Tidak ada anomali yang perlu dievaluasi.</p>";
        return;
    }

    narrativeBox.innerHTML = `<div style="color: #e74c3c; font-weight: 600;"><i class='bx bx-loader-alt bx-spin'></i> AI sedang menginvestigasi anomali...</div>`;

    let textAnomali = currentAnomalies.map(item => `- ${item.category} (${item.name}): Penjualan ${formatCurrency(item.sales)}, Rugi ${formatCurrency(Math.abs(item.profit))}`).join("\n");
    const promptData = `Sebagai analis keuangan, jelaskan logis (maksimal 2 paragraf) mengapa produk ini merugi:\n${textAnomali}\nFormat MURNI tag HTML <p> dan <strong>.`;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptData: promptData, temperature: 0.5 })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat dari backend Vercel.");

        let aiText = data.choices[0].message.content;
        aiText = aiText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        narrativeBox.innerHTML = aiText;
    } catch (error) {
        narrativeBox.innerHTML = `<p style="color: #e74c3c;"><i class='bx bx-error'></i> Error: ${error.message}</p>`;
    }
}

// AI: CHAT PRE-DEFINED
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

if (btnSendChat) btnSendChat.addEventListener('click', fetchChatInsight);

async function fetchChatInsight() {
    if (!chatInput.value) return alert("Pilih pertanyaan cepat di bawah!");
    chatOutput.innerHTML = `<div style="color: #4318ff; font-weight: 600; text-align:center;"><i class='bx bx-loader-alt bx-spin'></i> Menganalisis data mendalam...</div>`;

    // 1. HITUNG RINGKASAN DATA & KELOMPOKKAN (Agar AI tidak halusinasi)
    let totalSalesAI = 0, totalProfitAI = 0;
    const catSales = {}; const regionSales = {};

    filteredData.forEach(row => {
        totalSalesAI += row.Sales || 0;
        totalProfitAI += row.Profit || 0;

        // Kelompokkan profit berdasarkan kategori dan region
        if (row.Category) catSales[row.Category] = (catSales[row.Category] || 0) + (row.Profit || 0);
        if (row.Territory) regionSales[row.Territory] = (regionSales[row.Territory] || 0) + (row.Profit || 0);
    });

    let profitMarginAI = totalSalesAI > 0 ? ((totalProfitAI / totalSalesAI) * 100).toFixed(2) : 0;

    // Cari Kategori dan Region dengan Profit tertinggi saat ini
    const sortedCats = Object.entries(catSales).sort((a, b) => b[1] - a[1]);
    const sortedRegions = Object.entries(regionSales).sort((a, b) => b[1] - a[1]);

    let topCatContext = sortedCats.length > 0 ? `${sortedCats[0][0]} (Profit: $${sortedCats[0][1].toLocaleString("en-US", { minimumFractionDigits: 2 })})` : "-";
    let topRegionContext = sortedRegions.length > 0 ? `${sortedRegions[0][0]} (Profit: $${sortedRegions[0][1].toLocaleString("en-US", { minimumFractionDigits: 2 })})` : "-";

    // 2. RANGKAI KONTEKS DATA YANG LEBIH KAYA
    const konteksData = `[DATA DASHBOARD AKTIF: Total Sales = $${totalSalesAI.toLocaleString("en-US", { minimumFractionDigits: 2 })}, Total Profit = $${totalProfitAI.toLocaleString("en-US", { minimumFractionDigits: 2 })}, Profit Margin = ${profitMarginAI}%. Kategori Terbaik = ${topCatContext}. Region Terbaik = ${topRegionContext}]`;

    let instruksiKhusus = selectedPromptType === "Prioritas profit?" ? "Bandingkan profit margin dan sebutkan Kategori Terbaik berdasarkan data." :
        selectedPromptType === "Masalah region?" ? "Fokuskan pada performa logistik/penjualan di Region Terbaik berdasarkan data." :
            "Berikan rekomendasi promosi bulan depan berdasarkan total metrik yang ada.";

    // 3. PROMPT SUPER KETAT UNTUK MATA UANG & RELEVANSI
    const promptData = `
    Anda adalah Asisten AI Data Analyst. 
    ${konteksData}
    
    Pengguna bertanya: "${chatInput.value}". 
    Instruksi: ${instruksiKhusus}. 
    
    ATURAN WAJIB: 
    1. Jawaban HARUS merujuk pada angka di [DATA DASHBOARD AKTIF] di atas. Jangan mengarang angka.
    2. Format SEMUA angka mata uang dengan rapi menggunakan simbol dollar dan pemisah ribuan (Contoh: $1,234.56).
    3. Gunakan tag HTML <p> dan <ul><li> untuk merapikan jawaban. Jangan gunakan markdown.
    `;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptData: promptData, temperature: 0.3 }) // Suhu diturunkan agar lebih matematis dan tidak ngarang
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat dari backend Vercel.");

        let aiText = data.choices[0].message.content;

        // Pembersih teks sisa markdown
        aiText = aiText.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        chatOutput.innerHTML = aiText;
    } catch (error) {
        chatOutput.innerHTML = `<p style="color: #e74c3c;"><i class='bx bx-error'></i> Error: ${error.message}</p>`;
    }
}