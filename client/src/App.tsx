import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

interface Experience {
  id: string;
  dates: string;
  title: string;
  company: string;
  location: string;
  description: string;
}

interface Education {
  id: string;
  dates: string;
  degree: string;
  school: string;
  location: string;
  details: string;
}

interface CandidateData {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  linkedin: string;
  github: string;
  portfolio: string;
  skills: string;
  experience: Experience[];
  education: Education[];
}

const defaultCandidate: CandidateData = {
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

function App() {
  const [candidate, setCandidate] = useState<CandidateData>(defaultCandidate)
  const [jobDescription, setJobDescription] = useState('')
  const [latex, setLatex] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: Profile, 2: Job Details, 3: View/Alter

  useEffect(() => {
    axios.get('http://localhost:3001/api/overview')
      .then(res => {
        if (res.data) setCandidate(res.data)
      })
      .catch(err => console.error('Failed to load profile', err))
  }, [])

  const saveProfile = async () => {
    try {
      await axios.post('http://localhost:3001/api/overview', candidate)
      alert('Profile saved successfully!')
    } catch (err) {
      alert('Failed to save profile')
    }
  }

  const handleCandidateChange = (field: keyof CandidateData, value: any) => {
    setCandidate(prev => ({ ...prev, [field]: value }));
  }

  // --- Dynamic Experience Handlers ---
  const addExperience = () => {
    const newJob: Experience = {
      id: Date.now().toString(),
      dates: '',
      title: '',
      company: '',
      location: '',
      description: ''
    };
    handleCandidateChange('experience', [...candidate.experience, newJob]);
  }

  const removeExperience = (id: string) => {
    handleCandidateChange('experience', candidate.experience.filter(j => j.id !== id));
  }

  const updateExperience = (id: string, field: keyof Experience, value: string) => {
    handleCandidateChange('experience', candidate.experience.map(j => j.id === id ? { ...j, [field]: value } : j));
  }

  // --- Dynamic Education Handlers ---
  const addEducation = () => {
    const newEdu: Education = {
      id: Date.now().toString(),
      dates: '',
      degree: '',
      school: '',
      location: '',
      details: ''
    };
    handleCandidateChange('education', [...candidate.education, newEdu]);
  }

  const removeEducation = (id: string) => {
    handleCandidateChange('education', candidate.education.filter(e => e.id !== id));
  }

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    handleCandidateChange('education', candidate.education.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  const nextStep = async () => {
    await saveProfile();
    setStep(2);
  }

  const generateResume = async (alterations?: string) => {
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:3001/api/generate-resume', { 
        jobDescription, 
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
            <h2>Step 1: Candidate Profile</h2>
            <div className="button-group">
              <button className="secondary" onClick={saveProfile}>Save Profile</button>
              <button onClick={nextStep} disabled={!candidate.firstName || !candidate.lastName}>Next</button>
            </div>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>First Name</label>
              <input value={candidate.firstName} onChange={e => handleCandidateChange('firstName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input value={candidate.lastName} onChange={e => handleCandidateChange('lastName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input value={candidate.city} onChange={e => handleCandidateChange('city', e.target.value)} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input value={candidate.state} onChange={e => handleCandidateChange('state', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={candidate.phone} onChange={e => handleCandidateChange('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={candidate.email} onChange={e => handleCandidateChange('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>LinkedIn (URL/Handle)</label>
              <input value={candidate.linkedin} onChange={e => handleCandidateChange('linkedin', e.target.value)} />
            </div>
            <div className="form-group">
              <label>GitHub (URL/Handle)</label>
              <input value={candidate.github} onChange={e => handleCandidateChange('github', e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label>Portfolio Website</label>
              <input value={candidate.portfolio} onChange={e => handleCandidateChange('portfolio', e.target.value)} />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Exhaustive Skills List</label>
            <textarea 
              value={candidate.skills} 
              onChange={e => handleCandidateChange('skills', e.target.value)}
              rows={5}
              placeholder="List all your skills here..."
            />
          </div>

          {/* Dynamic Experience Section */}
          <div className="section-header">
            <h3>Work Experience</h3>
            <button className="small-button" onClick={addExperience}>+ Add Job</button>
          </div>
          {candidate.experience.map((job) => (
            <div key={job.id} className="nested-form card">
              <div className="header-row">
                 <h4>{job.company || 'New Entry'}</h4>
                 <button className="danger" onClick={() => removeExperience(job.id)}>Remove</button>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Dates</label><input value={job.dates} onChange={e => updateExperience(job.id, 'dates', e.target.value)} placeholder="e.g. Aug 2021--Aug 2024"/></div>
                <div className="form-group"><label>Job Title</label><input value={job.title} onChange={e => updateExperience(job.id, 'title', e.target.value)}/></div>
                <div className="form-group"><label>Company</label><input value={job.company} onChange={e => updateExperience(job.id, 'company', e.target.value)}/></div>
                <div className="form-group"><label>Location</label><input value={job.location} onChange={e => updateExperience(job.id, 'location', e.target.value)}/></div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea value={job.description} onChange={e => updateExperience(job.id, 'description', e.target.value)} rows={4} placeholder="Detail your achievements..."/>
                </div>
              </div>
            </div>
          ))}

          {/* Dynamic Education Section */}
          <div className="section-header">
            <h3>Education</h3>
            <button className="small-button" onClick={addEducation}>+ Add Education</button>
          </div>
          {candidate.education.map((edu) => (
            <div key={edu.id} className="nested-form card">
              <div className="header-row">
                 <h4>{edu.school || 'New Entry'}</h4>
                 <button className="danger" onClick={() => removeEducation(edu.id)}>Remove</button>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Date</label><input value={edu.dates} onChange={e => updateEducation(edu.id, 'dates', e.target.value)}/></div>
                <div className="form-group"><label>Degree</label><input value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)}/></div>
                <div className="form-group"><label>School</label><input value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)}/></div>
                <div className="form-group"><label>Location</label><input value={edu.location} onChange={e => updateEducation(edu.id, 'location', e.target.value)}/></div>
                <div className="form-group full-width">
                  <label>Details</label>
                  <textarea value={edu.details} onChange={e => updateEducation(edu.id, 'details', e.target.value)} rows={2} placeholder="GPA, Honors, Minor..."/>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>Step 2: Job Description</h2>
          <div className="form-group full-width">
            <textarea 
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={15}
            />
          </div>
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
            <h2>Generated Resume</h2>
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
                rows={4}
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
