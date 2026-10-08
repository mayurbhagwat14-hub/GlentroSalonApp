import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Firebase glentro-195f2 active
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
