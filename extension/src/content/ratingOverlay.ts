// Plain DOM, no React — keeps this content-script bundle small. MV3 gives no way
// for a background/content script to programmatically open the toolbar popup
// (see DECISIONS.md), so the "post-submission quality popup" is actually this:
// a small floating card injected into the LeetCode page itself, right after a
// verdict is captured. Auto-dismisses after ~20s if ignored — quality stays
// NULL, an already-valid, schema-supported state.
const AUTO_DISMISS_MS = 20_000;
const OVERLAY_ID = 'codereps-rating-overlay';

export function showRatingOverlay(onRate: (quality: number) => void): void {
  // Only one overlay at a time — a fast resubmission while one is still
  // showing replaces it rather than stacking.
  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    background: #1c1c1c; color: #fff; padding: 12px 16px; border-radius: 10px;
    font-family: system-ui, sans-serif; font-size: 13px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    display: flex; flex-direction: column; gap: 8px; align-items: stretch;
  `;

  const label = document.createElement('span');
  label.textContent = 'CodeReps — how did that feel?';
  overlay.appendChild(label);

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display: flex; gap: 4px;';

  let dismissTimer: ReturnType<typeof setTimeout>;
  const dismiss = () => {
    clearTimeout(dismissTimer);
    overlay.remove();
  };

  for (let quality = 1; quality <= 5; quality++) {
    const button = document.createElement('button');
    button.textContent = String(quality);
    button.style.cssText = `
      flex: 1; padding: 6px 0; border-radius: 6px; border: none; cursor: pointer;
      background: #333; color: #fff; font-weight: 600;
    `;
    button.addEventListener('click', () => {
      onRate(quality);
      dismiss();
    });
    buttonRow.appendChild(button);
  }
  overlay.appendChild(buttonRow);

  document.body.appendChild(overlay);
  dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS);
}
