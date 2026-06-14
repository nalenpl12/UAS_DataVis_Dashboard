export default async function handler(req, res) {
    // Hanya izinkan metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode tidak diizinkan' });
    }

    // Tangkap data yang dikirim dari script.js (frontend)
    const { promptData, temperature } = req.body;

    try {
        // Panggil server Groq dari dalam server Vercel (Sangat Aman)
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                // Mengambil kunci rahasia dari Environment Variable Vercel
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "user", content: promptData }],
                temperature: temperature || 0.4
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Koneksi ke server Groq gagal.");
        }

        // Kembalikan jawaban AI ke frontend
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}