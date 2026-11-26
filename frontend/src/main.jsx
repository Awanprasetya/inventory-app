import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PermissionsProvider } from './context/PermissionsContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PermissionsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PermissionsProvider>
    </AuthProvider>
  </React.StrictMode>
);

