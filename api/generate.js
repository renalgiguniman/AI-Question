// api/generate.js - Vercel Serverless Function
// API Key aman tersimpan di sisi server Vercel, tidak pernah terlihat oleh pengguna.

export default async function handler(req, res) {
    // Hanya izinkan method POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ 
            error: 'Konfigurasi server tidak lengkap. Hubungi administrator.' 
        });
    }

    const { blueprintItem, config } = req.body;

    if (!blueprintItem || !config) {
        return res.status(400).json({ error: 'Data blueprint tidak valid.' });
    }

    // Validasi jumlah soal (hard limit: maks 35 sesuai AGENTS.md)
    if (config.totalQuestions > 35) {
        return res.status(400).json({ error: 'Maksimal 35 soal per generate.' });
    }

    const prompt = buildPrompt(blueprintItem, config);

    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        if (!geminiResponse.ok) {
            const errData = await geminiResponse.json();
            const errMsg = errData?.error?.message || 'Gemini API error.';
            return res.status(502).json({ error: errMsg });
        }

        const data = await geminiResponse.json();
        const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            return res.status(502).json({ error: 'AI tidak menghasilkan teks. Coba lagi.' });
        }

        // Parse JSON dari Gemini & validasi struktur
        let parsed;
        try {
            parsed = JSON.parse(textResponse);
        } catch (e) {
            return res.status(502).json({ error: 'Format output AI tidak valid. Coba generate ulang.' });
        }

        // Validasi field wajib ada
        const requiredFields = ['question', 'options', 'correctAnswer', 'indicator'];
        for (const field of requiredFields) {
            if (!parsed[field]) {
                return res.status(502).json({ error: `Field '${field}' hilang dari output AI.` });
            }
        }

        // Validasi correctAnswer hanya A, B, C, atau D
        if (!['A', 'B', 'C', 'D'].includes(parsed.correctAnswer)) {
            return res.status(502).json({ error: 'Kunci jawaban dari AI tidak valid.' });
        }

        // Gabungkan output AI dengan metadata blueprint (metadata dari blueprint = otoritatif)
        const finalQuestion = {
            id: 'q_' + Date.now() + Math.random().toString(36).substr(2, 5),
            question: parsed.question,
            options: {
                A: parsed.options?.A || '',
                B: parsed.options?.B || '',
                C: parsed.options?.C || '',
                D: parsed.options?.D || '',
            },
            correctAnswer: parsed.correctAnswer,
            indicator: parsed.indicator,
            // Metadata dari blueprint — AI tidak bisa override ini
            questionNumber: blueprintItem.questionNumber,
            material: blueprintItem.material,
            bloomLevel: blueprintItem.bloomLevel,
            difficulty: blueprintItem.difficulty,
            locked: false,
            editedByUser: false,
        };

        return res.status(200).json({ question: finalQuestion });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ 
            error: 'Soal belum berhasil dibuat. Kemungkinan AI sedang sibuk. Silakan coba lagi.' 
        });
    }
}

function buildPrompt(blueprintItem, config) {
    const bloomLabels = {
        C1: 'C1 — Mengingat (Remember)',
        C2: 'C2 — Memahami (Understand)',
        C3: 'C3 — Menerapkan (Apply)',
        C4: 'C4 — Menganalisis (Analyze)',
        C5: 'C5 — Mengevaluasi (Evaluate)',
        C6: 'C6 — Mencipta (Create) — buat soal MCQ berorientasi pemilihan solusi/strategi terbaik',
    };

    const difficultyGuide = {
        Easy: 'Mudah — konsep dasar, satu langkah penyelesaian, distractor jelas berbeda',
        Medium: 'Sedang — membutuhkan 2-3 langkah, distractor plausibel, ada potensi kesalahan konsep',
        Hard: 'Sulit — multi-step reasoning, distractor sangat dekat, membutuhkan analisis mendalam',
    };

    return `Anda adalah pembuat soal ujian pilihan ganda profesional untuk kurikulum Indonesia.
Buat SATU soal pilihan ganda berdasarkan spesifikasi berikut:

SPESIFIKASI SOAL:
- Jenjang: ${config.jenjang} Kelas ${config.kelas}
- Mata Pelajaran: ${config.mapel}
- Materi: ${blueprintItem.material}
- Level Bloom: ${bloomLabels[blueprintItem.bloomLevel] || blueprintItem.bloomLevel}
- Tingkat Kesulitan: ${difficultyGuide[blueprintItem.difficulty] || blueprintItem.difficulty}

ATURAN WAJIB:
1. Buat 4 pilihan (A, B, C, D) dengan SATU jawaban yang benar.
2. Pengecoh (distractor) harus merepresentasikan kesalahan umum siswa, bukan jawaban absurd.
3. Jangan tulis kata "Bloom", "C1", "C3", dst. di teks soal.
4. Jika soal numerik, pastikan angka masuk akal dan perhitungannya bisa diverifikasi.
5. Gunakan Bahasa Indonesia yang baku dan jelas.

OUTPUT harus berupa JSON murni (tanpa markdown/backtick) persis seperti ini:
{
  "question": "teks soal lengkap...",
  "options": {
    "A": "pilihan A",
    "B": "pilihan B",
    "C": "pilihan C",
    "D": "pilihan D"
  },
  "correctAnswer": "B",
  "indicator": "Siswa dapat [kata kerja operasional] [materi] dengan [kondisi]"
}`;
}
