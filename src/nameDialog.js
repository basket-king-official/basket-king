// In-game name box (replaces the browser's prompt, whose colours differ per phone).
// Resolves with the typed name, or null if cancelled.
const STYLE_ID = 'bk-name-dialog-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .bk-overlay { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center;
      padding: 16px; background: rgba(10, 6, 25, 0.7); font-family: 'Poppins', system-ui, sans-serif; }
    .bk-box { width: 100%; max-width: 380px; background: #1a1030; border: 4px solid #ffd23f; border-radius: 22px;
      padding: 22px 20px 18px; box-shadow: 0 10px 0 rgba(0, 0, 0, 0.3); color: #fff; text-align: center; }
    .bk-box h2 { margin: 0 0 4px; font-size: 24px; font-weight: 800; color: #ffd23f; }
    .bk-box p { margin: 0 0 14px; font-size: 14px; color: #e6e0f5; }
    .bk-box input { width: 100%; box-sizing: border-box; font: 600 20px 'Poppins', system-ui, sans-serif; color: #fff;
      background: #2c2150; border: 3px solid #6d5fa3; border-radius: 14px; padding: 12px 14px; outline: none; text-align: center; }
    .bk-box input:focus { border-color: #ffd23f; }
    .bk-error { min-height: 20px; margin: 8px 0 4px; font-size: 14px; color: #ff6b7a; font-weight: 600; }
    .bk-row { display: flex; gap: 12px; margin-top: 6px; }
    .bk-row button { flex: 1; font: 800 18px 'Poppins', system-ui, sans-serif; padding: 12px 0; border-radius: 14px;
      border: 3px solid #0d0820; cursor: pointer; }
    .bk-cancel { background: #ffffff; color: #1a1030; }
    .bk-ok { background: #ffd23f; color: #3a1d00; }
    .bk-row button:disabled { opacity: 0.6; }
  `;
  document.head.appendChild(s);
}

// onSubmit(name) must return a promise; if it throws, the error is shown and the box stays open.
export function askName({ current = '', onSubmit }) {
  injectStyle();
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'bk-overlay';
    overlay.innerHTML = `
      <form class="bk-box" autocomplete="off">
        <h2>Your name</h2>
        <p>Shown on the leaderboard. 3–15 letters or numbers.</p>
        <input name="n" maxlength="15" enterkeyhint="done" />
        <div class="bk-error"></div>
        <div class="bk-row">
          <button type="button" class="bk-cancel">CANCEL</button>
          <button type="submit" class="bk-ok">SAVE</button>
        </div>
      </form>`;
    const form = overlay.querySelector('form');
    const input = overlay.querySelector('input');
    const error = overlay.querySelector('.bk-error');
    const ok = overlay.querySelector('.bk-ok');
    input.value = current;

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    // Keep taps inside the box from reaching the game canvas.
    ['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((ev) => overlay.addEventListener(ev, (e) => e.stopPropagation()));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector('.bk-cancel').addEventListener('click', () => close(null));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (name.length < 3) {
        error.textContent = 'Name must be 3 to 15 characters';
        return;
      }
      if (!/^[A-Za-z0-9 _.-]+$/.test(name)) {
        error.textContent = 'Use only letters, numbers, spaces, _ . -';
        return;
      }
      if (name === current) return close(null);
      ok.disabled = true;
      ok.textContent = 'SAVING…';
      error.textContent = '';
      try {
        await onSubmit(name);
        close(name);
      } catch (err) {
        error.textContent = err?.message || 'Could not save the name';
        ok.disabled = false;
        ok.textContent = 'SAVE';
      }
    });

    document.body.appendChild(overlay);
    setTimeout(() => input.focus(), 50);
  });
}
