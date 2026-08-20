import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

/* StrictMode stays until step 4. When MeetingProvider mounts it has to come
   out: StrictMode runs effects twice in dev, so the meeting joins twice and
   this browser shows up as two participants. Removing it earlier would just
   hide the double-mount bugs it exists to surface. */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
