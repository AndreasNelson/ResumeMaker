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

const OUTPUT_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

const CANDIDATE_DIR = path.join(__dirname, 'candidate_data');
if (!fs.existsSync(CANDIDATE_DIR)) {
    fs.mkdirSync(CANDIDATE_DIR);
}

const OVERVIEW_FILE = path.join(CANDIDATE_DIR, 'candidate_overview.txt');

// Load overview on startup
let candidateOverview = '';
if (fs.existsSync(OVERVIEW_FILE)) {
    candidateOverview = fs.readFileSync(OVERVIEW_FILE, 'utf8');
}

app.get('/api/overview', (req, res) => {
    res.json({ overview: candidateOverview });
});

app.post('/api/overview', (req, res) => {
    candidateOverview = req.body.overview;
    fs.writeFileSync(OVERVIEW_FILE, candidateOverview);
    res.json({ message: 'Overview updated and saved' });
});

app.post('/api/generate-resume', async (req, res) => {
    const { jobDescription, alterations, companyName } = req.body;

    if (!candidateOverview) {
        return res.status(400).json({ error: 'Candidate overview is missing.' });
    }

    // Attempt to extract candidate name for file naming (fallback to "Candidate")
    const nameMatch = candidateOverview.match(/(?:Name|I am|This is)\s*[:\-]?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
    const lastName = nameMatch ? nameMatch[1].split(' ').pop() : 'Candidate';
    const sanitizedCompany = (companyName || 'Company').replace(/[^a-z0-9]/gi, '_');
    const fileNameBase = `${lastName}_${sanitizedCompany}_Resume`;

    const prompt = `
You are an expert resume writer. Create a professional 1-page software engineering or IT resume using the LaTeX 'moderncv' class.
Style: classic
Icons: letters
Margins: scale=0.88, hintscolumnwidth=3.8cm

Follow the formatting of this specific example structure:
\\documentclass[11pt,a4paper,sans]{moderncv}
\\moderncvstyle{classic}
\\moderncvicons{letters}
\\usepackage[T1]{fontenc} % Robust font encoding
\\usepackage{lmodern}     % Scalable fonts to prevent font expansion errors
% Remove symbols
\\def\\mobilesymbol{}
\\def\\phonesymbol{}
\\def\\fixedphonesymbol{}
\\def\\emailsymbol{}
\\def\\linkedinsocialsymbol{}
\\usepackage[scale=0.88]{geometry}
\\setlength{\\hintscolumnwidth}{3.8cm}

\\name{FirstName}{LastName}
\\address{City, State}{}{}
\\phone{...}
\\email{...}
\\social[linkedin]{...}

\\begin{document}
\\makecvtitle

\\section{Summary}
[Impactful summary]

\\section{Core Competencies}
\\cvitem{Category}{Skill 1, Skill 2, ...}

\\section{Relevant Experience}
\\cventry{Dates}{Job Title}{Company}{Location}{}{%
\\begin{itemize}
    \\item Achievement...
\\end{itemize}}

\\section{Education}
\\cventry{Date}{Degree}{University}{Location}{}{Details}
\\end{document}

Return ONLY a complete, compilable LaTeX document. Do not include markdown blocks.

CANDIDATE OVERVIEW:
${candidateOverview}

JOB DESCRIPTION:
${jobDescription}

${alterations ? `USER REQUESTED ALTERATIONS: ${alterations}` : ''}
`;

    try {
        let response = await axios.post('http://localhost:11434/api/generate', {
            model: 'deepseek-coder-v2',
            prompt: prompt,
            stream: false
        });

        let latexCode = response.data.response;
        latexCode = latexCode.replace(/```latex/g, '').replace(/```/g, '').trim();

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
        } catch (initialError) {
            console.warn('Initial LaTeX compilation failed, attempting self-fix...', initialError.message);
            
            const fixPrompt = `
The following LaTeX code failed to compile with the error: "${initialError.message}".
Please fix the syntax errors in the LaTeX code and return ONLY the corrected, complete LaTeX document.
Ensure all special characters like &, %, $, #, _, {, }, ~, ^, \\ are properly escaped if they are intended to be literal text.
Common moderncv issues:
- Unclosed braces {}
- Special characters in URLs or addresses
- Incorrect number of arguments for \\cventry or \\cvitem

ORIGINAL CODE:
${latexCode}
`;
            
            const fixResponse = await axios.post('http://localhost:11434/api/generate', {
                model: 'deepseek-coder-v2',
                prompt: fixPrompt,
                stream: false
            });

            latexCode = fixResponse.data.response;
            latexCode = latexCode.replace(/```latex/g, '').replace(/```/g, '').trim();
            
            // Try compiling one more time with the fixed code
            await compileLatex(latexCode);
        }

        res.json({ 
            latex: latexCode,
            pdfUrl: `http://localhost:${port}/api/download-resume?file=${encodeURIComponent(fileNameBase)}`
        });

    } catch (error) {
        console.error('Final Error:', error);
        res.status(500).json({ error: 'Failed to generate a valid resume.', details: error.message });
    }
});

app.get('/api/download-resume', (req, res) => {
    const fileName = req.query.file || 'resume';
    const pdfPath = path.join(OUTPUT_DIR, `${fileName}.pdf`);
    if (fs.existsSync(pdfPath)) {
        res.contentType("application/pdf");
        fs.createReadStream(pdfPath).pipe(res);
    } else {
        res.status(404).json({ error: 'PDF not found' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
