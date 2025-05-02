import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { AppAuth0Provider } from './providers/Auth0Provider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppAuth0Provider>
    <App />
    </AppAuth0Provider>
  </React.StrictMode>,
)
