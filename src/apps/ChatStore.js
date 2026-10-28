/**
 * Local, simulated messaging model used by WhatsApp and Messages.
 *
 * Nothing here is ever transmitted anywhere. "Delivery" is an animation:
 * statuses advance on a timeline driven by update(nowMs), which keeps the
 * logic deterministic and unit-testable (no setTimeout).
 *
 * Status timeline for an outgoing message (ms after sending):
 *   0 sending -> 600 sent -> 1300 delivered -> 2600 read
 */
export const STATUS_STEPS = [
  { at: 600, status: 'sent' },
  { at: 1300, status: 'delivered' },
  { at: 2600, status: 'read' },
];

export class ChatStore {
  constructor({ chats = [], autoReplies = [], storage = null, storageKey = null, replyDelayMs = 3400 } = {}) {
    this.seed = clone(chats);
    this.autoReplies = autoReplies;
    this.storage = storage;
    this.storageKey = storageKey;
    this.replyDelayMs = replyDelayMs;
    this.replyIndex = 0;
    this.pending = []; // outgoing messages still animating
    this.typing = new Map(); // chatId -> reply due time
    this.chats = this.load() || clone(chats);
    this.version = 0; // bumps on any change (cheap dirty-check for renderers)
  }

  getChat(id) {
    return this.chats.find((c) => c.id === id) || null;
  }

  markRead(id) {
    const c = this.getChat(id);
    if (c && c.unread) {
      c.unread = 0;
      this.changed();
    }
  }

  /** Append an outgoing message. Returns the message or null for empty text. */
  send(chatId, text, nowMs, clock = formatTime(new Date())) {
    const body = String(text || '').trim();
    if (!body) return null;
    const chat = this.getChat(chatId);
    if (!chat) throw new Error(`Unknown chat ${chatId}`);
    const msg = { from: 'me', text: body, time: clock, status: 'sending', sentAt: nowMs, simulated: true };
    chat.messages.push(msg);
    chat.time = clock;
    // Move conversation to the top of the list, like real messengers.
    this.chats = [chat, ...this.chats.filter((c) => c !== chat)];
    this.pending.push(msg);
    if (this.autoReplies.length) this.typing.set(chatId, nowMs + this.replyDelayMs);
    this.changed();
    return msg;
  }

  isTyping(chatId, nowMs) {
    const due = this.typing.get(chatId);
    return due !== undefined && nowMs >= due - 1800 && nowMs < due;
  }

  /** Advance simulated delivery + auto replies. Returns true if anything changed. */
  update(nowMs) {
    let dirty = false;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const m = this.pending[i];
      const age = nowMs - m.sentAt;
      let status = 'sending';
      for (const step of STATUS_STEPS) if (age >= step.at) status = step.status;
      if (status !== m.status) {
        m.status = status;
        dirty = true;
      }
      if (status === 'read') this.pending.splice(i, 1);
    }
    for (const [chatId, due] of this.typing) {
      if (nowMs >= due) {
        this.typing.delete(chatId);
        const chat = this.getChat(chatId);
        if (chat) {
          const text = this.autoReplies[this.replyIndex++ % this.autoReplies.length];
          chat.messages.push({ from: 'them', text, time: formatTime(new Date()), simulated: true });
          dirty = true;
        }
      }
    }
    if (dirty) this.changed();
    return dirty;
  }

  reset() {
    this.chats = clone(this.seed);
    this.pending = [];
    this.typing.clear();
    this.changed();
  }

  changed() {
    this.version++;
    this.save();
  }

  load() {
    if (!this.storage || !this.storageKey) return null;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      // Any message persisted mid-animation is shown as delivered.
      for (const c of parsed) for (const m of c.messages || []) if (m.status === 'sending') m.status = 'delivered';
      return parsed;
    } catch {
      return null;
    }
  }

  save() {
    if (!this.storage || !this.storageKey) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.chats));
    } catch {
      /* ignore */
    }
  }
}

export function formatTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
