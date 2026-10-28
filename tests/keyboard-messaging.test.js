import { describe, expect, it } from 'vitest';
import { KeyboardModel, keyRows, layoutKeys, TextBuffer } from '../src/keyboard/KeyboardModel.js';
import { keyAt } from '../src/interactions/HitTesting.js';
import { ChatStore } from '../src/apps/ChatStore.js';

const find = (model, label) => model.rows().flat().find((k) => k.label === label || k.value === label || k.id === label);

describe('Virtual keyboard', () => {
  it('defaults to QWERTZ with umlauts and can switch to QWERTY', () => {
    const qz = keyRows('qwertz');
    expect(qz[0].map((k) => k.value).join('')).toBe('qwertzuiopü');
    expect(qz[1].map((k) => k.value)).toContain('ä');
    const qy = keyRows('qwerty');
    expect(qy[0].map((k) => k.value).join('')).toBe('qwertyuiop');
  });

  it('types characters, auto-capitalises the first letter and handles backspace', () => {
    const kb = new KeyboardModel('qwertz');
    const buf = new TextBuffer();
    kb.press(find(kb, 'H'), buf);
    kb.press(find(kb, 'a'), buf);
    kb.press(find(kb, 'l'), buf);
    kb.press(find(kb, 'l'), buf);
    kb.press(find(kb, 'o'), buf);
    expect(buf.text).toBe('Hallo');
    kb.press(find(kb, 'backspace'), buf);
    expect(buf.text).toBe('Hall');
    expect(buf.caret).toBe(4);
  });

  it('supports space, punctuation, shift, caps lock and the symbol layer', () => {
    const kb = new KeyboardModel('qwerty');
    const buf = new TextBuffer();
    kb.shift = false;
    kb.press(find(kb, 'h'), buf);
    kb.press(find(kb, 'i'), buf);
    kb.press(find(kb, 'k_dot'), buf);
    kb.press(find(kb, 'space'), buf);
    expect(kb.shift).toBe(true); // sentence end re-enables shift
    kb.press(find(kb, 'O'), buf);
    kb.press(find(kb, 'k'), buf);
    expect(buf.text).toBe('hi. Ok');
    kb.press(find(kb, 'layer'), buf);
    kb.press(find(kb, '1'), buf);
    kb.press(find(kb, '!'), buf);
    expect(buf.text).toBe('hi. Ok1!');
    kb.press(find(kb, 'layer'), buf);
    kb.press(find(kb, 'shift'), buf, 1000);
    kb.press(find(kb, 'shift'), buf, 1200); // double tap -> caps lock
    expect(kb.capsLock).toBe(true);
    kb.press(find(kb, 'A'), buf);
    kb.press(find(kb, 'B'), buf);
    expect(buf.text.endsWith('AB')).toBe(true);
  });

  it('enter returns an enter action without inserting text', () => {
    const kb = new KeyboardModel();
    const buf = new TextBuffer('x');
    expect(kb.press(find(kb, 'enter'), buf).action).toBe('enter');
    expect(buf.text).toBe('x');
  });

  it('deletes emoji as a single character', () => {
    const buf = new TextBuffer('ok😊');
    buf.backspace();
    expect(buf.text).toBe('ok');
  });

  it('lays out keys without overlap inside the given area', () => {
    const keys = layoutKeys(keyRows('qwertz'), 0, 0, 442, 250);
    for (const k of keys) {
      expect(k.x).toBeGreaterThanOrEqual(0);
      expect(k.x + k.w).toBeLessThanOrEqual(442.01);
      expect(k.y + k.h).toBeLessThanOrEqual(250.01);
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i];
        const b = keys[j];
        const overlap = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
        expect(overlap).toBe(false);
      }
    }
  });

  it('enlarged hitboxes resolve to the nearest key and tolerate misses in the gap', () => {
    const keys = layoutKeys(keyRows('qwertz'), 0, 0, 442, 250);
    const q = keys.find((k) => k.value === 'q');
    const w = keys.find((k) => k.value === 'w');
    expect(keyAt(keys, q.x + q.w / 2, q.y + q.h / 2, 1).value).toBe('q');
    // A point in the gap between q and w, slightly closer to w.
    const gapX = (q.x + q.w + w.x) / 2 + 1;
    expect(keyAt(keys, gapX, q.y + q.h / 2, 1)).toBeNull();
    expect(keyAt(keys, gapX, q.y + q.h / 2, 1.3).value).toBe('w');
  });
});

describe('Simulated messaging', () => {
  const seed = [
    { id: 'a', name: 'Alice', messages: [{ from: 'them', text: 'hi', time: '09:00' }], unread: 1 },
    { id: 'b', name: 'Bob', messages: [] },
  ];

  it('appends an outgoing message and moves the chat to the top', () => {
    const store = new ChatStore({ chats: seed });
    const msg = store.send('b', '  Hello Bob  ', 0, '10:00');
    expect(msg.text).toBe('Hello Bob');
    expect(msg.status).toBe('sending');
    expect(store.chats[0].id).toBe('b');
    expect(store.getChat('b').messages).toHaveLength(1);
  });

  it('rejects empty messages', () => {
    const store = new ChatStore({ chats: seed });
    expect(store.send('a', '   ', 0)).toBeNull();
    expect(store.getChat('a').messages).toHaveLength(1);
  });

  it('advances delivery status on a timeline', () => {
    const store = new ChatStore({ chats: seed });
    const msg = store.send('a', 'yo', 1000);
    store.update(1500);
    expect(msg.status).toBe('sending');
    store.update(1700);
    expect(msg.status).toBe('sent');
    store.update(2400);
    expect(msg.status).toBe('delivered');
    store.update(3700);
    expect(msg.status).toBe('read');
  });

  it('produces a simulated auto reply with a typing phase', () => {
    const store = new ChatStore({ chats: seed, autoReplies: ['auto!'], replyDelayMs: 3000 });
    store.send('a', 'ping', 0);
    expect(store.isTyping('a', 500)).toBe(false);
    expect(store.isTyping('a', 2000)).toBe(true);
    store.update(3100);
    const last = store.getChat('a').messages.at(-1);
    expect(last).toMatchObject({ from: 'them', text: 'auto!', simulated: true });
  });

  it('marks chats read, persists locally and resets to the seed', () => {
    const m = new Map();
    const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    const store = new ChatStore({ chats: seed, storage, storageKey: 'k' });
    store.markRead('a');
    store.send('a', 'persist me', 0);
    const reloaded = new ChatStore({ chats: seed, storage, storageKey: 'k' });
    expect(reloaded.getChat('a').unread).toBe(0);
    expect(reloaded.getChat('a').messages.at(-1).text).toBe('persist me');
    reloaded.reset();
    expect(reloaded.getChat('a').messages).toHaveLength(1);
    expect(seed[0].messages).toHaveLength(1); // seed is never mutated
  });
});
