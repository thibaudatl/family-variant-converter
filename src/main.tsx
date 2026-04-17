import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (!document.getElementById('root')) {
  document.body.innerHTML = '<div id="root"></div>';
}

// Show a loader immediately while the React bundle initializes.
const preloader = document.createElement('div');
preloader.id = 'fvc-preloader';
preloader.setAttribute(
  'style',
  'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#f9fafb;z-index:50;'
);
preloader.innerHTML = `
  <div style="width:32px;height:32px;border:4px solid rgb(148,82,186);border-top-color:transparent;border-radius:9999px;animation:fvc-spin 1s linear infinite"></div>
  <div style="font-size:13px;color:#4b5563;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">Loading Change Family Variant...</div>
  <style>@keyframes fvc-spin{to{transform:rotate(360deg)}}</style>
`;
document.body.appendChild(preloader);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Remove the preloader once React has painted the first frame.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('fvc-preloader')?.remove();
  });
});
