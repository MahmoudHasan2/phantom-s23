/**
 * Pure keyboard logic: layouts, layers, shift handling and the text buffer.
 * Rendering and hit-testing live in VirtualKeyboard.js.
 */

const LETTER_ROWS = {
  qwertz: [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', 'ß'],
  ],
  qwerty: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ],
};

const SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '€', '&', '-', '+', '(', ')', '/', '%'],
  ['😊', '!', '"', ':', ';', '?', '*', "'"],
];

/** Builds the key definitions (without geometry) for a layout/layer. */
export function keyRows(layout = 'qwertz', layer = 'letters', shift = false) {
  const base = layer === 'symbols' ? SYMBOL_ROWS : LETTER_ROWS[layout] || LETTER_ROWS.qwertz;
  const ch = (c) => ({ id: `k_${c}`, type: 'char', value: shift && layer === 'letters' ? upper(c) : c, label: shift && layer === 'letters' ? upper(c) : c, w: 1 });
  const rows = [base[0].map(ch), base[1].map(ch)];
  const third = base[2].map(ch);
  rows.push([
    layer === 'letters'
      ? { id: 'shift', type: 'shift', label: '⇧', w: 1.5 }
      : { id: 'k_emoji2', type: 'char', value: '👍', label: '👍', w: 1.5 },
    ...third,
    { id: 'backspace', type: 'backspace', label: '⌫', w: 1.5 },
  ]);
  rows.push([
    { id: 'layer', type: 'layer', label: layer === 'letters' ? '?123' : 'ABC', w: 1.6 },
    { id: 'k_comma', type: 'char', value: ',', label: ',', w: 1 },
    { id: 'space', type: 'space', value: ' ', label: layout === 'qwertz' ? 'Leertaste' : 'space', w: 5 },
    { id: 'k_dot', type: 'char', value: '.', label: '.', w: 1 },
    { id: 'enter', type: 'enter', label: '⏎', w: 1.6 },
  ]);
  return rows;
}

function upper(c) {
  return c === 'ß' ? 'ẞ' : c.toUpperCase();
}

/**
 * Computes key rectangles inside (x, y, width, height). Rows are scaled so the
 * widest row fills the width; narrower rows are centred, like a phone keyboard.
 */
export function layoutKeys(rows, x, y, width, height, gap = 5) {
  const maxUnits = Math.max(...rows.map((r) => r.reduce((a, k) => a + k.w, 0)));
  const maxCount = Math.max(...rows.map((r) => r.length));
  const unit = (width - gap * (maxCount + 1)) / maxUnits;
  const rowH = (height - gap * (rows.length + 1)) / rows.length;
  const keys = [];
  rows.forEach((row, ri) => {
    const units = row.reduce((a, k) => a + k.w, 0);
    let rowW = units * unit + gap * (row.length - 1);
    // Rows with large special keys stretch to the full width.
    let u = unit;
    if (row.some((k) => k.type !== 'char') && rowW < width - gap * 2) {
      u = (width - gap * 2 - gap * (row.length - 1)) / units;
      rowW = width - gap * 2;
    }
    let kx = x + (width - rowW) / 2;
    const ky = y + gap + ri * (rowH + gap);
    for (const k of row) {
      const w = k.w * u;
      keys.push({ ...k, x: kx, y: ky, w, h: rowH });
      kx += w + gap;
    }
  });
  return keys;
}

/** Editable text with a caret. Handles emoji/surrogate pairs on backspace. */
export class TextBuffer {
  constructor(text = '') {
    this.text = text;
    this.caret = Array.from(text).length;
  }

  get chars() {
    return Array.from(this.text);
  }

  insert(str) {
    const c = this.chars;
    c.splice(this.caret, 0, ...Array.from(str));
    this.text = c.join('');
    this.caret += Array.from(str).length;
  }

  backspace() {
    if (this.caret === 0) return false;
    const c = this.chars;
    c.splice(this.caret - 1, 1);
    this.text = c.join('');
    this.caret--;
    return true;
  }

  clear() {
    this.text = '';
    this.caret = 0;
  }

  setCaret(i) {
    this.caret = Math.max(0, Math.min(this.chars.length, i));
  }

  /** Text before the caret (for caret positioning when rendering). */
  get beforeCaret() {
    return this.chars.slice(0, this.caret).join('');
  }
}

/**
 * Keyboard state machine. press(key, buffer) mutates the buffer and returns
 * { action: 'insert'|'delete'|'enter'|'shift'|'layer'|'none', value? }.
 */
export class KeyboardModel {
  constructor(layout = 'qwertz') {
    this.layout = layout;
    this.layer = 'letters';
    this.shift = true; // auto-capitalise the first letter
    this.capsLock = false;
    this.lastShiftTime = -Infinity;
  }

  setLayout(layout) {
    this.layout = layout === 'qwerty' ? 'qwerty' : 'qwertz';
  }

  rows() {
    return keyRows(this.layout, this.layer, this.shift || this.capsLock);
  }

  press(key, buffer, now = 0) {
    switch (key.type) {
      case 'char': {
        buffer.insert(key.value);
        if (this.shift && !this.capsLock) this.shift = false;
        return { action: 'insert', value: key.value };
      }
      case 'space': {
        buffer.insert(' ');
        // Re-enable shift after sentence end.
        if (/[.!?]\s$/.test(buffer.beforeCaret)) this.shift = true;
        return { action: 'insert', value: ' ' };
      }
      case 'backspace':
        buffer.backspace();
        if (buffer.caret === 0) this.shift = true;
        return { action: 'delete' };
      case 'enter':
        return { action: 'enter' };
      case 'shift': {
        // Double-tap shift within 400 ms toggles caps lock.
        if (now - this.lastShiftTime < 400) {
          this.capsLock = !this.capsLock;
          this.shift = this.capsLock;
        } else {
          this.capsLock = false;
          this.shift = !this.shift;
        }
        this.lastShiftTime = now;
        return { action: 'shift' };
      }
      case 'layer':
        this.layer = this.layer === 'letters' ? 'symbols' : 'letters';
        return { action: 'layer' };
      default:
        return { action: 'none' };
    }
  }

  reset() {
    this.layer = 'letters';
    this.shift = true;
    this.capsLock = false;
  }
}
