import { safeImageSource } from './imagePolicy.mjs';
// Formatting accepts text only. User HTML is escaped before applying the supported marks.
export const escapeEmail = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function formatEmailText(value) {
  return escapeEmail(value)
    .split('\n')
    .map((line) => {
      const content = line
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
      return /^- /.test(content) ? '&#8226; ' + content.slice(2) : content;
    })
    .join('<br>');
}
export function renderEmailContent(
  { message, signature = '', logo = '', color = '#243247', align = 'left', font = 'Arial' },
  imageSource = logo,
) {
  imageSource = /^cid:[a-zA-Z0-9@._-]+$/.test(imageSource)
    ? imageSource
    : safeImageSource(imageSource);
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#243247';
  const safeAlign = ['left', 'center', 'right'].includes(align) ? align : 'left';
  const safeFont = ['Arial', 'Georgia', 'Verdana'].includes(font) ? font : 'Arial';
  return `<div style="font-family:${safeFont},sans-serif;font-size:15px;line-height:1.65;color:${safeColor};text-align:${safeAlign}">${formatEmailText(message)}${signature ? `<div style="margin-top:24px">${formatEmailText(signature)}</div>` : ''}${imageSource ? `<div style="margin-top:12px"><img src="${escapeEmail(imageSource)}" alt="Signature logo" width="160" style="width:160px;max-width:100%;height:auto;border:0"></div>` : ''}</div>`;
}
