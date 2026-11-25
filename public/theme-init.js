// Apply the saved appearance before the application paints. No credentials here.
try {
  const preference = localStorage.getItem('patra-color-scheme');
  document.documentElement.dataset.theme =
    preference === 'dark' ||
    (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
} catch {
  /* The app falls back to system appearance. */
}
