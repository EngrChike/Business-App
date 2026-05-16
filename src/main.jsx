import './index.css';
import './i18n/config'; 
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext'; 
import { LanguageProvider } from './context/LanguageContext'; // 1. Import Language Context

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      {/* 2. Wrap App with LanguageProvider so all sub-views listen to the toggle */}
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>,
);