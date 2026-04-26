import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './styles/tailwind.css';
import { router } from './router';
import { AuthProvider } from './auth/AuthProvider';
import { ThemeProvider } from './app/ThemeContext';
import { OfflineBanner } from './components/OfflineBanner';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <OfflineBanner />
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
