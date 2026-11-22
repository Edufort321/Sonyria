'use client';
// Icônes vectorielles (remplacent les emojis) — trait en dégradé néon du logo
import {
  Sparkles, Play, Pause, Mic, MicVocal, Music, Music4, Check, Clapperboard, Drum, Trash2, X, PenLine, Square, Circle, Timer,
  FolderOpen, Pointer, Piano, Dices, Crosshair, SlidersHorizontal, SlidersVertical, Settings, RotateCcw, Eraser, Images, Feather,
  Droplet, Flame, Bell, Volume2, HeadphoneOff, Repeat, FileDown, Share2, ClipboardCopy, FolderPlus, Disc3, Guitar, AudioLines,
  Palette, Film, Moon, Sun, ChevronUp, ChevronDown, ArrowLeftToLine, ArrowRightToLine, Headphones, Heart, Zap, Coffee, TreePalm,
  Radio, Waves, Download, Upload, Wand2, UserRound, ChevronRight, ChevronLeft, Plus, Smartphone, ShieldCheck, Mic2, Leaf, Activity, Camera, FileText, Maximize2, Minimize2,
} from 'lucide-react';

const MAP = {
  sparkles: Sparkles, play: Play, pause: Pause, mic: Mic, vocal: MicVocal, music: Music, score: Music4, check: Check, clap: Clapperboard,
  drum: Drum, trash: Trash2, x: X, pen: PenLine, stop: Square, rec: Circle, timer: Timer, folder: FolderOpen, tap: Pointer, piano: Piano,
  dice: Dices, target: Crosshair, mixerh: SlidersHorizontal, mixer: SlidersVertical, settings: Settings, undo: RotateCcw, eraser: Eraser,
  images: Images, feather: Feather, drop: Droplet, flame: Flame, bell: Bell, volume: Volume2, noecho: HeadphoneOff, loop: Repeat,
  import: FileDown, share: Share2, copy: ClipboardCopy, add: FolderPlus, disc: Disc3, guitar: Guitar, wave: AudioLines, palette: Palette,
  film: Film, moon: Moon, sun: Sun, up: ChevronUp, down: ChevronDown, left: ArrowLeftToLine, right: ArrowRightToLine, headphones: Headphones,
  heart: Heart, zap: Zap, coffee: Coffee, palm: TreePalm, radio: Radio, waves: Waves, download: Download, upload: Upload, wand: Wand2,
  user: UserRound, next: ChevronRight, prev: ChevronLeft, plus: Plus, phone: Smartphone, shield: ShieldCheck, mic2: Mic2, leaf: Leaf, pulse: Activity, camera: Camera, file: FileText, max: Maximize2, min: Minimize2,
};

export default function Ic({ n, size = 18, g = false, fill, style, className = '' }) {
  const C = MAP[n] || Music;
  return <C size={size} strokeWidth={2} className={'ic ' + (g ? 'ig ' : '') + className} fill={fill || 'none'} style={style} aria-hidden="true" />;
}

// définition du dégradé utilisé par les icônes « g »
export function IconDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" /><stop offset="45%" stopColor="#3b82f6" /><stop offset="75%" stopColor="#a855f7" /><stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Icônes néon illustrées (planche fournie par Eric) — /public/ic/*.webp
export function Ico({ n, s = 24, className = '', style, dim }) {
  return <img src={`/ic/${n}.webp`} width={s} height={s} alt="" className={'ico ' + (dim ? 'dim ' : '') + className} style={style} draggable={false} />;
}
