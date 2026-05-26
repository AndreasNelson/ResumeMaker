const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const latex = require('node-latex');
const fs = require('fs');
const path = require('path');

// Manually add MiKTeX to the path for this process
process.env.PATH = `C:\\Users\\Dre\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64;${process.env.PATH}`;

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const escapeLatex = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([&%$#_{}])/g, '\\$1')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
};

const OUTPUT_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const CANDIDATE_DIR = path.join(__dirname, 'candidate_data');
if (!fs.existsSync(CANDIDATE_DIR)) fs.mkdirSync(CANDIDATE_DIR);

const OVERVIEW_JSON = path.join(CANDIDATE_DIR, 'candidate_overview.json');

let candidateData = {
    firstName: '', lastName: '', city: '', state: '', phone: '', email: '',
    linkedin: '', github: '', portfolio: '', skills: '', experience: [], education: []
};

if (fs.existsSync(OVERVIEW_JSON)) {
    candidateData = JSON.parse(fs.readFileSync(OVERVIEW_JSON, 'utf8'));
}

app.get('/api/overview', (req, res) => res.json(candidateData));

app.post('/api/overview', (req, res) => {
    candidateData = { ...candidateData, ...req.body };
    fs.writeFileSync(OVERVIEW_JSON, JSON.stringify(candidateData, null, 2));
    res.json({ message: 'Overview updated' });
});

app.post('/api/generate-resume', async (req, res) => {
    const { jobDescription, alterations } = req.body;

    // --- STEP 1: THE ARCHITECT (Content Planning) ---
    const architectPrompt = `
You are a Resume Architect. Analyze the Candidate JSON and Job Description.
Create a structured Content Plan for a 1-page professional resume.

MANDATES:
- Include at least 4-5 work experience entries.
- If IT role: Prioritize Help Desk/Technician roles at the top.
- Select 10-12 most relevant technical skills.
- Draft a high-impact professional summary.

RETURN ONLY A JSON OBJECT:
{
  "jobTitleForFilename": "ExtractedJobTitle",
  "isSWE": true/false,
  "summary": "...",
  "skills": [{"category": "...", "items": "..."}],
  "experience": [{"dates": "...", "title": "...", "company": "...", "location": "...", "bullets": ["...", "..."]}],
  "education": [{"dates": "...", "degree": "...", "school": "...", "location": "...", "details": "..."}]
}

CANDIDATE DATA:
${JSON.stringify(candidateData, null, 2)}

JOB DESCRIPTION:
${jobDescription}
`;

    try {
        console.log(`[Architect] Starting content plan...`);
        const architectRes = await axios.post('http://localhost:11434/api/generate', {
            model: 'llama3',
            prompt: architectPrompt,
            stream: false,
            format: 'json'
        });

        let plan;
        try {
            plan = JSON.parse(architectRes.data.response);
        } catch (e) {
            console.error('Raw Architect Response:', architectRes.data.response);
            throw new Error('Failed to parse Architect JSON');
        }

        const rawTitle = plan.jobTitleForFilename || plan.jobTitle || 'JobPosition';
        const jobTitleSlug = rawTitle.replace(/[^a-z0-9]/gi, '');
        const fileNameBase = `${candidateData.lastName}${jobTitleSlug}`;

        // --- STEP 2: THE TYPESETTER (LaTeX Generation) ---
        console.log(`[Typesetter] Generating LaTeX...`);
        const typesetterPrompt = `
You are a LaTeX Expert. Map this plan to 'moderncv' (classic/letters).

RULES:
1. NO PHOTOS: Do NOT use \\photo.
2. NO EXTRA PACKAGES: Use only what is in the preamble.
3. RETURN ONLY LaTeX starting with \\documentclass and ending with \\end{document}.

PREAMBLE:
\\documentclass[11pt,a4paper,sans]{moderncv}
\\moderncvstyle{classic}
\\moderncvicons{letters}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\def\\mobilesymbol{}
\\def\\phonesymbol{}
\\def\\fixedphonesymbol{}
\\def\\emailsymbol{}
\\def\\linkedinsocialsymbol{}
\\usepackage[scale=0.88]{geometry}
\\setlength{\\hintscolumnwidth}{3.8cm}

CONTENT:
Name: ${escapeLatex(candidateData.firstName)} ${escapeLatex(candidateData.lastName)}
Location: ${escapeLatex(candidateData.city)}, ${escapeLatex(candidateData.state)}
Phone: ${escapeLatex(candidateData.phone)}
Email: ${escapeLatex(candidateData.email)}
LinkedIn: ${escapeLatex(candidateData.linkedin)}
GitHub: ${plan.isSWE ? escapeLatex(candidateData.github) : ''}
Portfolio: ${plan.isSWE ? escapeLatex(candidateData.portfolio) : ''}
Summary: ${escapeLatex(plan.summary)}
Skills: ${JSON.stringify(plan.skills)}
Experience: ${JSON.stringify(plan.experience)}
Education: ${JSON.stringify(plan.education)}
`;

        const typesetterRes = await axios.post('http://localhost:11434/api/generate', {
            model: 'deepseek-coder-v2',
            prompt: typesetterPrompt,
            stream: false
        });

        let rawLatex = typesetterRes.data.response;
        const docMatch = rawLatex.match(/\\documentclass[\s\S]*\\end\{document\}/);
        let latexCode = docMatch ? docMatch[0] : rawLatex;

        // Force cleanup
        latexCode = latexCode
            .replace(/\\photo\[.*?\]\{.*?\}/g, '')
            .replace(/\\usepackage\{picture\}/g, '')
            .trim();

        const latexPath = path.join(OUTPUT_DIR, `${fileNameBase}.tex`);
        const pdfPath = path.join(OUTPUT_DIR, `${fileNameBase}.pdf`);
        
        const compileLatex = (code) => {
            return new Promise((resolve, reject) => {
                fs.writeFileSync(latexPath, code);
                const input = fs.createReadStream(latexPath);
                const output = fs.createWriteStream(pdfPath);
                const pdfGenerator = latex(input);
                pdfGenerator.pipe(output);
                pdfGenerator.on('error', err => reject(err));
                pdfGenerator.on('finish', () => resolve());
            });
        };

        try {
            await compileLatex(latexCode);
        } catch (err) {
            console.warn('Retry fix...', err.message);
            const fixRes = await axios.post('http://localhost:11434/api/generate', {
                model: 'deepseek-coder-v2',
                prompt: `Fix this LaTeX (error: ${err.message}):\n${latexCode}\nReturn fixed code ONLY. No photos.`,
                stream: false
            });
            latexCode = fixRes.data.response.match(/\\documentclass[\s\S]*\\end\{document\}/)[0];
            latexCode = latexCode.replace(/\\photo\[.*?\]\{.*?\}/g, '');
            await compileLatex(latexCode);
        }

        res.json({ 
            latex: latexCode,
            pdfUrl: `http://localhost:${port}/api/download-resume?file=${encodeURIComponent(fileNameBase)}`
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Generation failed', details: error.message });
    }
});

app.get('/api/download-resume', (req, res) => {
    const pdfPath = path.join(OUTPUT_DIR, `${req.query.file}.pdf`);
    if (fs.existsSync(pdfPath)) {
        res.contentType("application/pdf").pipe(fs.createReadStream(pdfPath));
    } else {
        res.status(404).send('Not found');
    }
});

app.listen(port, () => console.log(`Server: http://localhost:${port}`));
