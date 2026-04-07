import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllSessions, saveSession, deleteSession, type LabSession, type LabLayer } from './labSessionDb';

const SESSION_ICONS = ['graphic_eq', 'layers', 'multiline_chart', 'equalizer', 'tune', 'mic', 'queue_music', 'stacked_line_chart'];

function randomIcon() {
  return SESSION_ICONS[Math.floor(Math.random() * SESSION_ICONS.length)];
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function SessionCard({ session, onOpen }: { session: LabSession; onOpen: (s: LabSession) => void }) {
  return (
    <div onClick={() => onOpen(session)} style={{
      background: '#1f2020', borderRadius: 14, padding: '20px 18px',
      cursor: 'pointer', transition: 'background 150ms ease',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}
      onPointerDown={e => (e.currentTarget.style.background = '#2c2c2c')}
      onPointerUp={e => (e.currentTarget.style.background = '#1f2020')}
      onPointerLeave={e => (e.currentTarget.style.background = '#1f2020')}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#679cff' }}>{session.icon}</span>
      </div>
      <div>
        <h4 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: '#e7e5e4', margin: '0 0 3px' }}>{session.name}</h4>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#acabaa', margin: 0 }}>Created {formatDate(session.createdAt)}</p>
      </div>
      <div style={{ borderTop: '1px solid rgba(72,72,72,0.2)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, color: '#9d9da6', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {session.layers.length} {session.layers.length === 1 ? 'Layer' : 'Layers'}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#acabaa' }}>play_circle</span>
      </div>
    </div>
  );
}

function LayerItem({ layer, onPlay, onDelete, isPlaying }: {
  layer: LabLayer; onPlay: () => void; onDelete: () => void; isPlaying: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: isPlaying ? '#191a1a' : 'transparent', borderRadius: 10,
      transition: 'background 150ms ease',
    }}>
      <button onClick={onPlay} style={{
        width: 32, height: 32, borderRadius: 8, background: '#000',
        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: isPlaying ? '#007aff' : '#acabaa', fontVariationSettings: isPlaying ? "'FILL' 1" : "'FILL' 0" }}>
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 13, color: '#e7e5e4', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.name}</p>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', margin: '1px 0 0' }}>
          {Math.round(layer.durationMs / 1000)}s
        </p>
      </div>
      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => { onDelete(); setConfirmDelete(false); }} style={{ background: '#7f2927', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#ff9993' }}>Delete</button>
          <button onClick={() => setConfirmDelete(false)} style={{ background: '#252626', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#acabaa' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#484848', display: 'flex', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
        </button>
      )}
    </div>
  );
}

function SessionDetail({ session, onBack, onUpdate }: {
  session: LabSession; onBack: () => void; onUpdate: (s: LabSession) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(session.name);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const dur = Date.now() - startTimeRef.current;
        const layer: LabLayer = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: `Layer ${session.layers.length + 1}`,
          audioBlob: blob,
          durationMs: dur,
          createdAt: Date.now(),
        };
        const updated = { ...session, layers: [...session.layers, layer], updatedAt: Date.now() };
        saveSession(updated).then(() => onUpdate(updated));
      };
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      recorder.start(250);
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const playLayer = (layer: LabLayer) => {
    if (playingId === layer.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const url = URL.createObjectURL(layer.audioBlob);
    const audio = new Audio(url);
    audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); };
    audio.play();
    audioRef.current = audio;
    setPlayingId(layer.id);
  };

  const removeLayer = (layerId: string) => {
    const updated = { ...session, layers: session.layers.filter(l => l.id !== layerId), updatedAt: Date.now() };
    saveSession(updated).then(() => onUpdate(updated));
  };

  const handleDeleteSession = async () => {
    await deleteSession(session.id);
    onBack();
  };

  const saveName = () => {
    setEditingName(false);
    if (name.trim() && name !== session.name) {
      const updated = { ...session, name: name.trim(), updatedAt: Date.now() };
      saveSession(updated).then(() => onUpdate(updated));
    } else {
      setName(session.name);
    }
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  return (
    <div style={{ padding: '16px 20px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span> Back
        </button>
        {confirmDeleteSession ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleDeleteSession} style={{ background: '#7f2927', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#ff9993' }}>Delete Session</button>
            <button onClick={() => setConfirmDeleteSession(false)} style={{ background: '#252626', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#acabaa' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDeleteSession(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#484848', display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          </button>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#679cff' }}>{session.icon}</span>
        </div>
        {editingName ? (
          <input
            value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            autoFocus
            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, color: '#e7e5e4', background: 'none', border: 'none', borderBottom: '2px solid #007aff', outline: 'none', padding: '0 0 4px', width: '100%' }}
          />
        ) : (
          <h2 onClick={() => setEditingName(true)} style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 26, color: '#e7e5e4', margin: '0 0 4px', cursor: 'pointer', letterSpacing: '-0.02em' }}>{session.name}</h2>
        )}
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575', margin: 0 }}>
          Created {formatDate(session.createdAt)} · {session.layers.length} {session.layers.length === 1 ? 'layer' : 'layers'}
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Layers</span>
        </div>

        {session.layers.length === 0 && (
          <div style={{ background: '#191a1a', borderRadius: 14, padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#484848' }}>layers</span>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#767575', margin: 0, textAlign: 'center' }}>No layers yet. Record your first vocal layer.</p>
          </div>
        )}

        {session.layers.map(layer => (
          <LayerItem key={layer.id} layer={layer} isPlaying={playingId === layer.id}
            onPlay={() => playLayer(layer)} onDelete={() => removeLayer(layer.id)} />
        ))}
      </div>

      <div style={{ position: 'sticky', bottom: 80, paddingTop: 16, display: 'flex', justifyContent: 'center' }}>
        {recording ? (
          <button onClick={stopRecording} style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#ef4444', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#fff', fontVariationSettings: "'FILL' 1" }}>stop</span>
          </button>
        ) : (
          <button onClick={startRecording} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #679cff, #007aff)',
            border: 'none', cursor: 'pointer', padding: '14px 24px',
            borderRadius: 9999, boxShadow: '0 8px 32px rgba(0,122,255,0.25)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff', fontWeight: 700 }}>mic</span>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff', letterSpacing: '0.02em' }}>Record Layer</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function LabPanel() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeSession, setActiveSession] = useState<LabSession | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadSessions = useCallback(async () => {
    const all = await getAllSessions();
    setSessions(all);
    setLoaded(true);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const createSession = async () => {
    const session: LabSession = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: `Session ${sessions.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layers: [],
      icon: randomIcon(),
    };
    await saveSession(session);
    await loadSessions();
    setActiveSession(session);
  };

  const handleUpdate = (updated: LabSession) => {
    setActiveSession(updated);
    loadSessions();
  };

  const handleBack = () => {
    setActiveSession(null);
    loadSessions();
  };

  if (activeSession) {
    return <SessionDetail session={activeSession} onBack={handleBack} onUpdate={handleUpdate} />;
  }

  const displaySessions = showAll ? sessions : sessions.slice(0, 4);

  return (
    <div style={{ padding: '20px 20px 40px', minHeight: '100%' }}>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 38, letterSpacing: '-0.03em', color: '#e7e5e4', margin: '0 0 10px', lineHeight: 1 }}>Lab</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#acabaa', margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
          A creative space to build harmonies, experiment with vocal layers, and explore your unique sound.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <button onClick={createSession} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, #679cff, #007aff)',
          border: 'none', cursor: 'pointer', padding: '16px 28px',
          borderRadius: 9999, fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15,
          color: '#fff', letterSpacing: '0.02em',
          boxShadow: '0 8px 32px rgba(0,122,255,0.25)',
          transition: 'transform 100ms ease, box-shadow 150ms ease',
        }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20, fontWeight: 700 }}>add</span>
          Start New Session
        </button>
      </section>

      {loaded && sessions.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 20, color: '#e7e5e4', margin: 0, letterSpacing: '-0.01em' }}>Recent Sessions</h3>
            {sessions.length > 4 && (
              <button onClick={() => setShowAll(!showAll)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#679cff',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {showAll ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {displaySessions.map(s => (
              <SessionCard key={s.id} session={s} onOpen={setActiveSession} />
            ))}
          </div>
        </section>
      )}

      {loaded && sessions.length === 0 && (
        <section style={{ textAlign: 'center', padding: '40px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#484848', marginBottom: 8 }}>science</span>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#767575', margin: '8px 0 0' }}>
            Your lab sessions will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
