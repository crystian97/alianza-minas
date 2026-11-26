import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './lib/supabase';
import { errorMessage } from './lib/remote';

export type Profile = { id: string; display_name: string; role: 'admin' | 'staff' | 'player'; active: boolean };
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    try {
      const { data } = getSupabase().auth.onAuthStateChange((event, value) => { setSession(value); if(event==='PASSWORD_RECOVERY')setRecovering(true); if(event==='SIGNED_OUT')setRecovering(false); });
      return () => data.subscription.unsubscribe();
    } catch (cause) { setError(errorMessage(cause)); setSession(null); }
  }, []);
  useEffect(() => {
    let alive = true;
    if (!session) { setProfile(null); setResolved(null); return; }
    const id = session.user.id;
    void Promise.resolve(getSupabase().from('profiles').select('id,display_name,role,active').eq('id', id).single()).then(({ data, error: failure }) => {
      if (!alive) return;
      setProfile(failure ? null : data); setResolved(id); setError(failure ? errorMessage(failure) : '');
    }).catch(cause => { if (alive) { setProfile(null); setResolved(id); setError(errorMessage(cause)); } });
    return () => { alive = false; };
  }, [session?.user.id, session?.access_token, revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const currentProfile = session && profile?.id === session.user.id ? profile : null;
  return { session, profile: currentProfile, error, loading: session === undefined || Boolean(session && resolved !== session.user.id),
    refresh: () => setRevision(value => value + 1), recovering, finishRecovery:()=>setRecovering(false) };
}

export function Login({ auth, navigate }: { auth: ReturnType<typeof useAuth>; navigate: (path: string) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : errorMessage(error));
      setPassword(''); navigate('/time');
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <section className="login-section"><div className="eyebrow">ÁREA EXCLUSIVA DO TIME</div><h1>O nosso time.<br/><em>O nosso espaço.</em></h1>
    <div className="login-card"><h2>Entrar no Alianza</h2>{auth.loading ? <p role="status">Verificando acesso…</p> : auth.session ? <>
      {auth.profile?.active ? <button className="primary" onClick={() => navigate(auth.profile?.role === 'admin' ? '/admin' : '/time')}>Acessar {auth.profile.display_name}</button> : <p>Seu acesso precisa ser liberado pelo administrador.</p>}
      <button className="text-button" onClick={auth.refresh}>Verificar acesso novamente</button>
      <button className="text-button" onClick={async () => { const { error } = await getSupabase().auth.signOut({ scope: 'local' }); if (error) setError(errorMessage(error)); }}>Sair desta conta</button>
    </> : <form onSubmit={submit}><fieldset disabled={busy}><div className="form-grid"><label className="full-field">E-mail<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label><label className="full-field">Senha<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label></div><button className="primary">{busy ? 'Entrando…' : 'Entrar'}</button></fieldset><p>Use o e-mail e a senha cadastrados para o webapp. Para liberar ou recuperar o acesso, fale com o administrador.</p></form>}
      {(error || auth.error) && <p className="admin-error" role="alert">{error || auth.error}</p>}
      {!auth.session&&<><button className="text-button" onClick={()=>navigate('/cadastro')}>Solicitar acesso ao time</button><button className="text-button" onClick={()=>navigate('/esqueci-senha')}>Esqueci minha senha</button></>}
    </div></section>;
}
