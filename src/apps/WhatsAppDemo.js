import { ChatAppBase } from './ChatAppBase.js';

/** WhatsApp-inspired simulated messenger (fictional contacts, local only). */
export class WhatsAppDemo extends ChatAppBase {
  constructor(shell) {
    super(shell, {
      id: 'whatsapp',
      title: 'WhatsApp',
      store: shell.services.chats.whatsapp,
      theme: {
        bg: '#0b141a',
        header: 'rgba(17, 32, 40, 0.95)',
        titleColor: '#e9edef',
        accent: '#25d366',
        read: '#53bdeb',
        tabs: ['Chats', 'Updates', 'Calls'],
        pattern: true,
        bubbles: { mine: 'rgba(0, 92, 75, 0.92)', theirs: 'rgba(32, 44, 51, 0.95)', author: '#53bdeb', read: '#53bdeb' },
      },
    });
  }
}
