'use client';

import * as React from 'react';
import Card from '@components/Card';
import SimpleTable from '@components/SimpleTable';
import Input from '@components/Input';
import ActionButton from '@components/ActionButton';
import ButtonGroup from '@components/ButtonGroup';
import ActionBar from '@components/ActionBar';
import ThemeDropdown from '@components/ThemeDropdown';
import NeighborTable from '@components/NeighborTable';
import TrackTable from '@components/TrackTable';
import AreaChart from '@components/AreaChart';
import YoutubePlayer, { YoutubePlayerActions } from '@components/YoutubePlayer';
import DateRangeModal from '@components/DateRangeModal';
import ASCII_BANNER from '@/lib/ascii';
import { formatName } from '@/lib/formatName';
import styles from './page.module.css';

const LOADER_FRAMES = ['|', '/', '-', '\\'];

type FetchMode = 'artists' | 'albums' | 'tracks' | 'stats' | 'neighbors';

function Spinner() {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % LOADER_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);
  return <span>{LOADER_FRAMES[frame]}</span>;
}

function LineLoader({ mode }: { mode: FetchMode }) {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % LOADER_FRAMES.length), 120);
    return () => clearInterval(id);
  }, []);
  const label = mode === 'albums' ? 'ALBUMS' : mode === 'tracks' ? 'TRACKS' : mode === 'stats' ? 'OVERVIEW' : mode === 'neighbors' ? 'NEIGHBOURS' : 'ARTISTS';
  return (
    <div className={styles.loader}>
      {LOADER_FRAMES[frame]} FETCHING {label}...
    </div>
  );
}

type Period = 'overall' | '7day' | '1month' | '3month' | '6month' | '12month' | 'this_month' | 'this_year' | 'custom';
type Theme = 'light' | 'dracula' | 'gruvbox' | 'github' | 'monokai' | 'tokyo' | 'catppuccin';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'LIGHT' },
  { id: 'dracula', label: 'DRACULA' },
  { id: 'gruvbox', label: 'GRUVBOX' },
  { id: 'github', label: 'GITHUB DARK' },
  { id: 'monokai', label: 'MONOKAI' },
  { id: 'tokyo', label: 'TOKYO NIGHT' },
  { id: 'catppuccin', label: 'CATPPUCCIN' },
];

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const _now = new Date();
const THIS_MONTH_LABEL = `THIS ${MONTH_NAMES[_now.getMonth()]}`;
const THIS_YEAR_LABEL = `THIS ${_now.getFullYear()}`;

const PERIOD_LABELS: Record<Period, string> = {
  overall: 'ALL TIME',
  '7day': '7 DAYS',
  '1month': '1 MONTH',
  '3month': '3 MONTHS',
  '6month': '6 MONTHS',
  '12month': '12 MONTHS',
  this_month: THIS_MONTH_LABEL,
  this_year: THIS_YEAR_LABEL,
  custom: 'CUSTOM DATE',
};

const PERIOD_LABEL_TO_VALUE: Record<string, Period> = Object.fromEntries(
  (Object.keys(PERIOD_LABELS) as Period[]).map((p) => [PERIOD_LABELS[p], p])
);

const PERIOD_ITEMS = (Object.keys(PERIOD_LABELS) as Period[]).map((p) => ({ id: p, label: PERIOD_LABELS[p] }));

const THEME_LABEL_TO_VALUE: Record<string, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.label, t.id])
);

interface Artist {
  rank: number;
  name: string;
  playcount: number;
  url: string;
}

interface Album {
  rank: number;
  name: string;
  artist: string;
  playcount: number;
  url: string;
  imageUrl: string | null;
}

interface Track {
  rank: number;
  name: string;
  artist: string;
  playcount: number;
  url: string;
}

interface Neighbor {
  rank: number;
  username: string;
  sharedArtists: string[];
  avatar: string | null;
  url: string;
}

interface UserStats {
  username: string;
  realname: string | null;
  scrobbles: number;
  artists: number;
  albums: number;
  tracks: number;
  country: string | null;
  registered: number | null;
}

function TrackYtButton({ artist, track, onPlay }: { artist: string; track: string; onPlay: (videoId: string) => void }) {
  const [loading, setLoading] = React.useState(false);
  const [videoId, setVideoId] = React.useState<string | null>(null);

  const handleClick = async () => {
    if (videoId) { onPlay(videoId); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`);
      const data = await res.json();
      if (data.videoId) { setVideoId(data.videoId); onPlay(data.videoId); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={styles.ytBtn} onClick={handleClick} disabled={loading} title="Play on YouTube">
      {loading ? '...' : '▶'}
    </button>
  );
}

interface AlbumMeta {
  artUrl: string | null;
  releaseDate: string | null;
  tracks: { rank: number; name: string; duration: number }[];
  totalDuration: number;
  listeners: number;
  playcount: number;
  tags: string[];
}

type ImageView = 'pixel' | 'original';

function formatDuration(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function Home() {
  const [theme, setTheme] = React.useState<Theme>('github');
  const [username, setUsername] = React.useState('');
  const [period, setPeriod] = React.useState<Period>('overall');

  React.useEffect(() => {
    const saved = localStorage.getItem('lastfm-username');
    if (saved) setUsername(saved);
  }, []);
  const [customDateRange, setCustomDateRange] = React.useState<{ from: string; to: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fetchMode, setFetchMode] = React.useState<FetchMode>('artists');
  const [showPlays, setShowPlays] = React.useState(true);
  const [resultsExpanded, setResultsExpanded] = React.useState(false);
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [albums, setAlbums] = React.useState<Album[]>([]);
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [neighbors, setNeighbors] = React.useState<Neighbor[]>([]);
  const [userStats, setUserStats] = React.useState<UserStats | null>(null);
  const [overviewTop, setOverviewTop] = React.useState<{ artists: Artist[]; albums: Album[]; tracks: Track[] } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [lastFetched, setLastFetched] = React.useState<{
    username: string;
    period: string;
    mode: FetchMode;
    customRange?: { from: string; to: string };
  } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [hoveredAlbumIndex, setHoveredAlbumIndex] = React.useState<number | null>(null);
  const [lockedAlbumIndex, setLockedAlbumIndex] = React.useState<number | null>(null);
  const [albumMetas, setAlbumMetas] = React.useState<(AlbumMeta | null)[]>([]);
  const [albumMetasLoading, setAlbumMetasLoading] = React.useState(false);
  const [imageView, setImageView] = React.useState<ImageView>('pixel');
  const [tracklistOpen, setTracklistOpen] = React.useState(true);
  const [overviewChart, setOverviewChart] = React.useState<{ days: { date: string; count: number }[]; total: number } | null>(null);
  const [nowPlaying, setNowPlaying] = React.useState<{ track: string; artist: string; album: string | null; imageUrl: string | null } | null>(null);
  const [nowPlayingLoading, setNowPlayingLoading] = React.useState(false);
  const [savedNeighborState, setSavedNeighborState] = React.useState<{ username: string; neighbors: Neighbor[] } | null>(null);
  const [pixelArtCache, setPixelArtCache] = React.useState<Record<number, string[] | null>>({});
  const [pixelLoading, setPixelLoading] = React.useState(false);
  const pixelFetchedRef = React.useRef<Set<number>>(new Set());
  const [ytEmbed, setYtEmbed] = React.useState<{ videoId: string; title: string; source: 'album' | 'tracks'; albumIdx: number; trackIdx: number } | null>(null);
  const [ytMini, setYtMini] = React.useState(false);
  const [ytPlaying, setYtPlaying] = React.useState(false);
  const [ytNavLoading, setYtNavLoading] = React.useState(false);
  const ytPlayerActionsRef = React.useRef<YoutubePlayerActions | null>(null);
  const ytVideoCacheRef = React.useRef<Record<string, string>>({});
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const leaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const themes: Theme[] = ['light', 'dracula', 'gruvbox', 'github', 'monokai', 'tokyo', 'catppuccin'];
    themes.forEach((t) => document.body.classList.remove(`theme-${t}`));
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  React.useEffect(() => {
    const activeIndex = lockedAlbumIndex ?? hoveredAlbumIndex;
    if (activeIndex === null) return;
    if (pixelFetchedRef.current.has(activeIndex)) return;
    const meta = albumMetas[activeIndex];
    const artUrl = meta?.artUrl ?? albums[activeIndex]?.imageUrl;
    if (!artUrl) return;

    pixelFetchedRef.current.add(activeIndex);
    setPixelLoading(true);
    fetch(`/api/pixel-art?artUrl=${encodeURIComponent(artUrl)}`)
      .then((r) => r.json())
      .then((data) => setPixelArtCache((prev) => ({ ...prev, [activeIndex]: data.pixels ?? null })))
      .catch(() => setPixelArtCache((prev) => ({ ...prev, [activeIndex]: null })))
      .finally(() => setPixelLoading(false));
  }, [lockedAlbumIndex, hoveredAlbumIndex, albumMetas]);

  React.useEffect(() => {
    setTracklistOpen(false);
  }, [lockedAlbumIndex, hoveredAlbumIndex]);

  const closeYtEmbed = React.useCallback(() => {
    setYtEmbed(null);
    setYtMini(false);
    setYtPlaying(false);
  }, []);

  const handleAutoNext = React.useCallback(() => {
    if (!ytEmbed) return;
    if (ytEmbed.source === 'tracks') {
      if (tracks[ytEmbed.trackIdx + 1]) handleTrackNavigate(ytEmbed.trackIdx + 1);
    } else {
      if (albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1]) {
        handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1);
      }
    }
  }, [ytEmbed, tracks, albumMetas]);

  const ytPlayingRef = React.useRef(ytPlaying);
  React.useEffect(() => { ytPlayingRef.current = ytPlaying; });

  React.useEffect(() => {
    if (!ytEmbed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeYtEmbed(); return; }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (ytPlayingRef.current) ytPlayerActionsRef.current?.pause();
        else ytPlayerActionsRef.current?.play();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ytEmbed]);

  const handleFetch = async (mode: FetchMode = fetchMode, overridePeriod?: Period, overrideCustomRange?: { from: string; to: string } | null, overrideUsername?: string, limit = 10) => {
    const activeUsername = (overrideUsername ?? username).trim();
    if (!activeUsername) {
      setError('Enter your Last.fm username.');
      return;
    }
    const activePeriod = overridePeriod ?? period;
    const activeCustomRange = overrideCustomRange !== undefined ? overrideCustomRange : customDateRange;
    if (mode === 'neighbors') setSavedNeighborState(null);
    setResultsExpanded(limit > 10);
    setLoading(true);
    setError('');
    setArtists([]);
    setAlbums([]);
    setTracks([]);
    setNeighbors([]);
    setUserStats(null);
    setOverviewTop(null);
    setAlbumMetas([]);
    setPixelArtCache({});
    pixelFetchedRef.current = new Set<number>();
    setOverviewChart(null);
    setNowPlaying(null);
    setNowPlayingLoading(false);
    setHoveredAlbumIndex(null);
    setLockedAlbumIndex(null);
    if (!ytMini) setYtEmbed(null);
    const start = Date.now();
    try {
      if (mode === 'stats') {
        const u = encodeURIComponent(activeUsername);
        const nowTs = Math.floor(Date.now() / 1000);
        const sixMonthsAgoTs = nowTs - 182 * 86400;
        setNowPlayingLoading(true);
        const [statsRes, artistsRes, albumsRes, tracksRes, chartRes] = await Promise.all([
          fetch(`/api/stats?username=${u}`),
          fetch(`/api/top-artists?username=${u}&period=overall`),
          fetch(`/api/top-albums?username=${u}&period=overall`),
          fetch(`/api/top-tracks?username=${u}&period=overall`),
          fetch(`/api/scrobble-chart?username=${u}&from=${sixMonthsAgoTs}&to=${nowTs}`),
        ]);
        const [statsData, artistsData, albumsData, tracksData, chartData] = await Promise.all([
          statsRes.json(), artistsRes.json(), albumsRes.json(), tracksRes.json(), chartRes.json(),
        ]);
        const elapsed = Date.now() - start;
        if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
        if (!statsRes.ok) { setError(statsData.error || 'Something went wrong.'); }
        else {
          setUserStats(statsData as UserStats);
          setOverviewTop({
            artists: artistsRes.ok ? (artistsData.artists ?? []).slice(0, 5) : [],
            albums:  albumsRes.ok  ? (albumsData.albums   ?? []).slice(0, 5) : [],
            tracks:  tracksRes.ok  ? (tracksData.tracks   ?? []).slice(0, 5) : [],
          });
          if (chartRes.ok) setOverviewChart(chartData);
          setLastFetched({ username: statsData.username, period: '', mode: 'stats' });
          fetch(`/api/now-playing?username=${u}`)
            .then((r) => r.json())
            .then((d) => { if (d.nowPlaying) setNowPlaying(d.nowPlaying); })
            .finally(() => setNowPlayingLoading(false));
        }
        return;
      }
      if (mode === 'neighbors') {
        const res = await fetch(`/api/neighbors?username=${encodeURIComponent(activeUsername)}`);
        const data = await res.json();
        const elapsed = Date.now() - start;
        if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
        if (!res.ok) { setError(data.error || 'Something went wrong.'); }
        else {
          setNeighbors(data.neighbors);
          setLastFetched({ username: data.username, period: '', mode: 'neighbors' });
        }
        return;
      }
      const base = `/api/${mode === 'albums' ? 'top-albums' : mode === 'tracks' ? 'top-tracks' : 'top-artists'}`;
      let params: string;
      if (activePeriod === 'custom' && activeCustomRange) {
        const fromTs = Math.floor(new Date(activeCustomRange.from + 'T00:00:00Z').getTime() / 1000);
        const toTs = Math.floor(new Date(activeCustomRange.to + 'T23:59:59Z').getTime() / 1000);
        params = `username=${encodeURIComponent(activeUsername)}&from=${fromTs}&to=${toTs}&limit=${limit}`;
      } else if (activePeriod === 'this_month' || activePeriod === 'this_year') {
        const now = new Date();
        const fromDate = activePeriod === 'this_month'
          ? new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
          : new Date(Date.UTC(now.getFullYear(), 0, 1));
        const fromTs = Math.floor(fromDate.getTime() / 1000);
        const toTs = Math.floor(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)).getTime() / 1000);
        params = `username=${encodeURIComponent(activeUsername)}&from=${fromTs}&to=${toTs}&limit=${limit}`;
      } else {
        params = `username=${encodeURIComponent(activeUsername)}&period=${activePeriod}&limit=${limit}`;
      }
      const res = await fetch(`${base}?${params}`);
      const data = await res.json();
      const elapsed = Date.now() - start;
      if (elapsed < 1000) await new Promise((r) => setTimeout(r, 1000 - elapsed));
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        if (mode === 'albums') {
          setAlbums(data.albums);
          setAlbumMetasLoading(true);
          Promise.all(
            (data.albums as Album[]).map(async (a) => {
              try {
                const r = await fetch(`/api/album-info?artist=${encodeURIComponent(a.artist)}&album=${encodeURIComponent(a.name)}`);
                return r.ok ? (await r.json() as AlbumMeta) : null;
              } catch { return null; }
            })
          ).then((metas) => { setAlbumMetas(metas); setAlbumMetasLoading(false); });
        } else if (mode === 'tracks') {
          setTracks(data.tracks);
        } else {
          setArtists(data.artists);
        }
        setLastFetched({
          username: data.username,
          period: (activePeriod === 'this_month' || activePeriod === 'this_year') ? activePeriod : data.period,
          mode,
          customRange: activePeriod === 'custom' && activeCustomRange ? activeCustomRange : undefined,
        });
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeClick = (mode: FetchMode) => {
    setFetchMode(mode);
    handleFetch(mode);
  };

  const handleAlbumHover = (index: number) => {
    if (lockedAlbumIndex !== null) return;
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setHoveredAlbumIndex(index);
  };

  const handleAlbumLeave = () => {
    if (lockedAlbumIndex !== null) return;
    leaveTimer.current = setTimeout(() => setHoveredAlbumIndex(null), 300);
  };

  const handleAlbumClick = (index: number) => {
    setLockedAlbumIndex((prev) => prev === index ? null : index);
  };

  const handleNeighborClick = (index: number) => {
    const neighbor = neighbors[index];
    if (!neighbor) return;
    setSavedNeighborState({ username, neighbors });
    setUsername(neighbor.username);
    localStorage.setItem('lastfm-username', neighbor.username);
    setFetchMode('albums');
    setPeriod('overall');
    handleFetch('albums', 'overall', null, neighbor.username);
  };

  const handleBackToNeighbors = () => {
    if (!savedNeighborState) return;
    setUsername(savedNeighborState.username);
    localStorage.setItem('lastfm-username', savedNeighborState.username);
    setNeighbors(savedNeighborState.neighbors);
    setAlbums([]);
    setAlbumMetas([]);
    setFetchMode('neighbors');
    setLastFetched({ username: savedNeighborState.username, period: '', mode: 'neighbors' });
    setSavedNeighborState(null);
  };

  const handleYtNavigate = async (albumIdx: number, trackIdx: number) => {
    if (ytNavLoading) return;
    const meta = albumMetas[albumIdx];
    const track = meta?.tracks[trackIdx];
    const album = albums[albumIdx];
    if (!track || !album) return;
    const cacheKey = `${album.artist}::${track.name}`;
    if (ytVideoCacheRef.current[cacheKey]) {
      setYtEmbed({ videoId: ytVideoCacheRef.current[cacheKey], title: `${album.artist} — ${track.name}`, source: 'album', albumIdx, trackIdx });
      return;
    }
    setYtNavLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(album.artist)}&track=${encodeURIComponent(track.name)}`);
      const data = await res.json();
      if (data.videoId) {
        ytVideoCacheRef.current[cacheKey] = data.videoId;
        setYtEmbed({ videoId: data.videoId, title: `${album.artist} — ${track.name}`, source: 'album', albumIdx, trackIdx });
      }
    } finally {
      setYtNavLoading(false);
    }
  };

  const handleTrackPlay = (trackIdx: number, videoId: string) => {
    const t = tracks[trackIdx];
    if (!t) return;
    setYtEmbed({ videoId, title: `${t.artist} — ${t.name}`, source: 'tracks', albumIdx: -1, trackIdx });
  };

  const handleTrackNavigate = async (trackIdx: number) => {
    if (ytNavLoading) return;
    const t = tracks[trackIdx];
    if (!t) return;
    const cacheKey = `${t.artist}::${t.name}`;
    if (ytVideoCacheRef.current[cacheKey]) {
      setYtEmbed({ videoId: ytVideoCacheRef.current[cacheKey], title: `${t.artist} — ${t.name}`, source: 'tracks', albumIdx: -1, trackIdx });
      return;
    }
    setYtNavLoading(true);
    try {
      const res = await fetch(`/api/yt-link?artist=${encodeURIComponent(t.artist)}&track=${encodeURIComponent(t.name)}`);
      const data = await res.json();
      if (data.videoId) {
        ytVideoCacheRef.current[cacheKey] = data.videoId;
        setYtEmbed({ videoId: data.videoId, title: `${t.artist} — ${t.name}`, source: 'tracks', albumIdx: -1, trackIdx });
      }
    } finally {
      setYtNavLoading(false);
    }
  };

  const handlePeriodSelect = (id: string) => {
    const value = id as Period;
    if (value === 'custom') {
      setIsModalOpen(true);
    } else {
      setPeriod(value);
      const activeMode = lastFetched?.mode ?? fetchMode;
      if (username.trim() && activeMode !== 'stats' && activeMode !== 'neighbors') {
        handleFetch(activeMode, value);
      }
    }
  };

  const handleModalConfirm = (from: string, to: string) => {
    const range = { from, to };
    setCustomDateRange(range);
    setPeriod('custom');
    setIsModalOpen(false);
    if (username.trim()) {
      handleFetch(lastFetched?.mode ?? fetchMode, 'custom', range);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleExport = async () => {
    if (!resultsRef.current) return;
    setExporting(true);
    try {
      const rows = resultsRef.current.querySelectorAll<HTMLTableRowElement>('tbody tr');
      rows.forEach((row) => {
        row.style.animationName = 'none';
        row.style.opacity = '1';
      });

      const html2canvas = (await import('html2canvas')).default;
      const bodyStyle = getComputedStyle(document.body);
      const bgColor = bodyStyle.getPropertyValue('--theme-background').trim() || '#ffffff';
      const textColor = bodyStyle.getPropertyValue('--theme-text').trim() || '#000000';
      const overlayColor = bodyStyle.getPropertyValue('--theme-overlay').trim() || '#888888';
      const elStyle = getComputedStyle(resultsRef.current);
      const fontFamily = elStyle.fontFamily;
      const basePx = parseFloat(elStyle.fontSize);

      const resultsCanvas = await html2canvas(resultsRef.current, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const scale = 2;
      const pad = 24 * scale;
      const gap = 16 * scale;
      const asciiFontPx = basePx * 0.5 * scale;
      const asciiLineH = asciiFontPx * 1.2;
      const asciiLines = ASCII_BANNER.split('\n');
      const asciiBlockH = asciiLines.length * asciiLineH;
      const footerFontPx = basePx * scale;

      const W = resultsCanvas.width + pad * 2;
      const H = pad + asciiBlockH + gap + resultsCanvas.height + gap + footerFontPx * 1.5 + pad;

      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const ctx = out.getContext('2d')!;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = textColor;
      ctx.font = `${asciiFontPx}px ${fontFamily}`;
      ctx.textBaseline = 'top';
      asciiLines.forEach((line, i) => ctx.fillText(line, pad, pad + i * asciiLineH));
      ctx.restore();

      ctx.drawImage(resultsCanvas, pad, pad + asciiBlockH + gap);

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = overlayColor;
      ctx.font = `${footerFontPx}px ${fontFamily}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'right';
      ctx.fillText('analyzed by musilog.me', W - pad, pad + asciiBlockH + gap + resultsCanvas.height + gap + footerFontPx);
      ctx.restore();

      const link = document.createElement('a');
      link.download = `lastfm-top-${lastFetched?.mode ?? 'artists'}-${lastFetched?.username ?? 'export'}.png`;
      link.href = out.toDataURL('image/png');
      link.click();
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  const hasResults = artists.length > 0 || albums.length > 0 || tracks.length > 0 || neighbors.length > 0 || userStats !== null || overviewTop !== null;

  const statsRows: string[][] = userStats ? [
    ['SCROBBLES', userStats.scrobbles.toLocaleString()],
    ['ARTISTS', userStats.artists.toLocaleString()],
    ['ALBUMS', userStats.albums.toLocaleString()],
    ['TRACKS', userStats.tracks.toLocaleString()],
    ...(userStats.country ? [['COUNTRY', userStats.country]] : []),
    ...(userStats.registered ? [['MEMBER SINCE', new Date(userStats.registered * 1000).getFullYear().toString()]] : []),
  ] : [];

  const tableData: React.ReactNode[][] =
    artists.length > 0
      ? showPlays
        ? [['#', 'ARTIST', 'PLAYS'], ...artists.map((a) => [String(a.rank), formatName(a.name), a.playcount.toLocaleString()])]
        : [['#', 'ARTIST'], ...artists.map((a) => [String(a.rank), formatName(a.name)])]
      : userStats
      ? [['STAT', 'VALUE'], ...statsRows]
      : showPlays
      ? [['#', 'ALBUM', 'ARTIST', 'PLAYS'], ...albums.map((a) => [String(a.rank), formatName(a.name), a.artist, a.playcount.toLocaleString()])]
      : [['#', 'ALBUM', 'ARTIST'], ...albums.map((a) => [String(a.rank), formatName(a.name), a.artist])];

  const tableAlign = (
    artists.length > 0 ? (showPlays ? ['left', 'left', 'right'] : ['left', 'left']) :
    userStats ? ['left', 'right'] :
    (showPlays ? ['left', 'left', 'left', 'right'] : ['left', 'left', 'left'])
  ) as ('left' | 'right')[];

  const periodDisplay = lastFetched?.customRange
    ? `${lastFetched.customRange.from} TO ${lastFetched.customRange.to}`
    : PERIOD_LABELS[lastFetched?.period as Period] ?? lastFetched?.period ?? '';

  const modeLabel =
    lastFetched?.mode === 'albums' ? 'TOP ALBUMS' :
    lastFetched?.mode === 'tracks' ? 'TOP SONGS' :
    lastFetched?.mode === 'stats' ? 'OVERVIEW' :
    lastFetched?.mode === 'neighbors' ? 'NEIGHBOURS' :
    'TOP ARTISTS';
  const noPeriodMode = lastFetched?.mode === 'stats' || lastFetched?.mode === 'neighbors';
  const resultTitle = lastFetched
    ? noPeriodMode
      ? `${modeLabel} — @${lastFetched.username.toUpperCase()}`
      : `${modeLabel} — @${lastFetched.username.toUpperCase()} — ${periodDisplay}`
    : 'TOP 10';

  const pendingModeLabel =
    fetchMode === 'albums' ? 'TOP ALBUMS' :
    fetchMode === 'tracks' ? 'TOP SONGS' :
    fetchMode === 'stats' ? 'OVERVIEW' :
    fetchMode === 'neighbors' ? 'NEIGHBOURS' :
    'TOP ARTISTS';
  const pendingPeriodDisplay = period === 'custom' && customDateRange
    ? `${customDateRange.from} TO ${customDateRange.to}`
    : PERIOD_LABELS[period];
  const pendingTitle = (fetchMode === 'stats' || fetchMode === 'neighbors')
    ? `${pendingModeLabel} — @${username.trim().toUpperCase()}`
    : `${pendingModeLabel} — @${username.trim().toUpperCase()} — ${pendingPeriodDisplay}`;

  return (
    <div className={styles.wrapper}>
    <ActionBar
      items={ytEmbed ? [
        { hotkey: 'K', body: ytPlaying ? 'PAUSE' : 'PLAY', onClick: () => ytPlaying ? ytPlayerActionsRef.current?.pause() : ytPlayerActionsRef.current?.play() },
        { hotkey: 'ESC', body: 'STOP', onClick: closeYtEmbed },
      ] : []}
      rightItems={[{ hotkey: '♥', body: 'SUPPORT', onClick: () => window.open('https://deionmenor.com', '_blank') }]}
    >
      <ThemeDropdown hotkey="◑" label="THEME" items={THEMES} currentId={theme} onSelect={(id) => setTheme(id as Theme)} />
    </ActionBar>
    <main className={styles.main}>
      <div className={styles.banner}>
        <Card title="MUSILOG.FM">
          <div className={styles.bannerInner}>
            <div className={styles.bannerForm}>
              <Input
                label="USERNAME"
                placeholder="e.g. rj"
                prefix="@"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  localStorage.setItem('lastfm-username', e.target.value);
                  setSavedNeighborState(null);
                }}
                onKeyDown={handleKeyDown}
                isBlink={true}
              />
              <ButtonGroup
                isFull
                items={[
                  { body: 'TOP ALBUMS',  selected: fetchMode === 'albums',    onClick: () => handleModeClick('albums') },
                  { body: 'TOP ARTISTS', selected: fetchMode === 'artists',   onClick: () => handleModeClick('artists') },
                  { body: 'TOP SONGS',   selected: fetchMode === 'tracks',    onClick: () => handleModeClick('tracks') },
                  { body: 'NEIGHBOURS',  selected: fetchMode === 'neighbors', onClick: () => handleModeClick('neighbors') },
                  { body: 'OVERVIEW',    selected: fetchMode === 'stats',     onClick: () => handleModeClick('stats') },
                ]}
              />
              {error && <div className={styles.error}>{error}</div>}
            </div>
            <pre className={styles.bannerPre}>{ASCII_BANNER}</pre>
          </div>
        </Card>
      </div>
      <div className={styles.pageRow}>
      <div className={styles.container}>
        {(loading || hasResults) && !(ytEmbed && !ytMini) && (
          <div className={styles.resultsToolbar}>
            {savedNeighborState && (
              <ActionButton hotkey="←" onClick={handleBackToNeighbors}>NEIGHBOURS</ActionButton>
            )}
            {fetchMode !== 'stats' && fetchMode !== 'neighbors' && (
              <ThemeDropdown
                label={period === 'custom' && customDateRange ? `${customDateRange.from} → ${customDateRange.to}` : PERIOD_LABELS[period]}
                items={PERIOD_ITEMS}
                currentId={period}
                onSelect={handlePeriodSelect}
              />
            )}
            <div className={styles.toolbarRight}>
              <button className={styles.exportBtn} onClick={handleExport} disabled={exporting || loading || !hasResults}>
                {exporting ? '...' : '↓ EXPORT'}
              </button>
              <button className={styles.playsToggle} onClick={() => setShowPlays((v) => !v)}>
                {showPlays ? '[X]' : '[ ]'} PLAYS
              </button>
            </div>
          </div>
        )}

        {loading && (
          <Card title={pendingTitle}>
            <LineLoader mode={fetchMode} />
          </Card>
        )}

        {hasResults && (
          <>
            {ytEmbed && !ytMini ? (
              <Card title={ytEmbed.title}>
                <div className={styles.ytEmbedWrapper}>
                  <YoutubePlayer videoId={ytEmbed.videoId} onEnded={handleAutoNext} onPlayingChange={setYtPlaying} onPlayerReady={(a) => { ytPlayerActionsRef.current = a; }} />
                </div>
                <div className={styles.ytControls}>
                  <div className={styles.ytNavButtons}>
                    {ytEmbed.source === 'tracks' ? (
                      <>
                        {ytEmbed.trackIdx > 0 && (
                          <ActionButton hotkey="←" onClick={() => handleTrackNavigate(ytEmbed.trackIdx - 1)}>
                            {ytNavLoading ? '...' : 'PREV'}
                          </ActionButton>
                        )}
                        {tracks[ytEmbed.trackIdx + 1] && (
                          <ActionButton hotkey="→" onClick={() => handleTrackNavigate(ytEmbed.trackIdx + 1)}>
                            {ytNavLoading ? '...' : 'NEXT'}
                          </ActionButton>
                        )}
                      </>
                    ) : (
                      <>
                        {ytEmbed.trackIdx > 0 && (
                          <ActionButton hotkey="←" onClick={() => handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1)}>
                            {ytNavLoading ? '...' : 'PREV'}
                          </ActionButton>
                        )}
                        {albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1] && (
                          <ActionButton hotkey="→" onClick={() => handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1)}>
                            {ytNavLoading ? '...' : 'NEXT'}
                          </ActionButton>
                        )}
                      </>
                    )}
                  </div>
                  <div className={styles.ytNavButtons}>
                    <ActionButton hotkey="⊟" onClick={() => setYtMini(true)}>MINI</ActionButton>
                    <ActionButton hotkey="ESC" onClick={closeYtEmbed}>EXIT</ActionButton>
                  </div>
                </div>
              </Card>
            ) : (
              <>
              <div className={styles.results} ref={resultsRef}>
                <Card title={resultTitle}>
                  {neighbors.length > 0 ? (
                    <NeighborTable
                      key={`${lastFetched?.username}-neighbors`}
                      neighbors={neighbors}
                      onRowClick={handleNeighborClick}
                    />
                  ) : tracks.length > 0 ? (
                    <TrackTable
                      key={`${lastFetched?.username}-${lastFetched?.period}-tracks`}
                      tracks={tracks}
                      onPlay={handleTrackPlay}
                      showPlays={showPlays}
                      headerVariant="blue"
                    />
                  ) : userStats ? (
                    <>
                    {(nowPlayingLoading || nowPlaying) && (
                      <div className={styles.nowPlaying}>
                        {nowPlayingLoading ? (
                          <div className={styles.nowPlayingInfo}>
                            <div className={styles.nowPlayingLabel}><Spinner /> NOW PLAYING</div>
                          </div>
                        ) : nowPlaying && (
                          <>
                            {nowPlaying.imageUrl && (
                              <img src={nowPlaying.imageUrl} alt={nowPlaying.album ?? nowPlaying.track} className={styles.nowPlayingArt} />
                            )}
                            <div className={styles.nowPlayingInfo}>
                              <div className={styles.nowPlayingLabel}>NOW PLAYING</div>
                              <div className={styles.nowPlayingTrack}>{formatName(nowPlaying.track)}</div>
                              <div className={styles.nowPlayingArtist}>{nowPlaying.artist}</div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className={styles.overviewSplit}>
                      <div className={styles.overviewStats}>
                        <SimpleTable
                          key={`${lastFetched?.username}-stats`}
                          data={tableData}
                          align={tableAlign}
                          animate
                          hideHeader
                        />
                      </div>
                      {overviewChart && (
                        <div className={styles.overviewChart}>
                          <AreaChart data={overviewChart.days} total={overviewChart.total} groupBy="week" />
                        </div>
                      )}
                    </div>
                    </>
                  ) : (
                    <SimpleTable
                      key={`${lastFetched?.username}-${lastFetched?.period}-${lastFetched?.mode}`}
                      data={tableData}
                      align={tableAlign}
                      animate
                      headerVariant={albums.length > 0 ? 'red' : artists.length > 0 ? 'green' : undefined}
                      onRowHover={albums.length > 0 ? handleAlbumHover : undefined}
                      onRowClick={albums.length > 0 ? handleAlbumClick : undefined}
                      onTableLeave={albums.length > 0 ? handleAlbumLeave : undefined}
                      selectedRow={lockedAlbumIndex ?? hoveredAlbumIndex ?? undefined}
                    />
                  )}
                </Card>
                {overviewTop && (
                  <>
                    <Card title="TOP ALBUMS — ALL TIME">
                      <SimpleTable
                        data={showPlays
                          ? [['#', 'ALBUM', 'ARTIST', 'PLAYS'], ...overviewTop.albums.map((a) => [String(a.rank), formatName(a.name), a.artist, a.playcount.toLocaleString()])]
                          : [['#', 'ALBUM', 'ARTIST'], ...overviewTop.albums.map((a) => [String(a.rank), formatName(a.name), a.artist])]}
                        align={showPlays ? ['left', 'left', 'left', 'right'] : ['left', 'left', 'left']}
                        headerVariant="red"
                        animate
                      />
                    </Card>
                    <Card title="TOP ARTISTS — ALL TIME">
                      <SimpleTable
                        data={showPlays
                          ? [['#', 'ARTIST', 'PLAYS'], ...overviewTop.artists.map((a) => [String(a.rank), formatName(a.name), a.playcount.toLocaleString()])]
                          : [['#', 'ARTIST'], ...overviewTop.artists.map((a) => [String(a.rank), formatName(a.name)])]}
                        align={showPlays ? ['left', 'left', 'right'] : ['left', 'left']}
                        headerVariant="green"
                        animate
                      />
                    </Card>
                    <Card title="TOP SONGS — ALL TIME">
                      <TrackTable
                        tracks={overviewTop.tracks}
                        onPlay={handleTrackPlay}
                        showPlays={showPlays}
                        headerVariant="blue"
                      />
                    </Card>
                  </>
                )}
              </div>
              {lastFetched && ['albums', 'artists', 'tracks'].includes(lastFetched.mode) && !resultsExpanded && (
                <ActionButton
                  hotkey="+"
                  onClick={() => handleFetch(lastFetched.mode as FetchMode, period, customDateRange, undefined, 50)}
                >
                  {`MORE ${lastFetched.mode === 'albums' ? 'ALBUMS' : lastFetched.mode === 'tracks' ? 'SONGS' : 'ARTISTS'}`}
                </ActionButton>
              )}
              </>
            )}
          </>
        )}
      </div>

      <div className={styles.sidebarCol}>
        {ytEmbed && ytMini && (
          <Card title={ytEmbed.title}>
            <div className={styles.ytEmbedWrapper}>
              <YoutubePlayer videoId={ytEmbed.videoId} onEnded={handleAutoNext} />
            </div>
            <div className={styles.ytControls}>
              <div className={styles.ytNavButtons}>
                {ytEmbed.source === 'tracks' ? (
                  <>
                    {ytEmbed.trackIdx > 0 && (
                      <ActionButton hotkey="←" onClick={() => handleTrackNavigate(ytEmbed.trackIdx - 1)}>
                        {ytNavLoading ? '...' : 'PREV'}
                      </ActionButton>
                    )}
                    {tracks[ytEmbed.trackIdx + 1] && (
                      <ActionButton hotkey="→" onClick={() => handleTrackNavigate(ytEmbed.trackIdx + 1)}>
                        {ytNavLoading ? '...' : 'NEXT'}
                      </ActionButton>
                    )}
                  </>
                ) : (
                  <>
                    {ytEmbed.trackIdx > 0 && (
                      <ActionButton hotkey="←" onClick={() => handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx - 1)}>
                        {ytNavLoading ? '...' : 'PREV'}
                      </ActionButton>
                    )}
                    {albumMetas[ytEmbed.albumIdx]?.tracks[ytEmbed.trackIdx + 1] && (
                      <ActionButton hotkey="→" onClick={() => handleYtNavigate(ytEmbed.albumIdx, ytEmbed.trackIdx + 1)}>
                        {ytNavLoading ? '...' : 'NEXT'}
                      </ActionButton>
                    )}
                  </>
                )}
              </div>
              <div className={styles.ytNavButtons}>
                <ActionButton hotkey="⊞" onClick={() => setYtMini(false)}>EXPAND</ActionButton>
                <ActionButton hotkey="ESC" onClick={closeYtEmbed}>EXIT</ActionButton>
              </div>
            </div>
          </Card>
        )}
        <div className={styles.sidebar}>
        {(() => {
          const activeIndex = lockedAlbumIndex ?? hoveredAlbumIndex;
          const activeAlbum = activeIndex !== null ? albums[activeIndex] : null;
          const activeMeta = activeIndex !== null ? albumMetas[activeIndex] ?? null : null;

          if (!activeAlbum) return (
            <Card title="MUSILOG.FM">
              <div className={styles.sidebarIntro}>
                <p>Enter your Last.fm username and pick a time period to see your top albums, artists, or songs.</p>
                <p>Hover an album to preview it. Click to lock the panel and see the full tracklist.</p>
              </div>
            </Card>
          );

          const idx = activeIndex!;
          const pixels = pixelArtCache[idx];

          return (
            <Card title="ALBUM INFO">
              <div className={styles.sidebarContent}>
                <div className={styles.albumHeader}>
                  {(activeAlbum.imageUrl || activeMeta?.artUrl) && (
                    <button
                      className={styles.albumThumb}
                      onClick={() => setImageView((v) => v === 'pixel' ? 'original' : 'pixel')}
                      title={imageView === 'pixel' ? 'Show original' : 'Show pixel art'}
                    >
                      {imageView === 'pixel' ? (
                        pixelLoading && !pixels
                          ? <div className={styles.thumbPlaceholder} />
                          : pixels
                          ? <div className={styles.pixelGrid}>{pixels.map((c, i) => <div key={i} className={styles.pixelCell} style={{ backgroundColor: c }} />)}</div>
                          : <div className={styles.thumbPlaceholder} />
                      ) : (
                        <img src={activeMeta?.artUrl ?? activeAlbum.imageUrl!} alt={activeAlbum.name} className={styles.thumbImg} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                    </button>
                  )}
                  <div className={styles.albumHeaderInfo}>
                    <div className={styles.albumTitle}>{formatName(activeAlbum.name)}</div>
                    <div className={styles.albumSubtitle}>{activeAlbum.artist}</div>
                  </div>
                </div>

                {albumMetasLoading && !activeMeta && <div className={styles.sidebarLoading}>LOADING...</div>}

                {activeMeta && (
                  <>
                    <div className={styles.statsRow}>
                      {activeMeta.releaseDate && (
                        <div className={styles.statItem}>
                          <span className={styles.statValue}>{activeMeta.releaseDate.slice(0, 4)}</span>
                          <span className={styles.statLabel}>◈</span>
                        </div>
                      )}
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{formatDuration(activeMeta.totalDuration)}</span>
                        <span className={styles.statLabel}>◷</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{formatCount(activeMeta.listeners)}</span>
                        <span className={styles.statLabel}>◉</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statValue}>{formatCount(activeMeta.playcount)}</span>
                        <span className={styles.statLabel}>↺</span>
                      </div>
                    </div>

                    {activeMeta.tags.slice(0, 3).length > 0 && (
                      <div className={styles.tags}>
                        {activeMeta.tags.slice(0, 3).join(' · ')}
                      </div>
                    )}

                    {activeMeta.tracks.length > 0 && (
                      <div className={styles.tracklistSection}>
                        <button className={styles.tracklistToggle} onClick={() => setTracklistOpen((o) => !o)}>
                          {tracklistOpen ? '▼' : '▶'} TRACKLIST
                        </button>
                        {tracklistOpen && (
                          <div className={styles.sidebarTracks}>
                            {activeMeta.tracks.map((t, tIdx) => (
                              <div key={t.rank} className={styles.sidebarTrack}>
                                <span className={styles.sidebarTrackNum}>{t.rank}.</span>
                                <span className={styles.sidebarTrackName}>{formatName(t.name)}</span>
                                {t.duration > 0 && (
                                  <span className={styles.sidebarTrackDur}>
                                    {Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, '0')}
                                  </span>
                                )}
                                <TrackYtButton
                                  artist={activeAlbum.artist}
                                  track={t.name}
                                  onPlay={(videoId) => setYtEmbed({ videoId, title: `${activeAlbum.artist} — ${t.name}`, source: 'album', albumIdx: idx, trackIdx: tIdx })}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          );
        })()}
        </div>
      </div>

      </div>

      <DateRangeModal
        isOpen={isModalOpen}
        initialFrom={customDateRange?.from}
        initialTo={customDateRange?.to}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />
    </main>
    </div>
  );
}
