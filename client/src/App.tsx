import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [overview, setOverview] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [latex, setLatex] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: Overview, 2: Job Description, 3: View/Alter

  useEffect(() => {
    // Fetch saved overview on load
    axios.get('http://localhost:3001/api/overview')
      .then(res => {
        if (res.data.overview) setOverview(res.data.overview)
      })
      .catch(err => console.error('Failed to load overview', err))
  }, [])

  const submitOverview = async () => {
    try {
      await axios.post('http://localhost:3001/api/overview', { overview })
      setStep(2)
    } catch (err) {
      alert('Failed to save overview')
    }
  }

  const generateResume = async (alterations?: string) => {
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:3001/api/generate-resume', { 
        jobDescription, 
        companyName,
        alterations 
      })
      setLatex(res.data.latex)
      setPdfUrl(`${res.data.pdfUrl}&t=${new Date().getTime()}`)
      setStep(3)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate resume')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Resume Maker AI</h1>
      
      {step === 1 && (
        <div className="card">
          <div className="header-row">
            <h2>Step 1: Candidate Overview</h2>
            <button className="secondary" onClick={async () => {
               await axios.post('http://localhost:3001/api/overview', { overview });
               alert('Overview saved to server!');
            }}>Save to File</button>
          </div>
          <textarea 
            placeholder="Paste your experience, skills, and background here..."
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={15}
          />
          <button onClick={submitOverview} disabled={!overview}>Next</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>Step 2: Job Details</h2>
          <input 
            type="text" 
            placeholder="Target Company (e.g., Google)" 
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="company-input"
          />
          <textarea 
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={10}
          />
          <div className="button-group">
            <button onClick={() => setStep(1)}>Back</button>
            <button onClick={() => generateResume()} disabled={!jobDescription || loading}>
              {loading ? 'Generating...' : 'Generate Resume'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card result-container">
          <div className="preview-header">
            <h2>{companyName || 'Company'} Resume</h2>
            <div className="button-group">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="button">Open in New Tab</a>
              <button onClick={() => setStep(2)}>New Job Description</button>
            </div>
          </div>

          <div className="resume-layout">
            <div className="pdf-viewer">
              {loading ? (
                <div className="loading-spinner">Regenerating PDF...</div>
              ) : (
                <iframe src={pdfUrl} title="Resume Preview" width="100%" height="750px" />
              )}
            </div>
            
            <div className="controls">
              <h3>Request Alterations</h3>
              <textarea 
                placeholder="e.g., Make it more focused on cloud architecture" 
                id="alt-input"
                rows={3}
              />
              <button onClick={() => {
                const el = document.getElementById('alt-input') as HTMLTextAreaElement;
                generateResume(el.value);
                el.value = '';
              }} disabled={loading}>
                {loading ? 'Processing...' : 'Apply Alteration'}
              </button>

              <div className="latex-toggle">
                <details>
                  <summary>View LaTeX Source</summary>
                  <pre className="latex-preview">{latex}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
