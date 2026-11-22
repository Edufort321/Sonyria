'use client';
// Ouverture (splash) + accueil en étapes + choix d'avatar — même expérience que les autres apps d'Eric (ZERVIA)
import { useEffect, useState } from 'react';
import Ic, { Ico } from './Ic';

const AVG = (p, n) => Array.from({ length: n }, (_, i) => p + String(i + 1).padStart(2, '0'));
export const AVATARS = { Adultes: AVG('a', 71), Ados: AVG('t', 22), Enfants: AVG('k', 20) };
export const avSrc = (a) => `/avatars/${a}.webp`;

export function loadMe() {
  try { return JSON.parse(localStorage.getItem('sonyria-me') || 'null') || { onboarded: false }; } catch (e) { return { onboarded: false }; }
}
export function saveMe(me) { try { localStorage.setItem('sonyria-me', JSON.stringify(me)); } catch (e) {} }

export function Splash({ onDone }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t1 = setTimeout(() => setOut(true), fast ? 500 : 2500);
    const t2 = setTimeout(onDone, fast ? 900 : 3050);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line
  return (
    <div className={'splash' + (out ? ' out' : '')} aria-hidden="true">
      <div className="sp-halo" />
      <div className="sp-logo"><img src="/logo.png" alt="" /></div>
      <div className="sp-word">SONYRIA</div>
      <div className="sp-tag">Écris · Compose · Chante</div>
      <div className="sp-eq">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}</div>
      <button className="sp-skip" onClick={() => { setOut(true); setTimeout(onDone, 450); }}>Passer</button>
    </div>
  );
}

export function AvatarGrid({ value, onPick }) {
  return (
    <div className="avscroll">
      {Object.entries(AVATARS).map(([g, list]) => (
        <div key={g}>
          <div className="avh">{g}</div>
          <div className="avgrid">{list.map((a) => <button key={a} type="button" className={'avopt' + (value === a ? ' on' : '')} onClick={() => onPick(a)}><img src={avSrc(a)} alt="" loading="lazy" /></button>)}</div>
        </div>
      ))}
    </div>
  );
}

export function Onboarding({ me, setMe, install, onInstall, onFinish }) {
  const [st, setSt] = useState(0);
  const [all, setAll] = useState(false);
  const dots = <div className="wsteps">{[0, 1, 2].map((i) => <i key={i} className={i <= st ? 'on' : ''} />)}</div>;
  const quick = [...AVATARS.Adultes.slice(0, 8), ...AVATARS.Ados.slice(0, 3), ...AVATARS.Enfants.slice(0, 2)];
  return (
    <div className="welcome">
      <div className="wwrap">
        {st === 0 && <div className="whero">
          <img className="wlogo" src="/logo.png" alt="" />
          <div className="wname">SONYRIA</div>
          <p className="wtag">Colle tes paroles : Sonyria compose les mélodies, les accords et le beat. Tu chantes, tu mixes, tu publies.</p>
          <div className="vals">
            <div><Ico n="note" s={44} /><b>Mélodies et accords</b>Plusieurs propositions pour ton texte, dans le style et le tempo que tu choisis.</div>
            <div><Ico n="voice-wave" s={44} /><b>Karaoké vivant</b>Les paroles défilent au tempo et se calent sur ta propre voix.</div>
            <div><Ico n="mixer" s={44} /><b>Studio complet</b>Enregistrement, écho, réverb, table de son et beat table.</div>
            <div><Ico n="spectrum" s={44} /><b>Clips prêts à publier</b>MP4 1080p pour TikTok, Reels, Shorts et YouTube.</div>
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn pri" style={{ padding: '13px 26px', fontSize: 16 }} onClick={() => setSt(1)}>Commencer <Ic n="next" /></button>
            {install && <button className="btn" onClick={onInstall}><Ic n="phone" /> Installer l’app</button>}
          </div>
        </div>}

        {st === 1 && <>{dots}<div className="wcard">
          <h2>Faisons connaissance</h2>
          <p className="lead">Ton prénom et ton nom d’artiste apparaissent dans tes clips et tes exports.</p>
          <label className="f">Ton prénom</label>
          <input type="text" value={me.name || ''} placeholder="Eric" onChange={(e) => setMe({ ...me, name: e.target.value })} />
          <label className="f">Nom d’artiste (facultatif)</label>
          <input type="text" value={me.artist || ''} placeholder="Ton nom de scène" onChange={(e) => setMe({ ...me, artist: e.target.value })} />
          <label className="f">Ton avatar</label>
          {!all ? <div className="avpick">
            {quick.map((a) => <button key={a} type="button" className={'img' + (me.av === a ? ' on' : '')} onClick={() => setMe({ ...me, av: a })}><img src={avSrc(a)} alt="" /></button>)}
            <button type="button" className="more" onClick={() => setAll(true)} title="Tous les avatars"><Ic n="plus" /></button>
          </div> : <div style={{ maxHeight: 300, display: 'flex' }}><AvatarGrid value={me.av} onPick={(a) => setMe({ ...me, av: a })} /></div>}
          <div className="wfoot"><button className="btn" onClick={() => setSt(0)}><Ic n="prev" /> Retour</button><span className="grow" /><button className="btn pri" onClick={() => setSt(2)}>Continuer <Ic n="next" /></button></div>
        </div></>}

        {st === 2 && <>{dots}<div className="wcard">
          <h2>Par quoi on commence{me.name ? `, ${me.name}` : ''} ?</h2>
          <p className="lead">Tu pourras créer autant de chansons que tu veux ; tout est sauvegardé sur ton appareil.</p>
          <div className="wopts">
            <button className="wopt hi" onClick={() => onFinish('paroles')}><Ico n="new" s={52} /><b>Coller mes paroles</b><small>Sonyria propose des ambiances, des mélodies et un beat pour ton texte.</small></button>
            <button className="wopt" onClick={() => onFinish('import')}><Ico n="upload" s={52} /><b>Retravailler un MP4</b><small>Importe une chanson : paroles, tempo, accords et karaoké sont recréés.</small></button>
            <button className="wopt" onClick={() => onFinish('demo')}><Ico n="headphones" s={52} /><b>Explorer l’exemple</b><small>Une chanson prête à écouter pour découvrir toutes les fonctions.</small></button>
          </div>
          <div className="wfoot"><button className="btn" onClick={() => setSt(1)}><Ic n="prev" /> Retour</button></div>
        </div></>}
      </div>
    </div>
  );
}
