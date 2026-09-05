// engine.js - Core Business Logic untuk AI Question Generator
// Semua panggilan AI sekarang melewati /api/generate (Vercel Serverless Function)
// API Key TIDAK pernah ada di file ini.

/**
 * Largest Remainder Method untuk mendistribusikan soal secara deterministik.
 * Memastikan total soal selalu sama dengan yang diminta tanpa ada desimal.
 */
function calculateDistribution(totalItems, items) {
    if (items.length === 0) return [];

    let totalAssigned = 0;
    const allocations = items.map(item => {
        const exact = (item.percentage / 100) * totalItems;
        const integerPart = Math.floor(exact);
        const remainder = exact - integerPart;
        totalAssigned += integerPart;
        return { ...item, exact, count: integerPart, remainder };
    });

    // Largest Remainder: tambahkan sisa ke item dengan remainder terbesar
    let remaining = totalItems - totalAssigned;
    allocations.sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remaining; i++) {
        allocations[i % allocations.length].count += 1;
    }

    return allocations;
}

/**
 * Membuat Blueprint (Material x Bloom Matrix)
 * Semua logika distribusi berjalan di sini — bukan di AI.
 */
function generateBlueprint(config) {
    const { totalQuestions, materials, bloomDistribution, difficulty } = config;

    // 1. Hitung kuota materi (deterministik)
    const materialQuota = calculateDistribution(totalQuestions, materials);

    // 2. Hitung kuota Bloom (deterministik)
    const bloomQuota = calculateDistribution(totalQuestions, bloomDistribution);

    // 3. Bangun blueprint satu per satu
    const blueprint = [];
    let qNumber = 1;

    // Pool bloom yang tersedia
    const availableBlooms = bloomQuota
        .filter(b => b.count > 0)
        .map(b => ({ level: b.level, count: b.count }));

    materialQuota.forEach(mat => {
        for (let i = 0; i < mat.count; i++) {
            // Pilih bloom berdasarkan kuota tertinggi (greedy, deterministik)
            let bloomLevel = 'C3';
            if (availableBlooms.length > 0) {
                availableBlooms.sort((a, b) => b.count - a.count);
                bloomLevel = availableBlooms[0].level;
                availableBlooms[0].count -= 1;
                if (availableBlooms[0].count === 0) availableBlooms.shift();
            }

            // Difficulty: Mixed = distribusi default 30/50/20
            let diff = difficulty;
            if (difficulty === 'Mixed') {
                const rand = Math.random();
                if (rand < 0.3) diff = 'Easy';
                else if (rand < 0.8) diff = 'Medium';
                else diff = 'Hard';
            }

            blueprint.push({
                questionNumber: qNumber++,
                material: mat.name,
                bloomLevel,
                difficulty: diff,
            });
        }
    });

    return blueprint;
}

/**
 * Generate satu soal via Vercel Serverless Function (/api/generate).
 * API Key aman di server — tidak ada di sini.
 */
async function generateQuestionWithAI(blueprintItem, config) {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintItem, config }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Gagal menghubungi server AI.');
    }

    return data.question;
}

// Expose ke app.js via window
window.AIQEngine = {
    calculateDistribution,
    generateBlueprint,
    generateQuestionWithAI,
};
