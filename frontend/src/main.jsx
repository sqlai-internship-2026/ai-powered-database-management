import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { LanguageProvider } from './i18n'
import './index.css'

// The language wraps everything, including the sign-in screens: a reader who
// chose Turkish must not be told in English that Keycloak is unreachable.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
)
