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

const OVERVIEW_JSON = path.join(CANDIDATE_DIR, 'candidate_overview.json');

// Default structure with arrays for experience and education
const defaultData = {
    firstName: '',
    lastName: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    linkedin: '',
    github: '',
    portfolio: '',
    skills: '',
    experience: [],
    education: []
};

let candidateData = { ...defaultData };

if (fs.existsSync(OVERVIEW_JSON)) {
    try {
        candidateData = JSON.parse(fs.readFileSync(OVERVIEW_JSON, 'utf8'));
    } catch (e) {
        console.error('Failed to parse candidate JSON, using defaults');
    }
}

app.get('/api/overview', (req, res) => {
    res.json(candidateData);
});

app.post('/api/overview', (req, res) => {
    candidateData = { ...candidateData, ...req.body };
    fs.writeFileSync(OVERVIEW_JSON, JSON.stringify(candidateData, null, 2));
    res.json({ message: 'Overview updated and saved' });
});

app.post('/api/generate-resume', async (req, res) => {
    const { jobDescription, alterations } = req.body;

    if (!candidateData.firstName || !candidateData.lastName) {
        return res.status(400).json({ error: 'Candidate profile is incomplete. Name is required.' });
    }

    // Extract job title from the first line or first 50 characters of the description
    const firstLine = jobDescription.split('\n')[0].trim() || 'Job';
    const extractedTitle = firstLine.length > 50 ? firstLine.substring(0, 50) : firstLine;
    const sanitizedTitle = extractedTitle.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    
    const lastName = candidateData.lastName.replace(/[^a-z0-9]/gi, '');
    const fileNameBase = `${lastName}_${sanitizedTitle}_Resume`;

    const prompt = `
You are an expert resume writer. Create a professional 1-page software engineering or IT resume using the LaTeX 'moderncv' class.
Style: classic
Icons: letters
Margins: scale=0.88, hintscolumnwidth=3.8cm

LATEX TEMPLATE:
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

\\name{${candidateData.firstName}}{${candidateData.lastName}}
\\address{${candidateData.city}}{${candidateData.state}}{}
\\phone{${candidateData.phone}}
\\email{${candidateData.email}}
${candidateData.linkedin ? `\\social[linkedin]{${candidateData.linkedin}}` : ''}
${candidateData.github ? `\\social[github]{${candidateData.github}}` : ''}
${candidateData.portfolio ? `\\homepage{${candidateData.portfolio}}` : ''}

\\begin{document}
\\makecvtitle

\\section{Summary}
[Draft a concise, high-impact summary tailored to the job description]

\\section{Core Competencies}
% TARGETED SELECTION: Draw a handful of the most relevant technical skills from the candidate data below that best fit the job description.
\\cvitem{Category}{Skill 1, Skill 2, ...}

\\section{Relevant Experience}
% Use \\cventry{dates}{title}{company}{location}{}{description} for each job below.
% For the description part, use an itemize block. 
% Tailor the bullet points to emphasize achievements relevant to the job description.

\\section{Education}
% Use \\cventry{dates}{degree}{school}{location}{}{details} for each entry below.

\\end{document}

Return ONLY the complete, compilable LaTeX document.

CANDIDATE DATA:
Skills: ${candidateData.skills}

EXPERIENCE ENTRIES:
${candidateData.experience.map(job => `
- Dates: ${job.dates}
  Title: ${job.title}
  Company: ${job.company}
  Location: ${job.location}
  Description: ${job.description}
`).join('\n')}

EDUCATION ENTRIES:
${candidateData.education.map(edu => `
- Dates: ${edu.dates}
  Degree: ${edu.degree}
  School: ${edu.school}
  Location: ${edu.location}
  Details: ${edu.details}
`).join('\n')}

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
The following LaTeX code failed to compile with error: "${initialError.message}". 
Fix the syntax and return ONLY the corrected LaTeX document. 
Ensure special characters like & are escaped (\\&).

ORIGINAL CODE:
${latexCode}
`;
            const fixResponse = await axios.post('http://localhost:11434/api/generate', {
                model: 'deepseek-coder-v2',
                prompt: fixPrompt,
                stream: false
            });
            latexCode = fixResponse.data.response.replace(/```latex/g, '').replace(/```/g, '').trim();
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
