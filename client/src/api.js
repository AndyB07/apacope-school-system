const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export async function api(path, opts = {}) {
  const r = await fetch(API_BASE_URL + path, { ...opts, headers: { 'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('token') }, body: opts.body && JSON.stringify(opts.body) });
  const contentType = r.headers.get('content-type') || '';
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    if (r.status === 404) {
      throw new Error('The school API returned 404 for this route. Restart the API using the current server code, then reload this page.');
    }
    throw new Error(`The API returned a non-JSON response (${r.status}). Check that VITE_API_BASE_URL points to the school API and that /api requests are routed to it.`);
  }
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 403 && d.error === 'Change your temporary password before continuing.') {
      window.dispatchEvent(new Event('auth:password-change-required'));
    }
    throw new Error(d.error || 'Error');
  }
  return d;
}
