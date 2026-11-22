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
  'Étape {n} sur {t}': 'Step {n} of {t}', 'Étape suivante': 'Next step', 'J’ai compris': 'Got it', 'Masquer le guide': 'Hide the guide', 'Guide des premiers pas': 'Getting started guide',
  'Tes paroles': 'Your lyrics', 'L’ambiance': 'The vibe', 'La mélodie': 'The melody', 'Le beat': 'The beat', 'Le mixage': 'Mixing', 'Partager': 'Share',
  'Écris ou colle ton texte, ou dépose une photo de ton cahier, un PDF ou un fichier Word. Mets [Couplet], [Refrain] ou [Pont] au-dessus de chaque bloc. Le bouton « Corriger avec Claude » corrige l’orthographe sans toucher à tes mots.': 'Type or paste your lyrics, or drop a photo of your notebook, a PDF or a Word file. Put [Verse], [Chorus] or [Bridge] above each block. The “Correct with Claude” button fixes spelling without touching your words.',
  'Touche une des ambiances proposées : tu entends tout de suite un extrait. Tu peux aussi choisir toi-même le style, la tonalité et le tempo juste en dessous.': 'Tap one of the suggested vibes: you hear a preview right away. You can also pick the style, key and tempo yourself just below.',
  'Écoute les propositions A, B, C, D ou demande une mélodie à Claude. Touche un accord pour le changer, ou une syllabe pour monter, descendre ou allonger sa note. Le bouton Partition imprime le tout.': 'Listen to options A, B, C, D or ask Claude for a melody. Tap a chord to change it, or a syllable to raise, lower or lengthen its note. The Sheet music button prints it all.',
  'Choisis la batterie (acoustique, TR-808, LinnDrum), ajuste le tempo et touche les cases de la grille pour créer ton rythme.': 'Choose the drums (acoustic, TR-808, LinnDrum), adjust the tempo and tap the grid to build your rhythm.',
  'Mets des écouteurs, puis enregistre ta voix avec le karaoké qui défile. Tu peux aussi fredonner une mélodie : Sonyria la transcrit et ajoute la musique.': 'Put on headphones, then record your voice with the scrolling karaoke. You can also hum a melody: Sonyria transcribes it and adds the music.',
  'Monte ou baisse chaque instrument et ta voix avec les faders. Ajoute de l’écho et de la réverb à ta voix dans le Studio.': 'Raise or lower each instrument and your voice with the faders. Add echo and reverb to your voice in the Studio.',
  'Crée ton vidéoclip et exporte en MP4 pour TikTok, Reels ou YouTube, ou en WAV. Tes chansons sont sauvegardées automatiquement dans Mes chansons.': 'Make your music video and export as MP4 for TikTok, Reels or YouTube, or as WAV. Your songs are saved automatically in My songs.',
  'Corriger avec Claude': 'Correct with Claude', 'Tes mots sont gardés : seules l’orthographe, les accords et la ponctuation sont corrigés.': 'Your words are kept: only spelling, agreement and punctuation are corrected.',
  'Suggestions de tournures (à toi de choisir)': 'Phrasing suggestions (your choice)', 'Appliquer': 'Apply',
  'Partition': 'Sheet music', 'Imprimer paroles et partition': 'Print lyrics and sheet music', 'Partition complète': 'Full sheet music', 'Paroles + accords': 'Lyrics + chords',
  'Paroles seules': 'Lyrics only', 'Imprimer / PDF': 'Print / PDF', 'Paroles et musique': 'Words and music', 'Gravure de la partition…': 'Engraving the score…',
  'Crédits des sons': 'Sound credits', 'Vrais instruments enregistrés, sous licences libres :': 'Real recorded instruments, under open licences:', 'Détails': 'Details',
  'Chœur (aah)': 'Choir (aah)', 'Piano à queue': 'Grand piano', 'Saxophone ténor': 'Tenor saxophone', 'Saxophone alto': 'Alto saxophone', 'Trompette': 'Trumpet',
  'Guitare électrique': 'Electric guitar', 'Guitare classique': 'Classical guitar', 'Guitare acoustique': 'Acoustic guitar', 'Cordes': 'Strings', 'Piano Rhodes': 'Rhodes piano',
  'Chœur': 'Choir', 'Nappe synthé': 'Synth pad', 'Batterie acoustique': 'Acoustic drums', 'TR-808': 'TR-808', 'LinnDrum': 'LinnDrum', 'Synthétique': 'Synthetic',
  'Créons quelque chose de merveilleux…': 'Let’s create something wonderful…', 'Tes mots prennent vie…': 'Your words are coming to life…',
  'On déchiffre ta plume avec soin…': 'Carefully reading your handwriting…', 'Chaque ligne trouve sa place…': 'Every line is finding its place…',
  'Ta chanson se réveille…': 'Your song is waking up…', 'La magie opère…': 'The magic is happening…', 'On cherche la mélodie parfaite…': 'Finding the perfect melody…',
  'Les notes se posent sur tes mots…': 'Notes are settling onto your words…', 'On peaufine chaque rime…': 'Polishing every rhyme…',
  'Tes vers prennent leur envol…': 'Your lines are taking flight…', 'On cherche l’ambiance idéale…': 'Finding the perfect vibe…',
  'Chaque style a sa couleur…': 'Every style has its colour…', 'On imagine ton clip…': 'Imagining your music video…', 'Lumières, couleurs, action…': 'Lights, colours, action…',
  'Dépose tes compositions': 'Drop your compositions', 'Photo d’un cahier ou d’une feuille manuscrite, PDF, Word ou texte': 'Photo of a notebook or handwritten page, PDF, Word or text',
  'Prendre en photo': 'Take a photo', 'Importer des fichiers': 'Import files', 'Lecture…': 'Reading…',
  'Corriger le français en même temps (manuscrits et PDF)': 'Also correct the spelling and grammar (handwriting and PDF)',
  'Plusieurs pages ? Sélectionne toutes les photos d’un coup, dans l’ordre.': 'Several pages? Select all the photos at once, in order.',
  'Texte importé': 'Imported lyrics', 'Titre': 'Title', 'Remplacer mes paroles': 'Replace my lyrics', 'Ajouter à la suite': 'Add after', 'Annuler': 'Cancel',
  'Paroles importées': 'Lyrics imported', 'Préparation des photos…': 'Preparing the photos…', 'Claude lit ton écriture… ({n} page(s))': 'Claude is reading your handwriting… ({n} page(s))',
  'Claude lit ton document…': 'Claude is reading your document…', 'PDF trop lourd (3 Mo max). Envoie plutôt des photos des pages.': 'PDF too large (3 MB max). Send photos of the pages instead.',
  'Fichier Word illisible': 'Unreadable Word file',
  'Fredonne ou chante : Sonyria ajoute la musique': 'Hum or sing: Sonyria adds the music', 'Fredonner une mélodie': 'Hum a melody',
  'Hum, la-la-la, sifflé : l’app transcrit tes notes et les rejoue.': 'Hum, la-la-la or whistle: the app transcribes your notes and plays them back.',
  'Chanter': 'Sing', 'Ta voix reste ; accords, basse et batterie s’ajoutent autour.': 'Your voice stays; chords, bass and drums are added around it.',
  'Garder ma tonalité': 'Keep my key', 'Poser sur mes paroles': 'Put it on my lyrics', 'Instrument qui rejoue ta mélodie': 'Instrument that plays your melody back',
  'Fredonner maintenant': 'Hum now', 'Chanter maintenant': 'Sing now', 'Terminer et ajouter la musique': 'Finish and add the music',
  'Après le décompte de 4 temps, fredonne au tempo. Choisis d’abord le style dans Paroles ou Beat : l’arrangement suit ce style.': 'After the 4-beat count-in, hum in time. Pick the style first in Lyrics or Beat: the arrangement follows that style.',
  'Chante tes paroles au tempo après le décompte. Le karaoké se cale sur ta voix.': 'Sing your lyrics in time after the count-in. The karaoke syncs to your voice.',
  'Pas de paroles tapées : elles seront transcrites depuis ta voix (Whisper).': 'No lyrics typed: they will be transcribed from your voice (Whisper).',
  'Analyse de ta voix : hauteur des notes…': 'Analysing your voice: note pitches…', 'Harmonisation et arrangement…': 'Harmonising and arranging…',
  'Aucune note détectée : rapproche-toi du micro et réessaie.': 'No notes detected: move closer to the mic and try again.',
  'Voix chantée': 'Sung vocals', 'Fredonnement': 'Humming', 'Ta voix est arrangée : accords, basse et batterie ajoutés': 'Your voice is arranged: chords, bass and drums added',
  'Mélodie reproduite : {n} notes en {k}': 'Melody reproduced: {n} notes in {k}',
  'Adultes': 'Adults', 'Ados': 'Teens', 'Enfants': 'Kids',
};
