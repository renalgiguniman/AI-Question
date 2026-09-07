// api/export-docx.js — Vercel Serverless Function
// Membuat file DOCX di server menggunakan npm package 'docx'
// Tidak butuh library CDN di browser sama sekali.

import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, ShadingType,
    convertInchesToTwip, HeadingLevel
} from 'docx';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { questions, config } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Data soal tidak valid.' });
    }

    const mapel = config?.mapel || 'Mata Pelajaran';
    const kelas = config ? `${config.jenjang} Kelas ${config.kelas}` : '';
    const today = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const spacer = () => new Paragraph({ text: '' });

    // ============================================================
    // SECTION 1 — LEMBAR SOAL
    // ============================================================
    const soalChildren = [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [new TextRun({ text: 'LEMBAR SOAL PILIHAN GANDA', bold: true, size: 32, font: 'Times New Roman' })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: `${mapel}  ·  ${kelas}`, size: 24, font: 'Times New Roman' })],
        }),
        spacer(),
    ];

    questions.forEach(q => {
        soalChildren.push(
            new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360, after: 120 },
                children: [new TextRun({ text: `${q.questionNumber}. ${q.question}`, font: 'Times New Roman', size: 24 })],
            }),
            ...['A', 'B', 'C', 'D'].map(letter =>
                new Paragraph({
                    indent: { left: convertInchesToTwip(0.3) },
                    spacing: { line: 360, after: 60 },
                    children: [new TextRun({ text: `${letter}. ${q.options[letter] || ''}`, font: 'Times New Roman', size: 24 })],
                })
            ),
            spacer()
        );
    });

    // ============================================================
    // SECTION 2 — KUNCI JAWABAN (tabel rapi 5 kolom)
    // ============================================================
    const COLS = 5;
    const headerRow = new TableRow({
        tableHeader: true,
        children: Array.from({ length: COLS }, () =>
            new TableCell({
                shading: { type: ShadingType.CLEAR, fill: '4F46E5' },
                width: { size: Math.floor(9000 / COLS), type: WidthType.DXA },
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: 'No — Jawaban', bold: true, color: 'FFFFFF', font: 'Times New Roman', size: 22 })]
                })]
            })
        )
    });

    const keyDataRows = [];
    for (let i = 0; i < questions.length; i += COLS) {
        const chunk = [...questions.slice(i, i + COLS)];
        while (chunk.length < COLS) chunk.push(null);
        keyDataRows.push(
            new TableRow({
                children: chunk.map((q, ci) =>
                    new TableCell({
                        shading: { type: ShadingType.CLEAR, fill: ci % 2 === 0 ? 'F3F4F6' : 'FFFFFF' },
                        width: { size: Math.floor(9000 / COLS), type: WidthType.DXA },
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: q ? [
                                new TextRun({ text: `${q.questionNumber}.  `, font: 'Times New Roman', size: 22 }),
                                new TextRun({ text: q.correctAnswer, bold: true, color: '4F46E5', font: 'Times New Roman', size: 22 }),
                            ] : [new TextRun({ text: '', size: 22 })]
                        })]
                    })
                )
            })
        );
    }

    const kunciChildren = [
        new Paragraph({
            pageBreakBefore: true,
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [new TextRun({ text: 'KUNCI JAWABAN', bold: true, size: 32, font: 'Times New Roman' })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: `${mapel}  ·  ${kelas}`, size: 24, font: 'Times New Roman' })],
        }),
        new Table({
            width: { size: 9000, type: WidthType.DXA },
            alignment: AlignmentType.CENTER,
            rows: [headerRow, ...keyDataRows],
        }),
    ];

    // ============================================================
    // SECTION 3 — KISI-KISI
    // ============================================================
    const kisiHeaderCols = ['No', 'Materi', 'Level Bloom', 'Kesulitan', 'Indikator Soal', 'Bentuk Soal'];
    const kisiHeaderRow = new TableRow({
        tableHeader: true,
        children: kisiHeaderCols.map(txt =>
            new TableCell({
                shading: { type: ShadingType.CLEAR, fill: '4F46E5' },
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: txt, bold: true, color: 'FFFFFF', font: 'Times New Roman', size: 20 })]
                })]
            })
        )
    });

    const kisiDataRows = questions.map(q =>
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.questionNumber), font: 'Times New Roman', size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: q.material || '', font: 'Times New Roman', size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q.bloomLevel || '', font: 'Times New Roman', size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q.difficulty || '', font: 'Times New Roman', size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: q.indicator || '', font: 'Times New Roman', size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PG', font: 'Times New Roman', size: 20 })] })] }),
            ]
        })
    );

    const kisiChildren = [
        new Paragraph({
            pageBreakBefore: true,
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [new TextRun({ text: 'KISI-KISI SOAL', bold: true, size: 32, font: 'Times New Roman' })],
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: `${mapel}  ·  ${kelas}  ·  ${today}`, size: 24, font: 'Times New Roman' })],
        }),
        new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [kisiHeaderRow, ...kisiDataRows],
        }),
    ];

    // ============================================================
    // BUILD & SEND
    // ============================================================
    try {
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: convertInchesToTwip(1),
                            bottom: convertInchesToTwip(1),
                            left: convertInchesToTwip(1.25),
                            right: convertInchesToTwip(1),
                        }
                    }
                },
                children: [...soalChildren, ...kunciChildren, ...kisiChildren],
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        const filename = `Soal_${mapel.replace(/\s+/g, '_')}_${kelas.replace(/\s+/g, '_')}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.status(200).send(buffer);

    } catch (err) {
        console.error('Error membuat DOCX:', err);
        return res.status(500).json({ error: 'Gagal membuat file DOCX: ' + err.message });
    }
}
