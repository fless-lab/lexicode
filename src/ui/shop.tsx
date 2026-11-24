// Boutique, garde-robe de Loupi, événements saisonniers, packs de grilles et archives.
import { useState, type CSSProperties } from 'react';
import type { Lang } from '../engine/types';
import type { Strings } from '../i18n';
import type { Save } from '../storage';
import { Icon } from './Icon';
import { Loupi, type Outfit } from './mascot';
import { Scene, type SceneKind } from './scenes';
import { daysLeft, type SeasonalEvent } from '../events';
import { sfx } from '../sound';
import { SHOP_STRINGS, fmtS, type ShopStrings } from '../i18n-shop';
import { ITEMS, BUNDLES, TOKEN_PACKS, owns, grant, item, weeklyShowcase, outfitOf, type Item, type ItemKind } from '../catalog';
import { SKUS, buy, priceOf, restore, isDemoStore, type Sku } from '../services/billing';
import { weekKey, levelProgress } from '../progress';
import { PACK_PHRASES } from '../content/extra';

type SetSave = React.Dispatch<React.SetStateAction<Save>>;
type Toast = (m: string, kind?: 'ach' | 'lvl' | 'info', icon?: string, sub?: string) => void;

export interface ShopCtx { save: Save; setSave: SetSave; lang: Lang; t: Strings; toast: Toast }

// ---------------- Actions ----------------

const slot = (k: ItemKind) => (k === 'skin' ? 'skin' : k);
const equipIn = (s: Save, i: Item): Save =>
  i.kind === 'skin' ? { ...s, skin: i.value as Save['skin'] } : i.kind === 'pack' ? s : { ...s, equip: { ...s.equip, [slot(i.kind)]: i.value } };
const isEquipped = (s: Save, i: Item) => (i.kind === 'skin' ? s.skin === i.value : (s.equip as Record<string, string | undefined>)[slot(i.kind)] === i.value);

function useShop({ save, setSave, lang, toast }: ShopCtx) {
  const S = SHOP_STRINGS[lang];
  const [busy, setBusy] = useState<string | null>(null);

  const equip = (i: Item) => {
    sfx.tap();
    setSave((s) => equipIn(s, i));
  };

  const pay = async (key: string, sku: Sku, onOk: (s: Save) => Save, label: string) => {
    if (busy) return;
    setBusy(key);
    const r = await buy(sku);
    setBusy(null);
    if (r === 'ok') {
      setSave((s) => onOk(s));
      sfx.unlock();
      toast(fmtS(S.bought, { x: label }), 'lvl', 'gift');
    } else toast(r === 'cancelled' ? S.cancelled : S.failed, 'info', 'close');
  };

  const buyItem = (i: Item, via: 'tokens' | 'sku' = i.tokens ? 'tokens' : 'sku') => {
    if (owns(save, i.id)) return equip(i);
    if (via === 'tokens' && i.tokens) {
      if (i.minLevel && levelProgress(save.xp).level < i.minLevel) return toast(fmtS(S.levelReq, { n: i.minLevel }), 'info', 'lock');
      if (save.tokens < i.tokens) return toast(S.notEnough, 'info', 'token');
      sfx.coin();
      setSave((s) => equipIn(grant({ ...s, tokens: s.tokens - i.tokens! }, [i.id]), i));
      toast(fmtS(S.bought, { x: i.name[lang] }), 'lvl', 'gift');
      return;
    }
    if (i.sku) return pay(i.id, i.sku, (s) => equipIn(grant(s, [i.id]), i), i.name[lang]);
  };

  const buyBundle = (b: (typeof BUNDLES)[number], label: string) =>
    pay(b.sku.id, b.sku, (s) => {
      let n = grant(s, b.items);
      if (b.tokens) n = { ...n, tokens: n.tokens + b.tokens };
      if (b.boosters) n = { ...n, boosters: Object.fromEntries(Object.entries(n.boosters).map(([k, v]) => [k, v + b.boosters!])) as Save['boosters'] };
      if (b.once) n = { ...n, starterBought: true };
      return n;
    }, label);

  const buyTokens = (p: (typeof TOKEN_PACKS)[number]) => pay(p.sku.id, p.sku, (s) => ({ ...s, tokens: s.tokens + p.tokens }), `${p.tokens}`);
  const buyPlus = (sku: Sku) => pay(sku.id, sku, (s) => ({ ...s, premium: true }), S.plusTitle);

  const restoreAll = async () => {
    const r = await restore();
    if (!r) return toast(S.demo, 'info', 'rotate');
    setSave((s) => {
      let n = { ...s, premium: s.premium || r.plus };
      for (const id of r.permanent) {
        const it = ITEMS.find((x) => x.sku?.id === id);
        if (it) n = grant(n, [it.id]);
        const b = BUNDLES.find((x) => x.sku.id === id);
        if (b) n = { ...grant(n, b.items), starterBought: n.starterBought || !!b.once };
      }
      return n;
    });
    toast(S.restored, 'info', 'check');
  };

  return { equip, buyItem, buyBundle, buyTokens, buyPlus, restoreAll, busy };
}

function lockLabel(ctx: ShopCtx, i: Item): string {
  const S = SHOP_STRINGS[ctx.lang];
  const u = i.unlock!;
  if ('chapter' in u) return fmtS(S.lockChapter, { n: u.chapter });
  if ('league' in u) return fmtS(S.lockLeague, { x: ctx.t.leagueNames[u.league] });
  if ('event' in u) return S.lockEvent;
  return S.lockAdventure;
}

/** Étiquette d'état ou bouton d'achat d'un objet. */
function Action({ ctx, i, shop }: { ctx: ShopCtx; i: Item; shop: ReturnType<typeof useShop> }) {
  const S = SHOP_STRINGS[ctx.lang];
  if (i.soon) return <span className="ptag lock">{S.soon}</span>;
  if (owns(ctx.save, i.id)) {
    if (i.kind === 'pack') return <span className="ptag own">{S.owned}</span>;
    return isEquipped(ctx.save, i) ? <span className="ptag eq"><Icon name="check" size={14} />{S.equipped}</span> : <button className="ptag own" onClick={() => shop.equip(i)}>{S.equip}</button>;
  }
  if (i.unlock) return <span className="ptag lock"><Icon name="lock" size={13} />{lockLabel(ctx, i)}</span>;
  const locked = !!i.minLevel && levelProgress(ctx.save.xp).level < i.minLevel;
  if (i.tokens && i.sku)
    return (
      <span className="ptags">
        <button className="ptag tok" onClick={() => shop.buyItem(i, 'tokens')}><Icon name="token" size={15} />{i.tokens}</button>
        <button className="ptag eur" disabled={shop.busy === i.id} onClick={() => shop.buyItem(i, 'sku')}>{shop.busy === i.id ? '…' : priceOf(i.sku)}</button>
      </span>
    );
  if (i.tokens && locked) return <span className="ptag lock"><Icon name="lock" size={13} />{fmtS(S.levelReq, { n: i.minLevel! })}</span>;
  if (i.tokens) return <button className="ptag tok" onClick={() => shop.buyItem(i)}><Icon name="token" size={15} />{i.tokens}</button>;
  if (i.sku) return <button className="ptag eur" disabled={shop.busy === i.id} onClick={() => shop.buyItem(i)}>{shop.busy === i.id ? '…' : priceOf(i.sku)}</button>;
  return null;
}

function Head({ title, back, right, lang }: { title: string; back: () => void; right?: React.ReactNode; lang: Lang }) {
  return (
    <header className="subhead">
      <button className="iconbtn" onClick={back} aria-label={SHOP_STRINGS[lang].back}><Icon name="back" /></button>
      <h2>{title}</h2>
      {right}
    </header>
  );
}

const Tiles = ({ skin, word = 'LEX' }: { skin: string; word?: string }) => (
  <span className={`mini-tiles skin-${skin}`}>{word.split('').map((c, i) => <span key={i}>{c}</span>)}</span>
);
const Keys = ({ kind }: { kind: string }) => (
  <span className={`mini-keys kb-${kind}`}>{['A', 'Z', 'E', 'R'].map((k) => <span key={k}>{k}</span>)}</span>
);
const FX_ICON: Record<string, string> = { letters: 'sparkle', ink: 'inkwell', fireworks: 'bolt', snow: 'snow' };
const PACK_ICON: Record<string, string> = { proverbs: 'book', cinema: 'play', football: 'target', geography: 'globe', africa: 'map' };

/** Aperçu visuel d'un objet du catalogue. */
export function Preview({ i, size = 80 }: { i: Item; size?: number }) {
  switch (i.kind) {
    case 'hat': return <Loupi bust size={size * 0.75} outfit={{ hat: i.value as Outfit['hat'] }} />;
    case 'neck': return <Loupi size={size} outfit={{ neck: i.value as Outfit['neck'] }} />;
    case 'loupe': return <Loupi bust mood="think" size={size * 0.75} outfit={{ loupe: i.value as Outfit['loupe'] }} />;
    case 'back': return <Loupi size={size} outfit={{ back: i.value as 'cape' }} />;
    case 'skin': return <Tiles skin={i.value} />;
    case 'keyboard': return <Keys kind={i.value} />;
    case 'effect': return <span className="fx-ico"><Icon name={FX_ICON[i.value] ?? 'sparkle'} size={26} /></span>;
    case 'frame': return <span className={`frame fr-${i.value}`}><Loupi bust size={44} /></span>;
    case 'decor': return <Scene kind={i.value as SceneKind} />;
    case 'pack': return <span className="fx-ico"><Icon name={PACK_ICON[i.value] ?? 'book'} size={24} /></span>;
  }
}

function untilMonday(S: ShopStrings): string {
  const d = new Date();
  const next = new Date(d);
  next.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  next.setHours(0, 0, 0, 0);
  const h = Math.max(0, Math.round((next.getTime() - d.getTime()) / 3600000));
  return h > 0 ? `${Math.floor(h / 24)} ${S.unitDay} ${h % 24} ${S.unitHour}` : S.lessThanHour;
}

// ---------------- Boutique ----------------

export function Shop({ ctx, back, openWardrobe, openPacks }: { ctx: ShopCtx; back: () => void; openWardrobe: () => void; openPacks: () => void }) {
  const { save, lang } = ctx;
  const S = SHOP_STRINGS[lang];
  const shop = useShop(ctx);
  const feat = weeklyShowcase(weekKey()).map((id) => item(id)!).filter(Boolean);
  const colors = ['f-violet', 'f-blue', 'f-coral'];
  const by = (k: ItemKind) => ITEMS.filter((i) => i.kind === k);
  const starter = BUNDLES.find((b) => b.once)!;
  const gentleman = BUNDLES.find((b) => !b.once)!;
  const gentlemanOwned = gentleman.items.every((id) => owns(save, id));

  const card = (i: Item) => (
    <article key={i.id} className={`icard sm ${i.unlock && !owns(save, i.id) ? 'locked' : ''}`}>
      <Preview i={i} size={92} />
      <b>{i.name[lang]}</b>
      <Action ctx={ctx} i={i} shop={shop} />
    </article>
  );
  const row = (i: Item) => (
    <article key={i.id} className="icard row"><Preview i={i} /><span><b>{i.name[lang]}</b><Action ctx={ctx} i={i} shop={shop} /></span></article>
  );

  return (
    <div className="shop">
      <Head title={S.shop} back={back} lang={lang} right={<span className="counter gold"><Icon name="token" size={18} />{save.tokens}</span>} />
      <div className="screen" style={{ paddingTop: 6 }}>
        {isDemoStore() && <p className="demo-note">{S.demo}</p>}
        <section className="vitrine">
          <div className="vit-top">
            <Loupi mood="happy" size={92} outfit={{ hat: 'tophat', neck: 'bowtie' }} />
            <div className="bubble">{S.showcase} {fmtS(S.showcaseLeft, { t: untilMonday(S) })}</div>
          </div>
          <div className="feat">
            {feat.map((i, k) => (
              <article key={i.id} className={`fcard ${colors[k % 3]}`}>
                <span className="feat-prev"><Preview i={i} size={84} /></span>
                <b>{i.name[lang]}</b>
                <Action ctx={ctx} i={i} shop={shop} />
              </article>
            ))}
          </div>
        </section>

        {!save.starterBought && (
          <section className="offer">
            <span className="ribbon">{S.once}</span>
            <Loupi mood="wow" size={78} outfit={{ hat: 'deerstalker' }} />
            <div className="of-main"><b>{S.starter}</b><small>{S.starterBody}</small></div>
            <button className="btn primary sm" disabled={!!shop.busy} onClick={() => shop.buyBundle(starter, S.starter)}>{priceOf(starter.sku)}</button>
          </section>
        )}

        <section className="plus">
          <div className="plus-head"><Icon name="crown" size={26} /><b>{S.plusTitle}</b>{save.premium ? <span className="ptag eq"><Icon name="check" size={14} />{S.plusActive}</span> : <span className="ptag eur">{S.plusTrial}</span>}</div>
          <ul>{S.plusPerks.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}</ul>
          {!save.premium && (
            <div className="row">
              <button className="btn primary" disabled={!!shop.busy} onClick={() => shop.buyPlus(SKUS.plusMonthly)}>{fmtS(S.perMonth, { p: priceOf(SKUS.plusMonthly) })}</button>
              <button className="btn" disabled={!!shop.busy} onClick={() => shop.buyPlus(SKUS.plusYearly)}>{fmtS(S.perYear, { p: priceOf(SKUS.plusYearly) })}</button>
            </div>
          )}
          <small className="fair">{S.fair}</small>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secOutfits}</h3><button className="aside" onClick={openWardrobe}>{S.wardrobe}</button></div>
          <div className="hscroll">
            {!gentlemanOwned && (
              <article className="icard bundle">
                <Loupi size={92} outfit={{ hat: 'tophat', neck: 'bowtie', loupe: 'crystal' }} />
                <b>{S.bundleGentleman}</b>
                <button className="ptag eur" disabled={!!shop.busy} onClick={() => shop.buyBundle(gentleman, S.bundleGentleman)}>{priceOf(gentleman.sku)}</button>
              </article>
            )}
            {[...by('hat'), ...by('neck').filter((i) => !i.free), ...by('loupe').filter((i) => !i.free), ...by('back')].map((i) => (
              <article key={i.id} className={`icard ${i.unlock && !owns(save, i.id) ? 'locked' : ''}`}>
                <Loupi size={92} outfit={{ ...outfitOf(save), [i.kind]: i.value }} />
                <b>{i.name[lang]}</b>
                <Action ctx={ctx} i={i} shop={shop} />
              </article>
            ))}
          </div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secTiles}</h3></div>
          <div className="grid3">{by('skin').map(card)}</div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secKeyboards}</h3></div>
          <div className="grid2">{by('keyboard').map(row)}</div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secEffects}</h3></div>
          <div className="grid2">{by('effect').map(row)}</div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secFrames}</h3><small className="aside">{S.framesNote}</small></div>
          <div className="grid2">{by('frame').map(card)}</div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secDecor}</h3></div>
          <div className="grid2">{by('decor').map((i) => (
            <article key={i.id} className="icard scene-card"><Preview i={i} /><span><b>{i.name[lang]}</b><Action ctx={ctx} i={i} shop={shop} /></span></article>
          ))}</div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secPacks}</h3><small className="aside">{S.packsNote}</small></div>
          <div className="packs">{by('pack').map((i) => (
            <article key={i.id} className={`pack ${i.soon ? 'soon' : ''}`}>
              <Preview i={i} />
              <b>{i.name[lang]}</b>
              {owns(save, i.id) ? <button className="btn primary sm" onClick={openPacks}>{S.play}</button> : <Action ctx={ctx} i={i} shop={shop} />}
            </article>
          ))}</div>
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.secTokens}</h3><small className="aside">{S.tokensNote}</small></div>
          <div className="grid3">{TOKEN_PACKS.map((p) => (
            <article key={p.sku.id} className="icard sm coins">
              {p.bonus && <span className="ribbon sm">{p.bonus}</span>}
              <span className="coin-stack">{Array.from({ length: p.tokens > 1000 ? 3 : p.tokens > 500 ? 2 : 1 }, (_, k) => <Icon key={k} name="token" size={30} />)}</span>
              <b>{p.tokens}</b>
              <button className="btn primary sm" disabled={!!shop.busy} onClick={() => shop.buyTokens(p)}>{priceOf(p.sku)}</button>
            </article>
          ))}</div>
          <small className="fair">{S.fairTokens}</small>
        </section>

        <button className="link" onClick={shop.restoreAll}>{S.restore}</button>
      </div>
    </div>
  );
}

// ---------------- Garde-robe ----------------

type Slot = 'hat' | 'neck' | 'loupe' | 'back';

export function Wardrobe({ ctx, back }: { ctx: ShopCtx; back: () => void }) {
  const { save, lang } = ctx;
  const S = SHOP_STRINGS[lang];
  const shop = useShop(ctx);
  const [tab, setTab] = useState<Slot>('hat');
  const [trial, setTrial] = useState<Partial<Record<Slot, string>>>({});
  const [mood, setMood] = useState<'idle' | 'happy'>('idle');
  const equipped = save.equip as Record<string, string | undefined>;
  const empty = (k: Slot): Item | null =>
    k === 'hat' || k === 'back' ? { id: `${k}:`, kind: k, value: '', name: { fr: k === 'hat' ? SHOP_STRINGS.fr.noHat : SHOP_STRINGS.fr.noBack, en: k === 'hat' ? SHOP_STRINGS.en.noHat : SHOP_STRINGS.en.noBack, es: k === 'hat' ? SHOP_STRINGS.es.noHat : SHOP_STRINGS.es.noBack }, free: true } : null;
  const list = [...(empty(tab) ? [empty(tab)!] : []), ...ITEMS.filter((i) => i.kind === tab)];
  const val = (i: Item) => i.value || undefined;
  const mine = (i: Item) => !i.value || owns(save, i.id);
  const shownVal = (k: Slot) => (k in trial ? trial[k] || undefined : equipped[k]);
  const shown = { hat: shownVal('hat'), neck: shownVal('neck'), loupe: shownVal('loupe'), back: shownVal('back') } as Outfit;

  const tryOn = (i: Item) => {
    sfx.tap();
    setTrial((t) => ({ ...t, [tab]: i.value }));
    setMood('happy');
    setTimeout(() => setMood('idle'), 900);
    if (mine(i)) ctx.setSave((s) => ({ ...s, equip: { ...s.equip, [tab]: val(i) } }));
  };
  const pending = list.find((i) => i.value && shownVal(tab) === i.value && !mine(i));

  return (
    <div>
      <Head title={S.wardrobe} back={back} lang={lang} />
      <div className="screen" style={{ paddingTop: 6 }}>
        <section className="dress">
          <Scene kind={(save.equip.decor as SceneKind) ?? 'home'} />
          <div className="dress-loupi"><Loupi size={190} mood={mood} outfit={shown} /></div>
          {pending && (
            <div className="dress-buy">
              <b>{pending.name[lang]}</b>
              <Action ctx={ctx} i={pending} shop={shop} />
            </div>
          )}
        </section>
        <div className="seg">
          {(['hat', 'neck', 'loupe', 'back'] as Slot[]).map((k) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{S[`slot${k[0].toUpperCase()}${k.slice(1)}` as 'slotHat']}</button>
          ))}
        </div>
        <div className="grid3">
          {list.map((i) => {
            const on = shownVal(tab) === val(i);
            const isEq = equipped[tab] === val(i);
            return (
              <div key={i.id} className={`icard sm ${on ? 'on' : ''} ${i.unlock && !mine(i) ? 'locked' : ''}`}>
                {/* L'essayage et l'achat sont deux boutons distincts : un bouton ne peut pas en contenir un autre. */}
                <button className="icard-try" onClick={() => tryOn(i)} aria-pressed={on}>
                  <Loupi bust={tab === 'hat' || tab === 'loupe'} size={tab === 'hat' || tab === 'loupe' ? 64 : 76} mood={tab === 'loupe' ? 'think' : 'idle'} outfit={{ [tab]: val(i) } as Outfit} />
                  <b>{i.name[lang]}</b>
                </button>
                {mine(i) ? (isEq ? <span className="ptag eq"><Icon name="check" size={14} />{S.equipped}</span> : <button className="ptag own" onClick={() => tryOn(i)}>{S.owned}</button>) : <Action ctx={ctx} i={i} shop={shop} />}
              </div>
            );
          })}
        </div>
        <p className="fair">{S.tryNote}</p>
      </div>
    </div>
  );
}

// ---------------- Événement ----------------

export function EventBanner({ ev, lang, day, save, open }: { ev: SeasonalEvent; lang: Lang; day: string; save: Save; open: () => void }) {
  const S = SHOP_STRINGS[lang];
  const got = save.events[ev.id]?.currency ?? 0;
  const max = ev.levels * ev.perLevel;
  return (
    <button className="evbanner" onClick={open}>
      <Scene kind="xmas" />
      <span className="ev-body">
        <span className="ev-tag"><Icon name="gift" size={14} />{fmtS(S.eventTag, { n: daysLeft(ev, day) })}</span>
        <b>{ev.title[lang]}</b>
        <span className="ev-bar"><i style={{ width: `${(got / max) * 100}%` }} /></span>
        <small><Icon name="snow" size={14} />{got} / {max} {ev.currency[lang]}</small>
      </span>
      <Loupi className="ev-loupi" size={84} mood="happy" outfit={ev.outfit} />
    </button>
  );
}

export function EventScreen({ ev, ctx, day, back, play }: { ev: SeasonalEvent; ctx: ShopCtx; day: string; back: () => void; play: (idx: number) => void }) {
  const { save, lang } = ctx;
  const S = SHOP_STRINGS[lang];
  const st = save.events[ev.id] ?? { done: 0, currency: 0, claimed: [] };
  const done = st.done;
  const finished = done >= ev.levels;
  return (
    <div>
      <Head title={ev.title[lang]} back={back} lang={lang} />
      <div className="screen" style={{ paddingTop: 6 }}>
        <section className="chapcard evcard">
          <Scene kind="xmas" />
          <div className="ev-hero"><Loupi size={110} mood={finished ? 'happy' : 'think'} outfit={ev.outfit} /></div>
          <p className="story">{finished ? S.eventDone : ev.story[lang]}</p>
          <div className="ev-meta">
            <span><Icon name="calendar" size={16} />{fmtS(S.daysLeft, { n: daysLeft(ev, day) })}</span>
            <span><Icon name="snow" size={16} />{st.currency} {ev.currency[lang]}</span>
          </div>
          <div className="trail ev-trail">
            {Array.from({ length: ev.levels }, (_, i) => (
              <button key={i} className={`stop ${i < done ? 'cleared' : ''} ${i === done ? 'cur' : ''}`} disabled={i > done} onClick={() => play(i)}>
                {i === done && <Loupi bust mood="think" size={50} className="pawn" outfit={{ hat: 'santa' }} />}
                {i === ev.levels - 1 && i >= done ? <Icon name="gift" size={19} /> : i > done ? <Icon name="lock" size={15} /> : i + 1}
                <span className="st">{i < done ? <Icon name="snow" size={9} /> : null}</span>
              </button>
            ))}
          </div>
          {!finished && <button className="btn primary lg block" onClick={() => play(done)}>{fmtS(S.message, { n: done + 1 })}</button>}
        </section>

        <section className="sec">
          <div className="sechead"><h3>{S.rewards}</h3><small className="aside">{S.rewardsNote}</small></div>
          <div className="evtrack">
            {ev.rewards.map((r, k) => {
              const ok = st.currency >= r.at;
              const it = r.item ? item(r.item) : undefined;
              return (
                <div key={k} className={`evr ${ok ? 'ok' : ''}`}>
                  <span className="evr-at"><Icon name="snow" size={13} />{r.at}</span>
                  <span className="evr-prev">{it ? <Preview i={it} size={60} /> : <Icon name="medal" size={26} />}</span>
                  <b>{r.label[lang]}</b>
                  {ok ? <span className="ptag eq"><Icon name="check" size={14} />{S.got}</span> : <span className="ptag lock"><Icon name="lock" size={13} /></span>}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------- Packs de grilles ----------------

export function PacksScreen({ ctx, back, play, openShop }: { ctx: ShopCtx; back: () => void; play: (pack: string, idx: number) => void; openShop: () => void }) {
  const { save, lang } = ctx;
  const S = SHOP_STRINGS[lang];
  const packs = ITEMS.filter((i) => i.kind === 'pack' && !i.soon);
  return (
    <div>
      <Head title={S.secPacks} back={back} lang={lang} />
      <div className="screen" style={{ paddingTop: 6 }}>
        {packs.map((p) => {
          const n = PACK_PHRASES[p.value]?.[lang].length ?? 0;
          const stars = save.packs[p.value] ?? {};
          const mine = owns(save, p.id);
          return (
            <section key={p.id} className="chapcard packcard">
              <div className="ct packhead">
                <span className="disc"><Icon name={PACK_ICON[p.value] ?? 'book'} size={22} /></span>
                <span><small>{fmtS(S.packGrids, { n })}</small><b>{p.name[lang]}</b></span>
              </div>
              {mine ? (
                <div className="trail pack-trail">
                  {Array.from({ length: n }, (_, i) => (
                    <button key={i} className={`stop ${stars[i] ? 'cleared' : ''}`} onClick={() => play(p.value, i)}>
                      {i + 1}
                      <span className="st">{Array.from({ length: stars[i] ?? 0 }, (_, k) => <Icon key={k} name="starFill" size={8} />)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button className="btn primary block" onClick={openShop}>{S.buyFor} {p.sku ? priceOf(p.sku) : ''}</button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Archives ----------------

export function ArchiveScreen({ ctx, day, back, play, openShop }: { ctx: ShopCtx; day: string; back: () => void; play: (date: string) => void; openShop: () => void }) {
  const { save, lang } = ctx;
  const S = SHOP_STRINGS[lang];
  const days = Array.from({ length: 60 }, (_, i) => new Date(Date.parse(day) - (i + 1) * 86400000).toISOString().slice(0, 10));
  return (
    <div>
      <Head title={S.archives} back={back} lang={lang} />
      <div className="screen" style={{ paddingTop: 6 }}>
        <p className="muted">{S.archivesSub}</p>
        {!save.premium && (
          <section className="plus">
            <div className="plus-head"><Icon name="crown" size={26} /><b>{S.plusTitle}</b></div>
            <p>{S.archivesLocked}</p>
            <button className="btn primary" onClick={openShop}>{S.shop}</button>
          </section>
        )}
        <div className="archive">
          {days.map((d) => {
            const res = save.daily[lang]?.[d];
            return (
              <button key={d} className={`arch ${res ? 'done' : ''}`} disabled={!save.premium} onClick={() => play(d)}>
                <b>{new Date(d).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</b>
                {res ? <small><Icon name="check" size={13} />{res.score}</small> : <small><Icon name={save.premium ? 'play' : 'lock'} size={13} /></small>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Flocons qui tombent sur toute l'application pendant l'événement de Noël. */
export function Snowfall() {
  return (
    <div className="snowfall" aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.7) % 8}s`, animationDuration: `${8 + (i % 5) * 2}s`, '--s': `${3 + (i % 3) * 2}px` } as CSSProperties} />
      ))}
    </div>
  );
}
