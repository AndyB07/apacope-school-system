import { useState } from 'react';
import { api } from './api.js';

export default function AccountSettings({ onPasswordChanged }) {
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError(''); setStatus('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: {
        currentPassword: passwords.currentPassword, newPassword: passwords.newPassword,
      } });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatus('Your password has been changed.');
      onPasswordChanged?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <section className="operationsPage">
    <header className="operationsHeading"><div><span className="sectionEyebrow">ACCOUNT SECURITY</span>
      <h1>{onPasswordChanged ? 'Set a new password' : 'Account settings'}</h1>
      <p>{onPasswordChanged ? 'Your administrator issued a temporary password. Set a private password to unlock your workspace.' : 'Change your password regularly and keep it private.'}</p></div>
      <span className="operationsMark">GSA <i>✳</i></span></header>
    {error && <p className="operationFeedback operationError" role="alert">{error}</p>}
    {status && <p className="operationFeedback" role="status">{status}</p>}
    <section className="operationCard"><div className="operationCardHeading"><span className="sectionEyebrow">PASSWORD</span>
      <h2>Change your password</h2><p>Use at least 10 characters. Your current password is required.</p></div>
      <form className="operationForm" onSubmit={submit}>
        <label>Current password<input required type="password" autoComplete="current-password" value={passwords.currentPassword}
          onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label>
        <label>New password<input required type="password" minLength="10" maxLength="128" autoComplete="new-password" value={passwords.newPassword}
          onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} /></label>
        <label>Confirm new password<input required type="password" minLength="10" maxLength="128" autoComplete="new-password" value={passwords.confirmPassword}
          onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></label>
        <button className="pri" disabled={busy}>{busy ? 'Updating…' : 'Change password'}</button>
      </form>
    </section>
  </section>;
}
