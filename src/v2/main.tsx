/**
 * WorldMonitor — Intelligence Platform
 * Entry point.
 */
import './tailwind.css';
import './osint.css';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app');

createRoot(root).render(<App />);
