import { ChatAppBase } from './ChatAppBase.js';

/** SMS-style simulated messages app (fictional conversations, local only). */
export class MessagesDemo extends ChatAppBase {
  constructor(shell) {
    super(shell, {
      id: 'messages',
      title: 'Messages',
      store: shell.services.chats.messages,
      theme: {
        bg: '#070d14',
        header: 'rgba(10, 22, 36, 0.95)',
        titleColor: '#e6f2ff',
        accent: '#4aa3ff',
        read: '#9fd0ff',
        tabs: null,
        pattern: false,
        bubbles: { mine: 'rgba(42, 111, 224, 0.92)', theirs: 'rgba(36, 48, 64, 0.95)', author: '#9fd0ff', read: '#cfe6ff' },
      },
    });
  }
}
