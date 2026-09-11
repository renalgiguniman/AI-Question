// api/export-docx.js
// Generate file RTF (Rich Text Format) yang bisa dibuka Word
// Format dirapikan: Tabel bergaris, header berwarna, spasi proporsional

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
            .replace(/[^\x00-\x7F]/g, ch => `\\u${ch.charCodeAt(0)}?`);
    }

    // RTF formatting constants
    const br = '\\par\n';
    const pb = '\\page\n'; // page break
    // border definition for table cells (solid, width 10)
    const brdr = '\\clbrdrt\\brdrs\\brdrw10 \\clbrdrl\\brdrs\\brdrw10 \\clbrdrb\\brdrs\\brdrw10 \\clbrdrr\\brdrs\\brdrw10';
    // cell background color (color index 2 in colortbl)
    const shadeHeader = '\\clcbpat2';

    // Headers & Paragraphs
    function heading(text) {
        return `\\pard\\qc\\b\\fs32 ${esc(text)}\\b0\\fs24${br}`;
    }
    function subheading(text) {
        return `\\pard\\qc\\b\\fs24 ${esc(text)}\\b0\\fs24\\sa240${br}`;
    }
    function soalPara(text) {
        return `\\pard\\qj\\fi0\\li0\\sl360\\slmult1\\fs24 ${esc(text)}${br}`; // 1.5 line spacing
    }
    function pilihanPara(text) {
        return `\\pard\\qj\\fi0\\li500\\sl360\\slmult1\\fs24 ${esc(text)}${br}`; // 1.5 line spacing, left indent
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
        soalContent += `\\pard\\sa120${br}`; // Spasi antar soal
    });

    // ============================================================
    // SECTION 2 — KUNCI JAWABAN (tabel bergaris)
    // ============================================================
    const COLS = 5;
    const colW = 1800; // twips per column (Total 9000 twips ~ 15.8cm)

    function rtfKunciRow(cells, isHeader = false) {
        let row = `\\trowd\\trgaph108\\trleft0`;
        // Setup cell borders and widths
        cells.forEach((_, i) => {
            row += `\\cellx${colW * (i + 1)} ${brdr} ${isHeader ? shadeHeader : ''}`;
        });
        row += '\n';
        // Fill cell data
        cells.forEach(cell => {
            const bold = isHeader ? '\\b ' : '';
            row += `\\pard\\intbl\\qc\\sl240\\slmult1\\sa60\\sb60 ${bold}${esc(cell)}${isHeader ? '\\b0' : ''}\\cell\n`;
        });
        row += '\\row\n';
        return row;
    }

    let kunciContent = pb;
    kunciContent += heading('KUNCI JAWABAN');
    kunciContent += subheading(`${mapel}  |  ${kelas}`);
    kunciContent += br;

    // Header Kunci
    kunciContent += rtfKunciRow(['No — Jawaban', 'No — Jawaban', 'No — Jawaban', 'No — Jawaban', 'No — Jawaban'], true);

    // Rows Kunci
    for (let i = 0; i < questions.length; i += COLS) {
        const chunk = questions.slice(i, i + COLS);
        while (chunk.length < COLS) chunk.push(null);
        const cells = chunk.map(q => q ? `${q.questionNumber}.  ${q.correctAnswer}` : '');
        kunciContent += rtfKunciRow(cells);
    }
    kunciContent += br;

    // ============================================================
    // SECTION 3 — KISI-KISI (tabel bergaris, lebar kolom spesifik)
    // ============================================================
    // Proporsi lebar kolom (Total ~ 9200 twips)
    const wNo = 600;
    const wMateri = 2200;
    const wBloom = 1000;
    const wSulit = 1200;
    const wIndikator = 3400;
    const wBentuk = 800;
    
    // Akumulasi posisi kanan tiap sel untuk RTF \cellx
    const pos1 = wNo;
    const pos2 = pos1 + wMateri;
    const pos3 = pos2 + wBloom;
    const pos4 = pos3 + wSulit;
    const pos5 = pos4 + wIndikator;
    const pos6 = pos5 + wBentuk;

    function rtfKisiRow(cells, isHeader = false) {
        let row = `\\trowd\\trgaph108\\trleft0`;
        const shade = isHeader ? shadeHeader : '';
        // Setup cell widths and borders
        row += `\\cellx${pos1} ${brdr} ${shade}`;
        row += `\\cellx${pos2} ${brdr} ${shade}`;
        row += `\\cellx${pos3} ${brdr} ${shade}`;
        row += `\\cellx${pos4} ${brdr} ${shade}`;
        row += `\\cellx${pos5} ${brdr} ${shade}`;
        row += `\\cellx${pos6} ${brdr} ${shade}\n`;
        
        // Fill cell data
        cells.forEach((cell, i) => {
            const bold = isHeader ? '\\b ' : '';
            // Kolom angka/pendek rata tengah, sisanya rata kiri-kanan
            const align = (i === 0 || i === 2 || i === 3 || i === 5) && !isHeader ? '\\qc' : '\\qj';
            row += `\\pard\\intbl${align}\\sl240\\slmult1\\sa60\\sb60 ${bold}${esc(cell)}${isHeader ? '\\b0' : ''}\\cell\n`;
        });
        row += '\\row\n';
        return row;
    }

    let kisiContent = pb;
    kisiContent += heading('KISI-KISI SOAL');
    kisiContent += subheading(`${mapel}  |  ${kelas}  |  ${today}`);
    kisiContent += br;

    // Header Kisi
    kisiContent += rtfKisiRow(['No', 'Materi', 'Level Bloom', 'Kesulitan', 'Indikator Soal', 'Bentuk'], true);

    // Data Kisi
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
    // colortbl: 1 = black, 2 = light gray (for table headers)
    const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;\\red230\\green230\\blue230;}
\\margl1440\\margr1440\\margt1440\\margb1440
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
