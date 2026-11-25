// Blinking "REC" favicon: the red dot flashes on/off like a camera's record light; the ring stays.
// (Browsers don't animate favicons themselves, so we swap the icon.)
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ring = '<circle cx="16" cy="16" r="13.5" fill="none" stroke="#ee4137" stroke-width="3"/>';
  const svg = (dot) => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${ring}${dot ? '<circle cx="16" cy="16" r="8" fill="#ee4137"/>' : ''}</svg>`);
  const ON = svg(true), OFF = svg(false);
  let link = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; link.type = 'image/svg+xml'; document.head.appendChild(link); }
  document.querySelectorAll('link[rel="icon"]:not([type="image/svg+xml"])').forEach(l => l.remove());   // so the PNG can't win
  let on = true;
  setInterval(() => { on = !on; link.href = on ? ON : OFF; }, 600);
})();
