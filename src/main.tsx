import App from '@/App';
import { createRoot } from 'react-dom/client';

import { StrictMode } from 'react';

import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
