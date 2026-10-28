import { avatar, C, fillRound, font, interactionGlow, text, textFit, wrapLines } from '../uicanvas/draw.js';
import { bubble, composer, header, statusTicks } from '../uicanvas/chrome.js';

/**
 * Shared conversation-list + chat-view implementation for the simulated
 * messengers. Subclasses provide a theme and a ChatStore.
 *
 * All conversations are local simulations; sending only appends to the
 * in-browser ChatStore and never contacts anyone.
 */
export class ChatAppBase {
  constructor(shell, { id, title, store, theme }) {
    this.shell = shell;
    this.id = id;
    this.title = title;
    this.store = store;
    this.theme = theme;
    this.buffers = new Map();
    this.stick = { chatId: null, version: -1, inset: -1 };
  }

  onEnter(route) {
    if (route.view === 'chat') {
      this.store.markRead(route.params.id);
      this.stick.chatId = null; // force scroll-to-bottom on open
    }
  }

  animating(t) {
    const r = this.shell.router.current;
    return r.app === this.id && r.view === 'chat' && this.store.isTyping(r.params.id, t * 1000);
  }

  bufferFor(chatId) {
    let b = this.buffers.get(chatId);
    if (!b) {
      b = this.shell.createBuffer('');
      this.buffers.set(chatId, b);
    }
    return b;
  }

  render(ui, route, area, t) {
    const ctx = ui.ctx;
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (route.view === 'chat') this.renderChat(ui, route, area, t);
    else this.renderList(ui, area, t);
  }

  renderList(ui, area) {
    const ctx = ui.ctx;
    const th = this.theme;
    const hh = header(ui, area, {
      id: `${this.id}-list`,
      title: this.title,
      tint: th.header,
      titleColor: th.titleColor,
      actions: [{ id: 'more', icon: 'dots', onClick: () => this.shell.toast('Menu not simulated') }, { id: 'search', icon: 'search', onClick: () => this.shell.toast('Search not simulated') }],
    });
    let top = area.y + hh;
    if (th.tabs) {
      const tw = area.w / th.tabs.length;
      th.tabs.forEach((tab, i) => {
        text(ctx, tab, area.x + tw * i + tw / 2, top + 26, 14, i === 0 ? th.accent : C.dim, 600, 'center');
        if (i === 0) {
          ctx.fillStyle = th.accent;
          ctx.fillRect(area.x + tw * i + 16, top + 38, tw - 32, 3);
        }
      });
      top += 42;
    }
    ui.beginScroll(`${this.id}-list`, area.x, top, area.w, area.y + area.h - top);
    let y = 6;
    const rowH = 76;
    for (const chat of this.store.chats) {
      if (ui.visible(y, rowH)) {
        const st = ui.region(`${this.id}-row-${chat.id}`, 0, y, area.w, rowH, {
          onClick: () => this.shell.router.push('chat', { id: chat.id }),
        });
        interactionGlow(ctx, 6, y + 2, area.w - 12, rowH - 4, 12, st);
        avatar(ctx, chat.name, 42, y + rowH / 2, 26, chat.color);
        const last = chat.messages[chat.messages.length - 1];
        textFit(ctx, chat.name, 80, y + 32, area.w - 170, 16, C.text, 600);
        const timeCol = chat.unread ? th.accent : C.faint;
        text(ctx, chat.time || '', area.w - 16, y + 30, 12, timeCol, 500, 'right');
        let px = 80;
        if (last && last.from === 'me' && last.status) {
          statusTicks(ctx, px + 7, y + 51, last.status, th.read);
          px += 20;
        }
        const preview = last ? (last.author ? `${last.author}: ` : '') + last.text : '';
        textFit(ctx, preview, px, y + 56, area.w - px - 56, 14, C.dim);
        if (chat.unread) {
          ctx.beginPath();
          ctx.arc(area.w - 28, y + 50, 11, 0, Math.PI * 2);
          ctx.fillStyle = th.accent;
          ctx.fill();
          text(ctx, String(chat.unread), area.w - 28, y + 54.5, 12, '#04140c', 700, 'center');
        }
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(80, y + rowH - 1, area.w - 90, 1);
      }
      y += rowH;
    }
    text(ctx, 'Simulated conversations · stored only in this browser', area.w / 2, y + 30, 11, C.faint, 400, 'center');
    y += 60;
    ui.endScroll(y);
  }

  renderChat(ui, route, area, t) {
    const ctx = ui.ctx;
    const th = this.theme;
    const chat = this.store.getChat(route.params.id);
    if (!chat) {
      text(ctx, 'Conversation not found', area.w / 2, area.y + 100, 14, C.dim, 400, 'center');
      return;
    }
    const typing = this.store.isTyping(chat.id, t * 1000);
    const hh = header(ui, area, {
      id: `${this.id}-chat`,
      title: chat.name,
      subtitle: typing ? 'typing…' : chat.group ? 'Jonas, Mira, You' : 'online',
      subtitleColor: typing ? th.accent : C.dim,
      tint: th.header,
      back: true,
      onBack: () => this.shell.back(),
      avatar: { name: chat.name, color: chat.color },
      actions: [{ id: 'call', icon: 'phone', onClick: () => this.shell.toast('Calls are not simulated') }, { id: 'video', icon: 'video', onClick: () => this.shell.toast('Video calls are not simulated') }],
    });

    const buffer = this.bufferFor(chat.id);
    const send = () => this.send(chat.id, buffer);
    // Composer first (to know the remaining height), drawn on top later.
    const compH = 58 + this.shell.keyboardInset;
    const vy = area.y + hh;
    const vh = area.h - hh - compH;

    // Wallpaper doodle pattern
    if (th.pattern) {
      ctx.save();
      ctx.strokeStyle = 'rgba(120, 220, 200, 0.05)';
      for (let py = vy; py < vy + vh; py += 46) {
        for (let px = ((py / 46) % 2) * 23; px < area.w; px += 46) {
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    const scrollId = `${this.id}-chat-${chat.id}`;
    ui.beginScroll(scrollId, area.x, vy, area.w, vh);
    let y = 14;
    fillRound(ctx, area.w / 2 - 110, y, 220, 24, 12, 'rgba(255, 210, 120, 0.12)');
    text(ctx, '🔒 Simulated chat · nothing is sent', area.w / 2, y + 16, 11, '#ffd99a', 500, 'center');
    y += 40;
    for (const m of chat.messages) {
      const est = estimateBubbleHeight(ctx, m, area.w);
      if (ui.visible(y, est)) y += bubble(ctx, wrapLines, m, 0, area.w, y, th.bubbles) + 8;
      else y += est + 8;
    }
    if (typing) {
      fillRound(ctx, 10, y, 70, 34, 14, th.bubbles.theirs);
      for (let i = 0; i < 3; i++) {
        const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - i * 0.7));
        ctx.fillStyle = `rgba(220,240,255,${a})`;
        ctx.beginPath();
        ctx.arc(30 + i * 15, y + 17, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      y += 42;
    }
    y += 10;
    ui.endScroll(y);

    // Stick to the newest message when the conversation changes.
    const inset = Math.round(this.shell.keyboardInset);
    if (this.stick.chatId !== chat.id || this.stick.version !== this.store.version || this.stick.inset !== inset || typing) {
      ui.scrollState(scrollId).scrollTo(Infinity);
      this.stick = { chatId: chat.id, version: this.store.version, inset };
    }

    composer(ui, this.shell, `${this.id}-composer`, area, buffer, send, th.accent);
  }

  send(chatId, buffer) {
    const msg = this.store.send(chatId, buffer.text, this.shell.ui.time * 1000);
    if (!msg) {
      this.shell.toast('Type a message first');
      return;
    }
    buffer.clear();
    this.shell.keyboard.model.shift = true;
    this.shell.sound?.play('send');
  }
}

/** Cheap height estimate for off-screen bubbles (culling only). */
function estimateBubbleHeight(ctx, m, w) {
  const lines = wrapLines(ctx, m.text, w * 0.74 - 26, 15);
  ctx.font = font(15);
  return lines.length * 20 + 26 + (m.author ? 17 : 0);
}
