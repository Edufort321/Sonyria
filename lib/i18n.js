// Sonyria — bilinguisme FR / EN. Le texte français sert de clé ; l'anglais est dans EN.
let LANG = 'fr';
const subs = new Set();
export const getLang = () => LANG;
export function setLang(l) {
  LANG = l === 'en' ? 'en' : 'fr';
  try { localStorage.setItem('sonyria-lang', LANG); document.documentElement.lang = LANG; } catch (e) {}
  subs.forEach((f) => f(LANG));
}
export function initLang() {
  let l = null;
  try { l = localStorage.getItem('sonyria-lang'); } catch (e) {}
  if (!l) l = (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  setLang(l);
  return LANG;
}
export const onLang = (f) => { subs.add(f); return () => subs.delete(f); };

// tx('texte français', { n: 3 }) -> traduction avec variables {n}
export function tx(fr, vars) {
  let s = LANG === 'en' ? EN[fr] ?? fr : fr;
  if (vars) Object.entries(vars).forEach(([k, v]) => (s = s.split(`{${k}}`).join(v)));
  return s;
}

const EN = {
  // en-tête, onglets
  'Installer': 'Install', 'Paroles': 'Lyrics', 'Mélodie': 'Melody', 'Table': 'Mixer', 'Studio de chansons': 'Song studio',
  'Salut, {n}': 'Hi, {n}', 'Mes chansons': 'My songs', 'Réglages': 'Settings', 'Mon profil': 'My profile',
  // paroles
  'Titre de la chanson': 'Song title', 'Artiste': 'Artist', 'Tes paroles': 'Your lyrics', 'Colle ton texte ici…': 'Paste your lyrics here…',
  'Astuce : écris': 'Tip: write', 'ou': 'or', '[Refrain]': '[Chorus]', '[Couplet]': '[Verse]', '[Pont]': '[Bridge]',
  'au-dessus d’un bloc. Laisse une ligne vide entre les blocs. Ajoute une nuance dans l’en-tête :': 'above a block. Leave an empty line between blocks. Add a dynamic in the header:',
  '[Pont (tout doucement)]': '[Bridge (very soft)]', '[Refrain (plus puissant)]': '[Chorus (more powerful)]', '(très émouvant)': '(very emotional)',
  '. Pour forcer un découpage de syllabe :': '. To force a syllable split:', 'chan/tent': 'sing/ing',
  'Correction…': 'Correcting…', 'Corriger et adapter avec Claude': 'Correct and adapt with Claude', 'Revenir à mon original': 'Back to my original',
  'Version corrigée': 'Corrected version', 'Utiliser cette version': 'Use this version', 'Garder la mienne': 'Keep mine',
  '{l} lignes · {s} syllabes · {b} sections': '{l} lines · {s} syllables · {b} sections',
  'Ambiances proposées': 'Suggested vibes', 'Demander à Claude': 'Ask Claude',
  'Touche une ambiance : tout est réarrangé et tu entends un extrait.': 'Tap a vibe: everything is rearranged and you hear a preview.',
  'Tonalité': 'Key', 'Majeur': 'Major', 'Mineur': 'Minor', 'majeur': 'major', 'mineur': 'minor', 'maj': 'maj', 'min': 'min',
  'Tempo : {n} BPM': 'Tempo: {n} BPM', 'Plus lent': 'Slower', 'Original': 'Original', 'Plus rapide': 'Faster',
  'Écouter l’arrangement': 'Play the arrangement', 'Claude compose…': 'Claude is composing…', 'Composer la mélodie avec Claude': 'Compose the melody with Claude',
  'Laisser Claude choisir aussi le style, la tonalité et le tempo': 'Let Claude also choose the style, key and tempo',
  'IA non configurée : ajoute ANTHROPIC_API_KEY dans Vercel.': 'AI not configured: add ANTHROPIC_API_KEY in Vercel.',
  // ambiances locales
  'Texte mélancolique : tempo lent, mineur, nappes douces': 'Melancholic lyrics: slow tempo, minor key, soft pads',
  'Émotion intime, groove souple et accords riches': 'Intimate emotion, smooth groove and rich chords',
  'Énergie urbaine sombre, charleys rapides': 'Dark urban energy, fast hi-hats', 'Ambiance feutrée et nostalgique': 'Hushed, nostalgic mood',
  'Pop mineure accrocheuse pour un refrain fort': 'Catchy minor pop for a strong chorus', 'Texte lumineux : pop entraînante en majeur': 'Bright lyrics: upbeat pop in a major key',
  'Flow rythmé, boom-bap posé': 'Rhythmic flow, laid-back boom-bap', 'Chaleur acoustique, guitare pincée': 'Acoustic warmth, plucked guitar',
  'Groove dansant pour un refrain festif': 'Danceable groove for a festive chorus', 'Version électro pour monter l’énergie': 'Electro version to raise the energy',
  ' · lignes chargées, tempo ajusté': ' · dense lines, tempo adjusted',
  // styles
  'Ballade': 'Ballad', 'Hip-hop': 'Hip-hop', 'Reggaeton': 'Reggaeton',
  // mélodie
  'Propositions de mélodie': 'Melody options', 'Grille': 'Chord sheet', 'Proposition {n}': 'Option {n}', 'Autre': 'Another',
  'Voix guide': 'Guide voice', 'Accords': 'Chords', 'Harmonie vocale': 'Vocal harmony', 'Do Ré Mi': 'Do Re Mi', 'perso': 'custom',
  'Voix': 'Voice', 'Synthé': 'Synth', 'Flûte': 'Flute', 'Piano': 'Piano', 'Auto (style)': 'Auto (style)', 'Nappe': 'Pad', 'Piano électrique': 'Electric piano',
  'Guitare pincée': 'Plucked guitar', 'Guitare saturée': 'Distorted guitar', 'Supersaw': 'Supersaw', 'Aucune': 'None', 'Tierce au-dessus': 'Third above',
  'Tierce en dessous': 'Third below', 'Sixte': 'Sixth', 'Octave': 'Octave', 'Couplet': 'Verse', 'Refrain': 'Chorus', 'Pont': 'Bridge',
  'Tout doux': 'Very soft', 'Normal': 'Normal', 'Émouvant': 'Emotional', 'Puissant': 'Powerful', 'Nouvelle mélodie': 'New melody',
  'Choisir l’accord': 'Choose the chord',
  // beat
  'Tap tempo': 'Tap tempo', 'Swing / groove': 'Swing / groove', 'Batterie': 'Drums', 'Métronome': 'Metronome', 'Intro + fin': 'Intro + ending',
  'Boucle': 'Loop', 'Vide': 'Empty', 'Pads en direct': 'Live pads', 'Grosse caisse': 'Kick', 'Caisse claire': 'Snare', 'Clap': 'Clap',
  'Charley': 'Hi-hat', 'Charley ouv.': 'Open hat',
  // studio
  'Enregistrement': 'Recording', 'Activer le micro': 'Turn on the mic', 'Enregistrer à partir de': 'Record from', 'Début de la chanson': 'Start of the song',
  'Décompte 1 mesure': '1-bar count-in', 'Karaoké plein écran': 'Full-screen karaoke', 'Mélodie guide': 'Guide melody', 'Sans écouteurs': 'No headphones',
  'Enregistrer une prise': 'Record a take', 'Arrêter l’enregistrement': 'Stop recording', 'Latence': 'Latency', 'auto': 'auto',
  'Mets des écouteurs pour que le beat ne s’enregistre pas dans le micro. Si ta voix arrive en retard, augmente la latence.': 'Wear headphones so the beat doesn’t bleed into the mic. If your voice lands late, increase the latency.',
  'Importer un MP4 ou un audio': 'Import an MP4 or audio file', 'Recréer la chanson': 'Recreate the song', 'Ajouter comme piste': 'Add as a track', 'Recréer': 'Recreate',
  ': l’app extrait les paroles (Whisper, dans ton téléphone), le tempo, la tonalité et les accords, sépare la voix de l’instrumental, puis rebâtit mélodie et karaoké. Tu retrouves l’original, l’instrumental et la voix dans la table de son. La 1re fois, le modèle de transcription (~80 Mo) se télécharge. Utilise des chansons dont tu as les droits.':
    ': the app extracts the lyrics (Whisper, on your phone), the tempo, key and chords, separates the voice from the instrumental, then rebuilds the melody and karaoke. You get the original, the instrumental and the voice in the mixer. The first time, the transcription model (~80 MB) downloads. Use songs you have the rights to.',
  'Aucune prise pour l’instant.': 'No takes yet.', 'Enregistre ta voix, une guitare ou ton rythme parlé.': 'Record your voice, a guitar or your spoken rhythm.',
  'Début : {s} s · {d} s': 'Start: {s} s · {d} s', 'Volume': 'Volume', 'Écho': 'Echo', 'Temps d’écho': 'Echo time', 'Slap (court)': 'Slap (short)', 'pointée': 'dotted',
  'Répétitions': 'Feedback', 'Réverb': 'Reverb', 'Doublage': 'Doubling', 'Brillance': 'Brightness', 'Panoramique': 'Pan', 'Décaler :': 'Nudge:',
  'Caler le karaoké sur cette voix': 'Sync karaoke to this voice', 'Écouter': 'Play', 'Tempo': 'Tempo',
  'En calant, reprendre aussi les notes que je chante': 'When syncing, also use the notes I sing', 'Supprimer': 'Delete',
  'Naturel': 'Natural', 'Studio': 'Studio', 'Radio': 'Radio', 'Grand écho': 'Big echo', 'Rap sec': 'Dry rap', 'Micro actif — niveau': 'Mic on — level',
  'Voix {n}': 'Voice {n}', 'Instrumental (voix retirée)': 'Instrumental (vocals removed)', 'Voix (approx.)': 'Vocals (approx.)',
  // table
  'Table de son': 'Mixing console', 'Harmonie': 'Harmony', 'Basse': 'Bass', 'Pistes': 'Tracks', 'Master': 'Master', 'Muet': 'Mute', 'Solo': 'Solo',
  'Lance la lecture pour voir les vumètres bouger.': 'Press play to see the meters move.', 'Effets de la voix guide': 'Guide voice effects',
  'Les effets de tes prises (écho, réverb, doublage, brillance) se règlent piste par piste dans l’onglet Studio.': 'Your takes’ effects (echo, reverb, doubling, brightness) are set track by track in the Studio tab.',
  // clip
  'Vidéoclip animé': 'Animated music video', 'Format prêt à publier (1080p)': 'Ready-to-post format (1080p)', 'Thème visuel': 'Visual theme',
  'Texte karaoké': 'Karaoke text', 'Texte qui rebondit': 'Bouncing text', 'Scénario IA': 'AI storyboard', 'Vidéo de fond': 'Background video', 'Vidéo': 'Video',
  'Mes photos': 'My photos', 'Thème simple': 'Simple theme',
  'Claude écrit le scénario : un thème, des couleurs et des mots-clés par section. L’animation suit le son et les paroles s’affichent en karaoké. Tes photos défilent en fond, une par ligne.': 'Claude writes the storyboard: a theme, colours and keywords for each section. The animation follows the sound and the lyrics show as karaoke. Your photos scroll in the background, one per line.',
  'Exporter': 'Export', 'Arrêter et enregistrer': 'Stop and save', 'Partie à exporter': 'Part to export', 'Toute la chanson': 'Whole song', 'Le refrain': 'The chorus',
  'Clip MP4': 'MP4 video', 'Audio MP4': 'MP4 audio', 'WAV studio': 'Studio WAV',
  'Export {w} en cours… garde l’écran allumé.': 'Exporting {w}… keep the screen on.', 'du clip': 'the video', 'WAV': 'WAV', 'MP4': 'MP4',
  'Clip MP4 en H.264 + AAC, 1080p, 30 images/s : prêt pour TikTok, Reels, Shorts et YouTube. 30 s et 60 s partent du 1er refrain. L’export se fait en temps réel ; le WAV (chanson complète) est instantané. Les sons de Sonyria sont générés par l’app, donc libres de droits.': 'H.264 + AAC MP4 video, 1080p, 30 fps: ready for TikTok, Reels, Shorts and YouTube. 30 s and 60 s start at the first chorus. Export runs in real time; the WAV (whole song) is instant. Sonyria’s sounds are generated by the app, so they are royalty-free.',
  'TikTok · Reels · Shorts': 'TikTok · Reels · Shorts', 'YouTube': 'YouTube', 'Instagram carré': 'Instagram square', 'Instagram / Facebook fil': 'Instagram / Facebook feed',
  'Néon rétro': 'Retro neon', 'Galaxie': 'Galaxy', 'Ville la nuit': 'City at night', 'Pluie': 'Rain', 'Océan': 'Ocean', 'Feu': 'Fire', 'Aurore boréale': 'Northern lights', 'Ondes sonores': 'Sound waves',
  // transport, karaoké
  'Enregistrement…': 'Recording…', 'Arrêter': 'Stop', 'Lecture': 'Play', 'Karaoké': 'Karaoke', 'Enregistrer': 'Record', 'Fermer': 'Close', 'OK': 'OK',
  'Ma chanson': 'My song',
  // réglages / profil
  'Prénom': 'First name', 'Nom d’artiste': 'Artist name', 'Avatar': 'Avatar', 'Code d’accès IA': 'AI access code', 'Code défini dans Vercel': 'Code set in Vercel',
  'Notation': 'Notation', 'Profil': 'Profile', 'Prénom, nom d’artiste, avatar': 'Name, artist name, avatar', 'Revoir l’accueil': 'Show the welcome again',
  'Installer l’app': 'Install the app', 'Langue': 'Language',
  'Android / Chrome : bouton « Installer » en haut, ou menu ⋮ → « Installer l’application ». iPhone : Partager → « Sur l’écran d’accueil ».': 'Android / Chrome: “Install” button at the top, or ⋮ menu → “Install app”. iPhone: Share → “Add to Home Screen”.',
  'IA : ': 'AI: ', 'Clé Anthropic détectée ✓': 'Anthropic key detected ✓', 'Aucune clé (ajoute ANTHROPIC_API_KEY dans Vercel)': 'No key (add ANTHROPIC_API_KEY in Vercel)',
  // chansons
  '＋ Nouvelle chanson': '＋ New song', '⧉ Dupliquer': '⧉ Duplicate', 'Rien d’enregistré pour l’instant (sauvegarde automatique).': 'Nothing saved yet (automatic saving).',
  'ouverte': 'open', 'Sans titre': 'Untitled', ' (copie)': ' (copy)',
  // messages
  'Micro refusé : autorise le micro pour Sonyria dans le navigateur.': 'Mic blocked: allow the microphone for Sonyria in your browser.',
  'Prise enregistrée': 'Take saved', 'Tempo introuvable': 'Tempo not found', 'Tempo détecté : {n} BPM': 'Tempo detected: {n} BPM', 'Fichier audio illisible': 'Unreadable audio file',
  'Aucune ligne des paroles ne tombe pendant cette prise.': 'No lyric line falls within this take.', 'Voix trop faible : rapproche-toi du micro et réessaie.': 'Voice too quiet: move closer to the mic and try again.',
  'Karaoké calé sur ta voix : {n} syllabes sur {l} ligne(s)': 'Karaoke synced to your voice: {n} syllables over {l} line(s)',
  'WAV exporté': 'WAV exported', 'Export impossible : ': 'Export failed: ', 'Ton navigateur ne permet pas l’export vidéo. Essaie Chrome.': 'Your browser can’t export video. Try Chrome.',
  'Exporté en WebM (ton navigateur ne gère pas le MP4)': 'Exported as WebM (your browser doesn’t support MP4)', 'Exporté en {f}': 'Exported as {f}',
  'Scénario du clip prêt': 'Video storyboard ready', 'Grille d’accords copiée': 'Chord sheet copied', 'Copie impossible': 'Copy failed',
  'Nouvelle version appliquée — ton original est gardé': 'New version applied — your original is kept', 'Touche encore la corbeille pour supprimer': 'Tap the trash again to delete',
  'Copie créée': 'Copy created', 'Claude a composé {n} ligne(s)': 'Claude composed {n} line(s)', '{n} photo(s) ajoutée(s)': '{n} photo(s) added',
  'Erreur du serveur IA': 'AI server error', 'Réponse vide': 'Empty response', 'Import impossible : ': 'Import failed: ',
  'Lecture du fichier…': 'Reading the file…', 'Séparation voix / instrumental…': 'Separating vocals / instrumental…', 'Tempo, tonalité et accords…': 'Tempo, key and chords…',
  'Reconstruction de la mélodie et du karaoké…': 'Rebuilding the melody and karaoke…', 'Téléchargement du modèle de transcription… {n} %': 'Downloading the transcription model… {n} %',
  'Transcription des paroles… (peut prendre 1 à 3 minutes)': 'Transcribing the lyrics… (may take 1 to 3 minutes)', 'Aucune parole détectée': 'No lyrics detected',
  'Chanson recréée : {b} BPM, {k}, {n} phrases. Vérifie les paroles !': 'Song recreated: {b} BPM, {k}, {n} phrases. Check the lyrics!',
  // accueil
  'Écris · Compose · Chante': 'Write · Compose · Sing', 'Passer': 'Skip',
  'Colle tes paroles : Sonyria compose les mélodies, les accords et le beat. Tu chantes, tu mixes, tu publies.': 'Paste your lyrics: Sonyria composes the melodies, chords and beat. You sing, you mix, you post.',
  'Mélodies et accords': 'Melodies and chords', 'Plusieurs propositions pour ton texte, dans le style et le tempo que tu choisis.': 'Several options for your lyrics, in the style and tempo you choose.',
  'Karaoké vivant': 'Live karaoke', 'Les paroles défilent au tempo et se calent sur ta propre voix.': 'Lyrics scroll in time and sync to your own voice.',
  'Studio complet': 'Full studio', 'Enregistrement, écho, réverb, table de son et beat table.': 'Recording, echo, reverb, mixing console and beat table.',
  'Clips prêts à publier': 'Ready-to-post videos', 'MP4 1080p pour TikTok, Reels, Shorts et YouTube.': '1080p MP4 for TikTok, Reels, Shorts and YouTube.',
  'Commencer': 'Get started', 'Faisons connaissance': 'Let’s get to know you', 'Ton prénom et ton nom d’artiste apparaissent dans tes clips et tes exports.': 'Your name and artist name appear in your videos and exports.',
  'Ton prénom': 'Your first name', 'Nom d’artiste (facultatif)': 'Artist name (optional)', 'Ton nom de scène': 'Your stage name', 'Ton avatar': 'Your avatar', 'Tous les avatars': 'All avatars',
  'Retour': 'Back', 'Continuer': 'Continue', 'Par quoi on commence ?': 'Where do we start?', 'Par quoi on commence, {n} ?': 'Where do we start, {n}?',
  'Tu pourras créer autant de chansons que tu veux ; tout est sauvegardé sur ton appareil.': 'You can create as many songs as you want; everything is saved on your device.',
  'Coller mes paroles': 'Paste my lyrics', 'Sonyria propose des ambiances, des mélodies et un beat pour ton texte.': 'Sonyria suggests vibes, melodies and a beat for your lyrics.',
  'Retravailler un MP4': 'Rework an MP4', 'Importe une chanson : paroles, tempo, accords et karaoké sont recréés.': 'Import a song: lyrics, tempo, chords and karaoke are recreated.',
  'Explorer l’exemple': 'Explore the example', 'Une chanson prête à écouter pour découvrir toutes les fonctions.': 'A ready-to-play song to discover every feature.',
  'Installer Sonyria': 'Install Sonyria', 'Sur ton écran d’accueil, en plein écran, même hors ligne.': 'On your home screen, full screen, even offline.',
  'iPhone : touche Partager, puis « Sur l’écran d’accueil ».': 'iPhone: tap Share, then “Add to Home Screen”.',
  'Bienvenue': 'Welcome',
  'Adultes': 'Adults', 'Ados': 'Teens', 'Enfants': 'Kids',
};
