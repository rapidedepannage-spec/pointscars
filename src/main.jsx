import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

// TODO: importer App une fois les composants convertis en JSX
// import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{
      background: '#0F172A',
      color: '#E2E8F0',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <p>Migration Vite en cours. Ouvrir <code>gestion-sinistres.html</code> pour la version actuelle.</p>
    </div>
  </React.StrictMode>
)
