/* =====================================================
 * WHATSAPP — a chat button in the bottom-right corner
 * =====================================================
 * Added to every page from one place, so the number and
 * the opening message only live here.
 * ===================================================== */

import './whatsapp.css';

const NUMBER = '919653217146'; // +91 96532 17146
const MESSAGE = "Hi Finlabs, I'd like to know more about your products and services.";

const button = document.createElement('a');
button.className = 'wa-float';
button.href = `https://wa.me/${NUMBER}?text=${encodeURIComponent(MESSAGE)}`;
button.target = '_blank';
button.rel = 'noopener';
button.setAttribute('aria-label', 'Chat with Finlabs on WhatsApp');
button.innerHTML =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5zm0 17.1a7.7 7.7 0 0 1-3.9-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 1 1 12 19.6zm4.2-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.3 6.3 0 0 1-3.1-2.7c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.5-.3z"/></svg>' +
  '<span class="wa-float__tip">Chat with us on WhatsApp</span>';
document.body.appendChild(button);
