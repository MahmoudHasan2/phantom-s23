import './styles/base.css';
import './styles/hologram.css';
import './styles/controls.css';
import { AppController } from './app/AppController.js';

const app = new AppController(document.getElementById('app')).init();

// Exposed for debugging from the DevTools console only (no network access).
window.__phantom = app;

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
