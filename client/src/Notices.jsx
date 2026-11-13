import { useEffect, useState } from 'react';
import { api } from './api.js';

const CATEGORIES = ['Announcement', 'Assignment', 'Event', 'Exam'];
const STAFF_ROLES = ['ADMIN', 'HEAD', 'DOS_REB', 'DOS_TVET', 'TRAINER'];
const trackLabel = track => track === 'TVT' ? 'TVET (L3SWD–L5SWD)'
  : track === 'NUR' ? 'Nursery' : track === 'PRI' ? 'Primary' : track === 'SEC' ? 'Secondary' : track;
const formatDate = value => value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const audienceLabel = item => item.audienceLevel || (item.audienceTrack ? trackLabel(item.audienceTrack) : 'Whole school');

export default function Notices({ user }) {
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [scope, setScope] = useState('school');
  const [track, setTrack] = useState('');
  const [level, setLevel] = useState('');
  const [form, setForm] = useState({ title: '', message: '', category: 'Announcement', dueAt: '' });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const canPublish = STAFF_ROLES.includes(user.role);
  const tracks = [...new Set(classes.map(item => item.track))];

  const load = () => api('/notices').then(setItems).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (canPublish) api('/classes').then(result => {
      setClasses(result);
      setTrack(result[0]?.track || '');
      setLevel(result[0]?.level || '');
    }).catch(e => setError(e.message));
    setScope(user.role === 'TRAINER' ? 'class' : 'school');
  }, [canPublish, user.role]);

  const publish = async event => {
    event.preventDefault();
    setError('');
    setStatus('');
    setSaving(true);
    try {
      await api('/notices', { method: 'POST', body: {
        ...form,
        scope,
        ...(scope === 'track' ? { track } : {}),
        ...(scope === 'class' ? { level } : {}),
        dueAt: form.dueAt || undefined,
      } });
      setForm({ title: '', message: '', category: 'Announcement', dueAt: '' });
      setStatus('Your notice has been published.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const acknowledge = async id => {
    setError('');
    try {
      await api(`/notices/${id}/read`, { method: 'POST' });
      setItems(current => current.map(item => item._id === id ? { ...item, isRead: true } : item));
    } catch (e) {
      setError(e.message);
    }
  };

  return <section className="noticesPage">
    <header className="noticesHeading">
      <div><span className="sectionEyebrow">SCHOOL COMMUNITY</span><h1>Notices &amp; calendar</h1>
        <p>School announcements, class updates, assignments, and important dates in one place.</p></div>
      <span className="noticesCount">{items.filter(item => !item.isRead).length}<small>unread</small></span>
    </header>
    {error && <p className="noticeFeedback noticeError" role="alert">{error}</p>}
    {status && <p className="noticeFeedback" role="status">{status}</p>}
    {canPublish && <form className="noticeComposer" onSubmit={publish}>
      <div className="noticeComposerHeading"><span className="sectionEyebrow">SHARE AN UPDATE</span><b>Create a school notice</b></div>
      <div className="noticeFormRow">
        <label>Type<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Audience<select value={scope} onChange={e => setScope(e.target.value)}>
          {user.role !== 'TRAINER' && <><option value="school">Whole school</option><option value="track">All classes in a track</option></>}
          <option value="class">One class or trade</option></select></label>
        {scope === 'track' && <label>Education track<select value={track} onChange={e => setTrack(e.target.value)}>{tracks.map(value => <option key={value} value={value}>{trackLabel(value)}</option>)}</select></label>}
        {scope === 'class' && <label>Class / trade<select value={level} onChange={e => setLevel(e.target.value)}>{classes.map(item => <option key={item.level} value={item.level}>{item.level} · {trackLabel(item.track)}</option>)}</select></label>}
        <label>{form.category === 'Event' || form.category === 'Exam' ? 'Date' : 'Due date'}<input type="date" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} /></label>
      </div>
      {scope === 'class' && <p className="noticeAudienceHint">Choose one class or trade, such as L5SWD or S3. Only that class will receive this notice.</p>}
      {scope === 'track' && <p className="noticeAudienceHint">All classes in the selected education track will receive this notice.</p>}
      <label className="noticeFullField">Title<input maxLength="120" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Give your notice a clear title" /></label>
      <label className="noticeFullField">Message<textarea maxLength="3000" required rows="4" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Share the details with your school community" /></label>
      {user.role === 'TRAINER' && !classes.length && <p className="noticeFeedback noticeError">Ask the administrator to assign your teaching classes before publishing notices.</p>}
      <button className="pri" type="submit" disabled={saving || (user.role === 'TRAINER' && !classes.length)}>{saving ? 'Publishing…' : 'Publish notice'}</button>
    </form>}
    <div className="noticeListHeading"><div><span className="sectionEyebrow">YOUR SCHOOL COMMUNITY</span><h2>Recent notices</h2></div><span>{items.length} shown</span></div>
    {items.length ? <div className="noticeList">{items.map(item => <article className={'noticeCard' + (item.isRead ? '' : ' unread')} key={item._id}>
      <div className="noticeCardTop"><span className={'noticeCategory category' + item.category}>{item.category}</span><span>{audienceLabel(item)}</span></div>
      <h3>{item.title}</h3><p className="noticeMessage">{item.message}</p>
      <div className="noticeMeta"><span>Posted by {item.postedBy || 'School staff'} · {formatDate(item.createdAt)}</span>
        {item.dueAt && <b>{item.category === 'Event' || item.category === 'Exam' ? 'Date' : 'Due'}: {formatDate(item.dueAt)}</b>}
      </div>
      {!item.isRead && <button className="noticeReadButton" onClick={() => acknowledge(item._id)}>Mark as read</button>}
    </article>)}</div> : <div className="noticeEmpty">There are no notices to show yet.</div>}
  </section>;
}
