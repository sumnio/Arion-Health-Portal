import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRouter from './app/AppRouter.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><AppRouter /></AuthProvider></BrowserRouter></React.StrictMode>,
);
