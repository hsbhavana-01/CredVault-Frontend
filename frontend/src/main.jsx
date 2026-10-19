import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ShieldCheck, FileCheck2, Search, Award, Files, ArrowRight, LockKeyhole,
  CheckCircle2, Clock3, XCircle, Fingerprint, Copy, RefreshCw, LogOut
} from 'lucide-react';
import './styles.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const states = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh','Puducherry'];
const emptyForm = { name: '', phone: '', gender: '', city: '', state: '' };

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${API_BASE}. Start the backend server and try again.`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.errors?.map(x => `${x.field}: ${x.message}`).join(' · ');
    throw new Error(detail || payload.message || `Request failed (${response.status}).`);
  }
  return payload;
}
function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}
function statusBadge(value) {
  const safe = (value || 'Unknown').toLowerCase();
  return <span className={`status ${safe}`}><i />{value || 'Unknown'}</span>;
}
function Field({ label, children }) {
  return <div className="field"><label>{label} <i>*</i></label>{children}</div>;
}
function Page({ title, desc, icon: Icon, children }) {
  return <div className="page"><div className="pageheading"><span className="pageicon"><Icon /></span><div><span className="eyebrow">CREDENTIAL SERVICES</span><h1>{title}</h1><p>{desc}</p></div></div>{children}</div>;
}
function Notice({ kind = 'success', children, onDismiss }) {
  return <div className={kind === 'error' ? 'notice errornotice' : 'notice'}>{kind === 'error' ? <XCircle /> : <CheckCircle2 />}{children}{onDismiss && <button onClick={onDismiss}>Dismiss</button>}</div>;
}
function App() {
  const [route, setRoute] = useState(window.location.pathname);
  const [token, setToken] = useState(() => sessionStorage.getItem('credvault_admin_token') || '');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [applicationId, setApplicationId] = useState('');
  const [login, setLogin] = useState({ username: '', password: '' });
  const [applications, setApplications] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState('success');
  const [search, setSearch] = useState('');

  function go(path) {
    window.history.pushState({}, '', path);
    setRoute(path); setQuery(''); setResult(null); setError(''); setNotice(''); setSearch('');
    window.scrollTo(0, 0);
  }
  function showNotice(message, kind = 'success') { setNotice(message); setNoticeKind(kind); }
  function signOut() {
    sessionStorage.removeItem('credvault_admin_token');
    setToken(''); setApplications([]); setCertificates([]); go('/admin/login');
  }

  useEffect(() => {
    const handlePop = () => { setRoute(window.location.pathname); setError(''); setNotice(''); };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (route.startsWith('/admin/') && route !== '/admin/login' && !token) {
      window.history.replaceState({}, '', '/admin/login');
      setRoute('/admin/login');
    }
  }, [route, token]);

  useEffect(() => {
    if (!token || !['/admin/applications', '/admin/certificates'].includes(route)) return;
    let cancelled = false;
    setLoading(true); setError('');
    const endpoint = route.endsWith('applications') ? '/admin/applications' : '/admin/certificates';
    api(endpoint, { token }).then(data => {
      if (cancelled) return;
      if (route.endsWith('applications')) setApplications(data.applications || []);
      else setCertificates(data.certificates || []);
    }).catch(err => {
      if (cancelled) return;
      if (/token|authentication|unauthorized|expired/i.test(err.message)) signOut();
      else setError(err.message);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [route, token]);

  async function submitApplication(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await api('/applications', { method: 'POST', body: form });
      setApplicationId(data.applicationId); setForm(emptyForm);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function lookup(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    const id = query.trim().replace(/^#/, '');
    try {
      const path = route === '/track'
        ? `/applications/track/${encodeURIComponent(id)}`
        : `/certificates/verify/${encodeURIComponent(id)}`;
      const data = await api(path);
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function adminLogin(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api('/admin/login', { method: 'POST', body: login });
      sessionStorage.setItem('credvault_admin_token', data.token);
      setToken(data.token); setLogin({ username: '', password: '' }); go('/admin/applications');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function changeApplication(application, action) {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await api(`/admin/applications/${encodeURIComponent(application.applicationId)}/${action}`, {
        method: 'PATCH', token, ...(action === 'reject' ? { body: {} } : {})
      });
      showNotice(action === 'approve'
        ? `${data.message}${data.certificateId ? ` Certificate ID: ${data.certificateId}` : ''}`
        : data.message);
      const refreshed = await api('/admin/applications', { token });
      setApplications(refreshed.applications || []);
      if (action === 'approve') {
        const certs = await api('/admin/certificates', { token });
        setCertificates(certs.certificates || []);
      }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function revokeCertificate(certificate) {
    if (!window.confirm(`Revoke certificate ${certificate.certificateId}? This changes its public verification status.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await api(`/admin/certificates/${encodeURIComponent(certificate.certificateId)}/revoke`, { method: 'PATCH', token });
      showNotice(data.message);
      const refreshed = await api('/admin/certificates', { token });
      setCertificates(refreshed.certificates || []);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const nav = (path, label, Icon) => <button className={`nav ${route === path ? 'active' : ''}`} onClick={() => go(path)}><Icon size={17} />{label}</button>;

  return <div className="app">
    <header>
      <button className="brand" onClick={() => go('/')}><span className="logo"><ShieldCheck /></span><span>CredVault<small>TRUSTED CREDENTIALS</small></span></button>
      <nav><button onClick={() => go('/track')}>Track application</button><button onClick={() => go('/verify')}>Verify certificate</button><button className="adminbtn" onClick={() => go(token ? '/admin/applications' : '/admin/login')}><LockKeyhole size={15} />{token ? 'Admin workspace' : 'Admin login'}</button></nav>
    </header>
    {route.startsWith('/admin/') && route !== '/admin/login' && token && <aside><label>WORKSPACE</label>{nav('/admin/applications', 'Applications', Files)}{nav('/admin/certificates', 'Certificates', Award)}<div className="asidebottom"><b><LockKeyhole size={13} /> Administrator</b><button onClick={signOut}><LogOut size={13} /> Sign out</button></div></aside>}
    <main className={route.startsWith('/admin/') && route !== '/admin/login' ? 'withside' : ''}>
      {route === '/' && <>
        <section className="hero"><div><span className="eyebrow"><i /> DIGITAL CREDENTIALS, REIMAGINED</span><h1>Proof of achievement.<br /><em>Built on trust.</em></h1><p>One simple place to request, manage, and verify certificates. Your achievements deserve proof that speaks for itself.</p><div className="actions"><button className="primary" onClick={() => go('/request')}>Request a certificate <ArrowRight size={16} /></button><button className="secondary" onClick={() => go('/verify')}><ShieldCheck size={16} /> Verify a certificate</button></div><div className="trust"><span><ShieldCheck size={15} /> Backend-connected records</span><span><Fingerprint size={15} /> Unique certificate IDs</span></div></div><div className="art"><div className="certificate"><div className="certbrand"><Award /> CREDVAULT <ShieldCheck /></div><small>CERTIFICATE OF ACHIEVEMENT</small><h2>Certificate of<br />Achievement</h2><p>Digitally issued credentials</p><h3>Verified by CredVault</h3><p>Check a certificate using its unique ID</p><b>Trusted · Traceable · Verifiable</b><div className="certfoot"><span>CredVault<br /><small>CREDENTIAL SERVICES</small></span><div className="qr">▦<br />▦</div></div><small>PUBLIC CERTIFICATE VERIFICATION</small></div><div className="float"><CheckCircle2 /><span><b>Database connected</b><small>Verify records in real time</small></span></div></div></section>
        <section className="stats"><div><Files /><b>Real-time</b><small>Application records</small></div><div><ShieldCheck /><b>Traceable</b><small>Certificate status</small></div><div><Clock3 /><b>Anytime</b><small>Public verification</small></div></section>
        <section className="section"><span className="eyebrow">GET STARTED</span><h2>Everything you need, <em>in one place.</em></h2><div className="features">{[['01',FileCheck2,'Request a certificate','Submit your details to create an application.','Start a request','/request'],['02',Search,'Track your application','Check your live application status by ID.','Track application','/track'],['03',ShieldCheck,'Verify a certificate','Look up a credential against the database.','Verify now','/verify']].map(([n, Icon, title, desc, button, path]) => <article key={n}><span className="ficon"><Icon /></span><small>{n}</small><h3>{title}</h3><p>{desc}</p><button onClick={() => go(path)}>{button} ↗</button></article>)}</div></section>
      </>}

      {route === '/request' && <Page title="Request a certificate" desc="Tell us a little about yourself. Your request will be saved securely." icon={FileCheck2}>
        {applicationId ? <div className="card success"><CheckCircle2 size={38} /><h2>Application submitted successfully!</h2><p>Your request was saved. Keep this real Application ID to track progress.</p><div className="idbox">APPLICATION ID <b>#{applicationId}</b><button onClick={() => navigator.clipboard?.writeText(applicationId)}><Copy size={14} /> Copy</button></div><button className="primary" onClick={() => { setQuery(applicationId); setApplicationId(''); go('/track'); setQuery(applicationId); }}>Track your application <ArrowRight size={16} /></button><button className="back" onClick={() => setApplicationId('')}>Submit another request</button></div> : <form className="card" onSubmit={submitApplication}>
          <h3>Applicant information</h3><p className="muted">Fields marked * are required.</p><div className="fields">
            <Field label="Full name"><input required minLength={2} maxLength={100} placeholder="e.g. Aarav Sharma" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone number"><input required type="tel" pattern="[+]?[0-9() -]{7,20}" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="City"><input required maxLength={80} placeholder="Your city" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="State / UT"><select required value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}><option value="">Select your state</option>{states.map(s => <option key={s}>{s}</option>)}</select></Field>
            <div className="field wide"><label>Gender *</label><div className="radios">{['Female','Male','Non-binary','Prefer not to say'].map(g => <label key={g}><input type="radio" name="gender" required checked={form.gender === g} onChange={() => setForm({ ...form, gender: g })} />{g}</label>)}</div></div>
          </div>{error && <Notice kind="error">{error}</Notice>}<div className="formfoot"><small>🔒 Your information is submitted to the CredVault backend.</small><button className="primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'} <ArrowRight size={16} /></button></div>
        </form>}
      </Page>}

      {(route === '/track' || route === '/verify') && <Page title={route === '/track' ? 'Track your application' : 'Verify a certificate'} desc={route === '/track' ? 'Check the latest status using your Application ID.' : 'Confirm a credential using its Certificate ID.'} icon={route === '/track' ? Search : ShieldCheck}>
        <form className="card lookup" onSubmit={lookup}><label>{route === '/track' ? 'Application ID' : 'Certificate ID'}</label><div className="lookuprow"><input required value={query} onChange={e => setQuery(e.target.value)} placeholder={route === '/track' ? 'e.g. APP-ABC123' : 'e.g. CERT-ABC123'} /><button className="primary" disabled={busy}>{busy ? 'Checking…' : route === '/track' ? 'Track application' : 'Verify certificate'} <ArrowRight size={16} /></button></div><small className="muted">Enter the ID exactly as it appears on your record.</small>{error && <Notice kind="error">{error}</Notice>}{result && <div className="result"><div className="resulttitle"><CheckCircle2 /><div><small>RECORD FOUND</small><h3>{result.name}</h3></div>{statusBadge(result.status)}</div><div className="details">{(route === '/track' ? [['Application ID', result.applicationId], ['Name', result.name], ['Status', result.status], ['Submission date', formatDate(result.submittedAt)], ...(result.rejectionReason ? [['Reason', result.rejectionReason]] : [])] : [['Certificate ID', result.certificateId], ['Name', result.name], ['Phone', result.phone], ['Issued on', formatDate(result.issuedOn)], ['Status', result.status]]).map(([label, value]) => <div key={label}><small>{label}</small><b>{value || '—'}</b></div>)}</div></div>}</form>
        <div className="help"><b>ⓘ {route === '/track' ? 'Where can I find my Application ID?' : 'What does verification mean?'}</b><p>{route === '/track' ? 'Your Application ID is shown after submitting a request. Use it to retrieve the latest status from the database.' : 'Certificate details and status are read from the backend database. A revoked certificate will be shown as Revoked.'}</p></div>
      </Page>}

      {route === '/admin/login' && <div className="loginlayout"><div className="loginintro"><span className="eyebrow">CREDVAULT ADMIN</span><h1>Good credentials.<br /><em>Better oversight.</em></h1><p>Manage certificate applications and keep every issued credential accountable from one secure workspace.</p><p>◈ Centralized management<br /><br />◈ Protected, traceable decisions</p></div><form className="card login" onSubmit={adminLogin}><span className="loginicon"><LockKeyhole /></span><span className="eyebrow">ADMINISTRATOR ACCESS</span><h2>Welcome back</h2><p className="muted">Sign in using the admin account configured in the backend.</p><Field label="Username"><input required autoComplete="username" value={login.username} onChange={e => setLogin({ ...login, username: e.target.value })} placeholder="Enter username" /></Field><Field label="Password"><input required type="password" autoComplete="current-password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} placeholder="Enter password" /></Field>{error && <Notice kind="error">{error}</Notice>}<button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={16} /></button><div className="demo"><b>Admin credentials</b><span>Use the credentials configured in the backend <code>.env</code> file.</span></div><button type="button" className="back" onClick={() => go('/')}>← Back to CredVault home</button></form></div>}

      {(route === '/admin/applications' || route === '/admin/certificates') && token && <>
        <div className="adminhead"><div><span className="eyebrow">ADMIN WORKSPACE / {route.endsWith('applications') ? 'APPLICATIONS' : 'CERTIFICATES'}</span><h1>{route.endsWith('applications') ? 'Applications' : 'Certificates'}</h1><p>{route.endsWith('applications') ? 'Review real requests and decide which credentials to issue.' : 'Manage issued credentials and their live status.'}</p></div><button className="secondary" onClick={() => go(route.endsWith('applications') ? '/admin/certificates' : '/admin/applications')}>{route.endsWith('applications') ? <Award size={16} /> : <Files size={16} />}{route.endsWith('applications') ? 'View certificates' : 'Applications'}</button></div>
        {notice && <Notice onDismiss={() => setNotice('')}>{notice}</Notice>}{error && <Notice kind="error">{error}</Notice>}
        <div className="metrics">{(route.endsWith('applications') ? [['Total applications', applications.length], ['Pending review', applications.filter(a => a.status === 'Pending').length], ['Approved', applications.filter(a => a.status === 'Approved').length], ['Rejected', applications.filter(a => a.status === 'Rejected').length]] : [['Total certificates', certificates.length], ['Valid certificates', certificates.filter(c => c.status === 'Valid').length], ['Revoked', certificates.filter(c => c.status === 'Revoked').length], ['Issued records', certificates.length]]).map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b><span>Live database records</span></div>)}</div>
        <div className="tablecard"><div className="tablehead"><div><h3>{route.endsWith('applications') ? 'All applications' : 'Issued certificates'} <span>{route.endsWith('applications') ? applications.length : certificates.length}</span></h3><p>Search records retrieved from the backend.</p></div><div className="tabletools"><input className="search" placeholder="Search records…" value={search} onChange={e => setSearch(e.target.value)} /><button className="secondary refresh" disabled={loading || busy} onClick={() => { setRoute(r => { const same = r; window.history.replaceState({}, '', same); return same; }); setLoading(true); const path = route.endsWith('applications') ? '/admin/applications' : '/admin/certificates'; api(path, { token }).then(data => route.endsWith('applications') ? setApplications(data.applications || []) : setCertificates(data.certificates || [])).catch(err => setError(err.message)).finally(() => setLoading(false)); }}><RefreshCw size={14} /> Refresh</button></div></div>
          {loading ? <div className="empty"><RefreshCw className="spin" /> Loading records from database…</div> : <div className="scroll"><table><thead><tr>{(route.endsWith('applications') ? ['Application ID','Name','Phone','Gender','City','State','Status','Action'] : ['Certificate ID','Application ID','Name','Phone','Issued On','Status','Action']).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>
            {route.endsWith('applications') ? applications.filter(a => `${a.name} ${a.applicationId} ${a.city} ${a.phone}`.toLowerCase().includes(search.toLowerCase())).map(a => <tr key={a.applicationId}><td><b className="id">{a.applicationId}</b><small>{formatDate(a.submittedAt)}</small></td><td><b>{a.name}</b></td><td>{a.phone}</td><td>{a.gender}</td><td>{a.city}</td><td>{a.state}</td><td>{statusBadge(a.status)}</td><td>{a.status === 'Pending' ? <div className="rowactions"><button className="issue" disabled={busy} onClick={() => changeApplication(a, 'approve')}>✓ Approve</button><button className="reject" disabled={busy} onClick={() => changeApplication(a, 'reject')}>× Reject</button></div> : '—'}</td></tr>) : certificates.filter(c => `${c.name} ${c.certificateId} ${c.applicationId} ${c.phone}`.toLowerCase().includes(search.toLowerCase())).map(c => <tr key={c.certificateId}><td><b className="id">{c.certificateId}</b></td><td>{c.applicationId}</td><td><b>{c.name}</b></td><td>{c.phone}</td><td>{formatDate(c.issuedOn)}</td><td>{statusBadge(c.status)}</td><td>{c.status === 'Valid' ? <button className="reject" disabled={busy} onClick={() => revokeCertificate(c)}>× Revoke</button> : 'Revoked'}</td></tr>)}
            </tbody></table>{!applications.length && route.endsWith('applications') && <div className="empty">No applications in the database yet.</div>}{!certificates.length && route.endsWith('certificates') && <div className="empty">No certificates have been issued yet.</div>}</div>}
        </div>
      </>}
      {!['/','/request','/track','/verify','/admin/login','/admin/applications','/admin/certificates'].includes(route) && <div className="card not-found"><h2>Page not found</h2><button className="primary" onClick={() => go('/')}>Return home</button></div>}
      <footer><button onClick={() => go('/')}><ShieldCheck size={18} /> CredVault</button><span>© 2026 CredVault · A little more certainty, every day.</span><div><button onClick={() => go('/verify')}>Verify</button><button onClick={() => go(token ? '/admin/applications' : '/admin/login')}>Admin</button></div></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
