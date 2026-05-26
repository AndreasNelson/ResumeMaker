# Resume Maker AI 🤖📄

A web application that leverages local AI to generate professionally formatted, 1-page SWE/IT resumes tailored to specific job descriptions using LaTeX.

## Features
- **Local AI Power:** Uses [Ollama](https://ollama.com/) with `deepseek-coder-v2` (or other models) to ensure data privacy and zero cost.
- **LaTeX Precision:** Generates resumes in LaTeX for high-quality, ATS-friendly typography.
- **7-Second Rule Optimization:** Prompt-engineered to produce resumes that are clean, impactful, and easy for recruiters to skim.
- **Live PDF Rendering:** Real-time conversion of LaTeX to PDF for instant preview.
- **Iterative Refinement:** Request specific alterations to the generated resume or swap job descriptions on the fly.

## Tech Stack
- **Frontend:** React + TypeScript + Vite + Vanilla CSS
- **Backend:** Node.js + Express
- **AI Engine:** Ollama (running locally)
- **Document Engine:** MiKTeX (pdflatex) + `node-latex`

## Prerequisites

1. **Ollama:** [Download Ollama](https://ollama.com/download) and pull the required model:
   ```powershell
   ollama pull deepseek-coder-v2
   ```
2. **LaTeX Distribution:** [Download MiKTeX](https://miktex.org/download) (Standard Installer recommended).
   - Ensure `pdflatex` is in your System PATH.
   - Run `pdflatex --version` in your terminal to verify.
3. **Node.js:** v18 or higher.

## Installation & Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd ResumeMaker
```

### 2. Backend Setup
```bash
cd server
npm install
node index.js
```
The server will run on `http://localhost:3001`.

### 3. Frontend Setup
```bash
cd client
npm install
npm run dev
```
The client will run on `http://localhost:5173`.

## Usage Guide

1. **Step 1: Candidate Overview:** Provide your general background, skills, and experience. This is stored in memory for the current session.
2. **Step 2: Job Description:** Paste the text of the job posting you are targeting.
3. **Step 3: Generate & View:** The AI will draft the resume. 
   - **First Run Note:** MiKTeX may ask to install missing packages (e.g., `geometry`, `enumitem`). Select **"Install"** and check **"Always install missing packages on-the-fly"**.
4. **Refinement:** Use the "Request Alterations" box to tweak the output (e.g., "Add a stronger focus on React" or "Make the formatting more compact").

## Project Structure
- `/client`: React application (Vite).
- `/server`: Express server handling AI prompts and PDF compilation.
- `resume.pdf`: The last generated resume (auto-generated).
- `resume.tex`: The last generated LaTeX source (auto-generated).

## License
MIT
