# Sonyria — Studio de chansons

Colle tes paroles → ambiances (style, tempo, tonalité) → mélodies et accords → beat → enregistre ta voix → mixe → karaoké → vidéoclip MP4.

- **Next.js** (App Router) · PWA installable (manifest + service worker)
- **Web Audio** : synthés, batterie, basse, accords, voix guide à formants — tous les sons sont générés, donc libres de droits
- **Studio** : prises micro calées à l'échantillon, écho, réverb, doublage, brillance, panoramique, table de son avec vumètres
- **Karaoké** calculé à partir de l'arrangement + calage automatique sur une voix enregistrée
- **IA** : route serveur `/api/claude` (ambiances, composition, scénario de clip)

## Variables d'environnement (Vercel)

| Nom | Obligatoire | Rôle |
|---|---|---|
| `ANTHROPIC_API_KEY` | oui (pour l'IA) | Clé de l'API Anthropic, jamais envoyée au navigateur |
| `ANTHROPIC_MODEL` | non | Modèle (par défaut `claude-sonnet-5-5`) |
| `SONYRIA_ACCESS_CODE` | non | Code à entrer dans ⚙️ Réglages pour pouvoir utiliser l'IA (protège ta clé) |

## Développement

```bash
npm install
npm run dev
```
