// api/export-docx.js
// Generate file RTF (Rich Text Format) yang bisa dibuka Word
// TANPA library eksternal - murni Node.js built-in
// File .docx didownload tapi isinya RTF yang valid untuk Word

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { questions, config } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Data soal tidak valid.' });
    }

    const mapel = (config?.mapel || 'Mata Pelajaran').replace(/[\\{}]/g, '');
    const kelas = config ? `${config.jenjang} Kelas ${config.kelas}` : '';
    const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    // RTF helper: escape special characters
    function esc(str = '') {
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/\{/g, '\\{')
            .replace(/\}/g, '\\}')
            // Latin chars dengan aksen (untuk bahasa Indonesia)
            .replace(/[^\x00-\x7F]/g, ch => {
                const code = ch.charCodeAt(0);
                return `\\u${code}?`;
            });
    }

    // RTF paragraph helpers
    const br  = '\\par\n';
    const pb  = '\\page\n'; // page break

    function heading(text) {
        return `\\pard\\qc\\b\\fs32 ${esc(text)}\\b0\\fs24${br}`;
    }
    function subheading(text) {
        return `\\pard\\qc\\fs22 ${esc(text)}\\fs24${br}`;
    }
    function soalPara(text) {
        return `\\pard\\qj\\fi0\\li0\\fs24 ${esc(text)}${br}`;
    }
    function pilihanPara(text) {
        return `\\pard\\qj\\fi0\\li720\\fs24 ${esc(text)}${br}`;
    }

    // ============================================================
    // SECTION 1 — LEMBAR SOAL
    // ============================================================
    let soalContent = heading('LEMBAR SOAL PILIHAN GANDA');
    soalContent += subheading(`${mapel}  |  ${kelas}`);
    soalContent += br;

    questions.forEach(q => {
        soalContent += soalPara(`${q.questionNumber}. ${q.question}`);
        ['A', 'B', 'C', 'D'].forEach(letter => {
            soalContent += pilihanPara(`${letter}. ${q.options?.[letter] || ''}`);
        });
        soalContent += br;
    });

    // ============================================================
    // SECTION 2 — KUNCI JAWABAN (tabel)
    // ============================================================
    const COLS = 5;
    const colW = 1800; // twips per column
    const totalW = colW * COLS;

    function rtfTableRow(cells, isBold = false) {
        let row = `\\trowd\\trgaph108\\trleft0`;
        cells.forEach((_, i) => {
            row += `\\cellx${colW * (i + 1)}`;
        });
        row += '\n';
        cells.forEach(cell => {
            const bold = isBold ? '\\b ' : '';
            row += `\\pard\\intbl\\qc ${bold}${esc(cell)}${isBold ? '\\b0' : ''}\\cell\n`;
        });
        row += '\\row\n';
        return row;
    }

    let kunciContent = pb;
    kunciContent += heading('KUNCI JAWABAN');
    kunciContent += subheading(`${mapel}  |  ${kelas}`);
    kunciContent += br;

    // Header kunci
    kunciContent += rtfTableRow(['No — Jawaban', 'No — Jawaban', 'No — Jawaban', 'No — Jawaban', 'No — Jawaban'], true);

    // Rows kunci
    for (let i = 0; i < questions.length; i += COLS) {
        const chunk = questions.slice(i, i + COLS);
        while (chunk.length < COLS) chunk.push(null);
        const cells = chunk.map(q => q ? `${q.questionNumber}.  ${q.correctAnswer}` : '');
        kunciContent += rtfTableRow(cells);
    }
    kunciContent += br;

    // ============================================================
    // SECTION 3 — KISI-KISI (tabel)
    // ============================================================
    const kisiCols = 6;
    const kisiColW = Math.floor(9000 / kisiCols);

    function rtfKisiRow(cells, isBold = false) {
        let row = `\\trowd\\trgaph108\\trleft0`;
        cells.forEach((_, i) => {
            row += `\\cellx${kisiColW * (i + 1)}`;
        });
        row += '\n';
        cells.forEach(cell => {
            const bold = isBold ? '\\b ' : '';
            row += `\\pard\\intbl\\ql ${bold}${esc(cell)}${isBold ? '\\b0' : ''}\\cell\n`;
        });
        row += '\\row\n';
        return row;
    }

    let kisiContent = pb;
    kisiContent += heading('KISI-KISI SOAL');
    kisiContent += subheading(`${mapel}  |  ${kelas}  |  ${today}`);
    kisiContent += br;

    kisiContent += rtfKisiRow(['No', 'Materi', 'Level Bloom', 'Kesulitan', 'Indikator Soal', 'Bentuk Soal'], true);
    questions.forEach(q => {
        kisiContent += rtfKisiRow([
            String(q.questionNumber),
            q.material || '',
            q.bloomLevel || '',
            q.difficulty || '',
            q.indicator || '',
            'PG'
        ]);
    });

    // ============================================================
    // BUILD RTF DOCUMENT
    // ============================================================
    const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;\\red79\\green70\\blue229;}
\\f0\\fs24\\widowctrl\\hyphauto
${soalContent}
${kunciContent}
${kisiContent}
}`;

    const filename = `Soal_${mapel.replace(/\s+/g, '_')}_${kelas.replace(/\s+/g, '_')}.doc`;

    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(rtf);
}
