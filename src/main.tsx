import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './figma-theme.css';
import './product-ui.css';
import './aida-screen-coverage.css';
import './internal-redesign.css';
import './unified-ui.css';
import './mental-diary-redesign.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
