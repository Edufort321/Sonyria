// Sonyria — route serveur : appelle l'API Anthropic avec la clé stockée dans Vercel (jamais exposée au navigateur)
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// accepte aussi les variantes de nom courantes (espaces ou casse différente)
function apiKey() {
  const env = process.env;
  const name = Object.keys(env).find((k) => /^(ANTHROPIC_API_KEY|ANTHROPIC_KEY|CLAUDE_API_KEY|CLAUDE_KEY)$/i.test(k.trim()));
  return name ? String(env[name]).trim() : '';
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const STYLES = ['pop', 'ballade', 'hiphop', 'trap', 'rnb', 'rock', 'folk', 'reggaeton', 'afro', 'edm', 'lofi', 'jazz'];
const THEMES = ['neon (néon rétro)', 'onde (ondes sonores)', 'bokeh (lumières floues)', 'club (lasers)', 'concert (scène, foule)', 'feux (feux d’artifice)', 'coucher (coucher de soleil sur la mer)', 'plage', 'ocean', 'sousmarin', 'montagnes (aube)', 'foret (lucioles)', 'neige', 'desert (nuit étoilée)', 'ciel (nuages)', 'cerisiers', 'aurore (boréale)', 'etoiles (voie lactée)', 'galaxie', 'ville', 'skyline (gratte-ciel)', 'route (de nuit)', 'pluie', 'vitre (pluie sur la vitre)', 'amour (cœurs)', 'chandelles', 'lumiere (rayons, spirituel)', 'fumee', 'feu', 'noel', 'halloween', 'vinyle', 'orage', 'automne', 'lavande', 'lac (montagne)', 'espace (planètes)', 'cyberpunk (ville néon sous la pluie)'];

function prompt(task, p) {
  const out = p.lang === 'en' ? 'English' : 'French';
  const extra = `\nIMPORTANT: write every explanatory text field ("why", "note", "pourquoi") in ${out}.`;
  return base(task, p) && base(task, p) + extra;
}
function base(task, p) {
  if (task === 'ambiance') {
    return `Tu es directeur musical. Pars VRAIMENT des paroles : lis-les attentivement (sens, émotions, images, rythme des vers, rimes, intensité de chaque section) avant de proposer quoi que ce soit.
Propose 4 ambiances musicales différentes qui servent ce texte précis.
Styles permis : ${STYLES.join(', ')}. Tonalité "key" : entier 0-11 (0=Do, 2=Ré, 4=Mi, 5=Fa, 7=Sol, 9=La, 11=Si). "mode" : "maj" ou "min". "bpm" : 60-170 (adapte le tempo au débit des vers : vers longs = tempo plus posé).
Pour chaque ambiance, "why" = une courte phrase qui explique le lien avec le texte en citant un mot ou une image des paroles.
"reading" = 1 ou 2 phrases : ce que raconte la chanson et l'émotion de chaque grande section (ex. couplets intimes, refrain qui s'ouvre, pont fragile).
Pour chaque ambiance, choisis aussi l'orchestration "layers" (3 à 6 instruments) PRIORITAIREMENT avec de vrais instruments enregistrés, parmi : batterie "drums" (acoustic, 808, linn), basse "bass" (bass, upright), accords "chords" (piano, epiano, pluck = guitare acoustique, nylon = guitare classique, eguitar, power = guitare saturée, strings, choir), nappe "pad" (strings, choir, epiano), arpèges "arp" (piano, epiano, nylon, pluck, eguitar), mélodie "melody" (voix = chœur, piano, sax, altosax, trumpet, flute, guitar, nylon, strings). "vol" entre 0.3 et 1. Pas de batterie pour une ambiance très intime si le texte le demande.
Réponds UNIQUEMENT avec ce JSON : {"reading":"...","options":[{"style":"pop","mode":"maj","key":0,"bpm":104,"why":"...","layers":[{"role":"drums","inst":"acoustic","vol":1},{"role":"chords","inst":"piano","vol":0.9},{"role":"melody","inst":"voix","vol":1}]}]}

Paroles :
${p.lyrics}`;
  }
  if (task === 'ocr') {
    return `Tu reçois ${p.kind === 'pdf' ? 'un document PDF' : 'des photos de pages (dans l’ordre)'} contenant des paroles de chanson, souvent écrites à la main.
Transcris les paroles de toutes les pages, dans l’ordre.
- Garde le titre, les en-têtes de sections (Couplet 1, Refrain, Pont, Fin…) et les indications de l’auteur entre parenthèses (tout doucement, plus puissant, très émouvant…).
- Ignore le texte barré et le texte qui transparaît du verso de la feuille (écriture à l’envers, pâle).
- Mets chaque en-tête entre crochets, ex. [Couplet 1], [Refrain (plus puissant)], [Pont (tout doucement)], et laisse une ligne vide entre les sections.
- Coupe le texte en vers chantables (une phrase musicale par ligne, environ 6 à 12 syllabes).
${p.correct ? '- Corrige SEULEMENT l’orthographe, les accents, les accords et la ponctuation, dans la langue des paroles. Ne change AUCUN mot, n’ajoute ni ne retire rien : garde exactement les mots de l’auteur.' : '- Ne corrige rien : recopie fidèlement ce qui est écrit (tu peux seulement ajouter la ponctuation des fins de vers).'}
- Si un mot est illisible, mets ta meilleure lecture suivie de (?).
Réponds UNIQUEMENT avec ce JSON :
{"title":"titre de la chanson ou chaîne vide","lyrics":"texte complet avec \\n entre les lignes","note":"une phrase : nombre de pages lues et ce qui était difficile à lire"}`;
  }
  if (task === 'polish') {
    return `Tu es correcteur de paroles de chanson. RÈGLE ABSOLUE : tu ne changes PAS les mots de l'auteur, ni l'ordre des mots, ni le sens.
Dans "lyrics", fais SEULEMENT :
- corriger l'orthographe, les accents, les accords (genre, nombre, conjugaison) et la ponctuation, dans la langue des paroles (français québécois standard si c'est du français) ;
- remettre les en-têtes de sections entre crochets ([Couplet 1], [Refrain (plus puissant)]…, ou [Verse 1], [Chorus]… en anglais) en gardant les indications de l'auteur ;
- couper les lignes trop longues en vers chantables (une phrase musicale par ligne), SANS changer les mots ;
- retirer une ligne recopiée deux fois par accident.
Ne traduis jamais. N'ajoute ni ne retire aucun mot.
Ensuite, à part, propose dans "suggestions" des idées de tournures qui se chanteraient mieux (rime plus juste, mot plus court, ordre plus naturel). Ce ne sont que des propositions : l'auteur décidera. Maximum 10, les plus utiles d'abord. "avant" doit être un passage EXACT du texte corrigé.
Réponds UNIQUEMENT avec ce JSON :
{"lyrics":"texte corrigé avec \\n entre les lignes et une ligne vide entre les sections","fixes":12,"suggestions":[{"avant":"passage exact","apres":"proposition","pourquoi":"courte raison"}],"note":"une phrase"}

Paroles :
${p.lyrics}`;
  }
  if (task === 'compose') {
    return `Tu es compositeur et arrangeur. Compose une mélodie chantable et accrocheuse pour ces paroles.
Contexte : tonalité ${p.keyName} ${p.mode === 'maj' ? 'majeur' : 'mineur'}, style ${p.style}, ${p.bpm} BPM, mesure 4/4, grille en doubles-croches (16 par mesure).
Notation :
- "p" = position mélodique en degrés de la gamme : 0 = tonique, 1 = 2e degré, 2 = 3e, 4 = quinte, 7 = tonique à l'octave, -1 = 7e degré en dessous. Plage permise -3 à 10.
- "d" = durée de la note en doubles-croches (1 à 16). "r" = silence avant la note en doubles-croches (0 par défaut).
- "chords" = un accord par mesure, en degrés 1 à 7 (accords diatoniques de la gamme).
Règles :
- Pour chaque ligne, EXACTEMENT une note par syllabe, dans l'ordre donné. La somme des r + d d'une ligne doit être ≤ bars × 16.
- Place les syllabes accentuées (fins de mots, fins de vers) sur les temps forts ; finis chaque vers par une note plus longue.
- Les accords doivent soutenir la mélodie (notes longues = notes de l'accord).
- Les refrains identiques ont la même mélodie ; le refrain monte plus haut et est plus accrocheur que les couplets.
- PARS DU SENS DES PAROLES : l'harmonie suit l'émotion de chaque vers (tristesse, manque, doute → accords 6, 2, 3 et mineurs; espoir, élan, lumière → 4, 5, 1; tension → 5 ou 2 avant une résolution). Les mots forts du vers tombent sur les notes hautes ou longues; une question monte, une affirmation descend vers la tonique.
- Respecte la nuance de chaque section ("dyn" : soft = notes plus graves et plus longues, emo = intervalles expressifs, loud = registre plus haut).
${p.chooseVibe ? `- Choisis aussi la meilleure tonalité ("key" 0-11), le "mode" ("maj"|"min"), le "style" parmi [${STYLES.join(', ')}] et le "bpm" selon l'émotion du texte.` : ''}
Réponds UNIQUEMENT avec ce JSON :
{${p.chooseVibe ? '"key":0,"mode":"maj","style":"pop","bpm":100,' : ''}"lines":[{"i":0,"chords":[1,5],"notes":[{"p":2,"d":2,"r":0}]}],"note":"une ou deux phrases en français sur tes choix"}

Paroles complètes (pour le sens) :
${p.lyrics || ''}

Lignes (i, section, nuance, texte, mesures, syllabes) :
${JSON.stringify(p.lines)}`;
  }
  if (task === 'clip') {
    return `Tu es réalisateur de vidéoclips. À partir de ces paroles, écris le scénario visuel d'un clip animé (généré par code : fonds animés, particules, spectre audio, paroles karaoké).
Thèmes visuels disponibles (utilise seulement le mot-clé avant la parenthèse) : ${THEMES.join(', ')}. Choisis des thèmes réalistes qui collent à l’imaginaire de chaque section et varie-les d’une section à l’autre. Palettes : 3 couleurs hexadécimales vives qui vont bien sur fond noir.
Pour chaque section (utilise exactement les libellés fournis), choisis un thème, une palette, une intensité 0.3-1 et 2 à 4 mots-clés courts tirés de l'imaginaire du texte (en majuscules dans la langue des paroles).
"textStyle" : "karaoke" ou "bounce".
Réponds UNIQUEMENT avec ce JSON :
{"title":"...","theme":"neon","palette":["#22d3ee","#a855f7","#fb923c"],"textStyle":"karaoke","keywords":["..."],"sections":{"Refrain":{"theme":"feu","palette":["#..","#..","#.."],"intensity":0.9,"keywords":["..."]}},"note":"une phrase en français décrivant le clip"}

Titre proposé : ${p.title || '(à inventer)'}
Sections : ${JSON.stringify(p.sections)}
Style musical : ${p.style}, ${p.bpm} BPM
Paroles :
${p.lyrics}`;
  }
  return null;
}

function extractJson(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Réponse sans JSON');
  return JSON.parse(text.slice(a, b + 1));
}

export async function POST(req) {
  const key = apiKey();
  if (!key) return Response.json({ error: 'Clé ANTHROPIC_API_KEY absente dans Vercel / ANTHROPIC_API_KEY missing in Vercel.' }, { status: 503 });
  const code = process.env.SONYRIA_ACCESS_CODE;
  if (code && req.headers.get('x-access-code') !== code) return Response.json({ error: 'Code d’accès requis (Réglages) / Access code required (Settings).' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Requête invalide' }, { status: 400 }); }
  const { task, payload } = body || {};
  const raw = JSON.stringify(payload || {});
  if (raw.length > (task === 'ocr' ? 4_300_000 : 40000)) return Response.json({ error: 'Fichier trop lourd / File too large' }, { status: 413 });
  const text = prompt(task, payload || {});
  if (!text) return Response.json({ error: 'Tâche inconnue' }, { status: 400 });
  let content = text;
  if (task === 'ocr') {
    const blocks = [];
    if (payload.kind === 'pdf') blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: payload.pdf } });
    else (payload.images || []).slice(0, 8).forEach((im) => blocks.push({ type: 'image', source: { type: 'base64', media_type: im.type || 'image/jpeg', data: im.data } }));
    if (!blocks.length) return Response.json({ error: 'Aucun fichier / No file' }, { status: 400 });
    content = [...blocks, { type: 'text', text }];
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: task === 'compose' || task === 'polish' || task === 'ocr' ? 8000 : 2000, messages: [{ role: 'user', content }] }),
    });
    const j = await r.json();
    if (!r.ok) return Response.json({ error: j?.error?.message || 'Erreur Anthropic' }, { status: r.status });
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return Response.json({ data: extractJson(text) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

export async function GET() {
  const k = apiKey();
  // diagnostic : noms seulement (jamais les valeurs)
  const names = Object.keys(process.env).filter((n) => /anthropic|claude|sonyria/i.test(n));
  return Response.json(
    { ok: true, ai: !!k, keyFormat: k ? (k.startsWith('sk-ant-') ? 'ok' : 'inattendu') : null, locked: !!process.env.SONYRIA_ACCESS_CODE, env: process.env.VERCEL_ENV || 'local', vars: names },
    { headers: { 'cache-control': 'no-store' } }
  );
}
