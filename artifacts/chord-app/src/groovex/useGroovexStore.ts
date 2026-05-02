import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GroovexPreferences {
  masterVolume: number;
  loopPlayback: boolean;
  autoPlay: boolean;
  countIn: boolean;
  defaultStemVolume: number;
}

export type GroovexView = 'library' | 'player' | 'preferences';

interface GroovexState {
  view: GroovexView;
  activeSongId: string | null;
  searchQuery: string;
  filterArtist: string;
  filterGenre: string;
  sortBy: 'title' | 'artist' | 'recent';
  recentSongs: string[];
  preferences: GroovexPreferences;
  stemVolumes: Record<string, Record<string, number>>;
  stemMutes: Record<string, Record<string, boolean>>;

  setView: (view: GroovexView) => void;
  setActiveSong: (songId: string | null) => void;
  setSearchQuery: (q: string) => void;
  setFilterArtist: (artist: string) => void;
  setFilterGenre: (genre: string) => void;
  setSortBy: (sort: 'title' | 'artist' | 'recent') => void;
  addRecentSong: (songId: string) => void;
  updatePreferences: (prefs: Partial<GroovexPreferences>) => void;
  setStemVolume: (songId: string, stem: string, volume: number) => void;
  setStemMute: (songId: string, stem: string, muted: boolean) => void;
}

export const useGroovexStore = create<GroovexState>()(
  persist(
    (set) => ({
      view: 'library',
      activeSongId: null,
      searchQuery: '',
      filterArtist: '',
      filterGenre: '',
      sortBy: 'artist',
      recentSongs: [],
      preferences: {
        masterVolume: 0.85,
        loopPlayback: false,
        autoPlay: false,
        countIn: false,
        defaultStemVolume: 0.85,
      },
      stemVolumes: {},
      stemMutes: {},

      setView: (view) => set({ view }),
      setActiveSong: (songId) => set({ activeSongId: songId }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setFilterArtist: (artist) => set({ filterArtist: artist }),
      setFilterGenre: (genre) => set({ filterGenre: genre }),
      setSortBy: (sort) => set({ sortBy: sort }),
      addRecentSong: (songId) =>
        set((s) => ({
          recentSongs: [songId, ...s.recentSongs.filter((id) => id !== songId)].slice(0, 20),
        })),
      updatePreferences: (prefs) =>
        set((s) => ({ preferences: { ...s.preferences, ...prefs } })),
      setStemVolume: (songId, stem, volume) =>
        set((s) => ({
          stemVolumes: {
            ...s.stemVolumes,
            [songId]: { ...(s.stemVolumes[songId] ?? {}), [stem]: volume },
          },
        })),
      setStemMute: (songId, stem, muted) =>
        set((s) => ({
          stemMutes: {
            ...s.stemMutes,
            [songId]: { ...(s.stemMutes[songId] ?? {}), [stem]: muted },
          },
        })),
    }),
    {
      name: 'groovex-storage-v1',
      partialize: (s) => ({
        recentSongs: s.recentSongs,
        preferences: s.preferences,
        stemVolumes: s.stemVolumes,
        stemMutes: s.stemMutes,
        sortBy: s.sortBy,
        // Persist the last-visited view + active song so launch resumes
        // exactly where the user left off (e.g. mid-song in the player).
        view: s.view,
        activeSongId: s.activeSongId,
      }),
    }
  )
);
