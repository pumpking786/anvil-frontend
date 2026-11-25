// Keep application revisions separate from CDN content-encoding validators.
export function workspaceRevision(headers: Headers): string {
  const revision = headers.get('X-Patra-Revision');
  if (revision !== null) {
    if (/^(0|[1-9]\d*)$/.test(revision)) return `"${revision}"`;
    throw new Error('The API returned an invalid workspace revision. Reconnect before editing.');
  }
  const tag = headers.get('ETag');
  // Compatibility with an older Patra backend behind compression. Only numeric
  // Patra revision tags can be recovered; arbitrary weak ETags remain invalid.
  if (tag && /^W\/"(0|[1-9]\d*)"$/.test(tag)) return tag.slice(2);
  if (tag && /^"[^"\u0000-\u0020\u007f]+"$/.test(tag)) return tag;
  throw new Error('The API must expose X-Patra-Revision or a valid ETag through CORS.');
}
