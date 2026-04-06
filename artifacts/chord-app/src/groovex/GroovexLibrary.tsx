import { useState, useMemo, useRef } from 'react';
import { SONG_CATALOG, getArtists, getGenres } from './songCatalog';
import type { SongMeta } from './songCatalog';
import { useGroovexStore } from './useGroovexStore';

export default function GroovexLibrary() {
  const { searchQuery, setSearchQuery, filterArtist, setFilterArtist, filterGenre, setFilterGenre, sortBy, setSortBy, setView, setActiveSong, addRecentSong, recentSongs } = useGroovexStore();
  const [showFilters, setShowFilters] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const artists = useMemo(() => getArtists(), []);
  const genres = useMemo(() => getGenres(), []);

  const filteredSongs = useMemo(() => {
    let songs = [...SONG_CATALOG];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      songs = songs.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.genre.toLowerCase().includes(q)
      );
    }
    if (filterArtist) songs = songs.filter(s => s.artist === filterArtist);
    if (filterGenre) songs = songs.filter(s => s.genre === filterGenre);

    if (sortBy === 'title') songs.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === 'artist') songs.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
    else if (sortBy === 'recent') {
      songs.sort((a, b) => {
        const ai = recentSongs.indexOf(a.id);
        const bi = recentSongs.indexOf(b.id);
        if (ai === -1 && bi === -1) return a.title.localeCompare(b.title);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
    return songs;
  }, [searchQuery, filterArtist, filterGenre, sortBy, recentSongs]);

  const grouped = useMemo(() => {
    if (sortBy === 'artist') {
      const map = new Map<string, SongMeta[]>();
      filteredSongs.forEach(s => {
        if (!map.has(s.artist)) map.set(s.artist, []);
        map.get(s.artist)!.push(s);
      });
      return [...map.entries()];
    }
    return [['', filteredSongs]] as [string, SongMeta[]][];
  }, [filteredSongs, sortBy]);

  function openSong(song: SongMeta) {
    setActiveSong(song.id);
    addRecentSong(song.id);
    setView('player');
  }

  const sortLabel = sortBy === 'title' ? 'A-Z' : sortBy === 'artist' ? 'ARTIST' : 'RECENT';

  return (
    <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        <section style={{ paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: 'var(--c-text-primary)' }}>Library</h2>
          <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0, fontWeight: 600 }}>
            {SONG_CATALOG.length} Multitrack Sessions Available
          </p>
        </section>

        <section style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-secondary)', fontSize: 20 }}>search</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists, or genres..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--gx-surface-low)', border: 'none', borderRadius: 14,
                padding: '14px 14px 14px 42px',
                color: 'var(--c-text-primary)', fontSize: 14, fontFamily: 'Inter',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                const idx = ['artist', 'title', 'recent'].indexOf(sortBy);
                setSortBy((['artist', 'title', 'recent'] as const)[(idx + 1) % 3]);
              }}
              style={{
                background: 'var(--gx-surface-high)', border: 'none', borderRadius: 14,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6,
                color: 'var(--c-text-primary)', cursor: 'pointer', fontFamily: 'Inter',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sort</span>
              {sortLabel}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                background: (filterArtist || filterGenre) ? 'var(--gx-accent-dim)' : 'var(--gx-surface-high)',
                border: 'none', borderRadius: 14,
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6,
                color: (filterArtist || filterGenre) ? '#fff' : 'var(--c-text-primary)',
                cursor: 'pointer', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
              FILTER
            </button>
            {(filterArtist || filterGenre) && (
              <button
                onClick={() => { setFilterArtist(''); setFilterGenre(''); }}
                style={{
                  background: 'transparent', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 14,
                  padding: '12px 16px', color: 'var(--c-text-secondary)', cursor: 'pointer',
                  fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
                }}
              >
                CLEAR
              </button>
            )}
          </div>
        </section>

        {showFilters && (
          <section style={{
            marginBottom: 24, background: 'var(--gx-surface)',
            borderRadius: 16, padding: 16,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>Artist</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              <FilterChip label="All" active={!filterArtist} onClick={() => setFilterArtist('')} />
              {artists.map(a => (
                <FilterChip key={a} label={a} active={filterArtist === a} onClick={() => setFilterArtist(filterArtist === a ? '' : a)} />
              ))}
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 10px' }}>Genre</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <FilterChip label="All" active={!filterGenre} onClick={() => setFilterGenre('')} />
              {genres.map(g => (
                <FilterChip key={g} label={g} active={filterGenre === g} onClick={() => setFilterGenre(filterGenre === g ? '' : g)} />
              ))}
            </div>
          </section>
        )}

        {filteredSongs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--c-text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12, display: 'block', opacity: 0.4 }}>search_off</span>
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>No songs found</p>
            <p style={{ fontSize: 13, margin: 0 }}>Try a different search or filter</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grouped.map(([group, songs]) => (
            <div key={group || 'all'}>
              {group && (
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px 4px', fontFamily: 'Inter' }}>
                  {group} <span style={{ opacity: 0.5 }}>({songs.length})</span>
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {songs.map(song => (
                  <SongRow key={song.id} song={song} onOpen={() => openSong(song)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SongRow({ song, onOpen }: { song: SongMeta; onOpen: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onOpen}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: pressed ? 'var(--gx-surface)' : 'var(--gx-surface-low)',
        borderRadius: 14, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
        boxSizing: 'border-box',
        borderLeft: '2px solid transparent',
        transition: 'background 100ms ease, transform 80ms ease',
        transform: pressed ? 'scale(0.99)' : 'scale(1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: 'var(--gx-surface-lowest)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--gx-accent)', opacity: 0.7 }}>album</span>
          {song.hasStems && (
            <span className="material-symbols-outlined" style={{
              position: 'absolute', bottom: -2, right: -2,
              fontSize: 12, color: '#4ade80',
              background: 'var(--gx-surface-low)', borderRadius: 9999, padding: 1,
            }}>cloud_done</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0', fontFamily: 'Inter' }}>
            {song.artist}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {song.stems.slice(0, 3).map(s => (
            <span key={s.name} style={{
              padding: '2px 5px', background: 'var(--gx-surface-lowest)', borderRadius: 4,
              fontSize: 9, fontFamily: 'Inter', color: 'var(--c-text-secondary)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {s.name.slice(0, 3)}
            </span>
          ))}
          {song.stems.length > 3 && (
            <span style={{
              padding: '2px 5px', background: 'var(--gx-surface-lowest)', borderRadius: 4,
              fontSize: 9, fontFamily: 'Inter', color: 'var(--c-text-secondary)', fontWeight: 600,
            }}>
              +{song.stems.length - 3}
            </span>
          )}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.4 }}>chevron_right</span>
      </div>
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 20,
        background: active ? 'var(--gx-accent-dim)' : 'var(--gx-surface-high)',
        color: active ? '#fff' : 'var(--c-text-secondary)',
        border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
        fontFamily: 'Inter', letterSpacing: '0.02em',
        transition: 'background 120ms ease',
      }}
    >
      {label}
    </button>
  );
}
