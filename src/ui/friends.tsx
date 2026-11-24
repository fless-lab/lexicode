// Amis : code à partager, demandes reçues et envoyées, liste. Le classement entre amis lit cette liste côté serveur.
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../engine/types';
import { FRIEND_STRINGS } from '../i18n-friends';
import { STRINGS } from '../i18n';
import { PUBLIC_URL, apiEnabled, ensureSession, friends, type FriendRow, type FriendsInfo } from '../services/api';
import type { Save } from '../storage';
import { sfx } from '../sound';
import { Icon } from './Icon';
import { Avatar, fm } from './multi';
import { Sub } from './screens';

type ToastFn = (text: string, kind?: 'info' | 'lvl' | 'ach', icon?: string, sub?: string) => void;

const profileOf = (s: Save) => ({ name: s.name, city: s.city, country: s.country });

export function Friends({ lang, save, back, toast, initialCode, onCount }: {
  lang: Lang;
  save: Save;
  back: () => void;
  toast: ToastFn;
  /** Code reçu par un lien ?ami=CODE : la demande part dès l'ouverture. */
  initialCode?: string;
  onCount: (n: number) => void;
}) {
  const F = FRIEND_STRINGS[lang];
  const t = STRINGS[lang];
  const [info, setInfo] = useState<FriendsInfo | null>(null);
  const [offline, setOffline] = useState(!apiEnabled);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const linkUsed = useRef(false);

  const load = async () => {
    try {
      if (!(await ensureSession(profileOf(save)))) throw new Error('offline');
      const i = await friends.list();
      setInfo(i);
      setOffline(false);
      onCount(i.incoming.length);
      return i;
    } catch {
      setOffline(true);
      return null;
    }
  };

  const add = async (raw: string) => {
    const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 6 || busy) return;
    setBusy(true);
    try {
      const r = await friends.add(c);
      sfx.tap();
      toast(r.status === 'sent' ? fm(F.sent, { n: r.name }) : r.status === 'accepted' ? fm(F.accepted, { n: r.name }) : F.already, r.status === 'accepted' ? 'lvl' : 'info', 'user');
      setCode('');
      await load();
    } catch (e) {
      const st = (e as { status?: number }).status;
      const msg = (e as Error).message;
      toast(st === 404 ? F.unknown : st === 400 && msg.includes('propre') ? F.own : st === 409 ? F.full : F.error, 'info', 'flag');
    } finally {
      setBusy(false);
    }
  };

  const act = async (f: FriendRow, action: 'accept' | 'decline' | 'remove') => {
    if (busy) return;
    setBusy(true);
    try {
      await friends.act(f.id, action);
      sfx.tap();
      if (action === 'accept') toast(fm(F.accepted, { n: f.name }), 'lvl', 'user');
      await load();
    } catch (e) {
      toast((e as { status?: number }).status === 409 ? F.full : F.error, 'info', 'flag');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  useEffect(() => {
    if (!apiEnabled) return;
    void load().then((i) => {
      if (i && initialCode && !linkUsed.current) {
        linkUsed.current = true;
        if (initialCode.toUpperCase() !== i.code) void add(initialCode);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = info ? `${PUBLIC_URL}?ami=${info.code}` : '';
  const share = async () => {
    if (!info) return;
    const text = fm(F.shareText, { c: info.code });
    try {
      if (navigator.share) {
        await navigator.share({ text, url: link });
        return;
      }
    } catch {
      /* partage annulé */
    }
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      toast(F.copied, 'info', 'copy');
    } catch {
      /* presse-papiers indisponible */
    }
  };

  const row = (f: FriendRow, i: number, actions: React.ReactNode) => (
    <li key={f.id}>
      <Avatar p={{ look: f.look ?? {}, color: i }} size={40} />
      <span className="who">{f.name}<small>{f.place}</small></span>
      <span className="acts">{actions}</span>
    </li>
  );

  return (
    <Sub title={F.title} back={back} backLabel={t.back}>
      <p className="muted">{F.sub}</p>
      {offline ? (
        <p className="demo-note">{F.offline}</p>
      ) : (
        <>
          <div className="friendcode">
            <small>{F.myCode}</small>
            <b>{info?.code ?? '······'}</b>
            <button className="btn gold sm" disabled={!info} onClick={share}><Icon name="send" size={16} /> {F.share}</button>
          </div>

          <form className="joinrow" onSubmit={(e) => { e.preventDefault(); void add(code); }}>
            <label>
              <span>{F.addLabel}</span>
              <input value={code} maxLength={6} placeholder={F.codePh} autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            </label>
            <button className="btn gold" disabled={code.length !== 6 || busy}>{F.add}</button>
          </form>

          {info && info.incoming.length > 0 && (
            <section className="sec">
              <h3>{F.incoming}</h3>
              <ul className="flist">
                {info.incoming.map((f, i) => row(f, i, (
                  <>
                    <button className="btn primary sm" disabled={busy} onClick={() => act(f, 'accept')}>{F.accept}</button>
                    <button className="btn ghost sm" disabled={busy} onClick={() => act(f, 'decline')}>{F.decline}</button>
                  </>
                )))}
              </ul>
            </section>
          )}

          <section className="sec">
            <h3>{F.list}{info && info.friends.length > 0 ? ` (${info.friends.length})` : ''}</h3>
            {info && info.friends.length === 0 && <p className="demo-note">{F.none}</p>}
            <ul className="flist">
              {info?.friends.map((f, i) => row(f, i, (
                confirm === f.id
                  ? <button className="btn ghost sm warn" disabled={busy} onClick={() => act(f, 'remove')}>{F.remove} ?</button>
                  : <button className="iconbtn" aria-label={F.remove} onClick={() => setConfirm(f.id)}><Icon name="close" size={18} /></button>
              )))}
            </ul>
          </section>

          {info && info.outgoing.length > 0 && (
            <section className="sec">
              <h3>{F.outgoing}</h3>
              <ul className="flist">{info.outgoing.map((f, i) => row(f, i, <Icon name="hourglass" size={18} />))}</ul>
            </section>
          )}
        </>
      )}
    </Sub>
  );
}
