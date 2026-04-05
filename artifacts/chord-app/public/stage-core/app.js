// ══════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════
const SEGMENT_COLORS = ['#7aafff','#ff7439','#c8a2ff','#c5ffc9','#ff716c','#ffd700','#ff8dd4','#80cfff'];
let _segNextId = 1;
const state = {
  elements: [],
  connections: [],
  setlist: [],
  segments: [],
  gear: [],
  members: [],
  selectedId: null,
  nextId: 1,
  snapToGrid: false,
  gridVisible: true,
  connectMode: false,
  connectSource: null,
  connectionsVisible: true,
  zoom: 1,
  currentView: 'Editor',
  navOrder: ['Editor','Rider','Setlist','Gear','Members'],
  gridSize: 80,
  canvasBg: '#1a1a1a',
  showStatusBar: false,
  labelsVisible: true,
  connLineStyle: 'solid',
  reducedAnimations: false,
  amoled: false,
  gigMode: false,
  smartSuggestionsEnabled: false,
  timeline: [],
  stageBalanceVisible: false,
  smIntelligenceEnabled: true,
  smAutoOptEnabled: true,
  smConflictEnabled: true,
  smPredictEnabled: true,
  exportNotes: undefined,
  canvasW: 0,
  canvasH: 0,
  history: [],
  historyIndex: -1,
  lang: 'en',
  theme: 'electric',
  lastModified: null,
  plotVersion: 1,
  showLastUpdated: true,
  riderNeeds: [
    { id:'rn1', type:'foh',     value:'Dante Primary/Secondary @ 96kHz' },
    { id:'rn2', type:'monitor', value:'Minimum 4 discrete stereo IEM mixes' },
    { id:'rn3', type:'power',   value:'2× 20A circuits, distro Stage Left' },
  ],
  _rnNextId: 4,
};

// ── Cable / Power constants ──────────────────────────────────
const POWER_REQUIRING_TYPES = new Set([
  'Guitar Amplifier','Bass Amplifier','Guitar Cabinet','Bass Cabinet',
  'Powered Floor PA','Stage Sub-Woofer','In-Ear Monitor',
  'Drum Fill Monitor','Drum Sub Monitor','Side Fill',
  'Main PA Left','Main PA Right','Delay Speaker Tower','Front Fill Speaker',
  'Headphone Amplifier','Stage Mixer','FOH Mixing Console','Monitor Console',
  'Amplifier Rack','Effects Rack','Wireless Rack','Laptop / Computer',
  'Electronic Drums','Keyboard DI','Synthesizer','Loop Station','Playback Device',
]);
const POWER_SOURCE_TYPES  = new Set(['Power Distro', 'Power Outlet']);
const POWER_OVERLOAD_LIMIT = 4;
const CABLE_LABELS = { xlr: 'XLR', quarter: '1/4"', power: 'Power' };

const NEED_TYPES = {
  foh:      { label:'FOH Protocol',          labelEs:'Protocolo FOH',           color:'#7aafff',
    presets:   ['Dante Primary/Secondary @ 96kHz','Analog console, 32 ch minimum','Digital console, 48 ch minimum','MADI + Dante hybrid','Console provided by band','No preference'],
    presetsEs: ['Dante Primario/Secundario @ 96kHz','Consola analógica, mín. 32 canales','Consola digital, mín. 48 canales','Híbrido MADI + Dante','Consola a cargo de la banda','Sin preferencia'] },
  monitor:  { label:'Monitor / IEM',         labelEs:'Monitor / IEM',           color:'#ff7439',
    presets:   ['4 stereo IEM mixes minimum','6 wedge monitor mixes','2 stereo IEM + 4 wedge mixes','8 discrete aux mixes','IEM provided by band, venue provides sends','No monitors required'],
    presetsEs: ['Mínimo 4 mezclas IEM estéreo','6 mezclas de monitores cuña','2 IEM estéreo + 4 cuñas','8 mezclas aux independientes','IEM a cargo de la banda, envíos por el venue','Sin monitores requeridos'] },
  power:    { label:'Power Requirement',     labelEs:'Requerimiento Eléctrico', color:'#c5ffc9',
    presets:   ['2× 20A circuits Stage Left','3× 20A circuits Stage Center','4× 15A circuits','Distro provided by band','Standard venue power sufficient'],
    presetsEs: ['2× circuitos 20A Lateral Izquierdo','3× circuitos 20A Centro del escenario','4× circuitos 15A','Distribución eléctrica a cargo de la banda','Alimentación estándar del venue suficiente'] },
  backline: { label:'Backline',              labelEs:'Backline',                color:'#ffd700',
    presets:   ['All backline provided by band','Drum kit required (venue to provide)','Guitar amp required (venue to provide)','Bass amp required (venue to provide)','Full backline required from venue'],
    presetsEs: ['Todo el backline a cargo de la banda','Batería requerida (el venue la proporciona)','Amplificador de guitarra requerido (el venue)','Amplificador de bajo requerido (el venue)','Backline completo requerido del venue'] },
  wireless: { label:'Wireless Coordination', labelEs:'Coordinación Inalámbrica',color:'#c8a2ff',
    presets:   ['All systems pre-coordinated by band','Frequency list provided 48h in advance','IEM frequencies on request','RF clear zone required at FOH'],
    presetsEs: ['Todos los sistemas coordinados por la banda','Lista de frecuencias enviada 48h antes','Frecuencias IEM disponibles bajo solicitud','Zona RF limpia requerida en FOH'] },
  crew:     { label:'Stage Crew',            labelEs:'Crew de Escenario',       color:'#ff8dd4',
    presets:   ['2 crew minimum at load-in','1 dedicated monitor engineer required','FOH engineer travels with band','Crew provided by band','Stage manager provided by venue'],
    presetsEs: ['Mínimo 2 crew en carga','1 ingeniero de monitores dedicado requerido','Ingeniero FOH viaja con la banda','Crew a cargo de la banda','Stage manager a cargo del venue'] },
  custom:   { label:'Custom',               labelEs:'Personalizado',           color:'#484847', presets:[], presetsEs:[] },
};

const DEFAULT_NOTES_EN = 'Artist provides all instruments, IEM transmitters, and playback rack. Venue must provide all microphones, stands, and XLR cabling as per the input list. PA system must be capable of 105dB continuous at FOH without distortion. Front-fills are mandatory for the first 3 rows. All wireless systems must be frequency-coordinated prior to load-in.';
const DEFAULT_NOTES_ES = 'El artista proporciona todos los instrumentos, transmisores IEM y rack de reproducción. El venue debe proporcionar todos los micrófonos, soportes y cableado XLR según la lista de canales. El sistema PA debe ser capaz de 105dB continuo en FOH sin distorsión. Los front-fills son obligatorios para las primeras 3 filas. Todos los sistemas inalámbricos deben coordinarse en frecuencia antes del montaje.';

const TRANSLATIONS = {
  en: {
    // PDF / Export
    coverLabel:'Technical Rider Export',
    docId:'Document ID', expDate:'Export Date', elements:'Elements',
    stagePlot:'Stage Plot', inputList:'Input List', bandMembers:'Band Members',
    connectivity:'Connectivity', riderReqs:'Technical Requirements',
    setlist:'Setlist', lightingRider:'Lighting Rider',
    techNotes:'Technical Notes', gear:'Gear / Load-In Checklist',
    colCh:'CH#', colInstrument:'Instrument', colPerformer:'Performer',
    colMicDI:'Mic / DI', colSource:'Source', colNotes:'Notes',
    colItem:'Item', colCategory:'Category', colQty:'Qty',
    inputEmpty:'Add elements in the Editor to populate this list',
    noGear:'No gear items added — visit the Gear tab to build your list.',
    noAssignments:'No assignments',
    signalPatch:'Signal Patch List', signalSummary:'Signal Summary',
    phantomCh:'+48V channels', signalPaths:'Signal paths', totalEl:'Total elements',
    activeInputs:'Active Inputs', outputRoutes:'Output Routes',
    noConns:'No connections defined — use Connect mode in the Editor to link elements.',
    noElems:'No elements placed — connectivity summary will appear here.',
    scaleLabel:'Scale: 1:50', clickEdit:'Click to edit',
    footerSub:'Professional Stage Plot & Technical Rider Editor',
    reqs:'Technical Requirements',
    // UI — views & actions
    elementsOnStage:'Elements on Stage', elementSingular:'Element',
    role:'role', rolePlural:'roles',
    noStageAssign:'No Stage Assignments',
    assignedElems:'Assigned Elements', assignments:'Assignments',
    noGearYet:'No gear items yet',
    addGearHint:'Click "Add Gear Item" to start your load-in list',
    noElemsRider:'No stage elements yet',
    dragToCanvas:'Drag items onto the canvas in the Editor tab to populate this list.',
    savedLabel:'Saved:', autosaveNever:'Autosave: Never',
    projectSaved:'Project Saved', noElemsToExport:'No elements to export',
    csvExported:'Input list exported as CSV',
    pdfSaved:'PDF saved successfully', pdfFailed:'PDF export failed — try again',
    linkCopied:'Link copied to clipboard',
    maxMembers:'Max 8 members',
    connectOn:'Connect Mode ON — click an element to start',
    connected:'Connected', alreadyConnected:'Already connected',
    presetSaved:'Preset saved', presetLoaded:'Preset loaded', presetDeleted:'Preset deleted',
    fileDownloaded:'Project file downloaded',
    fileLoaded:'Project loaded successfully', fileLoadFail:'Failed to load project file',
    clearConfirm:'Clear all elements from the stage? This cannot be undone.',
    loadPresetConfirm:'Load preset "{name}"? This will replace the current stage.',
    delPresetConfirm:'Delete preset "{name}"? This cannot be undone.',
    // Nav
    navEditor:'Editor', navRider:'Rider', navSetlist:'Setlist', navGear:'Gear', navMembers:'Members',
    saveBtnDesk:'Save / Presets', saveBtnMob:'Save', exportPdfBtn:'Export PDF',
    // Category bar
    catMics:'Mics', catDrums:'Drums', catInst:'Instruments', catAmps:'Amps', catAudio:'Audio', catUtil:'Utilities',
    // Accordion
    accMics:'Microphones', accDrums:'Drums', accInst:'Instruments', accAmps:'Amps', accAudio:'Audio', accUtil:'Utilities',
    // Sidebar
    sbSectionLabel:'Elements',
    // Toolbar
    tbGrid:'Grid', tbSnap:'Snap', tbConnect:'Connect', tbLines:'Lines', tbClear:'Clear',
    // Status bar
    sbZoom:'Zoom', sbElements:'Elements', sbLines:'Lines', sbSel:'Sel', sbSystemReady:'System Ready',
    autosaveOff:'AUTOSAVE: OFF', autosaveOn:'AUTOSAVE: ON',
    // Stage labels
    downstageLabel:'Downstage / Audience', dragHere:'Drag Elements Here',
    // Properties panel
    propLabel:'Label', propPerformer:'Performer', propChannel:'Channel',
    propRotation:'Rotation', propScale:'Scale', propInputSrc:'Input Source',
    propOutput:'Output', propRoles:'Roles', propNotes:'Notes',
    // Settings
    settingsTitle:'Settings',
    settingsLang:'Language', settingsLangHint:'Switch the entire app language.',
    settingsNavOrder:'Navigation Order', settingsNavOrderHint:'Drag sections to reorder the top navigation.',
    settingsCanvasBg:'Canvas Background', settingsCanvasBgHint:'Set the stage plot canvas color.',
    settingsGridSize:'Grid Size', settingsGridSizeHint:'Controls the spacing of the stage grid lines.',
    settingsGridFine:'Fine', settingsGridNormal:'Normal', settingsGridCoarse:'Coarse',
    settingsStatusBar:'Status Bar', settingsStatusBarHint:'Show plot info at the bottom of the editor.',
    settingsSnap:'Snap to Grid', settingsSnapHint:'Elements snap to grid when dragging.',
    settingsConn:'Show Connections', settingsConnHint:'Display lines between connected elements.',
    settingsTheme:'App Theme', settingsThemeHint:'Choose the accent color scheme for the entire interface.',
    themeElectric:'Electric', themeLime:'Lime', themeCyan:'Cyan', themeAmber:'Amber', themeViolet:'Violet', themeRose:'Rose',
    // Library — Mics
    libSM58:'SM58', libCondenser:'Condenser', libAmpMic:'Amp Mic',
    libWireless:'Wireless', libBoundary:'Boundary', libDrumClip:'Drum Clip',
    // Library — Drums
    libDrumKit:'Drum Kit', libEDrums:'E-Drums', libPercussion:'Percussion', libCajon:'Cajón',
    // Library — Instruments
    libElecGuitar:'Elec Guitar', libAcouGuitar:'Acou Guitar', libBassGuitar:'Bass Guitar',
    libKeyboard:'Keyboard', libSynth:'Synth', libDIBox:'DI Box',
    libLoopStation:'Loop Station', libPlayback:'Playback', libBrass:'Brass / Horn', libStrings:'Strings',
    libShaker:'Shaker', libTambourine:'Tambourine',
    // Library — Amps
    libGuitarAmp:'Guitar Amp', libBassAmp:'Bass Amp', libAmpCab:'Amp Cab', libBassCab:'Bass Cab',
    // Library — Audio
    libWedge:'Wedge', libFloorPA:'Floor PA', libStageSub:'Stage Sub', libIEMPack:'IEM Pack',
    libDrumFill:'Drum Fill', libDrumSub:'Drum Sub', libSideFill:'Side Fill',
    libMainPAL:'Main PA L', libMainPAR:'Main PA R', libDelayTower:'Delay Tower',
    libFrontFill:'Front Fill', libHeadphoneAmp:'Headphone Amp',
    // Library — Utilities
    libMixer:'Mixer', libPowerDistro:'Power Distro', libStageBox:'Stage Box', libPatchBay:'Patch Bay',
    libRouter:'Router', libSplitter:'Splitter', libFOHConsole:'FOH Console', libMONConsole:'MON Console',
    libAmpRack:'Amp Rack', libEffectsRack:'Effects Rack', libWirelessRack:'Wireless Rack',
    libLaptop:'Laptop', libIntercom:'Intercom', libOutlet:'Outlet',
  },
  es: {
    // PDF / Export
    coverLabel:'Rider Técnico',
    docId:'ID de Documento', expDate:'Fecha de Exportación', elements:'Elementos',
    stagePlot:'Diagrama de Escenario', inputList:'Lista de Canales', bandMembers:'Integrantes de Banda',
    connectivity:'Conectividad', riderReqs:'Requerimientos Técnicos',
    setlist:'Lista de Canciones', lightingRider:'Rider de Iluminación',
    techNotes:'Notas Técnicas', gear:'Lista de Equipo / Carga',
    colCh:'CH#', colInstrument:'Instrumento', colPerformer:'Intérprete',
    colMicDI:'Mic / DI', colSource:'Fuente', colNotes:'Notas',
    colItem:'Artículo', colCategory:'Categoría', colQty:'Cant.',
    inputEmpty:'Agrega elementos en el Editor para poblar esta lista.',
    noGear:'Sin equipo — visita la pestaña Equipo para agregar artículos.',
    noAssignments:'Sin asignaciones',
    signalPatch:'Lista de Señales', signalSummary:'Resumen de Señal',
    phantomCh:'Canales +48V', signalPaths:'Rutas de señal', totalEl:'Total de elementos',
    activeInputs:'Entradas Activas', outputRoutes:'Salidas',
    noConns:'Sin conexiones — usa el modo Conectar en el Editor para enlazar elementos.',
    noElems:'Sin elementos — el resumen de conectividad aparecerá aquí.',
    scaleLabel:'Escala: 1:50', clickEdit:'Clic para editar',
    footerSub:'Editor Profesional de Diagrama de Escenario y Rider Técnico',
    reqs:'Requerimientos Técnicos',
    // UI — views & actions
    elementsOnStage:'Elementos en Escenario', elementSingular:'Elemento',
    role:'rol', rolePlural:'roles',
    noStageAssign:'Sin Asignaciones en Escenario',
    assignedElems:'Elementos Asignados', assignments:'Asignaciones',
    noGearYet:'Sin artículos de equipo',
    addGearHint:'Haz clic en "Agregar Artículo" para empezar tu lista de carga',
    noElemsRider:'Sin elementos en escenario aún',
    dragToCanvas:'Arrastra elementos al lienzo en la pestaña Editor para poblar esta lista.',
    savedLabel:'Guardado:', autosaveNever:'Guardado Automático: Nunca',
    projectSaved:'Proyecto Guardado', noElemsToExport:'Sin elementos que exportar',
    csvExported:'Lista exportada como CSV',
    pdfSaved:'PDF guardado correctamente', pdfFailed:'Error al exportar PDF — intenta de nuevo',
    linkCopied:'Enlace copiado al portapapeles',
    maxMembers:'Máximo 8 integrantes',
    connectOn:'Modo Conectar ACTIVO — clic en un elemento para iniciar',
    connected:'Conectados', alreadyConnected:'Ya conectados',
    presetSaved:'Preset guardado', presetLoaded:'Preset cargado', presetDeleted:'Preset eliminado',
    fileDownloaded:'Archivo de proyecto descargado',
    fileLoaded:'Proyecto cargado correctamente', fileLoadFail:'Error al cargar el archivo',
    clearConfirm:'¿Eliminar todos los elementos del escenario? Esta acción no se puede deshacer.',
    loadPresetConfirm:'¿Cargar preset "{name}"? Esto reemplazará el escenario actual.',
    delPresetConfirm:'¿Eliminar preset "{name}"? Esta acción no se puede deshacer.',
    // Nav
    navEditor:'Editor', navRider:'Rider', navSetlist:'Setlist', navGear:'Equipo', navMembers:'Integrantes',
    saveBtnDesk:'Guardar / Presets', saveBtnMob:'Guardar', exportPdfBtn:'Exportar PDF',
    // Category bar
    catMics:'Micros', catDrums:'Batería', catInst:'Instrumentos', catAmps:'Amplificadores', catAudio:'Audio', catUtil:'Utilidades',
    // Accordion
    accMics:'Micrófonos', accDrums:'Batería', accInst:'Instrumentos', accAmps:'Amplificadores', accAudio:'Audio', accUtil:'Utilidades',
    // Sidebar
    sbSectionLabel:'Elementos',
    // Toolbar
    tbGrid:'Cuadrícula', tbSnap:'Ajuste', tbConnect:'Conectar', tbLines:'Líneas', tbClear:'Limpiar',
    // Status bar
    sbZoom:'Zoom', sbElements:'Elementos', sbLines:'Líneas', sbSel:'Sel', sbSystemReady:'Sistema Listo',
    autosaveOff:'AUTOGUARDADO: OFF', autosaveOn:'AUTOGUARDADO: ON',
    // Stage labels
    downstageLabel:'Tarima / Público', dragHere:'Arrastra Elementos Aquí',
    // Properties panel
    propLabel:'Etiqueta', propPerformer:'Intérprete', propChannel:'Canal',
    propRotation:'Rotación', propScale:'Escala', propInputSrc:'Fuente de Entrada',
    propOutput:'Salida', propRoles:'Roles', propNotes:'Notas',
    // Settings
    settingsTitle:'Configuración',
    settingsLang:'Idioma', settingsLangHint:'Cambia el idioma de toda la aplicación.',
    settingsNavOrder:'Orden de Navegación', settingsNavOrderHint:'Arrastra para reordenar la barra de navegación.',
    settingsCanvasBg:'Fondo del Lienzo', settingsCanvasBgHint:'Establece el color del lienzo del escenario.',
    settingsGridSize:'Tamaño de Cuadrícula', settingsGridSizeHint:'Controla el espaciado de las líneas de cuadrícula.',
    settingsGridFine:'Fino', settingsGridNormal:'Normal', settingsGridCoarse:'Grueso',
    settingsStatusBar:'Barra de Estado', settingsStatusBarHint:'Muestra información en la parte inferior del editor.',
    settingsSnap:'Ajuste a Cuadrícula', settingsSnapHint:'Los elementos se ajustan a la cuadrícula al arrastrar.',
    settingsConn:'Mostrar Conexiones', settingsConnHint:'Muestra líneas entre elementos conectados.',
    settingsTheme:'Tema de la App', settingsThemeHint:'Elige el esquema de color para toda la interfaz.',
    themeElectric:'Eléctrico', themeLime:'Lima', themeCyan:'Cian', themeAmber:'Ámbar', themeViolet:'Violeta', themeRose:'Rosa',
    // Library — Mics
    libSM58:'SM58', libCondenser:'Condensador', libAmpMic:'Mic Instrumento',
    libWireless:'Inalámbrico', libBoundary:'PZM', libDrumClip:'Clip Batería',
    // Library — Drums
    libDrumKit:'Kit de Batería', libEDrums:'Batería Elec.', libPercussion:'Percusión', libCajon:'Cajón',
    // Library — Instruments
    libElecGuitar:'Guitarra Elec.', libAcouGuitar:'Guitarra Acús.', libBassGuitar:'Bajo',
    libKeyboard:'Teclado', libSynth:'Sintetizador', libDIBox:'Caja DI',
    libLoopStation:'Looper', libPlayback:'Reproducción', libBrass:'Vientos', libStrings:'Cuerdas',
    libShaker:'Shaker', libTambourine:'Pandereta',
    // Library — Amps
    libGuitarAmp:'Amp Guitarra', libBassAmp:'Amp Bajo', libAmpCab:'Gabinete Guit.', libBassCab:'Gabinete Bajo',
    // Library — Audio
    libWedge:'Monitor', libFloorPA:'PA Piso', libStageSub:'Sub Escenario', libIEMPack:'Pack IEM',
    libDrumFill:'Fill Batería', libDrumSub:'Sub Batería', libSideFill:'Relleno Lateral',
    libMainPAL:'PA Principal I', libMainPAR:'PA Principal D', libDelayTower:'Torre Delay',
    libFrontFill:'Relleno Frontal', libHeadphoneAmp:'Amp Audífonos',
    // Library — Utilities
    libMixer:'Mezcladora', libPowerDistro:'Distribución', libStageBox:'Caja Escenario', libPatchBay:'Patchera',
    libRouter:'Router', libSplitter:'Divisor', libFOHConsole:'Consola FOH', libMONConsole:'Consola MON',
    libAmpRack:'Rack Amp', libEffectsRack:'Rack Efectos', libWirelessRack:'Rack Inalám.',
    libLaptop:'Laptop', libIntercom:'Intercomunicador', libOutlet:'Tomacorriente',
  }
};
function T(key) { return (TRANSLATIONS[state.lang]||TRANSLATIONS.en)[key] || TRANSLATIONS.en[key] || key; }
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = T(key);
  });
}

const library = {
  custom: [],
  mics: [
    { name: 'SM58',        nameKey:'libSM58',        icon: 'mic',              type: 'Dynamic Mic' },
    { name: 'Condenser',   nameKey:'libCondenser',   icon: 'mic-2',            type: 'Condenser Mic' },
    { name: 'Amp Mic',     nameKey:'libAmpMic',      icon: 'mic',              type: 'Instrument Mic' },
    { name: 'Wireless',    nameKey:'libWireless',    icon: 'cx-wireless',      type: 'Wireless Mic' },
    { name: 'Boundary',    nameKey:'libBoundary',    icon: 'cx-boundary',      type: 'PZM Mic' },
    { name: 'Drum Clip',   nameKey:'libDrumClip',    icon: 'cx-drum-clip',     type: 'Instrument Clip' },
  ],
  drums: [
    { name: 'Drum Kit',    nameKey:'libDrumKit',     icon: 'drum',              type: 'Acoustic Drums' },
    { name: 'E-Drums',     nameKey:'libEDrums',      icon: 'cx-edrum',         type: 'Electronic Drums' },
    { name: 'Percussion',  nameKey:'libPercussion',  icon: 'cx-percussion',    type: 'Percussion' },
    { name: 'Cajón',       nameKey:'libCajon',        icon: 'cx-cajon',          type: 'Cajón' },
  ],
  inst: [
    { name: 'Elec Guitar', nameKey:'libElecGuitar',  icon: 'cx-elec-guitar',   type: 'Electric Guitar' },
    { name: 'Acou Guitar', nameKey:'libAcouGuitar',  icon: 'guitar',            type: 'Acoustic Guitar' },
    { name: 'Bass Guitar', nameKey:'libBassGuitar',  icon: 'cx-bass-guitar',   type: 'Bass Guitar' },
    { name: 'Keyboard',    nameKey:'libKeyboard',    icon: 'piano',             type: 'Keyboard DI' },
    { name: 'Synth',       nameKey:'libSynth',       icon: 'cx-synth',         type: 'Synthesizer' },
    { name: 'Brass / Horn',nameKey:'libBrass',       icon: 'cx-trumpet',       type: 'Brass Instrument' },
    { name: 'Strings',     nameKey:'libStrings',     icon: 'cx-violin',        type: 'String Instrument' },
    { name: 'Shaker',      nameKey:'libShaker',       icon: 'cx-shaker',         type: 'Shaker' },
    { name: 'Tambourine',  nameKey:'libTambourine',   icon: 'cx-tambourine',     type: 'Tambourine' },
  ],

  amps: [
    { name: 'Guitar Amp',  nameKey:'libGuitarAmp',   icon: 'cx-guitar-amp',   type: 'Guitar Amplifier' },
    { name: 'Bass Amp',    nameKey:'libBassAmp',     icon: 'cx-bass-amp',     type: 'Bass Amplifier' },
    { name: 'Amp Cab',     nameKey:'libAmpCab',      icon: 'cx-amp-cab',      type: 'Guitar Cabinet' },
    { name: 'Bass Cab',    nameKey:'libBassCab',     icon: 'cx-bass-cab',     type: 'Bass Cabinet' },
  ],
  mon: [
    { name: 'Wedge',        nameKey:'libWedge',       icon: 'cx-wedge',        type: 'Floor Wedge' },
    { name: 'Floor PA',     nameKey:'libFloorPA',     icon: 'volume-2',         type: 'Powered Floor PA' },
    { name: 'Stage Sub',    nameKey:'libStageSub',    icon: 'disc',             type: 'Stage Sub-Woofer' },
    { name: 'IEM Pack',     nameKey:'libIEMPack',     icon: 'headphones',       type: 'In-Ear Monitor' },
    { name: 'Drum Fill',    nameKey:'libDrumFill',    icon: 'speaker',          type: 'Drum Fill Monitor' },
    { name: 'Drum Sub',     nameKey:'libDrumSub',     icon: 'disc-2',           type: 'Drum Sub Monitor' },
    { name: 'Side Fill',    nameKey:'libSideFill',    icon: 'megaphone',        type: 'Side Fill' },
    { name: 'Main PA L',    nameKey:'libMainPAL',     icon: 'volume-2',         type: 'Main PA Left' },
    { name: 'Main PA R',    nameKey:'libMainPAR',     icon: 'volume-2',         type: 'Main PA Right' },
    { name: 'Delay Tower',  nameKey:'libDelayTower',  icon: 'radio',            type: 'Delay Speaker Tower' },
    { name: 'Front Fill',   nameKey:'libFrontFill',   icon: 'cx-front-fill',    type: 'Front Fill Speaker' },
    { name: 'Headphone Amp',nameKey:'libHeadphoneAmp',icon: 'headset',          type: 'Headphone Amplifier' },
  ],
  util: [
    { name: 'Mixer',        nameKey:'libMixer',       icon: 'sliders-horizontal', type: 'Stage Mixer' },
    { name: 'Power Distro', nameKey:'libPowerDistro', icon: 'zap',              type: 'Power Distro' },
    { name: 'Stage Box',    nameKey:'libStageBox',    icon: 'box',              type: 'Stage Box' },
    { name: 'Patch Bay',    nameKey:'libPatchBay',    icon: 'grid-3x3',         type: 'Patch Bay' },
    { name: 'Router',       nameKey:'libRouter',      icon: 'network',          type: 'Network Router' },
    { name: 'Splitter',     nameKey:'libSplitter',    icon: 'git-branch',       type: 'Audio Splitter' },
    { name: 'FOH Console',  nameKey:'libFOHConsole',  icon: 'sliders-vertical', type: 'FOH Mixing Console' },
    { name: 'MON Console',  nameKey:'libMONConsole',  icon: 'sliders-horizontal', type: 'Monitor Console' },
    { name: 'Amp Rack',     nameKey:'libAmpRack',     icon: 'server',           type: 'Amplifier Rack' },
    { name: 'Effects Rack', nameKey:'libEffectsRack', icon: 'cpu',              type: 'Effects Rack' },
    { name: 'Wireless Rack',nameKey:'libWirelessRack',icon: 'cx-wireless-rack', type: 'Wireless Rack' },
    { name: 'Laptop',       nameKey:'libLaptop',      icon: 'laptop',           type: 'Laptop / Computer' },
    { name: 'Intercom',     nameKey:'libIntercom',    icon: 'headset',          type: 'Intercom System' },
    { name: 'DI Box',      nameKey:'libDIBox',       icon: 'cx-di-box',         type: 'DI Box' },
    { name: 'Loop Station',nameKey:'libLoopStation', icon: 'repeat-2',          type: 'Loop Station' },
    { name: 'Playback',    nameKey:'libPlayback',    icon: 'play-circle',       type: 'Playback Device' },
    { name: 'Outlet',      nameKey:'libOutlet',      icon: 'cx-outlet',         type: 'Power Outlet' },
  ],
};

// ══════════════════════════════════════════════════════════
//  PHOTO ICON MAP — maps icon names to real PNG images
// ══════════════════════════════════════════════════════════
const ICON_IMAGES = {
  'cx-drum-clip':       '/stage-core/icons/drum-clip.png',
  'cx-elec-guitar':     '/stage-core/icons/elec-guitar.png',
  'cx-bass-guitar':     '/stage-core/icons/bass-guitar.png',
  'cx-synth':           '/stage-core/icons/synth.png',
  'cx-edrum':           '/stage-core/icons/edrum.png',
  'cx-percussion':      '/stage-core/icons/percussion.png',
  'cx-trumpet':         '/stage-core/icons/trumpet.png',
  'cx-violin':          '/stage-core/icons/violin.png',
  'cx-di-box':          '/stage-core/icons/di-box.png',
  'cx-wireless':        '/stage-core/icons/wireless-handheld.png',
  'cx-wireless-rack':   '/stage-core/icons/wireless-antenna.png',
  'cx-boundary':        '/stage-core/icons/boundary-mic.png',
  'cx-front-fill':      '/stage-core/icons/front-fill.png',
  'cx-cajon':           '/stage-core/icons/cajon.svg',
  'cx-shaker':          '/stage-core/icons/shaker.svg',
  'cx-tambourine':      '/stage-core/icons/tambourine.svg',
  'mic':                '/stage-core/icons/mic-sm58.png',
  'mic-2':              '/stage-core/icons/mic-condenser.png',
  'guitar':             '/stage-core/icons/acoustic-guitar.png',
  'piano':              '/stage-core/icons/keyboard.png',
  'drum':               '/stage-core/icons/drum-kit.png',
  'cx-amp-cab':         '/stage-core/icons/amp-cab.png',
  'cx-bass-cab':        '/stage-core/icons/bass-cab.png',
  'cx-guitar-amp':      '/stage-core/icons/guitar-amp.png',
  'cx-bass-amp':        '/stage-core/icons/bass-amp.png',
  'cx-wedge':           '/stage-core/icons/wedge.png',
  'volume-2':           '/stage-core/icons/main-pa.png',
  'disc':               '/stage-core/icons/stage-sub.png',
  'disc-2':             '/stage-core/icons/drum-fill.png',
  'speaker':            '/stage-core/icons/drum-fill.png',
  'megaphone':          '/stage-core/icons/side-fill.png',
  'headphones':         '/stage-core/icons/iem-pack.png',
  'headset':            '/stage-core/icons/iem-pack.png',
  'sliders-horizontal': '/stage-core/icons/mon-console.png',
  'sliders-vertical':   '/stage-core/icons/foh-console.png',
  'zap':                '/stage-core/icons/power-distro.png',
  'box':                '/stage-core/icons/stage-box.png',
  'server':             '/stage-core/icons/amp-rack.png',
  'cpu':                '/stage-core/icons/effects-rack.png',
  'grid-3x3':           '/stage-core/icons/patch-bay.png',
  'git-branch':         '/stage-core/icons/splitter.png',
  'cx-outlet':          '/stage-core/icons/outlet.png',
};
function iconHtml(icon, size, extra) {
  const src = ICON_IMAGES[icon];
  if (src) return `<img src="${src}" draggable="false" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0;image-rendering:auto;${extra||''}">`;
  const customPaths = CUSTOM_ICONS && CUSTOM_ICONS[icon];
  if (customPaths) return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:inline-block;${extra||''}">${customPaths}</svg>`;
  return `<i data-lucide="${icon}" style="width:${size}px;height:${size}px;flex-shrink:0;stroke-width:1.8;${extra||''}"></i>`;
}

// ══════════════════════════════════════════════════════════
//  CUSTOM INSTRUMENT ICONS  (prefix: cx-)
//  Each value is innerHTML for a 24×24 viewBox SVG (stroke, no fill except
//  where fill="currentColor" is explicit for details like tuning pegs)
// ══════════════════════════════════════════════════════════
const CUSTOM_ICONS = {
  /* ELECTRIC BASS GUITAR – 4-in-line headstock (right side), long slim neck,
     asymmetric P-Bass body.  The 4 pegs are THE key differentiator vs guitar. */
  'cx-bass-guitar': `
    <rect x="10" y="1" width="4" height="6" rx="0.8"/>
    <line x1="14" y1="2"   x2="15.5" y2="2"/>  <circle cx="16.3" cy="2"   r="0.8" fill="currentColor"/>
    <line x1="14" y1="3.3" x2="15.5" y2="3.3"/><circle cx="16.3" cy="3.3" r="0.8" fill="currentColor"/>
    <line x1="14" y1="4.6" x2="15.5" y2="4.6"/><circle cx="16.3" cy="4.6" r="0.8" fill="currentColor"/>
    <line x1="14" y1="5.9" x2="15.5" y2="5.9"/><circle cx="16.3" cy="5.9" r="0.8" fill="currentColor"/>
    <line x1="9.5" y1="7.2" x2="14.5" y2="7.2"/>
    <path d="M11 7.2 L11 17.5 L13 17.5 L13 7.2 Z"/>
    <path d="M13 14.5 Q18 13 18 16.5 Q18 20 14.5 19.5 L13 19.5"/>
    <path d="M11 17.5 Q5.5 18 5.5 21.5 Q5.5 24 10 23.5 Q12 23.5 12 21 L12 19.5"/>
    <path d="M12 19.5 Q13.5 21 12.5 23.5"/>`,

  /* ELECTRIC GUITAR (STRATOCASTER) – 3+3 headstock pegs (symmetric),
     slim neck, double-cutaway solid body.  Clearly not acoustic.             */
  'cx-elec-guitar': `
    <rect x="10" y="1" width="4" height="5.5" rx="0.8"/>
    <line x1="10" y1="1.8" x2="8.5" y2="1.8"/><circle cx="7.8" cy="1.8" r="0.8" fill="currentColor"/>
    <line x1="10" y1="3"   x2="8.5" y2="3"/>  <circle cx="7.8" cy="3"   r="0.8" fill="currentColor"/>
    <line x1="10" y1="4.3" x2="8.5" y2="4.3"/><circle cx="7.8" cy="4.3" r="0.8" fill="currentColor"/>
    <line x1="14" y1="1.8" x2="15.5" y2="1.8"/><circle cx="16.2" cy="1.8" r="0.8" fill="currentColor"/>
    <line x1="14" y1="3"   x2="15.5" y2="3"/>  <circle cx="16.2" cy="3"   r="0.8" fill="currentColor"/>
    <line x1="14" y1="4.3" x2="15.5" y2="4.3"/><circle cx="16.2" cy="4.3" r="0.8" fill="currentColor"/>
    <line x1="9.5" y1="6.7" x2="14.5" y2="6.7"/>
    <rect x="10.5" y="6.7" width="3" height="10.5" rx="0.3"/>
    <path d="M10.5 15.5 Q6 14 5.5 17.5 Q5 20.5 8 21.5 L12 21.5"/>
    <path d="M13.5 15.5 Q18 14 18.5 17.5 Q19 20.5 16 21.5 L12 21.5"/>`,

  /* VIOLIN / STRINGS – small scroll, short neck, tight C-bout waist,
     large lower bout, bridge line.  Unmistakably a bowed string instrument.  */
  'cx-violin': `
    <path d="M12 1 Q15 1 15 3 Q15 5 12.5 5.5"/>
    <rect x="11" y="5.5" width="2" height="4" rx="0.3"/>
    <path d="M9.5 9.5 Q7 10.5 7 13 Q7 15 9 15.5"/>
    <path d="M14.5 9.5 Q17 10.5 17 13 Q17 15 15 15.5"/>
    <line x1="9.5" y1="9.5" x2="14.5" y2="9.5"/>
    <path d="M9 15.5 Q8.5 16.5 9 17.5"/>
    <path d="M15 15.5 Q15.5 16.5 15 17.5"/>
    <path d="M9 17.5 Q7 18.5 7 21.5 Q7 24 12 24 Q17 24 17 21.5 Q17 18.5 15 17.5"/>
    <line x1="10" y1="21" x2="14" y2="21"/>`,

  /* TRUMPET / BRASS & HORNS – horizontal: mouthpiece left, 3 valve buttons
     on top, return-loop tube, flared bell opening right.                      */
  'cx-trumpet': `
    <line x1="1.5" y1="12" x2="4" y2="12"/>
    <circle cx="3" cy="12" r="1.5"/>
    <path d="M5 10.5 L14 10.5"/>
    <path d="M5 13.5 L14 13.5"/>
    <path d="M5 10.5 Q3.5 10.5 3.5 12 Q3.5 13.5 5 13.5"/>
    <line x1="7"  y1="10.5" x2="7"  y2="8.5"/><circle cx="7"  cy="7.8" r="1.2"/>
    <line x1="10" y1="10.5" x2="10" y2="8.5"/><circle cx="10" cy="7.8" r="1.2"/>
    <line x1="13" y1="10.5" x2="13" y2="8.5"/><circle cx="13" cy="7.8" r="1.2"/>
    <path d="M14 10.5 Q17 10 20 7.5 Q21.5 6 22.5 5"/>
    <path d="M14 13.5 Q17 14 20 16.5 Q21.5 18 22.5 19"/>
    <line x1="22.5" y1="5" x2="22.5" y2="19"/>`,

  /* SYNTHESIZER – outer case, 5 fader tracks (thin) + filled slider caps at
     varied heights, divider, then 6-white-key keyboard with 4 black keys.
     Elements kept minimal so the icon reads cleanly at all sizes.          */
  'cx-synth': `
    <rect x="1" y="2.5" width="22" height="19" rx="1.5"/>
    <line x1="1" y1="13" x2="23" y2="13"/>
    <line x1="3"   y1="4.5" x2="3"   y2="11.5" stroke-width="0.8"/>
    <rect x="1.9"  y="7.5"  width="2.2" height="1.8" rx="0.4" fill="currentColor" stroke="none"/>
    <line x1="6"   y1="4.5" x2="6"   y2="11.5" stroke-width="0.8"/>
    <rect x="4.9"  y="5.5"  width="2.2" height="1.8" rx="0.4" fill="currentColor" stroke="none"/>
    <line x1="9"   y1="4.5" x2="9"   y2="11.5" stroke-width="0.8"/>
    <rect x="7.9"  y="9"    width="2.2" height="1.8" rx="0.4" fill="currentColor" stroke="none"/>
    <line x1="12"  y1="4.5" x2="12"  y2="11.5" stroke-width="0.8"/>
    <rect x="10.9" y="6.5"  width="2.2" height="1.8" rx="0.4" fill="currentColor" stroke="none"/>
    <line x1="15"  y1="4.5" x2="15"  y2="11.5" stroke-width="0.8"/>
    <rect x="13.9" y="8.5"  width="2.2" height="1.8" rx="0.4" fill="currentColor" stroke="none"/>
    <line x1="4.5"  y1="13" x2="4.5"  y2="21.5"/>
    <line x1="8"    y1="13" x2="8"    y2="21.5"/>
    <line x1="11.5" y1="13" x2="11.5" y2="21.5"/>
    <line x1="15"   y1="13" x2="15"   y2="21.5"/>
    <line x1="18.5" y1="13" x2="18.5" y2="21.5"/>
    <rect x="3.5"  y="13.3" width="1.5" height="5" rx="0.3" fill="currentColor" stroke="none"/>
    <rect x="7"    y="13.3" width="1.5" height="5" rx="0.3" fill="currentColor" stroke="none"/>
    <rect x="14"   y="13.3" width="1.5" height="5" rx="0.3" fill="currentColor" stroke="none"/>
    <rect x="17.5" y="13.3" width="1.5" height="5" rx="0.3" fill="currentColor" stroke="none"/>`,

  /* ELECTRONIC DRUMS – overhead view: octagonal main pad with trigger in
     center, two cymbal pads (ellipses) top-left/right, stand legs below.     */
  'cx-edrum': `
    <path d="M8 2 L16 2 L20 6 L20 13 L16 17 L8 17 L4 13 L4 6 Z"/>
    <circle cx="12" cy="9.5" r="3.5"/>
    <circle cx="12" cy="9.5" r="1.3" fill="currentColor"/>
    <ellipse cx="21" cy="1.5" rx="3" ry="1.2"/>
    <ellipse cx="3"  cy="1.5" rx="3" ry="1.2"/>
    <line x1="12" y1="17" x2="12" y2="22"/>
    <line x1="9" y1="22" x2="15" y2="22"/>
    <line x1="9" y1="22" x2="8"  y2="24"/>
    <line x1="15" y1="22" x2="16" y2="24"/>`,

  /* PERCUSSION (CONGAS) – two conga drums side by side.  The size difference
     (smaller + taller / larger + shorter) is true to real congas.            */
  'cx-percussion': `
    <path d="M3.5 6 Q3.5 3.5 7 3.5 Q10.5 3.5 10.5 6 L10.5 19 Q10.5 22 7 22 Q3.5 22 3.5 19 Z"/>
    <ellipse cx="7" cy="6" rx="3.5" ry="1.8"/>
    <path d="M13.5 4 Q13.5 2 18 2 Q22.5 2 22.5 4 L22.5 19 Q22.5 22 18 22 Q13.5 22 13.5 19 Z"/>
    <ellipse cx="18" cy="4" rx="4.5" ry="1.8"/>`,

  /* GUITAR COMBO AMPLIFIER – control strip with 3 knobs, single 12" speaker
     circle. Immediately recognizable as a guitar combo (not a zap icon!).    */
  'cx-guitar-amp': `
    <rect x="2" y="3" width="20" height="19" rx="1.5"/>
    <line x1="2" y1="8.5" x2="22" y2="8.5"/>
    <circle cx="7"  cy="5.8" r="1.5"/>
    <circle cx="12" cy="5.8" r="1.5"/>
    <circle cx="17" cy="5.8" r="1.5"/>
    <circle cx="12" cy="16" r="5.5"/>
    <circle cx="12" cy="16" r="2.2" fill="currentColor"/>`,

  /* BASS COMBO AMPLIFIER – same idea but taller body (bass amps are bulkier),
     wider/larger speaker cone, bigger dust cap.                               */
  'cx-bass-amp': `
    <rect x="1.5" y="1.5" width="21" height="21" rx="1.5"/>
    <line x1="1.5" y1="7.5" x2="22.5" y2="7.5"/>
    <circle cx="6"  cy="4.5" r="1.8"/>
    <circle cx="12" cy="4.5" r="1.8"/>
    <circle cx="18" cy="4.5" r="1.8"/>
    <circle cx="12" cy="15.5" r="7"/>
    <circle cx="12" cy="15.5" r="2.8" fill="currentColor"/>`,

  /* GUITAR SPEAKER CABINET 4×12 – rectangle with a 2×2 grid of four speakers.
     This is THE iconic look of a Marshall 4x12 — impossible to mistake.      */
  'cx-amp-cab': `
    <rect x="1" y="1" width="22" height="22" rx="1.5"/>
    <circle cx="7"  cy="7"  r="4"/>  <circle cx="7"  cy="7"  r="1.4" fill="currentColor"/>
    <circle cx="17" cy="7"  r="4"/>  <circle cx="17" cy="7"  r="1.4" fill="currentColor"/>
    <circle cx="7"  cy="17" r="4"/>  <circle cx="7"  cy="17" r="1.4" fill="currentColor"/>
    <circle cx="17" cy="17" r="4"/>  <circle cx="17" cy="17" r="1.4" fill="currentColor"/>`,

  /* BASS SPEAKER CABINET – wider rectangle, two large side-by-side speakers
     (4×10 or 2×15 style).  Wider speakers = lower bass suggestion.          */
  'cx-bass-cab': `
    <rect x="1" y="3" width="22" height="18" rx="1.5"/>
    <circle cx="7.5"  cy="12" r="5.5"/>  <circle cx="7.5"  cy="12" r="2" fill="currentColor"/>
    <circle cx="16.5" cy="12" r="5.5"/>  <circle cx="16.5" cy="12" r="2" fill="currentColor"/>`,

  /* FLOOR WEDGE MONITOR – classic parallelogram/wedge profile: low front,
     tall back, speaker cone visible inside the body.                         */
  'cx-wedge': `
    <path d="M1 22 L23 22 L23 6 L10 22 Z"/>
    <circle cx="17.5" cy="17" r="4"/>
    <circle cx="17.5" cy="17" r="1.5" fill="currentColor"/>`,

  /* DRUM CLIP MIC – C-clamp/rim-mount body (left), short gooseneck curve,
     cylindrical mic capsule (right).  Distinct from all handheld mic icons. */
  'cx-drum-clip': `
    <path d="M9 2 Q4 2 4 7 L4 17 Q4 22 9 22"/>
    <line x1="9" y1="2"  x2="12" y2="2"/>
    <line x1="9" y1="22" x2="12" y2="22"/>
    <line x1="12" y1="2" x2="12" y2="22"/>
    <path d="M12 9 Q15 9 15.5 12"/>
    <path d="M12 15 Q15 15 15.5 12"/>
    <rect x="15" y="8" width="7" height="8" rx="3.5"/>
    <line x1="15" y1="12" x2="22" y2="12"/>`,

  /* DUPLEX POWER OUTLET — US-style face plate, two outlets each with
     neutral (wider left slot) + hot (narrower right slot) vertical openings.
     Screw holes at top/bottom center.  No ground (2-prong). */
  'cx-outlet': `
    <rect x="3" y="0.5" width="18" height="23" rx="2.5" stroke-width="1.5"/>
    <circle cx="12" cy="2.5" r="0.85" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="21.5" r="0.85" fill="currentColor" stroke="none"/>
    <rect x="5.5" y="4" width="13" height="7.5" rx="1.5" stroke-width="1.2"/>
    <rect x="7.5" y="5.8" width="2"   height="3.8" rx="1"   fill="currentColor" stroke="none" opacity="0.85"/>
    <rect x="14.5" y="5.8" width="1.5" height="3.8" rx="0.75" fill="currentColor" stroke="none" opacity="0.85"/>
    <rect x="5.5" y="12.5" width="13" height="7.5" rx="1.5" stroke-width="1.2"/>
    <rect x="7.5" y="14.3" width="2"   height="3.8" rx="1"   fill="currentColor" stroke="none" opacity="0.85"/>
    <rect x="14.5" y="14.3" width="1.5" height="3.8" rx="0.75" fill="currentColor" stroke="none" opacity="0.85"/>`,
};

// ── Lucide helper: defers icon scan to after paint, optional scope ────────────
function lcIcons(el) {
  if (!window.lucide) return;
  requestAnimationFrame(() => lucide.createIcons(el ? { el } : undefined));
}

// ── Custom icon renderer ──────────────────────────────────────────────────────
// Intercepts any <i data-lucide="cx-*"> left after lucide.createIcons() and
// replaces them with proper inline SVG from CUSTOM_ICONS.
function _applyCustomIcons() {
  document.querySelectorAll('i[data-lucide^="cx-"]').forEach(el => {
    const name = el.getAttribute('data-lucide');
    const svgContent = CUSTOM_ICONS[name];
    if (!svgContent) return;
    const w  = el.style.width       || '24px';
    const h  = el.style.height      || '24px';
    const sw = el.style.strokeWidth || '1.8';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', sw);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.cssText = el.style.cssText;
    svg.style.width  = w;
    svg.style.height = h;
    svg.innerHTML = svgContent;
    el.replaceWith(svg);
  });
}
// Monkeypatch lucide.createIcons so every call automatically processes custom icons too.
// Temporarily suppress console.warn during the call to silence "icon not found" noise
// from the cx-* custom icons that Lucide doesn't know about (we handle them ourselves).
if (window.lucide && typeof lucide.createIcons === 'function') {
  const _origCI = lucide.createIcons.bind(lucide);
  lucide.createIcons = function(...a) {
    const _w = console.warn;
    console.warn = function(msg, ...rest) {
      if (typeof msg === 'string' && msg.includes('icon name was not found')) return;
      _w.call(console, msg, ...rest);
    };
    try { _origCI(...a); } finally { console.warn = _w; }
    _applyCustomIcons();
  };
}

const inputSourceLabels = {
  SL01:'XLR-M Stage Left 01', SL02:'XLR-M Stage Left 02', SL03:'XLR-M Stage Left 03', SL04:'XLR-M Stage Left 04',
  SR01:'XLR-M Stage Right 01', SR02:'XLR-M Stage Right 02', SR03:'XLR-M Stage Right 03',
  WRA:'Wireless Rack A', WRB:'Wireless Rack B', DNT1:'Dante Primary 01', DNT2:'Dante Primary 02', DI:'Direct Inject (DI)'
};
const inputSourceLabelsEs = {
  SL01:'XLR Lateral Izquierdo 01', SL02:'XLR Lateral Izquierdo 02', SL03:'XLR Lateral Izquierdo 03', SL04:'XLR Lateral Izquierdo 04',
  SR01:'XLR Lateral Derecho 01', SR02:'XLR Lateral Derecho 02', SR03:'XLR Lateral Derecho 03',
  WRA:'Rack Inalámbrico A', WRB:'Rack Inalámbrico B', DNT1:'Dante Primario 01', DNT2:'Dante Primario 02', DI:'Direct Inject (DI)'
};

const GEAR_CATS_ES = {
  'Instruments':'Instrumentos','Microphones':'Micrófonos','Audio':'Audio',
  'Cables':'Cables','Power':'Electricidad','Outboard':'Outboard',
  'Stands':'Pedestales','Misc':'Misceláneos'
};

const ELEMENT_TYPES_ES = {
  'Dynamic Mic':'Micrófono Dinámico','Condenser Mic':'Micrófono Condensador',
  'Instrument Mic':'Micrófono de Instrumento','Wireless Mic':'Micrófono Inalámbrico',
  'PZM Mic':'Micrófono PZM','Instrument Clip':'Clip de Instrumento',
  'Electric Guitar':'Guitarra Eléctrica','Acoustic Guitar':'Guitarra Acústica',
  'Bass Guitar':'Bajo Eléctrico','Upright Bass':'Contrabajo',
  'Keyboard DI':'Teclado DI','Synthesizer':'Sintetizador',
  'Acoustic Drums':'Batería Acústica','Electronic Drums':'Batería Electrónica',
  'Percussion':'Percusión','DI Box':'Caja DI',
  'Loop Station':'Estación de Loop','Playback Device':'Dispositivo de Reproducción',
  'Brass Instrument':'Instrumento de Viento Metal','String Instrument':'Instrumento de Cuerda',
  'Guitar Cabinet':'Gabinete de Guitarra','Bass Cabinet':'Gabinete de Bajo',
  'Guitar Amplifier':'Amplificador de Guitarra','Bass Amplifier':'Amplificador de Bajo',
  'Floor Wedge':'Monitor de Suelo (Cuña)','Powered Floor PA':'PA de Suelo Amplificado',
  'Stage Sub-Woofer':'Subwoofer de Escenario','In-Ear Monitor':'Monitor In-Ear',
  'Drum Fill Monitor':'Monitor de Batería (Fill)','Drum Sub Monitor':'Subwoofer de Batería',
  'Side Fill':'Side Fill','Main PA Left':'PA Principal Izquierdo','Main PA Right':'PA Principal Derecho',
  'Delay Speaker Tower':'Torre de Delay','Front Fill Speaker':'Altavoz Front Fill',
  'Headphone Amplifier':'Amplificador de Audífonos','Stage Mixer':'Mezclador de Escenario',
  'Power Distro':'Distribuidor de Energía','Stage Box':'Caja de Escenario',
  'Patch Bay':'Patchbay','Network Router':'Router de Red','Audio Splitter':'Divisor de Audio',
  'FOH Mixing Console':'Consola FOH','Monitor Console':'Consola de Monitores',
  'Amplifier Rack':'Rack de Amplificadores','Effects Rack':'Rack de Efectos',
  'Wireless Rack':'Rack Inalámbrico','Laptop / Computer':'Laptop / Computadora',
  'Intercom System':'Sistema Intercom'
};

// ── Translation helpers ────────────────────────────────────
// Translate a gear category key into the current language label
function Tcat(cat) {
  if (state.lang === 'es') return GEAR_CATS_ES[cat] || cat;
  return cat;
}
// Translate an input-source code into the current language label
function TSource(code) {
  if (!code) return '—';
  if (state.lang === 'es') return inputSourceLabelsEs[code] || inputSourceLabels[code] || code;
  return inputSourceLabels[code] || code;
}
// Translate an element type string into the current language
function Ttype(type) {
  if (!type) return '—';
  if (state.lang === 'es') return ELEMENT_TYPES_ES[type] || type;
  return type;
}
// Template-style translation: T('key', { name: 'Foo' }) replaces {name}
function Tformat(key, vars) {
  let s = T(key);
  if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace('{' + k + '}', v); });
  return s;
}

// ══════════════════════════════════════════════════════════
//  HISTORY (Undo / Redo)
// ══════════════════════════════════════════════════════════
function pushHistory() {
  const snap = JSON.stringify({ elements: state.elements, connections: state.connections, setlist: state.setlist, segments: state.segments });
  if (state.historyIndex >= 0 && snap === state.history[state.historyIndex]) return;
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snap);
  state.historyIndex++;
  updateHistoryButtons();
  markAutosaveDirty();
}
function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  const s = JSON.parse(state.history[state.historyIndex]);
  state.elements = s.elements; state.connections = s.connections;
  if (s.setlist) state.setlist = s.setlist;
  if (s.segments) state.segments = s.segments;
  state.selectedId = null;
  renderAll(); renderSetlist(); updateHistoryButtons();
}
function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  const s = JSON.parse(state.history[state.historyIndex]);
  state.elements = s.elements; state.connections = s.connections;
  if (s.setlist) state.setlist = s.setlist;
  if (s.segments) state.segments = s.segments;
  state.selectedId = null;
  renderAll(); renderSetlist(); updateHistoryButtons();
}
function updateHistoryButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.style.opacity = state.historyIndex > 0 ? '1' : '0.3';
  if (r) r.style.opacity = state.historyIndex < state.history.length - 1 ? '1' : '0.3';
}
const _undoBtn = document.getElementById('btn-undo');
const _redoBtn = document.getElementById('btn-redo');
if (_undoBtn) _undoBtn.addEventListener('click', undo);
if (_redoBtn) _redoBtn.addEventListener('click', redo);

// ══════════════════════════════════════════════════════════
//  VIEW SWITCHING
// ══════════════════════════════════════════════════════════
function switchView(view) {
  // Map React-facing view names to internal iframe view names
  if (view === 'Preferences') view = 'Assistant';
  // Capture real canvas size before the Editor gets hidden
  if (state.currentView === 'Editor') {
    const r = stageCanvas.getBoundingClientRect();
    if (r.width > 0) { state.canvasW = r.width; state.canvasH = r.height; }
  }
  const prevView = state.currentView;
  state.currentView = view;
  document.querySelectorAll('.view-page').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('view-entering');
    p.style.opacity = '';
    p.style.transform = '';
  });
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('view-' + view);
  if (page) {
    page.style.display = (view === 'Assistant' || view === 'Export') ? 'flex' : 'block';
    // The Editor view contains position:fixed children (sidebar, cat-bar).
    // Applying opacity to the parent traps those children in its stacking
    // context and causes them to disappear — so Editor snaps in immediately.
    // All other views are safe to fade because they have no fixed children.
    if (prevView !== view && view !== 'Editor') {
      page.style.opacity = '0';
      page.style.transform = 'translateY(5px)';
      page.classList.add('view-entering');
      requestAnimationFrame(() => {
        page.style.opacity = '1';
        page.style.transform = 'translateY(0)';
      });
    }
  }
  document.querySelectorAll('[data-view="' + view + '"]').forEach(b => b.classList.add('active'));
  // Sync active state of all preference UI chips whenever the Preferences view opens
  if (view === 'Preferences') syncSettingsUI();
  updateStatusBar(); // keep status bar stats current on every view switch
  // Sync mobile tabs
  document.querySelectorAll('.mob-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'Editor') { renderElements(); lcIcons(); }
  if (view === 'Rider') refreshRider();
  if (view === 'Setlist') renderSetlist();
  if (view === 'Gear') { renderGear(); lcIcons(); }
  if (view === 'Members') { renderMembersView(); lcIcons(); }
  if (view === 'Export') { if (prevView !== 'Export') state.prevView = prevView || 'Editor'; refreshExport(); }
  // Notify the React wrapper of view changes (shows/hides its back button)
  try { if (window.__onViewChange) window.__onViewChange(view); } catch(e) {}
  // Desktop: show category top bar only on Editor view
  const deskBar  = document.getElementById('desktop-cat-bar');
  const deskTray = document.getElementById('desktop-el-tray');
  if (deskBar) deskBar.classList.toggle('desk-bar-visible', view === 'Editor' && window.innerWidth >= 768);
  if (deskTray) { deskTray.classList.remove('desk-tray-open'); deskTray.innerHTML = ''; }
  document.querySelectorAll('.desk-cat-btn').forEach(b => b.classList.remove('active'));
  // On mobile, close sidebar drawer when switching views
  closeMobileSidebar();
  // On mobile, only show category bar + toolbar on Editor view
  const elTray     = document.getElementById('mobile-el-tray');
  const scVtools   = document.getElementById('sc-vtools');
  const fabWrap    = document.getElementById('sc-fab-wrap');
  const expBar     = document.getElementById('mob-export-bar');
  const expSheet   = document.getElementById('mob-export-settings');
  const isEditor   = (view === 'Editor');
  const isExport   = (view === 'Export');
  if (elTray)    elTray.classList.remove('mob-tray-open');
  if (scVtools)  scVtools.classList.toggle('mob-hidden', !isEditor);
  if (fabWrap)   fabWrap.classList.toggle('mob-hidden', !isEditor);
  if (!isEditor) { closeSCDial(); closeItemSheet(false); }
  if (expBar)    expBar.classList.add('mob-hidden'); // new export-bottom-bar replaces this
  if (expSheet)  { expSheet.style.display = 'none'; }
  if (document.getElementById('mob-exp-set-btn'))
    document.getElementById('mob-exp-set-btn').classList.remove('active');
  // Completely hide the bottom nav bar in Export view; restore it on any other view.
  // Must use setProperty('display','none','important') because the nav CSS uses display:flex !important
  var mobileNav = document.getElementById('mobile-nav-bar');
  if (mobileNav) {
    if (isExport) {
      mobileNav.style.setProperty('display', 'none', 'important');
    } else {
      mobileNav.style.removeProperty('display');
    }
  }
}

// ── Mobile sidebar helpers ──────────────────────────────────
function toggleMobileSidebar() {
  const panel = document.getElementById('lib-panel');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (panel.classList.contains('mobile-open')) {
    panel.classList.remove('mobile-open');
    backdrop.classList.remove('active');
  } else {
    panel.classList.add('mobile-open');
    backdrop.classList.add('active');
  }
}
function closeMobileSidebar() {
  const panel = document.getElementById('lib-panel');
  if (panel) panel.classList.remove('mobile-open');
  const bd = document.getElementById('sidebar-backdrop');
  if (bd) bd.classList.remove('active');
}

// ── Mobile export settings sheet ─────────────────────────────
function toggleMobExportSettings() {
  const sheet = document.getElementById('mob-export-settings');
  if (!sheet) return;
  const visible = sheet.style.display === 'flex' || sheet.style.display === 'block';
  if (visible) {
    closeMobExportSettings();
  } else {
    syncMobSettings();
    sheet.style.display = 'block';
    const btn = document.getElementById('mob-exp-set-btn');
    if (btn) btn.classList.add('active');
  }
}
function closeMobExportSettings() {
  const sheet = document.getElementById('mob-export-settings');
  if (sheet) sheet.style.display = 'none';
  const btn = document.getElementById('mob-exp-set-btn');
  if (btn) btn.classList.remove('active');
}
function syncMobSettings() {
  const fmt  = state.exportFormat || 'pdf';
  const hi = '#7aafff', hiTxt = '#002e5d', lo = '#1a1a1a', loTxt = '#767575';
  const setBtn = (id, active) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.background = active ? hi : lo;
    el.style.color = active ? hiTxt : loTxt;
  };
  setBtn('mob-fmt-pdf', true);
  ['stage','input','notes','lighting'].forEach(k => {
    const mob  = document.getElementById('mob-chk-' + k);
    const desk = document.getElementById('chk-' + k);
    if (mob && desk) mob.checked = desk.checked;
  });
}
// Wire up mob-export-settings buttons once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Ensure lib-panel starts closed on every load
  closeMobileSidebar();
  const panel = document.getElementById('lib-panel');
  if (panel) panel.style.display = 'none';

  const closeBtn = document.getElementById('mob-set-close');
  if (closeBtn) closeBtn.addEventListener('click', closeMobExportSettings);
  const fPdf = document.getElementById('mob-fmt-pdf');
  if (fPdf) fPdf.addEventListener('click', () => { setExportFormat('pdf'); syncMobSettings(); });
  ['stage','input','notes','lighting'].forEach(k => {
    const mob = document.getElementById('mob-chk-' + k);
    if (mob) mob.addEventListener('change', function() {
      const desk = document.getElementById('chk-' + k);
      if (desk) { desk.checked = this.checked; toggleExportSection('exp-' + k + '-section', this.checked); }
    });
  });
});

// ── Mobile category tray ─────────────────────────────────────
function openMobileCat(cat) {
  const tray = document.getElementById('mobile-el-tray');
  const btns = document.querySelectorAll('.mob-cat-btn');
  const alreadyActive = [...btns].find(b => b.dataset.cat === cat && b.classList.contains('active'));
  if (alreadyActive && tray.classList.contains('mob-tray-open')) {
    closeMobileElTray(); return;
  }
  btns.forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  tray.innerHTML = '';
  (library[cat] || []).forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'mob-el-btn';
    if (item._isCreate) {
      btn.style.cssText = 'border:1px dashed rgba(122,175,255,0.4);color:#7aafff;';
      btn.innerHTML = `<span style="font-size:18px;line-height:1;">+</span><span>New</span>`;
      btn.addEventListener('click', () => { closeMobileElTray(); openCustomElementModal(); });
    } else if (item.isCustom) {
      const iconMob = item.imageData
        ? `<img src="${item.imageData}" style="width:22px;height:22px;object-fit:contain;" draggable="false"/>`
        : `<span style="font-size:18px;line-height:1;">${item.emoji || '🎵'}</span>`;
      btn.innerHTML = `${iconMob}<span>${item.name}</span>`;
      btn.addEventListener('click', () => { addItemToStage(item); });
    } else {
      btn.innerHTML = `${iconHtml(item.icon,22,'color:#7aafff;')}<span>${item.name}</span>`;
      btn.addEventListener('click', () => { addItemToStage(item); });
    }
    tray.appendChild(btn);
  });
  tray.classList.add('mob-tray-open');
  lcIcons();
}
function closeMobileElTray() {
  document.getElementById('mobile-el-tray').classList.remove('mob-tray-open');
  document.querySelectorAll('.mob-cat-btn').forEach(b => b.classList.remove('active'));
}

// ══════════════════════════════════════════════════════════
//  FAB SPEED DIAL  +  ITEM SHEET  (two-level menu)
// ══════════════════════════════════════════════════════════
const SC_DIAL_CATS = [
  { cat: 'mics',   icon: 'mic',                      label: 'Mics'        },
  { cat: 'drums',  icon: 'music_note',                label: 'Drums'       },
  { cat: 'inst',   icon: 'electric_bolt',             label: 'Instruments' },
  { cat: 'amps',   icon: 'speaker',                   label: 'Amps'        },
  { cat: 'mon',    icon: 'volume_up',                 label: 'Audio'       },
  { cat: 'util',   icon: 'settings_input_component',  label: 'Utilities'   },
  { cat: 'custom', icon: 'add_circle',                label: 'Custom',  accent: true },
  { cat: null,     icon: 'bookmark',                  label: 'Presets', gold: true, action: 'presets' },
];
let _dialOpen = false;

function _buildDial() {
  const container = document.getElementById('sc-dial-items');
  if (!container || container.childElementCount > 0) return;
  SC_DIAL_CATS.forEach(item => {
    const chip = document.createElement('button');
    chip.className = 'sc-dial-chip';
    const iconColor = item.accent ? 'var(--accent)' : item.gold ? '#f0b429' : 'currentColor';
    chip.innerHTML = `<span class="material-symbols-outlined sc-dial-chip-icon" style="color:${iconColor}">${item.icon}</span><span>${item.label}</span>`;
    chip.addEventListener('click', () => {
      if (item.action === 'presets') {
        closeSCDial();
        setTimeout(() => scOpenElPresets(), 90);
      } else {
        openItemSheet(item.cat, item.label);
      }
    });
    container.appendChild(chip);
  });
}

function toggleSCDial() {
  const sheet = document.getElementById('sc-item-sheet');
  const sheetOpen = sheet && sheet.classList.contains('sc-sheet-open');
  if (sheetOpen) { closeItemSheet(false); return; }
  _dialOpen ? closeSCDial() : openSCDial();
}

function openSCDial() {
  _buildDial();
  _dialOpen = true;
  closeMobileElTray();
  const wrap  = document.getElementById('sc-fab-wrap');
  const chips = wrap ? wrap.querySelectorAll('.sc-dial-chip') : [];
  chips.forEach((chip, i) => { chip.style.transitionDelay = `${i * 40}ms`; });
  if (wrap) wrap.classList.add('sc-dial-open');
  // Spring "open" pulse on the FAB button
  const btn = document.getElementById('sc-fab-btn');
  if (btn) {
    btn.classList.remove('sc-fab-opening');
    void btn.offsetWidth;
    btn.classList.add('sc-fab-opening');
    setTimeout(() => btn.classList.remove('sc-fab-opening'), 400);
  }
}

function closeSCDial() {
  if (!_dialOpen) return;
  _dialOpen = false;
  const wrap  = document.getElementById('sc-fab-wrap');
  const chips = wrap ? wrap.querySelectorAll('.sc-dial-chip') : [];
  const total = chips.length;
  chips.forEach((chip, i) => { chip.style.transitionDelay = `${(total - 1 - i) * 22}ms`; });
  if (wrap) wrap.classList.remove('sc-dial-open');
  // Spring "return home" pulse on the FAB button
  const btn = document.getElementById('sc-fab-btn');
  if (btn) {
    btn.classList.remove('sc-fab-returning');
    void btn.offsetWidth; // force reflow to restart animation
    btn.classList.add('sc-fab-returning');
    setTimeout(() => btn.classList.remove('sc-fab-returning'), 520);
  }
}

// ── Item sheet: second-level panel that replaces the bottom cat bar ──
function openItemSheet(cat, label) {
  // Quickly collapse chips (no stagger, instant feel)
  if (_dialOpen) {
    _dialOpen = false;
    const wrap  = document.getElementById('sc-fab-wrap');
    const chips = wrap ? wrap.querySelectorAll('.sc-dial-chip') : [];
    chips.forEach(chip => { chip.style.transitionDelay = '0ms'; });
    if (wrap) wrap.classList.remove('sc-dial-open');
  }

  const sheet   = document.getElementById('sc-item-sheet');
  const titleEl = document.getElementById('sc-item-sheet-title');
  const listEl  = document.getElementById('sc-item-list');
  const wrap    = document.getElementById('sc-fab-wrap');
  if (!sheet || !listEl) return;

  if (titleEl) titleEl.textContent = label;
  listEl.innerHTML = '';

  (library[cat] || []).forEach(item => {
    const btn = document.createElement('button');
    if (item._isCreate) {
      btn.className = 'sc-item-btn sc-item-btn--create';
      btn.innerHTML = `<span class="sc-item-btn-icon"><span class="material-symbols-outlined" style="font-size:15px;">add</span></span><span class="sc-item-btn-name">New Custom</span>`;
      btn.addEventListener('click', () => { closeItemSheet(false); openCustomElementModal(); });
    } else if (item.isCustom) {
      btn.className = 'sc-item-btn';
      const ico = item.imageData
        ? `<img src="${item.imageData}" style="width:20px;height:20px;object-fit:contain;" draggable="false"/>`
        : `<span style="font-size:15px;line-height:1;">${item.emoji || '🎵'}</span>`;
      btn.innerHTML = `<span class="sc-item-btn-icon">${ico}</span><span class="sc-item-btn-name">${item.name}</span>`;
      btn.addEventListener('click', () => { addItemToStage(item); closeItemSheet(false); });
    } else {
      btn.className = 'sc-item-btn';
      btn.innerHTML = `<span class="sc-item-btn-icon">${iconHtml(item.icon, 16, 'color:#7aafff;')}</span><span class="sc-item-btn-name">${item.name}</span>`;
      btn.addEventListener('click', () => { addItemToStage(item); closeItemSheet(false); });
    }
    listEl.appendChild(btn);
  });
  lcIcons();

  // Show sheet + keep FAB in × state
  setTimeout(() => {
    if (wrap) wrap.classList.add('sc-items-open');
    sheet.classList.add('sc-sheet-open');
  }, 100);
}

function closeItemSheet(goBackToChips) {
  const sheet = document.getElementById('sc-item-sheet');
  const wrap  = document.getElementById('sc-fab-wrap');
  if (sheet) sheet.classList.remove('sc-sheet-open');
  if (wrap)  wrap.classList.remove('sc-items-open');
  if (goBackToChips) {
    setTimeout(() => openSCDial(), 190);
  } else {
    // Spring "return home" pulse when the FAB lands back in its resting state
    const btn = document.getElementById('sc-fab-btn');
    if (btn) {
      btn.classList.remove('sc-fab-returning');
      void btn.offsetWidth;
      btn.classList.add('sc-fab-returning');
      setTimeout(() => btn.classList.remove('sc-fab-returning'), 520);
    }
  }
}

// ── Mobile: add library item directly to center of stage ──────
function addItemToStage(item) {
  const rect = stageCanvas.getBoundingClientRect();
  state.canvasW = rect.width; state.canvasH = rect.height;
  const jitter = () => (Math.random() - 0.5) * 60;
  const x = Math.max(40, Math.min(rect.width  - 40, rect.width  / 2 + jitter()));
  const y = Math.max(40, Math.min(rect.height - 40, rect.height / 2 + jitter()));
  const channelNum = (state.elements.length + 1).toString().padStart(2, '0');
  const displayName = (item.nameKey && T(item.nameKey)) || item.name;
  const isCustom = !!item.isCustom;
  const el = {
    id: 'el-' + state.nextId++, name: item.name, label: displayName.toUpperCase(),
    icon: item.icon, type: item.type, x, y, rotation: 0,
    scale: window.innerWidth < 768 ? 65 : 100,
    channelId: 'CH-' + channelNum, source: 'SL01', output: 'FOH',
    phantom: false, notes: '', color: item.color || '#7aafff', roles: [],
    ...(isCustom ? { isCustom: true, emoji: item.emoji, ...(item.imageData ? { imageData: item.imageData } : {}) } : {}),
  };
  state.elements.push(el);
  _spawnId = el.id;
  renderElements();
  _spawnId = null;
  selectElement(el.id);
  pushHistory();
  updateDropHint();
  _showSmartSuggestion(el);
  closeMobileSidebar();
}
// Nav is now rendered dynamically via renderNav()
// init Editor visible — also show FAB and vertical toolbar for the initial view
document.getElementById('view-Editor').style.display = 'block';
(function() {
  const fab = document.getElementById('sc-fab-wrap');
  if (fab) fab.classList.remove('mob-hidden');
  const vt = document.getElementById('sc-vtools');
  if (vt) vt.classList.remove('mob-hidden');
})();

// ══════════════════════════════════════════════════════════
//  LIBRARY — Accordion
// ══════════════════════════════════════════════════════════
function buildLibraryItem(item) {
  const div = document.createElement('div');

  // Special "Create Custom" sentinel item
  if (item._isCreate) {
    div.className = 'draggable-item bg-surface-container-highest flex flex-col items-center justify-center hover:bg-surface-bright transition-all';
    div.style.cssText = 'cursor:pointer;border:1px dashed rgba(122,175,255,0.35);padding:4px 4px;width:60px;height:60px;flex-shrink:0;';
    div.innerHTML = `
      <span style="font-size:22px;line-height:1;margin-bottom:3px;">+</span>
      <span class="font-bold text-center" style="font-size:8px;text-transform:uppercase;letter-spacing:-0.01em;line-height:1.1;color:#7aafff;">New</span>`;
    div.addEventListener('click', () => openCustomElementModal());
    return div;
  }

  div.className = 'draggable-item bg-surface-container-highest flex flex-col items-center justify-center hover:bg-surface-bright transition-all';
  div.style.cssText = 'cursor:grab;border:1px solid transparent;padding:4px 4px;width:60px;height:60px;flex-shrink:0;';
  div.draggable = true;
  const displayName = (item.nameKey && T(item.nameKey)) || item.name;
  let iconContent;
  if (item.isCustom) {
    iconContent = item.imageData
      ? `<img src="${item.imageData}" style="width:26px;height:26px;object-fit:contain;margin-bottom:3px;" draggable="false"/>`
      : `<span style="font-size:22px;line-height:1;margin-bottom:3px;">${item.emoji || '🎵'}</span>`;
  } else {
    iconContent = iconHtml(item.icon, 28, 'margin-bottom:3px;color:#7aafff;');
  }
  div.innerHTML = `
    ${iconContent}
    <span class="font-bold text-on-surface-variant text-center" style="font-size:8px;text-transform:uppercase;letter-spacing:-0.01em;line-height:1.1;">${displayName}</span>`;
  div.addEventListener('dragstart', e => {
    if (item.isCustom) {
      const payload = { name: displayName, icon: item.emoji || '🎵', type: item.type || 'Custom', isCustom: true, color: item.color };
      if (item.imageData) payload.imageData = item.imageData;
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    } else {
      e.dataTransfer.setData('text/plain', JSON.stringify({ name: displayName, nameKey: item.nameKey, icon: item.icon, type: item.type }));
    }
    div.style.opacity = '0.5';
  });
  div.addEventListener('dragend', () => { div.style.opacity = '1'; });
  div.addEventListener('mouseover', () => { div.style.borderColor = 'rgba(122,175,255,0.2)'; });
  div.addEventListener('mouseout', () => { div.style.borderColor = 'transparent'; });
  // Tap/click to add to center of stage (mobile & desktop tray)
  div.addEventListener('click', () => addItemToStage(item));
  div._item = item;
  return div;
}

// Populate CH-01..CH-32 options in the channel select
(function() {
  const sel = document.getElementById('input-chid');
  if (!sel) return;
  for (let n = 1; n <= 32; n++) {
    const opt = document.createElement('option');
    const val = 'CH-' + String(n).padStart(2, '0');
    opt.value = val;
    opt.textContent = val;
    sel.appendChild(opt);
  }
})();

// Close song modal on backdrop click or Escape
document.getElementById('song-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSongModal();
});
document.getElementById('segment-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSegmentModal();
});
document.getElementById('smart-sort-modal').addEventListener('click', function(e) {
  if (e.target === this) closeSmartSortModal();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (document.getElementById('song-modal').style.display !== 'none') closeSongModal();
    if (document.getElementById('segment-modal').style.display !== 'none') closeSegmentModal();
    if (document.getElementById('smart-sort-modal').style.display !== 'none') closeSmartSortModal();
  }
});
// Save on Enter in title field
document.getElementById('sng-title').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') saveSong();
});
document.getElementById('seg-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') saveSegment();
});

function populateAllGrids() {
  Object.keys(library).forEach(cat => {
    const grid = document.getElementById('grid-' + cat);
    if (!grid) return;
    grid.innerHTML = '';
    library[cat].forEach(item => grid.appendChild(buildLibraryItem(item)));
  });
  lcIcons();
}

function toggleAccordion(cat) {
  const panels = document.querySelectorAll('.accordion-panel');
  const headers = document.querySelectorAll('.accordion-header');
  panels.forEach(panel => {
    if (panel.dataset.panel === cat) {
      const isOpen = panel.style.maxHeight !== '0px' && panel.style.maxHeight !== '';
      panel.style.maxHeight = isOpen ? '0' : '600px';
    } else {
      panel.style.maxHeight = '0';
    }
  });
  headers.forEach(h => {
    const btn = h.closest('.accordion-section');
    const chevron = h.querySelector('.accordion-chevron');
    const isThis = btn && btn.dataset.cat === cat;
    if (chevron) chevron.style.transform = isThis ? 'rotate(180deg)' : 'rotate(0deg)';
    if (isThis) h.classList.add('active'); else h.classList.remove('active');
  });
}

populateAllGrids();
// All categories start closed — hover to open on desktop, click to toggle on mobile

// ── Properties panel: hover to open when peeking, mouseleave returns to peek ──
(function initPropPanelHover() {
  const p = document.getElementById('properties-panel');
  if (!p) return;
  let _hoverOpened = false;
  let _closeTimer = null;
  p.addEventListener('mouseenter', () => {
    // Cancel any pending close first — prevents gap-flicker during CSS transition
    clearTimeout(_closeTimer);
    _closeTimer = null;
    if (_getPropState() === 'peek') {
      _hoverOpened = true;
      setPropState('open');
    }
  });
  p.addEventListener('mouseleave', () => {
    if (_hoverOpened && _getPropState() === 'open') {
      // Delay close so brief cursor gaps (from the slide transition) don't re-trigger
      _closeTimer = setTimeout(() => {
        _hoverOpened = false;
        if (!_propUserDismissed && state.selectedId) setPropState('peek');
      }, 250);
    }
  });
})();

// ── Desktop flyout: hover category → items appear in panel beside sidebar ──
(function initDesktopCatBar() {
  if (window.innerWidth < 768) return;
  const bar  = document.getElementById('desktop-cat-bar');
  const tray = document.getElementById('desktop-el-tray');
  if (!bar || !tray) return;

  let hideTimer = null;
  let activeCat = null;

  function openCat(cat) {
    clearTimeout(hideTimer);
    hideTimer = null;
    if (cat === activeCat) return;
    activeCat = cat;
    // Mark active button
    bar.querySelectorAll('.desk-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    // Populate tray with items from the library using mob-el-btn style (compact cards)
    tray.innerHTML = '';
    tray.scrollLeft = 0; // always start from the beginning
    (library[cat] || []).forEach(item => {
      const el = buildLibraryItem(item, true); // mob style
      tray.appendChild(el);
    });
    tray.classList.add('desk-tray-open');
    lcIcons();
  }

  function scheduleClose() {
    hideTimer = setTimeout(() => {
      tray.classList.remove('desk-tray-open');
      activeCat = null;
      bar.querySelectorAll('.desk-cat-btn').forEach(b => b.classList.remove('active'));
      // Clear content after fade-out transition completes
      setTimeout(() => { if (!tray.classList.contains('desk-tray-open')) tray.innerHTML = ''; }, 150);
    }, 900);
  }

  bar.querySelectorAll('.desk-cat-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => openCat(btn.dataset.cat));
    btn.addEventListener('mouseleave', scheduleClose);
  });
  // Entering the bar itself (e.g. moving between buttons) cancels the close timer
  bar.addEventListener('mouseenter', () => { clearTimeout(hideTimer); hideTimer = null; });

  tray.addEventListener('mouseenter', () => { clearTimeout(hideTimer); hideTimer = null; });
  tray.addEventListener('mouseleave', scheduleClose);

  // Trackpad / mousewheel → horizontal scroll (vertical deltaY converted to scrollLeft)
  tray.addEventListener('wheel', function(e) {
    if (tray.scrollWidth <= tray.clientWidth) return; // nothing to scroll
    e.preventDefault();
    tray.scrollLeft += (e.deltaX !== 0 ? e.deltaX : e.deltaY);
  }, { passive: false });
})();

// ══════════════════════════════════════════════════════════
//  CANVAS DRAG & DROP (from library)
// ══════════════════════════════════════════════════════════
const stageCanvas = document.getElementById('stage-canvas');

stageCanvas.addEventListener('dragover', e => {
  e.preventDefault();
  document.getElementById('drop-zone-hint').style.opacity = state.elements.length === 0 ? '1' : '0';
});
stageCanvas.addEventListener('dragleave', () => {
  document.getElementById('drop-zone-hint').style.opacity = '0';
});

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone-hint').style.opacity = '0';
  let raw;
  try { raw = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }

  const rect = stageCanvas.getBoundingClientRect();
  state.canvasW = rect.width;
  state.canvasH = rect.height;
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  if (state.snapToGrid) { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
  x = Math.max(32, Math.min(rect.width - 32, x));
  y = Math.max(32, Math.min(rect.height - 32, y));

  const channelNum = (state.elements.length + 1).toString().padStart(2, '0');
  const isCustom = !!raw.isCustom;
  const dropLabel = isCustom ? raw.name.toUpperCase() : ((raw.nameKey && T(raw.nameKey)) || raw.name).toUpperCase();
  const el = {
    id: 'el-' + state.nextId++,
    name: raw.name,
    label: dropLabel,
    icon: raw.icon,
    type: raw.type,
    x, y,
    rotation: 0,
    scale: window.innerWidth < 768 ? 65 : 100,
    channelId: 'CH-' + channelNum,
    source: 'SL01',
    output: 'FOH',
    phantom: false,
    notes: '',
    color: raw.color || '#7aafff',
    roles: [],
    ...(isCustom ? { isCustom: true, emoji: raw.emoji, ...(raw.imageData ? { imageData: raw.imageData } : {}) } : {}),
  };
  state.elements.push(el);
  renderElements();
  selectElement(el.id);
  pushHistory();
  updateDropHint();
  _showSmartSuggestion(el);
}

// ══════════════════════════════════════════════════════════
//  MULTI-ROLE HELPERS
// ══════════════════════════════════════════════════════════
function nextChannelId() {
  const used = new Set();
  state.elements.forEach(e => {
    if (e.channelId) used.add(e.channelId);
    (e.roles || []).forEach(r => { if (r.channelId) used.add(r.channelId); });
  });
  let n = 1;
  while (used.has('CH-' + n.toString().padStart(2,'0'))) n++;
  return 'CH-' + n.toString().padStart(2,'0');
}

function buildIconsHTML(el) {
  const roles = el.roles || [];
  if (el.isCustom) {
    if (el.imageData) {
      const sz = roles.length > 0 ? 20 : 30;
      return `<img src="${el.imageData}" style="width:${sz}px;height:${sz}px;object-fit:contain;image-rendering:auto;user-select:none;pointer-events:none;" draggable="false"/>`;
    }
    const em = el.emoji || el.icon || '🎵';
    return `<span style="font-size:${roles.length > 0 ? 20 : 26}px;line-height:1;user-select:none;">${em}</span>`;
  }
  if (roles.length === 0) return iconHtml(el.icon, 40);
  const all = [el, ...roles];
  const sz = all.length <= 2 ? 36 : all.length <= 3 ? 28 : 22;
  return all.map(r => iconHtml(r.icon, sz)).join('');
}

function updateElementIconDOM(el) {
  const dom = document.getElementById('elem-' + el.id);
  if (!dom) return;
  const elIcon = dom.querySelector('.el-icon');
  if (!elIcon) return;
  const hasRoles = el.roles && el.roles.length > 0;
  elIcon.className = 'el-icon' + (hasRoles ? ' multi-role' : '');
  elIcon.style.color = el.color;
  elIcon.innerHTML = buildIconsHTML(el);
  lcIcons();
}

function updatePropIconSym(el) {
  const propIconSym = document.getElementById('prop-icon-sym');
  if (!propIconSym) return;
  const roles = el.roles || [];
  if (roles.length === 0) {
    propIconSym.innerHTML = iconHtml(el.icon, 28);
    propIconSym.style.cssText = `width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:${el.color};`;
  } else {
    const all = [el, ...roles];
    const sz = all.length <= 2 ? 22 : 16;
    propIconSym.style.cssText = `width:56px;height:56px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:3px;color:${el.color};`;
    propIconSym.innerHTML = all.map(r => iconHtml(r.icon, sz)).join('');
  }
  lcIcons();
}

function renderRolesList(el) {
  const list = document.getElementById('roles-list');
  const addBtn = document.getElementById('add-role-btn');
  if (!list) return;
  const roles = el.roles || [];
  if (roles.length === 0) {
    list.innerHTML = `<p style="font-size:10px;color:#484847;font-style:italic;padding:4px 0;">No additional roles assigned.</p>`;
  } else {
    list.innerHTML = roles.map(role => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#111;margin-bottom:3px;">
        <div style="color:${el.color};flex-shrink:0;display:flex;align-items:center;">
          ${iconHtml(role.icon,16)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:700;color:#e0e0e0;text-transform:uppercase;letter-spacing:0.06em;">${role.name}</div>
          <div style="font-size:9px;color:#484847;">${role.channelId} · ${role.type}</div>
        </div>
        <button onclick="removeRole('${el.id}','${role.id}')"
          style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#ff716c;font-size:15px;font-weight:700;background:none;border:none;cursor:pointer;flex-shrink:0;" title="Remove role">×</button>
      </div>
    `).join('');
    lcIcons();
  }
  if (addBtn) {
    const atLimit = roles.length >= 3;
    addBtn.style.opacity = atLimit ? '0.35' : '1';
    addBtn.style.cursor = atLimit ? 'not-allowed' : 'pointer';
  }
}

let _rolePickerCat = 'mics';

function toggleRolePicker() {
  const picker = document.getElementById('role-picker');
  if (!picker) return;
  const hidden = picker.classList.contains('hidden');
  if (hidden) { picker.classList.remove('hidden'); populateRolePickerGrid(_rolePickerCat); }
  else picker.classList.add('hidden');
}

function switchRolePickerCat(cat) {
  _rolePickerCat = cat;
  document.querySelectorAll('.role-cat-btn').forEach(b => {
    const active = b.dataset.cat === cat;
    b.style.background = active ? '#7aafff' : '#1a1a1a';
    b.style.color = active ? '#000' : '#7aafff';
  });
  populateRolePickerGrid(cat);
}

function populateRolePickerGrid(cat) {
  const grid = document.getElementById('role-picker-grid');
  if (!grid) return;
  grid.innerHTML = '';
  (library[cat] || []).forEach(item => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:5px 2px;height:44px;width:100%;background:#0e0e0e;border:1px solid transparent;cursor:pointer;transition:border-color 0.15s;';
    btn.innerHTML = `${iconHtml(item.icon,16,'color:#7aafff;')}<span style="font-size:6px;font-weight:700;text-transform:uppercase;color:#adaaaa;text-align:center;line-height:1.2;word-break:break-all;">${item.name}</span>`;
    btn.addEventListener('mouseover', () => btn.style.borderColor = 'rgba(122,175,255,0.3)');
    btn.addEventListener('mouseout', () => btn.style.borderColor = 'transparent');
    btn.addEventListener('click', () => addRoleFromPicker(item));
    grid.appendChild(btn);
  });
  lcIcons();
}

function addRoleFromPicker(item) {
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;
  if (!el.roles) el.roles = [];
  if (el.roles.length >= 3) return;
  el.roles.push({ id: 'role-' + Date.now(), name: item.name, type: item.type, icon: item.icon,
    channelId: nextChannelId(), source: 'SL01', output: 'FOH', phantom: false, notes: '' });
  updateElementIconDOM(el);
  renderRolesList(el);
  updatePropIconSym(el);
  document.getElementById('role-picker').classList.add('hidden');
  pushHistory();
}

function removeRole(elId, roleId) {
  const el = state.elements.find(e => e.id === elId);
  if (!el || !el.roles) return;
  el.roles = el.roles.filter(r => r.id !== roleId);
  updateElementIconDOM(el);
  renderRolesList(el);
  updatePropIconSym(el);
  pushHistory();
}

// ══════════════════════════════════════════════════════════
//  STATUS BAR — live plot stats
// ══════════════════════════════════════════════════════════
// rAF-throttled: multiple synchronous calls collapse into one paint update
let _sbRaf = null;
function updateStatusBar() {
  if (_sbRaf) return;
  _sbRaf = requestAnimationFrame(() => {
    _sbRaf = null;
    function setVal(id, n) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = n;
      el.classList.toggle('sb-nonzero', n > 0);
    }
    setVal('sb-elements-val', state.elements.length);
    setVal('sb-lines-val',    state.connections.length);
    const zEl = document.getElementById('sb-zoom-val');
    if (zEl) { zEl.textContent = Math.round((state.zoom || 1) * 100) + '%'; zEl.classList.toggle('sb-nonzero', (state.zoom || 1) !== 1); }
    const selEl = document.getElementById('sb-sel-val');
    if (selEl) { const sel = state.elements.find(e => e.id === state.selectedId); selEl.textContent = sel ? sel.name : '—'; selEl.classList.toggle('sb-nonzero', !!sel); }
  });
}

// ══════════════════════════════════════════════════════════
//  ELEMENT RENDERING
// ══════════════════════════════════════════════════════════
let _spawnId = null; // set before renderElements() when a brand-new element is being added
function renderElements() {
  const layer = document.getElementById('elements-layer');
  layer.innerHTML = '';
  state.elements.forEach(el => createElementDOM(el));
  renderConnections();
  updateStatusBar();
  // Scope to the layer only — never scan the full document (very slow)
  lcIcons(layer);
}

function createElementDOM(el) {
  const layer = document.getElementById('elements-layer');
  const wrap = document.createElement('div');
  wrap.className = 'stage-element' + (state.selectedId === el.id ? ' selected' : '') + (_spawnId === el.id ? ' spawning' : '');
  wrap.id = 'elem-' + el.id;
  wrap.style.cssText = `left:${el.x}px;top:${el.y}px;transform:translate(-50%,-50%) scale(${el.scale/100});--el-color:${el.color};`;

  wrap.innerHTML = `
    <div class="el-content">
      <div class="el-box">
        <div class="el-icon-wrap" style="transform:rotate(${el.rotation}deg);display:flex;align-items:center;justify-content:center;">
          <div class="el-icon${(el.roles && el.roles.length > 0) ? ' multi-role' : ''}" style="color:${el.color};">
            ${buildIconsHTML(el)}
          </div>
        </div>
        <div class="el-label" style="${state.labelsVisible ? '' : 'display:none;'}">${el.label}</div>
      </div>
    </div>
    <div class="el-resize-bar">
      <button title="Smaller" data-action="smaller">−</button>
      <span class="el-scale-display">${el.scale}%</span>
      <button title="Larger"  data-action="larger">+</button>
      <button title="Rotate ↺" data-action="rotate" style="font-size:11px;">↺</button>
      <button title="Remove" data-action="remove" style="color:#ff716c;border-left:1px solid rgba(255,113,108,0.2);margin-left:2px;padding-left:2px;">
        <span class="material-symbols-outlined" style="font-size:13px;line-height:1;display:block;">delete</span>
      </button>
    </div>`;

  // Click to select / drag (pointer events – mouse & trackpad only; touch uses touchstart below)
  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // handled by touchstart
    if (e.button !== 0) return;
    e.stopPropagation();
    if (state.connectMode) { handleConnectClick(el.id); return; }
    // Ctrl/Cmd+click is handled by features.js capture-phase listener — skip here
    if (e.ctrlKey || e.metaKey) return;
    // Normal click: clear multi-select if clicking an unselected element
    if (typeof msClear === 'function' && typeof multiSel !== 'undefined' && multiSel.size > 0 && !multiSel.has(String(el.id))) {
      msClear();
    }
    selectElement(el.id);
    if (!e.target.closest('.el-resize-bar')) startDragElement(e, el);
  });
  // Touch: select + drag on mobile
  wrap.addEventListener('touchstart', e => {
    e.stopPropagation();
    selectElement(el.id);
    if (!e.target.closest('.el-resize-bar') && e.touches.length === 1) {
      startTouchDragElement(e.touches[0], el);
    }
  }, { passive: true });

  // Resize toolbar buttons
  wrap.querySelector('[data-action="smaller"]').addEventListener('mousedown', e => {
    e.stopPropagation();
    scaleElementBy(el, -10);
  });
  wrap.querySelector('[data-action="larger"]').addEventListener('mousedown', e => {
    e.stopPropagation();
    scaleElementBy(el, +10);
  });
  wrap.querySelector('[data-action="rotate"]').addEventListener('mousedown', e => {
    e.stopPropagation();
    el.rotation = (el.rotation + 45) % 360;
    const iconWrap = wrap.querySelector('.el-icon-wrap');
    if (iconWrap) iconWrap.style.transform = `rotate(${el.rotation}deg)`;
    document.getElementById('input-rotation').value = el.rotation;
    pushHistory();
  });
  const removeBtn = wrap.querySelector('[data-action="remove"]');
  removeBtn.addEventListener('mousedown', e => { e.stopPropagation(); removeSelected(); });
  removeBtn.addEventListener('click',     e => { e.stopPropagation(); });

  layer.appendChild(wrap);
}

let _scaleHistoryTid = 0;
function scaleElementBy(el, delta) {
  el.scale = Math.max(30, Math.min(300, (el.scale || 100) + delta));
  const dom = document.getElementById('elem-' + el.id);
  if (dom) {
    dom.style.transform = `translate(-50%,-50%) scale(${el.scale/100})`;
    const disp = dom.querySelector('.el-scale-display');
    if (disp) disp.textContent = el.scale + '%';
  }
  document.getElementById('input-scale').value = el.scale;
  // Debounce: only push one history snapshot after rapid clicks settle
  clearTimeout(_scaleHistoryTid);
  _scaleHistoryTid = setTimeout(pushHistory, 250);
}

function renderAll() {
  renderElements();
  updatePropertiesPanel();
}

// ══════════════════════════════════════════════════════════
//  ELEMENT DRAG (move on canvas)
// ══════════════════════════════════════════════════════════
// ── Properties panel state machine ───────────────────────────
// States: 'hidden' | 'peek' | 'open'  (mutually exclusive classes)
// Same behavior on all screen sizes.
let _propUserDismissed = false; // true after user manually closes via X

function setPropState(newState) {
  const p = document.getElementById('properties-panel');
  if (!p) return;
  p.classList.remove('prop-open', 'prop-peek');
  if (newState === 'open') p.classList.add('prop-open');
  else if (newState === 'peek') p.classList.add('prop-peek');
  // 'hidden' → no classes
}
function _getPropState() {
  const p = document.getElementById('properties-panel');
  if (!p) return 'hidden';
  if (p.classList.contains('prop-open')) return 'open';
  if (p.classList.contains('prop-peek')) return 'peek';
  return 'hidden';
}
// X button: dismiss panel without deselecting the element
function dismissPropPanel() {
  _propUserDismissed = true;
  setPropState('hidden');
}
// Drag peek — fully hidden while moving, peek when released (unless dismissed)
function _propPeek(on) {
  if (on) {
    // During drag: fully hide so canvas is completely clear
    if (_getPropState() !== 'hidden') setPropState('hidden');
  } else {
    // Drag ended: restore to peek tab unless user dismissed it
    if (!_propUserDismissed && state.selectedId) setPropState('peek');
  }
}

function startDragElement(e, el) {
  const wrap = document.getElementById('elem-' + el.id);
  if (!wrap) return;

  const startX = e.clientX, startY = e.clientY;
  const initX = el.x, initY = el.y;
  const rect = stageCanvas.getBoundingClientRect();
  const zoom = state.zoom || 1;
  let dragging = false;
  let rafId = null;
  let pendingX = initX, pendingY = initY;

  // Snapshot starting positions of every other element in the multi-select group
  // multiSel stores string IDs (from DOM attribute); state element IDs may be numbers — compare via String()
  const groupStarts = new Map();
  if (typeof multiSel !== 'undefined' && multiSel.size > 1 && multiSel.has(String(el.id))) {
    multiSel.forEach(eid => {
      if (eid === String(el.id)) return;
      const peer = state.elements.find(e2 => String(e2.id) === eid);
      if (peer) groupStarts.set(eid, { x: peer.x, y: peer.y, elem: peer });
    });
  }

  // Capture the pointer so we get events even when cursor leaves the window
  try { wrap.setPointerCapture(e.pointerId); } catch(_) {}
  wrap.classList.add('dragging');
  wrap.style.willChange = 'left, top'; // promote only this element during drag
  _propPeek(true);

  const commit = () => {
    rafId = null;
    el.x = pendingX; el.y = pendingY;
    wrap.style.left = pendingX + 'px';
    wrap.style.top  = pendingY + 'px';
    // Move every other grouped element by the same delta
    if (groupStarts.size > 0) {
      const dx = pendingX - initX;
      const dy = pendingY - initY;
      groupStarts.forEach((start, eid) => {
        const nx = Math.max(0, Math.min(rect.width,  start.x + dx));
        const ny = Math.max(0, Math.min(rect.height, start.y + dy));
        start.elem.x = nx; start.elem.y = ny;
        const dom = document.getElementById('elem-' + eid);
        if (dom) { dom.style.left = nx + 'px'; dom.style.top = ny + 'px'; }
      });
    }
    renderConnections();
    const coords = document.getElementById('status-coords');
    if (coords) coords.textContent = `X: ${Math.round(pendingX)} | Y: ${Math.round(pendingY)}`;
  };

  const onMove = mv => {
    if (mv.pointerId !== e.pointerId) return;
    const dx = (mv.clientX - startX) / zoom;
    const dy = (mv.clientY - startY) / zoom;
    // Minimum 5px threshold to avoid ghost drags from light trackpad touches
    if (!dragging && Math.hypot(dx, dy) < 5) return;
    dragging = true;
    let nx = initX + dx;
    let ny = initY + dy;
    if (state.snapToGrid) { nx = Math.round(nx / 20) * 20; ny = Math.round(ny / 20) * 20; }
    nx = Math.max(0, Math.min(rect.width, nx));
    ny = Math.max(0, Math.min(rect.height, ny));
    pendingX = nx; pendingY = ny;
    if (!rafId) rafId = requestAnimationFrame(commit);
  };

  const onUp = mv => {
    if (mv.pointerId !== e.pointerId) return;
    cleanup();
    state.canvasW = rect.width; state.canvasH = rect.height;
    _propPeek(false);
    if (dragging) pushHistory();
  };

  const cleanup = () => {
    wrap.removeEventListener('pointermove', onMove);
    wrap.removeEventListener('pointerup', onUp);
    wrap.removeEventListener('pointercancel', cleanup);
    wrap.removeEventListener('lostpointercapture', cleanup);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    try { wrap.releasePointerCapture(e.pointerId); } catch(_) {}
    wrap.classList.remove('dragging');
    wrap.style.willChange = ''; // release GPU layer once drag is done
    _propPeek(false);
  };

  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', cleanup);
  wrap.addEventListener('lostpointercapture', cleanup);
}

function startTouchDragElement(touch, el) {
  const startX = touch.clientX, startY = touch.clientY;
  const initX = el.x, initY = el.y;
  const rect = stageCanvas.getBoundingClientRect();
  _propPeek(true);
  let _touchRaf = null;

  const onMove = ev => {
    ev.preventDefault();
    const t = ev.touches[0];
    let nx = initX + (t.clientX - startX);
    let ny = initY + (t.clientY - startY);
    if (state.snapToGrid) { nx = Math.round(nx / 20) * 20; ny = Math.round(ny / 20) * 20; }
    nx = Math.max(0, Math.min(rect.width, nx));
    ny = Math.max(0, Math.min(rect.height, ny));
    el.x = nx; el.y = ny;
    const dom = document.getElementById('elem-' + el.id);
    if (dom) { dom.style.left = nx + 'px'; dom.style.top = ny + 'px'; }
    // Throttle connection redraws to one per animation frame
    if (!_touchRaf) _touchRaf = requestAnimationFrame(() => { _touchRaf = null; renderConnections(); });
  };
  const onEnd = () => {
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    state.canvasW = rect.width; state.canvasH = rect.height;
    _propPeek(false);
    pushHistory();
  };
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

// ══════════════════════════════════════════════════════════
//  SELECTION
// ══════════════════════════════════════════════════════════
// ── Properties panel open / close ──────────────────────────
function openPropPanel()  { setPropState('open'); }
function closePropPanel() { setPropState('hidden'); }

function selectElement(id) {
  const differentElement = id !== state.selectedId;
  state.selectedId = id;
  document.querySelectorAll('.stage-element').forEach(d => d.classList.remove('selected'));
  const dom = document.getElementById('elem-' + id);
  if (dom) dom.classList.add('selected');
  updatePropertiesPanel();
  updateStatusBar(); // refresh SEL stat
  // Selecting a different element always resets the dismissed flag and peeks
  if (differentElement) _propUserDismissed = false;
  // Show peek tab unless user explicitly dismissed this element's panel
  if (!_propUserDismissed) setPropState('peek');
}

function deselectAll() {
  state.selectedId = null;
  _propUserDismissed = false; // reset so next selection shows peek
  document.querySelectorAll('.stage-element').forEach(d => d.classList.remove('selected'));
  updatePropertiesPanel();
  updateStatusBar(); // refresh SEL stat
  setPropState('hidden');
}

// Tap the peeked panel edge to expand it fully
document.addEventListener('DOMContentLoaded', function() {
  const panel = document.getElementById('properties-panel');
  if (!panel) return;
  panel.addEventListener('click', function(e) {
    if (_getPropState() === 'peek') {
      e.stopPropagation();
      setPropState('open');
    }
  });
});


// Click/tap canvas background to deselect
const _canvasBg = e => {
  if (e.target === stageCanvas || e.target === document.getElementById('elements-layer')) deselectAll();
};
document.getElementById('stage-canvas').addEventListener('mousedown', _canvasBg);
document.getElementById('stage-canvas').addEventListener('touchstart', _canvasBg, { passive: true });

// ══════════════════════════════════════════════════════════
//  PROPERTIES PANEL
// ══════════════════════════════════════════════════════════
function updatePropertiesPanel() {
  const el = state.elements.find(e => e.id === state.selectedId);
  const empty = document.getElementById('prop-empty');
  const controls = document.getElementById('prop-controls');

  if (!el) {
    empty.classList.remove('hidden');
    controls.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  controls.classList.remove('hidden');

  if (!el.roles) el.roles = [];
  updatePropIconSym(el);
  document.getElementById('prop-name-display').textContent = el.name;
  document.getElementById('prop-type-display').textContent = el.type || '';
  document.getElementById('input-label').value = el.label;
  _repopulateMemberDropdown();
  document.getElementById('input-member').value = el.memberId || '';
  document.getElementById('input-chid').value = el.channelId;
  document.getElementById('input-rotation').value = el.rotation;
  document.getElementById('input-scale').value = el.scale;
  document.getElementById('input-source').value = el.source;
  document.getElementById('input-output').value = el.output || 'FOH';
  document.getElementById('input-notes').value = el.notes;
  updatePhantomUI(el.phantom);
  updateColorTags(el.color);
  renderRolesList(el);
  document.getElementById('role-picker').classList.add('hidden');
}

function updateSelectedElement() {
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;
  el.label = document.getElementById('input-label').value;
  el.memberId = document.getElementById('input-member').value;
  el.channelId = document.getElementById('input-chid').value;
  el.rotation = parseInt(document.getElementById('input-rotation').value) || 0;
  el.scale = parseInt(document.getElementById('input-scale').value) || 100;
  el.source = document.getElementById('input-source').value;
  el.output = document.getElementById('input-output').value;
  el.notes = document.getElementById('input-notes').value;
  // Update DOM
  const dom = document.getElementById('elem-' + el.id);
  if (dom) {
    dom.style.transform = `translate(-50%,-50%) scale(${el.scale/100})`;
    const iconWrap = dom.querySelector('.el-icon-wrap');
    if (iconWrap) iconWrap.style.transform = `rotate(${el.rotation}deg)`;
    const lbl = dom.querySelector('.el-label');
    if (lbl) lbl.textContent = el.label;
  }
}

// Color tags
document.querySelectorAll('.color-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    const el = state.elements.find(e => e.id === state.selectedId);
    if (!el) return;
    el.color = btn.dataset.color;
    updateColorTags(el.color);
    const dom = document.getElementById('elem-' + el.id);
    if (dom) {
      dom.style.setProperty('--el-color', el.color);
      const ico = dom.querySelector('.el-icon');
      if (ico) ico.style.color = el.color;
    }
    document.getElementById('prop-icon-sym').style.color = el.color;
    pushHistory();
  });
});
function updateColorTags(color) {
  document.querySelectorAll('.color-tag').forEach(b => {
    const active = b.dataset.color === color;
    b.classList.toggle('color-active', active);
    b.style.outline = active ? '2px solid #fff' : 'none';
    b.style.outlineOffset = '2px';
  });
}

// Phantom power
function togglePhantom() {
  const el = state.elements.find(e => e.id === state.selectedId);
  if (!el) return;
  el.phantom = !el.phantom;
  updatePhantomUI(el.phantom);
  pushHistory();
}
function updatePhantomUI(on) {
  const track = document.getElementById('phantom-track');
  const knob = document.getElementById('phantom-knob');
  track.style.background = on ? '#ff7439' : '#484847';
  knob.style.transform = on ? 'translateX(20px)' : 'translateX(0)';
  knob.style.background = on ? '#fff' : '#adaaaa';
}

function removeSelected() {
  if (!state.selectedId) return;
  const id  = state.selectedId;
  const dom = document.getElementById('elem-' + id);

  // Deselect immediately so nothing else can interact with this element
  state.selectedId = null;
  closePropPanel();

  const finalize = () => {
    state.elements    = state.elements.filter(e => e.id !== id);
    state.connections = state.connections.filter(c => c.from !== id && c.to !== id);
    renderAll();
    pushHistory();
    updateDropHint();
  };

  if (dom) {
    dom.classList.remove('selected');
    dom.style.pointerEvents = 'none';
    dom.style.zIndex = '0';
    // Animate: shrink + fade + blur. Strip existing scale() so we can replace it.
    const baseXform = dom.style.transform.replace(/\s*scale\([^)]*\)/g, '');
    requestAnimationFrame(() => {
      dom.style.transition = 'opacity 0.16s cubic-bezier(0.4,0,1,1), filter 0.16s ease, transform 0.18s cubic-bezier(0.4,0,1,1)';
      dom.style.opacity   = '0';
      dom.style.filter    = 'blur(8px)';
      dom.style.transform = baseXform + ' scale(0.25)';
      setTimeout(finalize, 195);
    });
  } else {
    finalize();
  }
}

function updateDropHint() {
  document.getElementById('drop-zone-hint').style.opacity = state.elements.length === 0 ? '0.6' : '0';
}

// ══════════════════════════════════════════════════════════
//  CONNECTIONS
// ══════════════════════════════════════════════════════════
function _setConnectBanner(msg) {
  const pill = document.getElementById('mode-pill');
  if (!pill) return;
  if (msg) { pill.textContent = msg; pill.classList.add('visible'); }
  else { pill.classList.remove('visible'); }
}

function handleConnectClick(id) {
  if (!state.connectSource) {
    state.connectSource = id;
    const el = state.elements.find(e => e.id === id);
    _setConnectBanner(`FROM: ${el ? el.label : 'element'} — click destination · ESC to cancel`);
    renderConnections();
    return;
  }
  if (state.connectSource === id) {
    state.connectSource = null;
    _setConnectBanner(null);
    renderConnections();
    return;
  }
  const exists = state.connections.find(c =>
    (c.from === state.connectSource && c.to === id) ||
    (c.from === id && c.to === state.connectSource)
  );
  if (!exists) {
    const a = state.elements.find(e => e.id === state.connectSource);
    const b = state.elements.find(e => e.id === id);
    state.connections.push({ from: state.connectSource, to: id, type: 'xlr' });
    showToast(`${T('connected')}: ${a ? a.label : '?'} → ${b ? b.label : '?'}`);
  } else {
    showToast(T('alreadyConnected'));
  }
  state.connectSource = null;
  _setConnectBanner(null);
  renderConnections();
  pushHistory();
}

// Cache: skip full SVG rebuild if visible state hasn't changed (hot-path during drag)
let _connFP = '';
let _connHandles = [];        // { x, y, connIdx } — rebuilt on every renderConnections()
let _cableDragState = null;   // { connIdx, prevCx, prevCy } — set while dragging a bend handle
function _buildConnFP() {
  const idMap = {};
  state.elements.forEach(e => { idMap[e.id] = `${Math.round(e.x)},${Math.round(e.y)},${e.color}`; });
  return (state.connectionsVisible?'1':'0') + '|' + state.connLineStyle + '|' + (state.connectSource||'') + '|' +
    state.connections.map(c => c.from + '>' + c.to + ':' + (c.type||'xlr') + ':' + Math.round(c.cpDx||0) + ',' + Math.round(c.cpDy||0) + ':' + (idMap[c.from]||'') + ':' + (idMap[c.to]||'')).join(';');
}
function renderConnections() {
  const fp = _buildConnFP();
  if (fp === _connFP) return;
  _connFP = fp;

  const svg = document.getElementById('connections-svg');
  svg.innerHTML = '';
  _connHandles = []; // rebuild handle positions each render

  if (!state.connectionsVisible) {
    if (state.connectSource) _drawSourceRing(svg);
    return;
  }

  // Per-connection arrowhead markers — one per unique stroke color
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  const _markerColors = new Set();

  function _ensureMarker(color, id) {
    if (_markerColors.has(id)) return;
    _markerColors.add(id);
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    m.setAttribute('id', 'arr_' + id);
    m.setAttribute('markerWidth', '7'); m.setAttribute('markerHeight', '7');
    m.setAttribute('refX', '6'); m.setAttribute('refY', '3.5');
    m.setAttribute('orient', 'auto'); m.setAttribute('markerUnits', 'strokeWidth');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M0,0 L0,7 L7,3.5 z');
    p.setAttribute('fill', color);
    m.appendChild(p);
    defs.appendChild(m);
  }

  // ── Build power-connection awareness maps ────────────────────
  // Map: elementId → array of connection indices where this el has a power cable
  const powerConnMap = new Map(); // elId → count of power connections
  const powerSourceLoad = new Map(); // elId → count of power cables sourced from it
  state.connections.forEach((c, idx) => {
    if ((c.type || 'xlr') !== 'power') return;
    powerConnMap.set(c.to,   (powerConnMap.get(c.to)   || 0) + 1);
    powerConnMap.set(c.from, (powerConnMap.get(c.from) || 0) + 1);
    // Track load on power sources
    const src = state.elements.find(e => e.id === c.from);
    if (src && POWER_SOURCE_TYPES.has(src.type)) {
      powerSourceLoad.set(c.from, (powerSourceLoad.get(c.from) || 0) + 1);
    }
    const dst = state.elements.find(e => e.id === c.to);
    if (dst && POWER_SOURCE_TYPES.has(dst.type)) {
      powerSourceLoad.set(c.to, (powerSourceLoad.get(c.to) || 0) + 1);
    }
  });

  // ── Draw visual connection lines ─────────────────────────────
  state.connections.forEach((c, idx) => {
    const a = state.elements.find(e => e.id === c.from);
    const b = state.elements.find(e => e.id === c.to);
    if (!a || !b) return;

    const cableType = c.type || 'xlr';

    // Per-type visual properties — each cable type has a distinct system color
    let lineColor, strokeWidth, dashArray, opacity;
    if (cableType === 'power') {
      lineColor   = '#ffb347';   // amber
      strokeWidth = '2.4';
      dashArray   = null;
      opacity     = '0.72';
    } else if (cableType === 'quarter') {
      lineColor   = '#a8ff7a';   // lime green
      strokeWidth = '1.6';
      dashArray   = '5,4';
      opacity     = '0.65';
    } else {
      // XLR — teal
      lineColor   = '#22d3ee';
      strokeWidth = '1.6';
      dashArray   = (state.connLineStyle === 'dashed') ? '6,4' : null;
      opacity     = '0.65';
    }

    const markerId = 'arr_' + lineColor.replace(/[^a-z0-9]/gi, '_');
    _ensureMarker(lineColor, lineColor.replace(/[^a-z0-9]/gi, '_'));

    const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const autoOffset = Math.min(35, len * 0.14) * (idx % 2 === 0 ? 1 : -1);
    const autoCpx = (x1 + x2) / 2 - (dy / len) * autoOffset;
    const autoCpy = (y1 + y2) / 2 + (dx / len) * autoOffset;
    // Apply user-dragged bend offset on top of auto curve
    const cpx = autoCpx + (c.cpDx || 0);
    const cpy = autoCpy + (c.cpDy || 0);
    const pathD = `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;

    // Invisible wide hit path for right-click context menu
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hit.setAttribute('d', pathD);
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '14');
    hit.setAttribute('fill', 'none');
    hit.setAttribute('style', 'cursor:context-menu;');
    hit.dataset.connIdx = idx;
    hit.classList.add('conn-hit');
    svg.appendChild(hit);

    // Visual path — tagged with data-vconn for hover targeting
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', lineColor);
    path.setAttribute('stroke-opacity', opacity);
    path.setAttribute('stroke-width', strokeWidth);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    if (dashArray) path.setAttribute('stroke-dasharray', dashArray);
    path.setAttribute('marker-end', `url(#${markerId})`);
    path.setAttribute('pointer-events', 'none');
    // Smooth hover transitions
    path.style.transition = 'stroke-opacity 0.22s ease, stroke-width 0.22s ease, filter 0.28s ease';
    path.dataset.vconn = idx;
    path.dataset.baseOpacity = opacity;
    path.dataset.baseWidth   = strokeWidth;
    svg.appendChild(path);

    // Source dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x1); dot.setAttribute('cy', y1); dot.setAttribute('r', '3');
    dot.setAttribute('fill', lineColor); dot.setAttribute('fill-opacity', '0.75');
    dot.setAttribute('stroke', '#0e0e0e'); dot.setAttribute('stroke-width', '1');
    dot.setAttribute('pointer-events', 'none');
    svg.appendChild(dot);

    // Bend handle — draggable midpoint control
    const hmt = 0.5;
    const hx = (1-hmt)*(1-hmt)*x1 + 2*(1-hmt)*hmt*cpx + hmt*hmt*x2;
    const hy = (1-hmt)*(1-hmt)*y1 + 2*(1-hmt)*hmt*cpy + hmt*hmt*y2;
    _connHandles[idx] = { x: hx, y: hy, connIdx: idx };
    const hasBend = (c.cpDx || 0) !== 0 || (c.cpDy || 0) !== 0;
    const hndl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hndl.setAttribute('cx', hx); hndl.setAttribute('cy', hy); hndl.setAttribute('r', '4.5');
    hndl.setAttribute('fill', '#0e0e11');
    hndl.setAttribute('fill-opacity', hasBend ? '0.9' : '0.6');
    hndl.setAttribute('stroke', lineColor);
    hndl.setAttribute('stroke-opacity', hasBend ? '0.55' : '0.18');
    hndl.setAttribute('stroke-width', '1.2');
    hndl.setAttribute('style', 'pointer-events:all;cursor:grab;transition:stroke-opacity 0.22s ease,fill-opacity 0.22s ease;');
    hndl.dataset.handleConn = idx;
    svg.appendChild(hndl);

    // Cable type badge — shown only for non-XLR types
    if (cableType !== 'xlr') {
      const nx = dx / len, ny = dy / len;
      const mt = 0.5;
      const mbx = (1-mt)*(1-mt)*x1 + 2*(1-mt)*mt*cpx + mt*mt*x2;
      const mby = (1-mt)*(1-mt)*y1 + 2*(1-mt)*mt*cpy + mt*mt*y2;
      const lbl = CABLE_LABELS[cableType] || cableType;
      const tw = lbl.length * 5 + 8;
      const bg2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg2.setAttribute('x', mbx - tw/2); bg2.setAttribute('y', mby - 7);
      bg2.setAttribute('width', tw); bg2.setAttribute('height', 11);
      bg2.setAttribute('rx', '2');
      bg2.setAttribute('fill', cableType === 'power' ? '#332200' : '#0e0e0e');
      bg2.setAttribute('fill-opacity', '0.85');
      bg2.setAttribute('pointer-events', 'none');
      svg.appendChild(bg2);
      const lbTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbTxt.setAttribute('x', mbx); lbTxt.setAttribute('y', mby + 2);
      lbTxt.setAttribute('text-anchor', 'middle');
      lbTxt.setAttribute('font-family', 'Space Grotesk,Inter,sans-serif');
      lbTxt.setAttribute('font-size', '6.5');
      lbTxt.setAttribute('font-weight', '800');
      lbTxt.setAttribute('fill', lineColor);
      lbTxt.setAttribute('fill-opacity', '0.95');
      lbTxt.setAttribute('letter-spacing', '0.06em');
      lbTxt.setAttribute('pointer-events', 'none');
      lbTxt.textContent = lbl.toUpperCase();
      svg.appendChild(lbTxt);
    }

    // Destination label — compact, placed just past the arrowhead
    const nx = dx / len, ny = dy / len;
    const lx = x2 + nx * 14, ly = y2 + ny * 14;
    const destName = (b.label || '?').substring(0, 12);
    const textW = destName.length * 5.2 + 8;

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', lx - textW / 2); bg.setAttribute('y', ly - 7);
    bg.setAttribute('width', textW); bg.setAttribute('height', 12);
    bg.setAttribute('fill', '#0e0e0e'); bg.setAttribute('fill-opacity', '0.82');
    bg.setAttribute('pointer-events', 'none');
    svg.appendChild(bg);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', lx); txt.setAttribute('y', ly + 3);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-family', 'Space Grotesk,Inter,sans-serif');
    txt.setAttribute('font-size', '7.5');
    txt.setAttribute('font-weight', '700');
    txt.setAttribute('fill', lineColor);
    txt.setAttribute('fill-opacity', '0.9');
    txt.setAttribute('letter-spacing', '0.04em');
    txt.setAttribute('pointer-events', 'none');
    txt.textContent = destName;
    svg.appendChild(txt);
  });

  // ── Discrete power-needed indicators ────────────────────────
  // Only for devices that require power but have no power cable yet
  state.elements.forEach(el => {
    if (!POWER_REQUIRING_TYPES.has(el.type)) return;
    if (powerConnMap.has(el.id)) return; // already has power — no badge
    _drawDiscretePowerDot(svg, el.x, el.y);
  });

  if (state.connectSource) _drawSourceRing(svg);
}

function _drawDiscretePowerDot(svg, x, y) {
  const bx = x + 17, by = y - 17;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  // Enable pointer-events on this group so SVG <title> tooltip fires on hover
  // (the parent SVG has pointer-events:none, but child can override)
  g.setAttribute('style', 'pointer-events:all;cursor:default;');
  // Tooltip on hover — native SVG tooltip
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = 'Not connected to power';
  g.appendChild(t);
  // Outer glow ring — very faint
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', bx); ring.setAttribute('cy', by); ring.setAttribute('r', '5.5');
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#ffb347'); ring.setAttribute('stroke-width', '0.8');
  ring.setAttribute('opacity', '0.3');
  g.appendChild(ring);
  // Inner dot — subtle amber
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', bx); dot.setAttribute('cy', by); dot.setAttribute('r', '3');
  dot.setAttribute('fill', '#ffb347'); dot.setAttribute('opacity', '0.45');
  dot.setAttribute('stroke', 'none');
  g.appendChild(dot);
  svg.appendChild(g);
}

function _drawPowerBadge(svg, x, y, color, glyph, title) {
  const r = 7;
  const bx = x + 18, by = y - 18;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('pointer-events', 'none');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = title;
  g.appendChild(t);
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', bx); circle.setAttribute('cy', by); circle.setAttribute('r', r);
  circle.setAttribute('fill', '#0e0e0e'); circle.setAttribute('stroke', color);
  circle.setAttribute('stroke-width', '1.5'); circle.setAttribute('opacity', '0.92');
  g.appendChild(circle);
  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', bx); txt.setAttribute('y', by + 3.5);
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('font-family', 'Space Grotesk,Inter,sans-serif');
  txt.setAttribute('font-size', '8'); txt.setAttribute('font-weight', '900');
  txt.setAttribute('fill', color);
  txt.textContent = glyph;
  g.appendChild(txt);
  svg.appendChild(g);
}

function _drawSourceRing(svg) {
  const src = state.elements.find(e => e.id === state.connectSource);
  if (!src) return;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', src.x); ring.setAttribute('cy', src.y); ring.setAttribute('r', 28);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#ff7439'); ring.setAttribute('stroke-width', '2');
  ring.setAttribute('stroke-dasharray', '5,4'); ring.setAttribute('opacity', '0.8');
  svg.appendChild(ring);
}

// ══════════════════════════════════════════════════════════
//  CABLE CONTEXT MENU — right-click a connection line
// ══════════════════════════════════════════════════════════
let _cableMenuConnIdx = -1;

function _cableHitTest(canvasX, canvasY) {
  const THRESHOLD = 10; // pixels in canvas-space
  for (let i = 0; i < state.connections.length; i++) {
    const c = state.connections[i];
    const a = state.elements.find(e => e.id === c.from);
    const b = state.elements.find(e => e.id === c.to);
    if (!a || !b) continue;
    const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const autoOffset = Math.min(35, len*0.14) * (i % 2 === 0 ? 1 : -1);
    const cpx = (x1+x2)/2 - (dy/len)*autoOffset + (c.cpDx || 0);
    const cpy = (y1+y2)/2 + (dx/len)*autoOffset + (c.cpDy || 0);
    // Sample bezier curve at 24 points for hit detection
    for (let t = 0; t <= 1; t += 0.042) {
      const mt = 1 - t;
      const bx = mt*mt*x1 + 2*mt*t*cpx + t*t*x2;
      const by = mt*mt*y1 + 2*mt*t*cpy + t*t*y2;
      if ((bx-canvasX)*(bx-canvasX) + (by-canvasY)*(by-canvasY) < THRESHOLD*THRESHOLD) return i;
    }
  }
  return -1;
}

function _showCableContextMenu(connIdx, clientX, clientY) {
  _cableMenuConnIdx = connIdx;
  const menu = document.getElementById('cable-context-menu');
  if (!menu) return;
  const c = state.connections[connIdx];
  const currentType = (c && c.type) || 'xlr';

  // Update checkmarks
  menu.querySelectorAll('.cable-type-item').forEach(item => {
    const active = item.dataset.ctype === currentType;
    item.style.color = active ? '#7aafff' : '#adaaaa';
    item.querySelector('.cable-type-check').textContent = active ? '✓' : ' ';
  });

  // Show power device count if power type
  const powerInfo = menu.querySelector('#cable-menu-power-info');
  if (powerInfo) {
    const src = c && state.elements.find(e => e.id === c.from);
    const dst = c && state.elements.find(e => e.id === c.to);
    const devCount = state.connections.filter(cn => (cn.type || 'xlr') === 'power').length;
    powerInfo.style.display = currentType === 'power' ? '' : 'none';
    powerInfo.textContent = devCount + ' power cable' + (devCount !== 1 ? 's' : '') + ' on stage';
  }

  // Position: keep inside viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 180, mh = 140;
  let left = Math.min(clientX, vw - mw - 8);
  let top  = Math.min(clientY, vh - mh - 8);
  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';
  menu.style.display = 'block';
  requestAnimationFrame(() => menu.classList.add('visible'));
}

function _closeCableMenu() {
  const menu = document.getElementById('cable-context-menu');
  if (!menu) return;
  menu.classList.remove('visible');
  setTimeout(() => { if (!menu.classList.contains('visible')) menu.style.display = 'none'; }, 120);
  _cableMenuConnIdx = -1;
}

function setCableType(type) {
  const idx = _cableMenuConnIdx;
  _closeCableMenu();
  if (idx < 0 || idx >= state.connections.length) return;
  state.connections[idx].type = type;
  _connFP = ''; // force re-render
  renderConnections();
  pushHistory();
  markAutosaveDirty();
  const lbl = CABLE_LABELS[type] || type;
  showToast('Cable type: ' + lbl);
}

function deleteCableConnection() {
  const idx = _cableMenuConnIdx;
  _closeCableMenu();
  if (idx < 0 || idx >= state.connections.length) return;
  state.connections.splice(idx, 1);
  _connFP = '';
  renderConnections();
  pushHistory();
  markAutosaveDirty();
  showToast('Connection removed');
}

// ── Cable hover highlight ─────────────────────────────────────
let _hoveredConnIdx = -1;
let _hoverRafPending = false;

function _applyCableHover(newIdx) {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;
  // Restore previously hovered path + handle
  if (_hoveredConnIdx >= 0) {
    const prev = svg.querySelector(`[data-vconn="${_hoveredConnIdx}"]`);
    if (prev) {
      prev.setAttribute('stroke-opacity', prev.dataset.baseOpacity || '0.65');
      prev.setAttribute('stroke-width',   prev.dataset.baseWidth   || '1.6');
      prev.setAttribute('filter', '');
    }
    const prevH = svg.querySelector(`[data-handle-conn="${_hoveredConnIdx}"]`);
    if (prevH) {
      const hasBend = _connHandles[_hoveredConnIdx] &&
        ((state.connections[_hoveredConnIdx]?.cpDx || 0) !== 0 ||
         (state.connections[_hoveredConnIdx]?.cpDy || 0) !== 0);
      prevH.setAttribute('stroke-opacity', hasBend ? '0.55' : '0.18');
      prevH.setAttribute('fill-opacity', hasBend ? '0.9' : '0.6');
    }
  }
  _hoveredConnIdx = newIdx;
  // Highlight newly hovered path + handle
  if (newIdx >= 0) {
    const next = svg.querySelector(`[data-vconn="${newIdx}"]`);
    if (next) {
      next.setAttribute('stroke-opacity', '1');
      next.setAttribute('stroke-width',   String(parseFloat(next.dataset.baseWidth || '1.6') + 1.4));
      next.setAttribute('filter', 'drop-shadow(0 0 5px currentColor)');
    }
    const nextH = svg.querySelector(`[data-handle-conn="${newIdx}"]`);
    if (nextH) {
      nextH.setAttribute('stroke-opacity', '0.8');
      nextH.setAttribute('fill-opacity', '0.95');
    }
  }
}

// ── Cable line bend drag + hover + right-click ──────────────────
(function _initCableInteractions() {
  document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('stage-canvas');
    if (!canvas) return;

    // Helper: client coords → canvas-space coords
    function toCanvas(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width  / canvas.offsetWidth;
      const scaleY = rect.height / canvas.offsetHeight;
      return { cx: (clientX - rect.left) / scaleX, cy: (clientY - rect.top) / scaleY };
    }

    // ── Pointer-down: start bend drag when clicking a handle ────
    canvas.addEventListener('pointerdown', function(e) {
      if (state.currentView !== 'Editor' || !state.connectionsVisible) return;
      // Detect handle click via bubbled event from SVG child with pointer-events:all
      const handleEl = e.target.closest ? e.target.closest('[data-handle-conn]') : null;
      if (handleEl && handleEl.dataset.handleConn !== undefined) {
        const connIdx = parseInt(handleEl.dataset.handleConn, 10);
        const { cx, cy } = toCanvas(e.clientX, e.clientY);
        _cableDragState = { connIdx, prevCx: cx, prevCy: cy };
        canvas.style.cursor = 'grabbing';
        e.stopPropagation();
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    });

    // ── Pointer-move: update bend OR hover-highlight ─────────────
    canvas.addEventListener('pointermove', function(e) {
      if (state.currentView !== 'Editor') return;
      const { cx, cy } = toCanvas(e.clientX, e.clientY);

      // Active bend drag
      if (_cableDragState) {
        const { connIdx, prevCx, prevCy } = _cableDragState;
        const ddx = cx - prevCx, ddy = cy - prevCy;
        const c = state.connections[connIdx];
        if (c) {
          // Dragging the bezier midpoint moves the CP by 2× the delta
          c.cpDx = (c.cpDx || 0) + ddx * 2;
          c.cpDy = (c.cpDy || 0) + ddy * 2;
        }
        _cableDragState.prevCx = cx;
        _cableDragState.prevCy = cy;
        _connFP = ''; // force SVG rebuild
        renderConnections();
        return;
      }

      if (!state.connectionsVisible) {
        if (_hoveredConnIdx >= 0) _applyCableHover(-1);
        return;
      }
      if (_hoverRafPending) return;
      _hoverRafPending = true;
      requestAnimationFrame(() => {
        _hoverRafPending = false;
        // Check if near a bend handle first
        const HANDLE_THRESH = 8;
        let nearHandle = -1;
        for (let i = 0; i < _connHandles.length; i++) {
          const h = _connHandles[i];
          if (!h) continue;
          if ((h.x-cx)*(h.x-cx) + (h.y-cy)*(h.y-cy) < HANDLE_THRESH*HANDLE_THRESH) {
            nearHandle = i; break;
          }
        }
        if (nearHandle >= 0) {
          canvas.style.cursor = 'grab';
          if (nearHandle !== _hoveredConnIdx) _applyCableHover(nearHandle);
          return;
        }
        // Cable line hover
        const newIdx = _cableHitTest(cx, cy);
        if (newIdx !== _hoveredConnIdx) _applyCableHover(newIdx);
        canvas.style.cursor = newIdx >= 0 ? 'context-menu' : '';
      });
    });

    // ── Pointer-up: end drag, save ───────────────────────────────
    canvas.addEventListener('pointerup', function(e) {
      if (_cableDragState) {
        _cableDragState = null;
        canvas.style.cursor = 'grab';
        pushHistory();
        markAutosaveDirty();
      }
    });

    canvas.addEventListener('pointercancel', function() {
      _cableDragState = null;
      canvas.style.cursor = '';
    });

    canvas.addEventListener('mouseleave', function() {
      if (!_cableDragState && _hoveredConnIdx >= 0) _applyCableHover(-1);
      if (!_cableDragState) canvas.style.cursor = '';
    });

    // ── Double-click on handle: reset bend to auto ───────────────
    canvas.addEventListener('dblclick', function(e) {
      const handleEl = e.target.closest ? e.target.closest('[data-handle-conn]') : null;
      if (handleEl && handleEl.dataset.handleConn !== undefined) {
        const connIdx = parseInt(handleEl.dataset.handleConn, 10);
        const c = state.connections[connIdx];
        if (c) { delete c.cpDx; delete c.cpDy; }
        _connFP = '';
        renderConnections();
        pushHistory();
        markAutosaveDirty();
        showToast('Cable bend reset');
        e.stopPropagation();
      }
    });

    // ── Right-click: cable type context menu ─────────────────────
    canvas.addEventListener('contextmenu', function(e) {
      if (state.currentView !== 'Editor') return;
      const { cx, cy } = toCanvas(e.clientX, e.clientY);
      const hitIdx = _cableHitTest(cx, cy);
      if (hitIdx >= 0) {
        e.preventDefault();
        e.stopPropagation();
        _showCableContextMenu(hitIdx, e.clientX, e.clientY);
      } else {
        _closeCableMenu();
      }
    });

    // Close context menu on outside click
    document.addEventListener('mousedown', function(e) {
      const menu = document.getElementById('cable-context-menu');
      if (menu && !menu.contains(e.target)) _closeCableMenu();
    }, true);
  });
})();

function toggleConnectionsVisible() {
  state.connectionsVisible = !state.connectionsVisible;
  _setToolBtn('btn-connections', state.connectionsVisible, 'primary');
  renderConnections();
}

// ══════════════════════════════════════════════════════════
//  VERTICAL TOOLBAR: TOGGLE COLLAPSE
// ══════════════════════════════════════════════════════════
function toggleSCVTools() {
  const body      = document.getElementById('sc-vtools-body');
  const toggle    = document.getElementById('sc-vtools-toggle');
  const container = document.getElementById('canvas-container');
  if (!body) return;
  const isNowCollapsed = body.classList.toggle('vtools-collapsed');
  // Mirror state onto the container so the CSS slide rule can respond
  if (container) container.classList.toggle('vtools-open', !isNowCollapsed);
  if (toggle) {
    toggle.title = isNowCollapsed ? 'Show tools' : 'Hide tools';
  }
}

// ══════════════════════════════════════════════════════════
//  TOOLBAR: GRID / SNAP / CONNECT / ZOOM
// ══════════════════════════════════════════════════════════
function _setToolBtn(id, active, activeColor) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.background = active ? (activeColor === 'secondary' ? 'rgba(255,116,57,0.18)' : 'rgba(122,175,255,0.18)') : 'transparent';
  btn.style.color = active ? (activeColor === 'secondary' ? '#ff7439' : '#7aafff') : '#767575';
}
function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  stageCanvas.classList.toggle('grid-off', !state.gridVisible);
  _setToolBtn('btn-grid', state.gridVisible, 'primary');
}
function toggleSnap() {
  state.snapToGrid = !state.snapToGrid;
  _setToolBtn('btn-snap', state.snapToGrid, 'primary');
  updateStatusBar();
}
function toggleConnect() {
  state.connectMode = !state.connectMode;
  state.connectSource = null;
  _setToolBtn('btn-connect', state.connectMode, 'secondary');
  document.getElementById('canvas-container').style.cursor = state.connectMode ? 'crosshair' : 'default';
  _setConnectBanner(state.connectMode
    ? (state.lang === 'es' ? 'CONECTAR — toca un elemento' : 'CONNECT — tap an element')
    : null);
  renderConnections();
}
function zoomIn() { state.zoom = Math.min(state.zoom + 0.15, 3); applyZoom(); }
function zoomOut() { state.zoom = Math.max(state.zoom - 0.15, 0.3); applyZoom(); }
function resetView() { state.zoom = 1; applyZoom(); }
function applyZoom() {
  stageCanvas.style.transform = `scale(${state.zoom})`;
  stageCanvas.style.transformOrigin = 'center center';
  updateStatusBar();
}


// ══════════════════════════════════════════════════════════
//  THEME SYSTEM
// ══════════════════════════════════════════════════════════
const THEMES = {
  electric: { accent:'#7aafff', aR:122,aG:175,aB:255, dark:'#002e5d', hot:'#ff7439', hR:255,hG:116,hB:57 },
  lime:     { accent:'#a3e635', aR:163,aG:230,aB:53,  dark:'#1a3300', hot:'#ff7439', hR:255,hG:116,hB:57 },
  cyan:     { accent:'#22d3ee', aR:34, aG:211,aB:238, dark:'#003040', hot:'#f97316', hR:249,hG:115,hB:22 },
  amber:    { accent:'#fbbf24', aR:251,aG:191,aB:36,  dark:'#3a2000', hot:'#ef4444', hR:239,hG:68, hB:68  },
  violet:   { accent:'#c084fc', aR:192,aG:132,aB:252, dark:'#2d0060', hot:'#fb923c', hR:251,hG:146,hB:60 },
  rose:     { accent:'#fb7185', aR:251,aG:113,aB:133, dark:'#4a0020', hot:'#a78bfa', hR:167,hG:139,hB:250 },
};

function applyTheme(name) {
  const t = THEMES[name] || THEMES.electric;
  const a = (o) => `rgba(${t.aR},${t.aG},${t.aB},${o})`;
  const h = (o) => `rgba(${t.hR},${t.hG},${t.hB},${o})`;
  let s = document.getElementById('theme-vars');
  if (!s) { s = document.createElement('style'); s.id = 'theme-vars'; document.head.appendChild(s); }
  s.textContent = `:root{
    --accent:${t.accent};--accent-dark:${t.dark};
    --accent-08:${a(0.08)};--accent-10:${a(0.10)};--accent-12:${a(0.12)};
    --accent-14:${a(0.14)};--accent-20:${a(0.20)};--accent-22:${a(0.22)};
    --accent-30:${a(0.30)};--accent-40:${a(0.40)};--accent-50:${a(0.50)};
    --accent-60:${a(0.60)};--accent-70:${a(0.70)};
    --hot:${t.hot};--hot-dark:#4a1600;--hot-10:${h(0.10)};--hot-20:${h(0.20)};
  }`;
  state.theme = name;
  // Update swatch active state
  document.querySelectorAll('.theme-swatch-btn').forEach(b => b.classList.toggle('t-active', b.dataset.theme === name));
  // Sync lang button colors to active theme
  _syncLangButtons();
  // Persist silently (no toast)
  _saveThemePref();
}

function _syncLangButtons() {
  const t = THEMES[state.theme] || THEMES.electric;
  const enBtn = document.getElementById('settings-lang-en');
  const esBtn = document.getElementById('settings-lang-es');
  if (!enBtn || !esBtn) return;
  const isEn = state.lang === 'en';
  enBtn.style.background  = isEn  ? t.accent : '#262626';
  enBtn.style.color        = isEn  ? t.dark   : '#767575';
  esBtn.style.background  = !isEn ? t.accent : '#262626';
  esBtn.style.color        = !isEn ? t.dark   : '#767575';
}
function _saveThemePref() {
  try {
    const raw = localStorage.getItem('stagecoreProject');
    const d = raw ? JSON.parse(raw) : {};
    d.theme = state.theme;
    localStorage.setItem('stagecoreProject', JSON.stringify(d));
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════
//  BAND MEMBERS
// ══════════════════════════════════════════════════════════
const MEMBER_COLORS = ['#7aafff','#ff7439','#c5ffc9','#ff716c','#ffd700','#c8a2ff','#ff8dd4','#80cfff'];

let _memberNextId = 1;

function addMember() {
  const input = document.getElementById('member-name-input');
  const name = (input.value || '').trim();
  if (!name) return;
  if (state.members.length >= 8) { showToast(T('maxMembers')); return; }
  const color = MEMBER_COLORS[state.members.length % MEMBER_COLORS.length];
  state.members.push({ id: 'm' + (_memberNextId++), name, color });
  input.value = '';
  input.focus();
  renderMembersView();
  _repopulateMemberDropdown();
  pushHistory();
  saveProject();
}

function removeMember(id) {
  state.members = state.members.filter(m => m.id !== id);
  state.elements.forEach(el => { if (el.memberId === id) el.memberId = ''; });
  renderMembersView();
  _repopulateMemberDropdown();
  renderAll();
  pushHistory();
  saveProject();
}

function renderMembersList() {
  const list = document.getElementById('members-list');
  const badge = document.getElementById('member-count-badge');
  const addRow = document.getElementById('add-member-row');
  if (!list) return;
  badge.textContent = state.members.length + '/8';
  badge.style.color = state.members.length >= 8 ? '#ff7439' : '#484847';
  if (addRow) addRow.style.display = state.members.length >= 8 ? 'none' : 'flex';
  list.innerHTML = state.members.map(m => `
    <div style="display:flex;align-items:center;gap:5px;padding:4px 6px;background:#111;border-left:2px solid ${m.color};">
      <div style="width:7px;height:7px;border-radius:50%;background:${m.color};flex-shrink:0;"></div>
      <span style="flex:1;font-size:10px;font-weight:700;color:#e0e0e0;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Space Grotesk';">${m.name}</span>
      <button onclick="removeMember('${m.id}')" title="Remove" style="color:#484847;background:none;border:none;cursor:pointer;font-size:13px;padding:0 2px;line-height:1;flex-shrink:0;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#484847'">×</button>
    </div>`).join('');
}

function _repopulateMemberDropdown() {
  const sel = document.getElementById('input-member');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— None —</option>' +
    state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  sel.value = cur;
}

function _getMember(id) {
  return state.members.find(m => m.id === id);
}

function cycleColor(id) {
  const m = _getMember(id);
  if (!m) return;
  const idx = MEMBER_COLORS.indexOf(m.color);
  m.color = MEMBER_COLORS[(idx + 1) % MEMBER_COLORS.length];
  renderMembersView();
  _repopulateMemberDropdown();
  pushHistory();
  saveProject();
}

function renderMembersView() {
  const grid = document.getElementById('members-grid');
  const empty = document.getElementById('members-empty');
  const statCount = document.getElementById('members-stat-count');
  const statAssigned = document.getElementById('members-stat-assigned');
  const statElements = document.getElementById('members-stat-elements');
  const statUnassigned = document.getElementById('members-stat-unassigned');
  const maxWarn = document.getElementById('members-max-warn');
  const addBtn = document.getElementById('btn-add-member');
  if (!grid) return;

  const totalElements = state.elements.length;
  const assignedMembers = state.members.filter(m => state.elements.some(el => el.memberId === m.id)).length;
  const assignedElements = state.elements.filter(el => el.memberId).length;
  const unassigned = totalElements - assignedElements;

  if (statCount) statCount.innerHTML = state.members.length + '<span style="color:#484847;font-size:15px;font-weight:500;">/8</span>';
  if (statAssigned) statAssigned.textContent = assignedMembers;
  if (statElements) statElements.textContent = totalElements;
  if (statUnassigned) statUnassigned.textContent = Math.max(0, unassigned);
  if (maxWarn) maxWarn.style.display = state.members.length >= 8 ? 'block' : 'none';
  if (addBtn) { addBtn.disabled = state.members.length >= 8; addBtn.style.opacity = state.members.length >= 8 ? '0.35' : '1'; addBtn.style.cursor = state.members.length >= 8 ? 'not-allowed' : 'pointer'; }

  if (state.members.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }
  grid.style.display = 'grid';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = state.members.map(m => {
    const assigned = state.elements.filter(el => el.memberId === m.id);
    const colorIdx = MEMBER_COLORS.indexOf(m.color);
    const nextColor = MEMBER_COLORS[(colorIdx + 1) % MEMBER_COLORS.length];
    const itemsHtml = assigned.length > 0
      ? assigned.map(el => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid rgba(255,255,255,0.03);">
            <div style="width:8px;height:8px;background:${el.color || m.color};flex-shrink:0;"></div>
            <span style="font-size:11px;color:#d4d4d4;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${el.label || el.name || '—'}</span>
            ${el.channelId ? `<span style="font-size:9px;font-weight:700;font-family:'Space Grotesk';color:#7aafff;letter-spacing:0.05em;">CH&nbsp;${el.channelId}</span>` : ''}
          </div>`).join('')
      : `<div style="padding:16px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#2a2a2a;text-align:center;">${T('noStageAssign')}</div>`;

    return `
    <div style="background:#0e0e0e;border:1px solid #1a1a1a;border-left:4px solid ${m.color};display:flex;flex-direction:column;transition:border-color 0.2s;">
      <!-- Card header -->
      <div style="display:flex;align-items:center;gap:10px;padding:16px 14px 14px;border-bottom:1px solid #111;">
        <button onclick="cycleColor('${m.id}')" title="Change color (current: ${m.color})"
          style="width:20px;height:20px;border-radius:50%;background:${m.color};border:2px solid rgba(255,255,255,0.08);cursor:pointer;flex-shrink:0;transition:transform 0.15s;outline:none;"
          onmouseover="this.style.transform='scale(1.2)';this.title='Next: ${nextColor}'" onmouseout="this.style.transform='scale(1)'"></button>
        <span style="flex:1;font-family:'Space Grotesk';font-size:14px;font-weight:800;text-transform:uppercase;color:#fff;letter-spacing:0.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.name}</span>
        ${assigned.length > 0 ? `<span style="font-size:9px;font-weight:800;font-family:'Space Grotesk';color:${m.color};background:${m.color}1a;padding:2px 8px;letter-spacing:0.1em;">${assigned.length}&nbsp;elem</span>` : ''}
        <button onclick="removeMember('${m.id}')" title="Remove ${m.name}"
          style="color:#2a2a2a;background:none;border:none;cursor:pointer;font-size:18px;padding:0 2px;line-height:1;flex-shrink:0;transition:color 0.15s;"
          onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#2a2a2a'">×</button>
      </div>
      <!-- Assignment list -->
      <div style="flex:1;">
        <div style="padding:6px 14px 4px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#2a2a2a;">
          ${assigned.length > 0 ? T('assignedElems') : T('assignments')}
        </div>
        ${itemsHtml}
      </div>
    </div>`;
  }).join('');
  updateStatusBar();
}

// ══════════════════════════════════════════════════════════
//  CLEAR STAGE
// ══════════════════════════════════════════════════════════
function clearStage() {
  if (state.elements.length === 0) return;
  showConfirm(T('clearConfirm'), () => {
    state.elements = [];
    state.connections = [];
    state.selectedId = null;
    _propUserDismissed = false;
    setPropState('hidden');
    renderAll();
    pushHistory();
    updateDropHint();
  });
}

// ══════════════════════════════════════════════════════════
//  RIDER VIEW
// ══════════════════════════════════════════════════════════
function refreshRider() {
  const withCh = state.elements.filter(e => e.channelId);
  document.getElementById('rider-ch-count').textContent = withCh.length + ' / 32';
  document.getElementById('rider-el-count').textContent = state.elements.length;
  const dateEl = document.getElementById('rider-date-val');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString(state.lang === 'es' ? 'es-MX' : 'en-US', { year:'numeric', month:'short', day:'numeric' });
  renderRiderNeeds();
  const tbody = document.getElementById('rider-table-body');
  if (state.elements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding:56px 16px;text-align:center;">
      <div style="font-family:'Space Grotesk';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#484847;">${T('noElemsRider')}</div>
      <div style="font-size:12px;color:#333;margin-top:8px;font-family:'Inter';">${T('dragToCanvas')}</div>
    </td></tr>`;
    return;
  }
  const sorted = [...state.elements].sort((a, b) => a.channelId.localeCompare(b.channelId));
  tbody.innerHTML = sorted.map(el => `
    <tr class="hover:bg-surface-container-high transition-colors">
      <td class="px-4 py-5 font-headline font-bold text-primary" style="font-size:18px;">${el.channelId || '-'}</td>
      <td class="px-4 py-5">
        <div class="flex items-center gap-3">
          <div style="width:10px;height:10px;background:${el.color};flex-shrink:0;"></div>
          <span class="text-sm font-semibold text-on-surface">${el.label}</span>
        </div>
      </td>
      <td class="px-4 py-5 text-on-surface-variant uppercase tracking-wider" style="font-size:11px;">${el.type || el.name}</td>
      <td class="px-4 py-5 font-mono" style="font-size:11px;color:#adaaaa;">${inputSourceLabels[el.source] || el.source}</td>
      <td class="px-4 py-5 font-mono" style="font-size:11px;color:#c5ffc9;">${el.output || 'FOH'}</td>
      <td class="px-4 py-5">
        <span style="font-size:11px;font-weight:700;padding:2px 8px;background:${el.phantom ? 'rgba(255,116,57,0.15)' : 'rgba(38,38,38,0.8)'};color:${el.phantom ? '#ff7439' : '#767575'};">
          ${el.phantom ? 'ON' : 'OFF'}
        </span>
      </td>
      <td class="px-4 py-5 text-on-surface-variant italic" style="font-size:12px;">${el.notes || '—'}</td>
    </tr>`).join('');
}

// ══════════════════════════════════════════════════════════
//  RIDER NEEDS (editable requirements)
// ══════════════════════════════════════════════════════════
function renderRiderNeeds() {
  const container = document.getElementById('rider-needs-list');
  if (!container) return;
  if (state.riderNeeds.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:#484847;font-style:italic;padding:8px 0;">No requirements yet. Click + Add to begin.</p>';
    return;
  }
  container.innerHTML = state.riderNeeds.map(need => {
    const nt = NEED_TYPES[need.type] || NEED_TYPES.custom;
    const isEs = state.lang === 'es';
    const typeOptions = Object.entries(NEED_TYPES).map(([k, v]) => {
      const lbl = isEs ? (v.labelEs || v.label) : v.label;
      return `<option value="${k}" ${need.type === k ? 'selected' : ''}>${lbl}</option>`;
    }).join('');
    const activePresets = (isEs ? (nt.presetsEs || nt.presets) : nt.presets);
    const presets = activePresets.map(p =>
      `<button onclick="applyNeedPreset('${need.id}',this.textContent)" title="${p}"
        style="padding:3px 8px;font-size:10px;font-family:'Space Grotesk';background:var(--rn-chip-bg);color:var(--rn-muted);border:1px solid var(--rn-border);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${p}</button>`
    ).join('');
    return `
    <div style="border-left:3px solid ${nt.color};background:var(--rn-card-bg);">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px 6px;">
        <select onchange="updateNeedType('${need.id}',this.value)"
          style="flex:1;padding:5px 8px;font-family:'Space Grotesk';font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;background:var(--rn-input-bg);color:${nt.color};border:1px solid var(--rn-border);cursor:pointer;">
          ${typeOptions}
        </select>
        <button onclick="removeRiderNeed('${need.id}')"
          style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:none;border:1px solid rgba(255,116,57,0.3);color:#ff7439;cursor:pointer;font-size:14px;flex-shrink:0;">×</button>
      </div>
      ${presets ? `<div style="display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 8px;">${presets}</div>` : ''}
      <div style="padding:0 12px 10px;">
        <textarea rows="2" onchange="updateNeedValue('${need.id}',this.value)"
          style="width:100%;resize:none;background:var(--rn-input-bg);color:var(--rn-text);border:1px solid var(--rn-border);padding:7px 10px;font-family:'Inter';font-size:12px;line-height:1.5;box-sizing:border-box;">${need.value}</textarea>
      </div>
    </div>`;
  }).join('');
}

function addRiderNeed() {
  state.riderNeeds.push({ id:'rn'+state._rnNextId++, type:'custom', value:'' });
  renderRiderNeeds();
  refreshExportConnectivity();
  markAutosaveDirty();
}
function removeRiderNeed(id) {
  state.riderNeeds = state.riderNeeds.filter(n => n.id !== id);
  renderRiderNeeds();
  refreshExportConnectivity();
  markAutosaveDirty();
}
function updateNeedType(id, type) {
  const need = state.riderNeeds.find(n => n.id === id);
  if (!need) return;
  need.type = type;
  const nt = NEED_TYPES[type] || NEED_TYPES.custom;
  if (nt.presets.length > 0) need.value = nt.presets[0];
  renderRiderNeeds();
  refreshExportConnectivity();
  markAutosaveDirty();
}
function updateNeedValue(id, val) {
  const need = state.riderNeeds.find(n => n.id === id);
  if (need) { need.value = val; refreshExportConnectivity(); markAutosaveDirty(); }
}
function applyNeedPreset(id, val) {
  const need = state.riderNeeds.find(n => n.id === id);
  if (!need) return;
  need.value = val.trim();
  renderRiderNeeds();
  refreshExportConnectivity();
  markAutosaveDirty();
}

// Auto-translate riderNeed values when language changes
// For each need, if the stored value matches a preset in the OLD language,
// swap it to the same-index preset in the NEW language.
function autoTranslateNeeds(fromLang, toLang) {
  state.riderNeeds.forEach(need => {
    const nt = NEED_TYPES[need.type];
    if (!nt) return;
    const fromPresets = fromLang === 'es' ? (nt.presetsEs || nt.presets) : nt.presets;
    const toPresets   = toLang   === 'es' ? (nt.presetsEs || nt.presets) : nt.presets;
    const idx = fromPresets.indexOf(need.value);
    if (idx >= 0 && toPresets[idx] !== undefined) need.value = toPresets[idx];
  });
}

// Auto-translate the Technical Notes field if it still holds the default text
function autoTranslateNotes(toLang) {
  const el = document.getElementById('exp-notes-text');
  if (!el) return;
  const cur = (el.textContent || el.innerText || '').trim();
  const defaultText = toLang === 'es' ? DEFAULT_NOTES_ES : DEFAULT_NOTES_EN;
  const otherDefault = toLang === 'es' ? DEFAULT_NOTES_EN : DEFAULT_NOTES_ES;
  // Only auto-translate if the field still has the default text (wasn't customised)
  if (cur === otherDefault.trim() || cur === '') {
    el.textContent = defaultText;
    state.exportNotes = defaultText;
  }
}

// Language toggle
function setLang(lang) {
  const prev = state.lang;
  state.lang = lang;
  // Update Settings panel language buttons (themed)
  _syncLangButtons();
  autoTranslateNeeds(prev, lang);
  autoTranslateNotes(lang);
  applyTranslations();
  // Refresh autosave label text
  const saveLbl = document.getElementById('status-save');
  if (saveLbl) saveLbl.textContent = state.autosave ? T('autosaveOn') : T('autosaveOff');
  // Re-render library grids so item names update
  repopulateAllLibraryGrids();
  refreshExport();
  renderRiderNeeds();
  renderGear();
  renderMembersView();
}
function repopulateAllLibraryGrids() {
  ['mics','drums','inst','amps','mon','util'].forEach(cat => {
    const g = document.getElementById('grid-' + cat);
    if (g) { g.innerHTML = ''; library[cat].forEach(item => g.appendChild(buildLibraryItem(item))); }
  });
  // Close any open desktop/mobile tray (user will re-open with updated language)
  const deskTray = document.getElementById('desktop-el-tray');
  if (deskTray) { deskTray.classList.remove('desk-tray-open'); deskTray.innerHTML = ''; }
  document.querySelectorAll('.desk-cat-btn').forEach(b => b.classList.remove('active'));
  const mobTray = document.getElementById('mobile-el-tray');
  if (mobTray) { mobTray.classList.remove('mob-tray-open'); mobTray.innerHTML = ''; }
}

// ══════════════════════════════════════════════════════════
//  SETLIST VIEW
// ══════════════════════════════════════════════════════════
function _parseDurationSecs(str) {
  if (!str || str === '—') return 0;
  const parts = String(str).split(':');
  if (parts.length === 2) return parseInt(parts[0]||0)*60 + parseInt(parts[1]||0);
  return 0;
}
function _fmtDuration(totalSecs) {
  const m = Math.floor(totalSecs / 60), s = totalSecs % 60;
  return m + ':' + String(s).padStart(2,'0');
}
// Returns only song items (not section headers) from the mixed setlist array
function _onlySongs() {
  return (state.setlist || []).filter(item => !item.type || item.type === 'song');
}

function renderSetlist() {
  const tbody = document.getElementById('setlist-body');
  if (!tbody) return;
  const songs = _onlySongs();
  const countEl = document.getElementById('sl-stat-count');
  const durEl   = document.getElementById('sl-stat-duration');
  const engEl   = document.getElementById('sl-stat-energy');
  const segWrap  = document.getElementById('sl-stat-segments-wrap');
  const segBlock = document.getElementById('sl-stat-segments-block');
  const segStat  = document.getElementById('sl-stat-segments');
  if (countEl) countEl.textContent = songs.length;
  if (durEl) {
    const totalSecs = songs.reduce((s, song) => s + _parseDurationSecs(song.duration), 0);
    durEl.textContent = totalSecs ? _fmtDuration(totalSecs) : '0:00';
  }
  if (engEl) {
    if (songs.length) {
      const avg = Math.round(songs.reduce((a, song) => a + _derivedEnergy(song), 0) / songs.length);
      engEl.textContent = avg + '/100';
    } else {
      engEl.textContent = '—';
    }
  }
  const hasSeg = state.segments && state.segments.length > 0;
  if (segWrap)  segWrap.style.display  = hasSeg ? 'block' : 'none';
  if (segBlock) segBlock.style.display = hasSeg ? 'block' : 'none';
  if (segStat)  segStat.textContent    = state.segments.length;
  _renderSegmentsBar();

  if (!state.setlist.length) {
    tbody.innerHTML = `<div style="padding:56px 0;text-align:center;">
      <div style="font-family:'Space Grotesk';font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#484847;">No songs yet — tap ADD NEW TRACK to start your setlist.</div>
    </div>`;
    renderSetlistInsights();
    return;
  }

  let songIdx = 0;
  let html = '';
  state.setlist.forEach((item, i) => {
    if (item.type === 'section') {
      html += `
      <div class="sl-section-hdr" data-sid="${item.id}"
        style="border-left-color:${item.color};"
        draggable="true"
        ondragstart="event.stopPropagation();_slDragStart(event,'${item.id}')"
        ondragend="_slDragEnd(event)"
        ondragover="event.preventDefault();_slDragOver(event)"
        ondragleave="_slDragLeave(event)"
        ondrop="event.preventDefault();_slDrop(event,'${item.id}')">
        <span class="sl-drag-handle">
          <span class="material-symbols-outlined" style="font-size:15px;">drag_indicator</span>
        </span>
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
          <div style="width:8px;height:8px;border-radius:50%;background:${item.color};flex-shrink:0;box-shadow:0 0 6px ${item.color}88;"></div>
          <div>
            <div class="sl-section-hdr-name" style="color:${item.color};">${item.name}</div>
            ${item.description ? `<div class="sl-section-hdr-desc">${item.description}</div>` : ''}
          </div>
        </div>
        <button onclick="event.stopPropagation();removeSection('${item.id}')" class="sl-del-btn" title="Remove section">
          <span class="material-symbols-outlined" style="font-size:14px;">close</span>
        </button>
      </div>`;
    } else {
      songIdx++;
      const chipKey = item.key ? `<span class="sl-chip-key">${item.key}</span>` : '';
      const chipBpm = item.bpm ? `<span class="sl-chip-bpm">${item.bpm} BPM</span>` : '';
      const chipDur = (item.duration && item.duration !== '—') ? `<span class="sl-chip-dur">${item.duration}</span>` : '';
      const safeNotes = (item.notes || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const notesHtml = item.notes
        ? `<p class="sl-notes-txt">${safeNotes}</p>`
        : `<p class="sl-notes-txt sl-notes-empty">No notes — edit song to add cues</p>`;
      html += `
      <div class="sl-song-row" data-sid="${item.id}" style="animation-delay:${Math.min(i,10)*40}ms"
        draggable="true"
        ondragstart="event.stopPropagation();_slDragStart(event,${item.id})"
        ondragend="_slDragEnd(event)"
        ondragover="event.preventDefault();_slDragOver(event)"
        ondragleave="_slDragLeave(event)"
        ondrop="event.preventDefault();_slDrop(event,${item.id})">
        <div class="sl-song-row-main" onclick="toggleSongNotes(${item.id})">
          <span class="sl-drag-handle" ontouchstart="_slTouchStart(event)" ontouchmove="_slTouchMove(event)" ontouchend="_slTouchEnd()">
            <span class="material-symbols-outlined" style="font-size:16px;">drag_indicator</span>
          </span>
          <span class="sl-song-num">${String(songIdx).padStart(2,'0')}</span>
          <div class="sl-song-info">
            <div class="sl-song-title">${item.title}</div>
            ${item.artist ? `<div class="sl-song-artist">${item.artist}</div>` : ''}
          </div>
          <div class="sl-song-chips">${chipKey}${chipBpm}${chipDur}</div>
          <button onclick="event.stopPropagation();removeSong(${item.id})" class="sl-del-btn" title="Remove">
            <i data-lucide="trash-2" style="width:14px;height:14px;stroke-width:2;"></i>
          </button>
        </div>
        <div class="sl-notes-exp" id="sl-notes-${item.id}">
          <div class="sl-notes-inner">${notesHtml}</div>
        </div>
      </div>`;
    }
  });
  tbody.innerHTML = html;
  lcIcons();
  updateStatusBar();
  _slInitTouchDrag();
  renderSetlistInsights();
}

function toggleSongNotes(songId) {
  const el = document.getElementById('sl-notes-' + songId);
  if (!el) return;
  el.classList.toggle('open');
}

// ── Sections (inline setlist dividers) ──────────────────────────────
const _SL_SECTION_TYPES = {
  opening: { name: 'Opening Segment', description: 'A strong, high-energy opener to grab attention and establish competence.', color: '#ff7439' },
  main:    { name: 'Main Set',        description: 'The core journey — 3–4 song clusters alternating high & low energy.', color: '#7aafff' },
  closing: { name: 'Closing Segment', description: 'A powerful crowd-pleaser to end the main set on a high note.', color: '#c8a2ff' },
  encore:  { name: 'Encore',          description: 'An optional major hit performed after the main set concludes.', color: '#c5ffc9' },
};

function openSectionsModal()  { const m = document.getElementById('sections-modal'); if (m) m.style.display = 'flex'; }
function closeSectionsModal() { const m = document.getElementById('sections-modal'); if (m) m.style.display = 'none'; }

function addSection(type) {
  const st = _SL_SECTION_TYPES[type] || { name: type, description: '', color: '#7aafff' };
  state.setlist.push({ id: 'sec-' + Date.now(), type: 'section', sectionType: type, name: st.name, description: st.description, color: st.color });
  closeSectionsModal();
  renderSetlist();
  if (typeof pushHistory === 'function')      pushHistory();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
}

function removeSection(id) {
  state.setlist = state.setlist.filter(s => String(s.id) !== String(id));
  renderSetlist();
  if (typeof pushHistory === 'function')      pushHistory();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
}

// ── Drag-to-reorder (HTML5 desktop) ─────────────────────────────────
function _slDragStart(e, sid) {
  e.dataTransfer.setData('sl-sid', String(sid));
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => { const r = document.querySelector(`[data-sid="${sid}"]`); if (r) r.classList.add('sl-row-dragging'); }, 0);
}
function _slDragEnd(e) {
  document.querySelectorAll('.sl-row-dragging').forEach(el => el.classList.remove('sl-row-dragging'));
  document.querySelectorAll('.sl-drag-over').forEach(el => el.classList.remove('sl-drag-over'));
}
function _slDragOver(e) { e.currentTarget.classList.add('sl-drag-over'); }
function _slDragLeave(e) { e.currentTarget.classList.remove('sl-drag-over'); }
function _slDrop(e, targetSid) {
  document.querySelectorAll('.sl-drag-over,.sl-row-dragging').forEach(el => el.classList.remove('sl-drag-over','sl-row-dragging'));
  const sid = e.dataTransfer.getData('sl-sid');
  if (!sid || String(sid) === String(targetSid)) return;
  const fromIdx = state.setlist.findIndex(s => String(s.id) === String(sid));
  const toIdx   = state.setlist.findIndex(s => String(s.id) === String(targetSid));
  if (fromIdx === -1 || toIdx === -1) return;
  const [item] = state.setlist.splice(fromIdx, 1);
  state.setlist.splice(toIdx, 0, item);
  renderSetlist();
  if (typeof pushHistory === 'function')      pushHistory();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
}

// ── Drag-to-reorder (touch / mobile) ────────────────────────────────
let _slTouchDrag = null;
let _slTouchInitialized = false;

function _slInitTouchDrag() {
  if (_slTouchInitialized) return;
  _slTouchInitialized = true;
  const body = document.getElementById('setlist-body');
  if (!body) return;
  body.addEventListener('touchstart', _slTouchStart, { passive: false });
  body.addEventListener('touchmove',  _slTouchMove,  { passive: false });
  body.addEventListener('touchend',   _slTouchEnd);
  body.addEventListener('touchcancel',_slTouchEnd);
}

function _slTouchStart(e) {
  if (!e.target.closest('.sl-drag-handle')) return;
  e.preventDefault();
  const row = e.target.closest('[data-sid]');
  if (!row) return;
  row.classList.add('sl-row-dragging');
  _slTouchDrag = { sid: row.dataset.sid, row, targetSid: null };
}

function _slTouchMove(e) {
  if (!_slTouchDrag) return;
  e.preventDefault();
  document.querySelectorAll('.sl-drag-over').forEach(el => el.classList.remove('sl-drag-over'));
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const targetRow = el && el.closest('[data-sid]');
  if (targetRow && targetRow.dataset.sid !== _slTouchDrag.sid) {
    targetRow.classList.add('sl-drag-over');
    _slTouchDrag.targetSid = targetRow.dataset.sid;
  } else {
    _slTouchDrag.targetSid = null;
  }
}

function _slTouchEnd() {
  if (!_slTouchDrag) return;
  _slTouchDrag.row.classList.remove('sl-row-dragging');
  document.querySelectorAll('.sl-drag-over').forEach(el => el.classList.remove('sl-drag-over'));
  const { sid, targetSid } = _slTouchDrag;
  _slTouchDrag = null;
  if (!targetSid || targetSid === sid) return;
  const fromIdx = state.setlist.findIndex(s => String(s.id) === String(sid));
  const toIdx   = state.setlist.findIndex(s => String(s.id) === String(targetSid));
  if (fromIdx === -1 || toIdx === -1) return;
  const [item] = state.setlist.splice(fromIdx, 1);
  state.setlist.splice(toIdx, 0, item);
  _slTouchInitialized = false; // allow re-init after DOM rebuild
  renderSetlist();
  if (typeof pushHistory === 'function')      pushHistory();
  if (typeof markAutosaveDirty === 'function') markAutosaveDirty();
}

function _renderSegmentsBar() {
  const bar = document.getElementById('segments-bar');
  if (!bar) return;
  const segs = state.segments || [];
  if (!segs.length) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = segs.map(seg => {
    const count = _onlySongs().filter(s => s.segmentId === seg.id).length;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:${seg.color}18;border:1px solid ${seg.color}44;">
      <div style="width:8px;height:8px;background:${seg.color};flex-shrink:0;"></div>
      <span style="font-family:'Space Grotesk';font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:${seg.color};">${seg.name}</span>
      <span style="font-size:9px;color:#484847;">(${count})</span>
      <button onclick="removeSegment(${seg.id})" style="background:none;border:none;color:#484847;cursor:pointer;padding:0;margin-left:2px;line-height:1;font-size:13px;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#484847'" title="Remove segment">×</button>
    </div>`;
  }).join('');
}

function renderSetlistInsights() {
  const songs = _onlySongs();
  const tEl = document.getElementById('insight-tempo');
  const kEl = document.getElementById('insight-keys');
  const fEl = document.getElementById('insight-flow');
  if (!tEl || !kEl || !fEl) return;

  if (!songs.length) {
    tEl.textContent = '—'; tEl.style.color = '';
    kEl.textContent = '—'; kEl.style.color = '';
    fEl.textContent = '—'; fEl.style.color = '';
    return;
  }

  // ── Tempo Stability ──
  const bpms = songs.map(s => Number(s.bpm) || 120);
  const avgBpm = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  const bpmRange = Math.max(...bpms) - Math.min(...bpms);
  let tempoLabel, tempoColor;
  if (bpmRange <= 10)       { tempoLabel = `Steady · ${avgBpm} BPM avg`;   tempoColor = '#5ddd8a'; }
  else if (bpmRange <= 30)  { tempoLabel = `Stable · ${avgBpm} BPM avg`;   tempoColor = '#679cff'; }
  else if (bpmRange <= 60)  { tempoLabel = `Moderate · ${avgBpm} BPM avg`; tempoColor = '#f0a500'; }
  else                      { tempoLabel = `Dynamic · ${avgBpm} BPM avg`;  tempoColor = '#ff7a5a'; }
  tEl.textContent = tempoLabel;
  tEl.style.color = tempoColor;

  // ── Key Variety ──
  const uniqueKeys = [...new Set(songs.map(s => s.key || 'C'))];
  const keyCount = uniqueKeys.length;
  let keysLabel, keysColor;
  if (keyCount === 1)      { keysLabel = `Single key (${uniqueKeys[0]})`;   keysColor = '#5ddd8a'; }
  else if (keyCount <= 3)  { keysLabel = `${keyCount} keys · Focused`;      keysColor = '#679cff'; }
  else if (keyCount <= 5)  { keysLabel = `${keyCount} keys · Varied`;       keysColor = '#f0a500'; }
  else                     { keysLabel = `${keyCount} keys · Wide range`;   keysColor = '#ff7a5a'; }
  kEl.textContent = keysLabel;
  kEl.style.color = keysColor;

  // ── Transition Fluidity ──
  if (songs.length < 2) {
    fEl.textContent = 'Single song';
    fEl.style.color = '#767575';
    return;
  }
  let smoothPairs = 0;
  for (let i = 0; i < songs.length - 1; i++) {
    if ((songs[i].key || 'C') === (songs[i + 1].key || 'C')) smoothPairs++;
  }
  const total = songs.length - 1;
  const ratio = smoothPairs / total;
  let flowLabel, flowColor;
  if (ratio === 1)       { flowLabel = 'All smooth transitions';      flowColor = '#5ddd8a'; }
  else if (ratio >= 0.7) { flowLabel = `${smoothPairs}/${total} smooth`;  flowColor = '#679cff'; }
  else if (ratio >= 0.4) { flowLabel = `${smoothPairs}/${total} smooth`;  flowColor = '#f0a500'; }
  else                   { flowLabel = `${smoothPairs}/${total} smooth`;  flowColor = '#ff7a5a'; }
  fEl.textContent = flowLabel;
  fEl.style.color = flowColor;
}

let _sngSelectedSection = null;

function addSong() {
  // Reset fields
  const titleEl = document.getElementById('sng-title');
  titleEl.value = '';
  titleEl.classList.remove('sng-error');
  document.getElementById('sng-artist').value   = '';
  document.getElementById('sng-key').value      = 'C';
  document.getElementById('sng-bpm').value      = '120';
  document.getElementById('sng-duration').value = '';
  document.getElementById('sng-notes').value    = '';
  _sngSelectedSection = null;

  // Build section pills if any sections exist
  const sections = state.setlist.filter(item => item.type === 'section');
  const sectionRow   = document.getElementById('sng-section-row');
  const pillsWrap    = document.getElementById('sng-section-pills');
  if (sections.length && sectionRow && pillsWrap) {
    sectionRow.style.display = 'block';
    pillsWrap.innerHTML = sections.map(sec => `
      <button class="sng-section-pill" data-sid="${sec.id}"
        style="border-color:${sec.color}55;"
        onclick="_toggleSngSection(this,'${sec.id}','${sec.color}')">
        <span style="width:7px;height:7px;border-radius:50%;background:${sec.color};flex-shrink:0;box-shadow:0 0 5px ${sec.color}88;"></span>
        <span>${sec.name}</span>
      </button>`).join('');
  } else {
    if (sectionRow) sectionRow.style.display = 'none';
  }

  // Animate sheet up
  const modal = document.getElementById('song-modal');
  const sheet = document.getElementById('song-sheet');
  modal.style.display = 'flex';
  sheet.style.transform = 'translateY(100%)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sheet.style.transform = 'translateY(0)';
  }));
  setTimeout(() => titleEl.focus(), 360);
}

function _toggleSngSection(btn, sid, color) {
  document.querySelectorAll('#sng-section-pills .sng-section-pill').forEach(p => {
    p.classList.remove('active');
    p.style.backgroundColor = '';
  });
  if (_sngSelectedSection === sid) {
    _sngSelectedSection = null;
  } else {
    _sngSelectedSection = sid;
    btn.classList.add('active');
    btn.style.backgroundColor = color + '22';
  }
}

function saveSong() {
  const title = document.getElementById('sng-title').value.trim();
  if (!title) { document.getElementById('sng-title').classList.add('sng-error'); return; }

  const newSong = {
    id:        Date.now(),
    type:      'song',
    title,
    artist:    document.getElementById('sng-artist').value.trim(),
    key:       document.getElementById('sng-key').value,
    bpm:       parseInt(document.getElementById('sng-bpm').value) || 120,
    duration:  document.getElementById('sng-duration').value.trim() || '—',
    notes:     document.getElementById('sng-notes').value.trim(),
    segmentId: null,
  };

  if (_sngSelectedSection) {
    const secIdx = state.setlist.findIndex(item => String(item.id) === String(_sngSelectedSection));
    if (secIdx !== -1) {
      // Insert at the end of this section block (just before the next section header)
      let insertIdx = state.setlist.length;
      for (let i = secIdx + 1; i < state.setlist.length; i++) {
        if (state.setlist[i].type === 'section') { insertIdx = i; break; }
      }
      state.setlist.splice(insertIdx, 0, newSong);
    } else {
      state.setlist.push(newSong);
    }
  } else {
    state.setlist.push(newSong);
  }

  _sngSelectedSection = null;
  closeSongModal();
  renderSetlist();
  pushHistory();
  markAutosaveDirty();
}

function closeSongModal() {
  const sheet = document.getElementById('song-sheet');
  if (sheet) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => { document.getElementById('song-modal').style.display = 'none'; }, 320);
  } else {
    document.getElementById('song-modal').style.display = 'none';
  }
}

// ─── BATCH IMPORT ─────────────────────────────────────────────────────────
function openBatchImport() {
  const modal = document.getElementById('batch-import-modal');
  modal.style.display = 'flex';
  document.getElementById('batch-import-ta').value = '';
  document.getElementById('batch-file-name').textContent = '';
  document.getElementById('batch-file-input').value = '';
  const btn = document.getElementById('batch-import-btn');
  btn.textContent = 'Import 0 Songs';
  btn.disabled = true;
  btn.style.opacity = '0.4';
  document.getElementById('batch-preview-count').textContent = '';
  setTimeout(() => document.getElementById('batch-import-ta').focus(), 60);
}

function closeBatchImport() {
  document.getElementById('batch-import-modal').style.display = 'none';
}

function _parseSongLines(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => {
      // Strip leading numbers/bullets: "1.", "1)", "-", "•", "▸", "*", "–"
      l = l.replace(/^\d+[.)]\s*/, '').replace(/^[-•*–▸►▶·]\s*/, '').trim();

      let bpm = 120, key = 'C';

      // Extract BPM: "120bpm", "120 BPM", "@ 120", "BPM: 120"
      const bpmM = l.match(/\b(\d{2,3})\s*bpm\b/i) || l.match(/\bbpm\s*:?\s*(\d{2,3})\b/i) || l.match(/@\s*(\d{2,3})\b/i);
      if (bpmM) { bpm = parseInt(bpmM[1]); l = l.replace(bpmM[0], ''); }

      // Extract musical key: "Am", "Bb", "F#m", "Ebm" — but only strip it if
      // it appears after a known separator, so we don't eat part of the title
      const keyM = l.match(/(?:[-–—|,·()\s])\s*([A-G][#b]?m?)\s*(?:[-–—|,·()\s]|$)/);
      if (keyM) { key = keyM[1]; l = l.replace(keyM[0], ' '); }

      // Clean up leftover separators and trailing/leading whitespace
      const title = l.replace(/\s*[-–—|,·()]\s*$/g, '').replace(/^\s*[-–—|,·()]\s*/g, '').replace(/\s+/g, ' ').trim();
      return title ? { title, bpm, key } : null;
    })
    .filter(Boolean);
}

function updateBatchPreview() {
  const text = document.getElementById('batch-import-ta').value;
  const songs = _parseSongLines(text);
  const btn = document.getElementById('batch-import-btn');
  const preview = document.getElementById('batch-preview-count');
  if (songs.length > 0) {
    preview.textContent = songs.length + ' song' + (songs.length !== 1 ? 's' : '') + ' detected';
    preview.style.color = 'var(--accent)';
    btn.textContent = 'Import ' + songs.length + ' Song' + (songs.length !== 1 ? 's' : '');
    btn.disabled = false;
    btn.style.opacity = '1';
  } else {
    preview.textContent = text.trim() ? 'No songs detected — check format' : '';
    preview.style.color = '#484847';
    btn.textContent = 'Import 0 Songs';
    btn.disabled = true;
    btn.style.opacity = '0.4';
  }
}

async function handleBatchFile(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('batch-file-name').textContent = file.name;

  if (file.name.endsWith('.txt') || file.type === 'text/plain') {
    const text = await file.text();
    document.getElementById('batch-import-ta').value = text;
    updateBatchPreview();
    return;
  }

  if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
    const preview = document.getElementById('batch-preview-count');
    preview.textContent = 'Extracting text from PDF…';
    preview.style.color = '#767575';
    try {
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/stage-core/vendor/pdf.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          '/stage-core/vendor/pdf.worker.min.js';
      }
      const buf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      let lines = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Group items into lines using the y-coordinate
        let lastY = null;
        let lineStr = '';
        content.items.forEach(item => {
          const y = Math.round(item.transform[5]);
          if (lastY !== null && Math.abs(y - lastY) > 2) {
            if (lineStr.trim()) lines.push(lineStr.trim());
            lineStr = item.str;
          } else {
            lineStr += item.str;
          }
          lastY = y;
        });
        if (lineStr.trim()) lines.push(lineStr.trim());
      }
      document.getElementById('batch-import-ta').value = lines.join('\n');
      updateBatchPreview();
    } catch (err) {
      preview.textContent = 'Could not read PDF — try copy-pasting the text instead';
      preview.style.color = '#ff6b6b';
    }
    return;
  }

  document.getElementById('batch-preview-count').textContent = 'Unsupported file type — use .txt or .pdf';
  document.getElementById('batch-preview-count').style.color = '#ff6b6b';
}

function executeBatchImport() {
  const text = document.getElementById('batch-import-ta').value;
  const songs = _parseSongLines(text);
  if (!songs.length) return;
  const base = Date.now();
  songs.forEach((s, i) => {
    state.setlist.push({
      id: base + i,
      title: s.title,
      artist: '',
      key: s.key,
      bpm: s.bpm,
      duration: '—',
      notes: '',
      segmentId: null,
    });
  });
  closeBatchImport();
  renderSetlist();
  pushHistory();
  markAutosaveDirty();
  showToast(songs.length + ' song' + (songs.length !== 1 ? 's' : '') + ' imported');
}

function removeSong(id) {
  state.setlist = state.setlist.filter(s => s.id !== id);
  renderSetlist();
  pushHistory();
  markAutosaveDirty();
}

function assignSongSegment(songId, segId) {
  const song = state.setlist.find(s => s.id === songId);
  if (!song) return;
  song.segmentId = segId || null;
  // Re-sort setlist so segment-grouped songs appear together
  _groupSetlistBySegment();
  renderSetlist();
  pushHistory();
  markAutosaveDirty();
}

function _groupSetlistBySegment() {
  if (!state.segments || !state.segments.length) return;
  // Group songs by segmentId while preserving order within each group
  const groups = {};
  state.setlist.forEach(s => {
    const key = s.segmentId || '__none__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });
  const result = [];
  // First: songs with no segment
  if (groups['__none__']) result.push(...groups['__none__']);
  // Then: each segment in definition order
  state.segments.forEach(seg => {
    if (groups[seg.id]) result.push(...groups[seg.id]);
  });
  state.setlist = result;
}

// ── SEGMENT MODAL ──────────────────────────────────────────
function openSegmentModal() {
  document.getElementById('segment-modal').style.display = 'flex';
  document.getElementById('seg-name').value = '';
  // Build color picker
  const picker = document.getElementById('seg-color-picker');
  const usedColors = new Set((state.segments||[]).map(s => s.color));
  const first = SEGMENT_COLORS.find(c => !usedColors.has(c)) || SEGMENT_COLORS[0];
  document.getElementById('seg-color-value').value = first;
  picker.innerHTML = SEGMENT_COLORS.map(c => `
    <div onclick="_pickSegColor('${c}')" id="seg-swatch-${c.replace('#','')}"
      style="width:28px;height:28px;background:${c};cursor:pointer;outline:${c===first?'2px solid #fff':'2px solid transparent'};outline-offset:2px;transition:outline 0.1s;">
    </div>`).join('');
  setTimeout(() => document.getElementById('seg-name').focus(), 50);
}

function _pickSegColor(color) {
  document.getElementById('seg-color-value').value = color;
  SEGMENT_COLORS.forEach(c => {
    const sw = document.getElementById('seg-swatch-' + c.replace('#',''));
    if (sw) sw.style.outline = c === color ? '2px solid #fff' : '2px solid transparent';
  });
}

function closeSegmentModal() {
  document.getElementById('segment-modal').style.display = 'none';
}

function saveSegment() {
  const name = document.getElementById('seg-name').value.trim();
  if (!name) { document.getElementById('seg-name').style.borderBottomColor = '#ff716c'; return; }
  const color = document.getElementById('seg-color-value').value;
  if (!state.segments) state.segments = [];
  state.segments.push({ id: _segNextId++, name, color });
  closeSegmentModal();
  renderSetlist();
  pushHistory();
  markAutosaveDirty();
}

function removeSegment(id) {
  state.segments = (state.segments||[]).filter(s => s.id !== id);
  // Unassign songs that belonged to this segment
  state.setlist.forEach(s => { if (s.segmentId === id) s.segmentId = null; });
  renderSetlist();
  pushHistory();
  markAutosaveDirty();
}

// ── SMART SORT ─────────────────────────────────────────────
let _smartSortProposal = null; // { setlist, segments }

// ── BPM → energy (0-100). Primary energy source for Smart Sort ─────────────
function _derivedEnergy(song) {
  const bpm = parseInt(song.bpm) || 120;
  if (bpm < 60)  return 15;
  if (bpm < 75)  return 28;
  if (bpm < 90)  return 40;
  if (bpm < 105) return 52;
  if (bpm < 120) return 64;
  if (bpm < 135) return 74;
  if (bpm < 150) return 83;
  if (bpm < 170) return 90;
  return 95;
}

// ── Classic live-show energy arc (position 0→1) ─────────────────────────────
function _energyTarget(pos) {
  if (pos === 0)   return 88;  // strong opener
  if (pos < 0.18)  return 72;  // early build
  if (pos < 0.42)  return 82;  // mid build
  if (pos < 0.58)  return 96;  // peak zone
  if (pos < 0.70)  return 38;  // breather
  if (pos < 0.85)  return 76;  // pre-finale
  return 92;                    // big closer
}

// ── Greedy sort: fill each slot with the best-scoring remaining song ─────────
function _smartSortGroup(songs) {
  const n = songs.length;
  if (n < 2) return [...songs];
  const placed = [];
  const remaining = [...songs];
  for (let slot = 0; slot < n; slot++) {
    const pos = n > 1 ? slot / (n - 1) : 0;
    const targetE = _energyTarget(pos);
    let bestIdx = 0, bestScore = Infinity;
    remaining.forEach((song, i) => {
      const derived = _derivedEnergy(song);
      const eDist = Math.abs(derived - targetE);
      // BPM smoothness: penalise jarring tempo jumps between consecutive songs
      const prevBpm = placed.length ? (placed[placed.length - 1].bpm || 120) : (song.bpm || 120);
      const bpmJump = Math.abs((song.bpm || 120) - prevBpm) / 20;
      const score = eDist + bpmJump * 0.4;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    });
    placed.push(remaining.splice(bestIdx, 1)[0]);
  }
  return placed;
}

// ── Build proposed segments without touching state ───────────────────────────
function _buildProposedSegments(sortedSongs) {
  const n = sortedSongs.length;
  const use4 = n >= 7;
  let nextId = 1;
  const proposedSegs = [];
  const cuts = use4
    ? [
        { name:'Opener',   color:'#ff7439', ratio: 0.20 },
        { name:'Build',    color:'#7aafff', ratio: 0.50 },
        { name:'Main Set', color:'#c8a2ff', ratio: 0.80 },
        { name:'Encore',   color:'#ffd700', ratio: 1.00 },
      ]
    : [
        { name:'Opener',   color:'#ff7439', ratio: 0.33 },
        { name:'Main Set', color:'#c8a2ff', ratio: 0.67 },
        { name:'Encore',   color:'#ffd700', ratio: 1.00 },
      ];

  cuts.forEach(c => proposedSegs.push({ id: nextId++, name: c.name, color: c.color }));

  // Assign each song to its segment based on sorted position
  sortedSongs.forEach((song, i) => {
    const pos = (i + 1) / n;
    let segIdx = cuts.findIndex(c => pos <= c.ratio);
    if (segIdx < 0) segIdx = cuts.length - 1;
    song.segmentId = proposedSegs[segIdx].id;
  });

  return proposedSegs;
}

function openSmartSortModal() {
  if (state.setlist.length < 2) {
    showToast('Add at least 2 songs to use Smart Sort.');
    return;
  }

  // Always sort the FULL list — auto-segments override existing ones
  const sorted = _smartSortGroup(state.setlist.map(s => ({ ...s })));
  const proposedSegs = _buildProposedSegments(sorted);

  _smartSortProposal = { setlist: sorted, segments: proposedSegs };

  const use4 = proposedSegs.length === 4;
  const segCount = proposedSegs.length;
  const desc = `Songs sorted by BPM-driven energy arc — strong opener, building tension, peak zone, breather, then big finale. Auto-split into ${segCount} segments (${use4 ? 'Opener / Build / Main Set / Encore' : 'Opener / Main Set / Encore'}) based on position. Existing segments will be replaced. PDF will be exported automatically.`;
  document.getElementById('smart-sort-desc').textContent = desc;

  // Build preview with proposed segment headers
  let lastSegId = '__INIT__';
  let previewHtml = '';
  sorted.forEach((song, i) => {
    const curSegId = song.segmentId;
    if (curSegId !== lastSegId) {
      const seg = proposedSegs.find(s => s.id === curSegId);
      if (seg) {
        previewHtml += `<div style="display:flex;align-items:center;gap:8px;padding:10px 0 5px;margin-top:${i>0?'8px':'0'};border-top:${i>0?`1px solid ${seg.color}33`:' none'};">
          <div style="width:3px;height:14px;background:${seg.color};flex-shrink:0;"></div>
          <span style="font-family:'Space Grotesk';font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.25em;color:${seg.color};">${seg.name}</span>
        </div>`;
      }
      lastSegId = curSegId;
    }
    const seg = proposedSegs.find(s => s.id === curSegId);
    const derived = _derivedEnergy(song);
    const bpmLabel = song.bpm ? `${song.bpm} BPM` : '— BPM';
    previewHtml += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:#111;margin-bottom:2px;">
      <span style="font-family:'Space Grotesk';font-size:11px;font-weight:900;color:#484847;min-width:24px;">${String(i+1).padStart(2,'0')}.</span>
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Inter';font-size:13px;font-weight:700;color:#fff;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${song.title}</div>
        ${song.artist ? `<div style="font-size:10px;color:#484847;margin-top:1px;">${song.artist}</div>` : ''}
      </div>
      <span style="font-size:9px;color:#767575;white-space:nowrap;">${bpmLabel}</span>
      <div style="display:flex;align-items:center;gap:5px;min-width:90px;">
        <div style="flex:1;height:3px;background:#262626;position:relative;">
          <div style="position:absolute;inset-y:0;left:0;background:${seg ? seg.color : '#7aafff'};width:${derived}%;"></div>
        </div>
        <span style="font-size:9px;color:${seg ? seg.color : '#7aafff'};font-weight:700;">${derived}</span>
      </div>
    </div>`;
  });
  document.getElementById('smart-sort-preview').innerHTML = previewHtml;
  document.getElementById('smart-sort-modal').style.display = 'flex';
}

function closeSmartSortModal() {
  document.getElementById('smart-sort-modal').style.display = 'none';
  _smartSortProposal = null;
}

async function applySmartSort() {
  if (!_smartSortProposal) return;
  const { setlist, segments } = _smartSortProposal;
  _smartSortProposal = null;
  document.getElementById('smart-sort-modal').style.display = 'none';

  // Apply sorted setlist and replace segments
  state.setlist = setlist;
  state.segments = segments;
  _segNextId = segments.length + 1;

  renderSetlist();
  pushHistory();
  showToast('Smart Sort applied — generating PDF…');

  // Refresh export data then trigger PDF
  refreshExport();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  exportPDF();
}

// ══════════════════════════════════════════════════════════
//  CUSTOM CONFIRM (replaces browser confirm() blocked in iframes)
// ══════════════════════════════════════════════════════════
let _confirmCb = null;
function showConfirm(message, onOk) {
  _confirmCb = onOk;
  document.getElementById('confirm-msg').textContent = message;
  const el = document.getElementById('confirm-modal');
  el.style.display = 'flex';
  lcIcons();
}
function doConfirm(ok) {
  document.getElementById('confirm-modal').style.display = 'none';
  if (ok && typeof _confirmCb === 'function') _confirmCb();
  _confirmCb = null;
}

// ══════════════════════════════════════════════════════════
//  PRESETS
// ══════════════════════════════════════════════════════════
const PRESETS_KEY = 'stagecorePresets_v1';

function getPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
}
function setPresets(arr) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(arr));
  scheduleCloudAutosave();
}

function openPresetsPanel(triggerEl) {
  const panel = document.getElementById('presets-panel');
  document.getElementById('presets-backdrop').style.display = 'block';
  panel.classList.add('preset-open');
  hideSaveForm();
  renderPresetsList();
  lcIcons();
}
function closePresetsPanel() {
  document.getElementById('presets-panel').classList.remove('preset-open');
  document.getElementById('presets-backdrop').style.display = 'none';
  hideSaveForm();
}

function triggerSavePreset() {
  const form = document.getElementById('presets-save-form');
  if (!form) return;
  if (form.classList.contains('pf-open')) {
    hideSaveForm();
  } else {
    form.classList.add('pf-open');
  }
}

function hideSaveForm() {
  const form = document.getElementById('presets-save-form');
  if (!form) return;
  form.classList.remove('pf-open');
  const input = document.getElementById('preset-name-input');
  if (input) input.value = '';
}

function savePreset() {
  const nameEl = document.getElementById('preset-name-input');
  const name = nameEl.value.trim();
  if (!name) { nameEl.style.borderColor = '#ff716c'; return; }
  nameEl.style.borderColor = '';
  const presets = getPresets();
  presets.unshift({
    id: Date.now(),
    name,
    savedAt: new Date().toLocaleString(),
    elements: JSON.parse(JSON.stringify(state.elements)),
    connections: JSON.parse(JSON.stringify(state.connections)),
    setlist: JSON.parse(JSON.stringify(state.setlist)),
    canvasW: state.canvasW,
    canvasH: state.canvasH,
  });
  setPresets(presets);
  hideSaveForm();
  renderPresetsList();
  showToast(T('presetSaved') + ': "' + name + '"');
}

function loadPreset(id) {
  const presets = getPresets();
  const p = presets.find(x => x.id === id);
  if (!p) return;
  showConfirm(Tformat('loadPresetConfirm', { name: p.name }), () => {
    state.elements = JSON.parse(JSON.stringify(p.elements || []));
    state.connections = JSON.parse(JSON.stringify(p.connections || []));
    state.setlist = JSON.parse(JSON.stringify(p.setlist || []));
    if (p.canvasW) { state.canvasW = p.canvasW; state.canvasH = p.canvasH; }
    state.nextId = state.elements.reduce((max, el) => {
      const n = parseInt(el.id.replace('el-', '')) || 0; return Math.max(max, n + 1);
    }, 1);
    renderAll();
    updateDropHint();
    pushHistory();
    closePresetsPanel();
    showToast(T('presetLoaded') + ': "' + p.name + '"');
  });
}

function deletePreset(id) {
  const presets = getPresets();
  const p = presets.find(x => x.id === id);
  if (!p) return;
  showConfirm(Tformat('delPresetConfirm', { name: p.name }), () => {
    setPresets(presets.filter(x => x.id !== id));
    renderPresetsList();
    showToast(T('presetDeleted'));
  });
}

function renderPresetsList() {
  const container = document.getElementById('presets-list');
  const presets = getPresets();
  if (!presets.length) {
    container.innerHTML = `<div class="presets-empty">No presets yet.<br>Save your current stage setup.</div>`;
    return;
  }
  container.innerHTML = presets.map(p => `
    <div class="preset-item">
      <div class="preset-item-info">
        <div class="preset-item-name">${p.name}</div>
        <div class="preset-item-meta">${p.elements.length} element${p.elements.length!==1?'s':''}</div>
      </div>
      <button class="preset-item-load" onclick="loadPreset(${p.id})" title="Load preset">Load</button>
      <button class="preset-item-del" onclick="deletePreset(${p.id})" title="Delete preset">
        <i data-lucide="trash-2" style="width:13px;height:13px;stroke-width:2;pointer-events:none;"></i>
      </button>
    </div>`).join('');
  lcIcons();
}

// ── Quick Presets ──────────────────────────────────────────
const QUICK_PRESETS = {
  rock: {
    name: 'Rock Band',
    elements: [
      { id:'qr-1', name:'Drum Kit',   icon:'drum',             label:'Drums',     x:310, y:120, scale:100, rotation:0, color:'#ff7439', channelId:'CH-01', source:'mic',   output:'FOH', phantom:false, notes:'Kick, Snare, OH mics', roles:[] },
      { id:'qr-2', name:'Bass Guitar',icon:'cx-bass-guitar',  label:'Bass',      x:185, y:195, scale:100, rotation:0, color:'#7aafff', channelId:'CH-02', source:'direct',output:'FOH', phantom:false, notes:'DI box',               roles:[] },
      { id:'qr-3', name:'Guitar',     icon:'cx-elec-guitar',  label:'Guitar L',  x:100, y:195, scale:100, rotation:0, color:'#c5ffc9', channelId:'CH-03', source:'amp',   output:'FOH', phantom:false, notes:'Amp stage right',      roles:[] },
      { id:'qr-4', name:'Guitar',     icon:'cx-elec-guitar',  label:'Guitar R',  x:450, y:195, scale:100, rotation:0, color:'#c5ffc9', channelId:'CH-04', source:'amp',   output:'FOH', phantom:false, notes:'Amp stage left',       roles:[] },
      { id:'qr-5', name:'Keyboard',   icon:'piano',  label:'Keys',      x:535, y:195, scale:100, rotation:0, color:'#ffe066', channelId:'CH-05', source:'direct',output:'FOH', phantom:false, notes:'Stereo DI',            roles:[] },
      { id:'qr-6', name:'SM58',       icon:'mic',    label:'Lead Vox',  x:290, y:295, scale:100, rotation:0, color:'#ff7439', channelId:'CH-06', source:'mic',   output:'FOH', phantom:false, notes:'Centre stage',         roles:[] },
      { id:'qr-7', name:'SM58',       icon:'mic',    label:'BGV L',     x:190, y:315, scale:100, rotation:0, color:'#adaaaa', channelId:'CH-07', source:'mic',   output:'FOH', phantom:false, notes:'',                     roles:[] },
      { id:'qr-8', name:'SM58',       icon:'mic',    label:'BGV R',     x:395, y:315, scale:100, rotation:0, color:'#adaaaa', channelId:'CH-08', source:'mic',   output:'FOH', phantom:false, notes:'',                     roles:[] },
    ],
  },
  acoustic: {
    name: 'Acoustic Set',
    elements: [
      { id:'qa-1', name:'Guitar',     icon:'guitar', label:'Acoustic L', x:180, y:205, scale:100, rotation:0, color:'#ffe066', channelId:'CH-01', source:'direct',output:'FOH', phantom:true,  notes:'Pickup DI',  roles:[] },
      { id:'qa-2', name:'Guitar',     icon:'guitar', label:'Acoustic R', x:385, y:205, scale:100, rotation:0, color:'#ffe066', channelId:'CH-02', source:'direct',output:'FOH', phantom:true,  notes:'Pickup DI',  roles:[] },
      { id:'qa-3', name:'Drum Kit',   icon:'drum',   label:'Cajon',      x:295, y:150, scale:100, rotation:0, color:'#c5ffc9', channelId:'CH-03', source:'mic',   output:'FOH', phantom:false, notes:'Single mic', roles:[] },
      { id:'qa-4', name:'SM58',       icon:'mic',    label:'Vox L',      x:190, y:315, scale:100, rotation:0, color:'#ff7439', channelId:'CH-04', source:'mic',   output:'FOH', phantom:false, notes:'',           roles:[] },
      { id:'qa-5', name:'SM58',       icon:'mic',    label:'Vox R',      x:395, y:315, scale:100, rotation:0, color:'#ff7439', channelId:'CH-05', source:'mic',   output:'FOH', phantom:false, notes:'',           roles:[] },
    ],
  },
  fullband: {
    name: 'Full Band',
    elements: [
      { id:'qf-1', name:'Drum Kit',   icon:'drum',            label:'Drums',     x:290, y:100, scale:110, rotation:0, color:'#ff7439', channelId:'CH-01', source:'mic',   output:'FOH', phantom:false, notes:'Full kit mics', roles:[] },
      { id:'qf-2', name:'Bass Guitar',icon:'cx-bass-guitar', label:'Bass',      x:160, y:195, scale:100, rotation:0, color:'#7aafff', channelId:'CH-06', source:'direct',output:'FOH', phantom:false, notes:'DI box',        roles:[] },
      { id:'qf-3', name:'Guitar',     icon:'cx-elec-guitar', label:'Guitar 1',  x:65,  y:195, scale:100, rotation:0, color:'#c5ffc9', channelId:'CH-07', source:'amp',   output:'FOH', phantom:false, notes:'',              roles:[] },
      { id:'qf-4', name:'Guitar',     icon:'cx-elec-guitar', label:'Guitar 2',  x:455, y:195, scale:100, rotation:0, color:'#c5ffc9', channelId:'CH-08', source:'amp',   output:'FOH', phantom:false, notes:'',              roles:[] },
      { id:'qf-5', name:'Keyboard',   icon:'piano',  label:'Keys',      x:550, y:195, scale:100, rotation:0, color:'#ffe066', channelId:'CH-09', source:'direct',output:'FOH', phantom:false, notes:'Stereo DI',     roles:[] },
      { id:'qf-6', name:'SM58',       icon:'mic',    label:'Lead Vox',  x:275, y:300, scale:100, rotation:0, color:'#ff7439', channelId:'CH-10', source:'mic',   output:'FOH', phantom:false, notes:'Centre',        roles:[] },
      { id:'qf-7', name:'SM58',       icon:'mic',    label:'BGV L',     x:175, y:318, scale:100, rotation:0, color:'#adaaaa', channelId:'CH-11', source:'mic',   output:'FOH', phantom:false, notes:'',              roles:[] },
      { id:'qf-8', name:'SM58',       icon:'mic',    label:'BGV R',     x:385, y:318, scale:100, rotation:0, color:'#adaaaa', channelId:'CH-12', source:'mic',   output:'FOH', phantom:false, notes:'',              roles:[] },
    ],
  },
};

function loadQuickPreset(key) {
  const p = QUICK_PRESETS[key];
  if (!p) return;
  showConfirm('Load "' + p.name + '" quick preset? This will replace the current stage.', () => {
    state.elements = JSON.parse(JSON.stringify(p.elements));
    state.connections = [];
    state.setlist = [];
    state.nextId = 20;
    renderAll();
    updateDropHint();
    pushHistory();
    closePresetsPanel();
    showToast(T('presetLoaded') + ': "' + p.name + '"');
  });
}

// Escape closes modals / panels
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (document.getElementById('presets-panel').style.display !== 'none') closePresetsPanel();
    if (document.getElementById('gear-modal').style.display !== 'none') closeGearModal();
  }
});

// ══════════════════════════════════════════════════════════
//  GEAR VIEW
// ══════════════════════════════════════════════════════════
const GEAR_CATS = ['Instruments','Microphones','Audio','Cables','Power','Outboard','Stands','Misc'];
const GEAR_CAT_COLORS = {
  'Instruments':'#7aafff','Microphones':'#ff7439','Audio':'#c5ffc9',
  'Cables':'#ffcc44','Power':'#ff716c','Outboard':'#bf99ff',
  'Stands':'#adaaaa','Misc':'#484847'
};

let _gearNextId = 1;

function openGearModal() {
  document.getElementById('gear-name').value = '';
  document.getElementById('gear-cat').value = 'Instruments';
  document.getElementById('gear-qty').value = '1';
  document.getElementById('gear-notes').value = '';
  document.getElementById('gear-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('gear-name').focus(), 80);
}
function closeGearModal() {
  document.getElementById('gear-modal').style.display = 'none';
}
function saveGearItem() {
  const name = document.getElementById('gear-name').value.trim();
  if (!name) {
    document.getElementById('gear-name').style.borderBottomColor = '#ff716c';
    document.getElementById('gear-name').focus();
    return;
  }
  const item = {
    id: _gearNextId++,
    name,
    category: document.getElementById('gear-cat').value,
    qty: Math.max(1, parseInt(document.getElementById('gear-qty').value) || 1),
    notes: document.getElementById('gear-notes').value.trim(),
    packed: false,
  };
  state.gear.push(item);
  closeGearModal();
  renderGear();
  refreshExportGear();
  saveProject();
}
function deleteGearItem(id) {
  state.gear = state.gear.filter(g => g.id !== id);
  renderGear();
  refreshExportGear();
  saveProject();
}
function toggleGearPacked(id) {
  const item = state.gear.find(g => g.id === id);
  if (item) item.packed = !item.packed;
  renderGear();
  refreshExportGear();
  saveProject();
}
function renderGear() {
  const tbody = document.getElementById('gear-body');
  if (!tbody) return;

  // Sort by category then name
  const sorted = [...state.gear].sort((a, b) =>
    GEAR_CATS.indexOf(a.category) - GEAR_CATS.indexOf(b.category) || a.name.localeCompare(b.name)
  );

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding:64px 0;text-align:center;">
      <div style="font-family:'Space Grotesk';font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;color:#333;">${T('noGearYet')}</div>
      <div style="font-size:12px;color:#484847;margin-top:8px;">${T('addGearHint')}</div>
    </td></tr>`;
  } else {
    let lastCat = null;
    tbody.innerHTML = sorted.map(g => {
      let catRow = '';
      if (g.category !== lastCat) {
        lastCat = g.category;
        const col = GEAR_CAT_COLORS[g.category] || '#484847';
        catRow = `<tr><td colspan="6" style="padding:10px 16px 4px;font-family:'Space Grotesk';font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.25em;color:${col};border-top:1px solid #1a1a1a;">${Tcat(g.category)}</td></tr>`;
      }
      return catRow + `<tr style="border-bottom:1px solid #111;${g.packed ? 'opacity:0.4;' : ''}">
        <td style="padding:12px 16px;width:36px;">
          <div onclick="toggleGearPacked(${g.id})" style="width:20px;height:20px;border:2px solid ${g.packed ? '#c5ffc9' : '#484847'};background:${g.packed ? '#c5ffc9' : 'transparent'};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.1s;flex-shrink:0;">
            ${g.packed ? '<span style="font-size:13px;color:#002e00;line-height:1;">✓</span>' : ''}
          </div>
        </td>
        <td style="padding:12px 16px;font-family:'Inter';font-size:13px;font-weight:600;color:${g.packed ? '#767575' : '#fff'};${g.packed ? 'text-decoration:line-through;' : ''}">${g.name}</td>
        <td style="padding:12px 16px;">
          <span style="font-family:'Space Grotesk';font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:${GEAR_CAT_COLORS[g.category]||'#484847'};padding:3px 8px;border:1px solid ${GEAR_CAT_COLORS[g.category]||'#484847'}33;">${Tcat(g.category)}</span>
        </td>
        <td style="padding:12px 16px;font-family:'Space Grotesk';font-size:16px;font-weight:900;color:#ff7439;">${g.qty}</td>
        <td style="padding:12px 16px;font-size:11px;color:#767575;font-family:'Inter';">${g.notes || '—'}</td>
        <td style="padding:12px 16px;width:36px;">
          <button onclick="deleteGearItem(${g.id})" style="color:#333;background:none;border:none;cursor:pointer;font-size:18px;line-height:1;transition:color 0.1s;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#333'">×</button>
        </td>
      </tr>`;
    }).join('');
  }

  // Stats
  const total = state.gear.length;
  const packed = state.gear.filter(g => g.packed).length;
  const units = state.gear.reduce((s, g) => s + g.qty, 0);
  const el = id => document.getElementById(id);
  if (el('gear-stat-total')) el('gear-stat-total').textContent = total;
  if (el('gear-stat-packed')) el('gear-stat-packed').textContent = packed;
  if (el('gear-stat-remaining')) el('gear-stat-remaining').textContent = total - packed;
  if (el('gear-stat-units')) el('gear-stat-units').textContent = units;

  lcIcons();
  updateStatusBar();
}

function refreshExportGear() {
  const tbody = document.getElementById('exp-gear-tbody');
  const empty = document.getElementById('exp-gear-empty');
  const content = document.getElementById('exp-gear-content');
  if (!tbody) return;

  if (!state.gear.length) {
    if (empty) empty.style.display = 'block';
    if (content) content.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (content) content.style.display = 'block';

  const sorted = [...state.gear].sort((a, b) =>
    GEAR_CATS.indexOf(a.category) - GEAR_CATS.indexOf(b.category) || a.name.localeCompare(b.name)
  );

  let lastCat = null;
  tbody.innerHTML = sorted.map((g, i) => {
    let catRow = '';
    if (g.category !== lastCat) {
      lastCat = g.category;
      catRow = `<tr><td colspan="5" style="padding:8px 12px 3px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:${GEAR_CAT_COLORS[g.category]||'#484847'};border-top:1px solid rgba(72,72,71,0.3);">${Tcat(g.category)}</td></tr>`;
    }
    const bg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    return catRow + `<tr style="background:${bg};">
      <td style="padding:7px 12px;font-size:12px;font-weight:600;color:#fff;">${g.name}</td>
      <td style="padding:7px 12px;font-size:10px;color:#767575;">${Tcat(g.category)}</td>
      <td style="padding:7px 12px;font-size:12px;font-weight:700;color:#ff7439;text-align:center;">${g.qty}</td>
      <td style="padding:7px 12px;font-size:10px;color:#767575;">${g.notes || '—'}</td>
      <td style="padding:7px 12px;text-align:center;">
        <div style="width:14px;height:14px;border:1.5px solid ${g.packed ? '#c5ffc9' : '#484847'};background:${g.packed ? '#c5ffc9' : 'transparent'};margin:0 auto;display:flex;align-items:center;justify-content:center;">
          ${g.packed ? '<span style="font-size:9px;color:#002e00;line-height:1;">✓</span>' : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════
//  AUTOSAVE
// ══════════════════════════════════════════════════════════
let _sessionDirty = false;   // true after any user change — triggers reload warning
let _asState = 'off';        // 'off' | 'on' | 'saving'
let _asPresetId = null;
let _asPresetName = null;
let _asTimer = null;

function setAutosaveUI(mode) {
  const dot = document.getElementById('autosave-dot');
  const lbl = document.getElementById('status-save');
  if (!dot || !lbl) return;
  if (mode === 'off') {
    dot.className = '';
    dot.innerHTML = '';
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#484847;flex-shrink:0;transition:background 0.2s,box-shadow 0.2s;box-shadow:none;';
    lbl.textContent = 'AUTOSAVE: OFF';
    lbl.style.color = '#484847';
  } else if (mode === 'on') {
    dot.className = '';
    dot.innerHTML = '';
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#3ddc84;flex-shrink:0;transition:background 0.2s,box-shadow 0.2s;box-shadow:0 0 6px rgba(61,220,132,0.55);';
    lbl.textContent = 'AUTOSAVE: ON';
    lbl.style.color = '#3ddc84';
  } else if (mode === 'saving') {
    dot.innerHTML = '';
    dot.style.cssText = 'width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
    dot.innerHTML = '<span class="material-symbols-outlined as-spinning" style="font-size:15px;color:#ff9930;">sync</span>';
    lbl.textContent = 'AUTOSAVING...';
    lbl.style.color = '#ff9930';
  }
}

function toggleAutosave() {
  if (_asState === 'off') {
    const modal = document.getElementById('autosave-modal');
    const inp = document.getElementById('autosave-name-input');
    if (_asPresetName) inp.value = _asPresetName;
    modal.style.display = 'block';
    setTimeout(() => inp.focus(), 60);
  } else {
    clearTimeout(_asTimer);
    _asState = 'off';
    _asPresetId = null;
    _asPresetName = null;
    setAutosaveUI('off');
    showToast('Autosave disabled');
  }
}

function confirmAutosaveName() {
  const inp = document.getElementById('autosave-name-input');
  const name = inp.value.trim();
  if (!name) { inp.style.borderBottomColor = '#ff716c'; setTimeout(() => inp.style.borderBottomColor = '#333', 1200); return; }
  inp.style.borderBottomColor = '#333';
  document.getElementById('autosave-modal').style.display = 'none';
  _asPresetName = name;
  // Re-use existing preset with same name or create new slot
  const presets = getPresets();
  let existing = presets.find(p => p.name === name);
  if (existing) {
    _asPresetId = existing.id;
  } else {
    _asPresetId = Date.now();
    presets.unshift({ id: _asPresetId, name, savedAt: new Date().toLocaleString(),
      elements: JSON.parse(JSON.stringify(state.elements)),
      connections: JSON.parse(JSON.stringify(state.connections)),
      setlist: JSON.parse(JSON.stringify(state.setlist)),
      canvasW: state.canvasW, canvasH: state.canvasH });
    setPresets(presets);
  }
  _asState = 'on';
  setAutosaveUI('on');
  showToast('Autosave enabled: "' + name + '"');
}

function cancelAutosave() {
  document.getElementById('autosave-modal').style.display = 'none';
}

function markAutosaveDirty() {
  state.lastModified = new Date().toISOString();
  _sessionDirty = true;    // Flag so reload warning fires
  scheduleCloudAutosave(); // Always cloud-sync when signed in, regardless of local autosave
  _scheduleSessionSave();  // Save session locally for cloud sync purposes
  if (_asState === 'off') return;
  clearTimeout(_asTimer);
  _asTimer = setTimeout(_doAutosave, 3000);
}

function _doAutosave() {
  if (_asState === 'off' || !_asPresetId) return;
  _asState = 'saving';
  setAutosaveUI('saving');
  try {
    const presets = getPresets();
    const idx = presets.findIndex(p => p.id === _asPresetId);
    const slot = { id: _asPresetId, name: _asPresetName, savedAt: new Date().toLocaleString(),
      elements: JSON.parse(JSON.stringify(state.elements)),
      connections: JSON.parse(JSON.stringify(state.connections)),
      setlist: JSON.parse(JSON.stringify(state.setlist)),
      canvasW: state.canvasW, canvasH: state.canvasH };
    if (idx >= 0) presets[idx] = slot; else presets.unshift(slot);
    setPresets(presets);
  } catch(e) {}
  setTimeout(() => { if (_asState === 'saving') { _asState = 'on'; setAutosaveUI('on'); } }, 900);
}

// ══════════════════════════════════════════════════════════
//  SAVE / EXPORT
// ══════════════════════════════════════════════════════════
function saveProject() {
  try {
    localStorage.setItem('stagecoreProject', JSON.stringify({ schemaVersion: 7, members: state.members, riderNeeds: state.riderNeeds, lang: state.lang, segments: state.segments, setlist: state.setlist, timeline: state.timeline, gear: state.gear }));
  } catch(e) {}
  _sessionSave();
  showToast(T('projectSaved'));
  // Always push to cloud autosave when signed in, independent of local autosave toggle
  scheduleCloudAutosave();
}

// ── Silent full-session persistence ──────────────────────────
let _sessionSaveTimer = null;
function _scheduleSessionSave() {
  clearTimeout(_sessionSaveTimer);
  _sessionSaveTimer = setTimeout(_sessionSave, 1500);
}
function _sessionSave() {
  try {
    localStorage.setItem('sc_session', JSON.stringify(getCloudState()));
  } catch(e) {}
}
function _sessionRestore() {
  try {
    const raw = localStorage.getItem('sc_session');
    if (!raw) { loadSaved(); return; }
    const d = JSON.parse(raw);
    if (d.elements)    state.elements    = JSON.parse(JSON.stringify(d.elements));
    if (d.connections) state.connections = JSON.parse(JSON.stringify(d.connections));
    if (d.setlist)     state.setlist     = JSON.parse(JSON.stringify(d.setlist));
    if (d.segments)    state.segments    = JSON.parse(JSON.stringify(d.segments));
    if (d.gear)        state.gear        = JSON.parse(JSON.stringify(d.gear));
    if (d.members)     state.members     = JSON.parse(JSON.stringify(d.members));
    if (d.timeline)    state.timeline    = JSON.parse(JSON.stringify(d.timeline));
    if (d.riderNeeds)  state.riderNeeds  = JSON.parse(JSON.stringify(d.riderNeeds));
    if (d._rnNextId)   state._rnNextId   = d._rnNextId;
    if (d.lang)        state.lang        = d.lang;
    if (d.canvasBg) {
      state.canvasBg = d.canvasBg;
      // Do NOT set inline style here — CSS rule handles the correct theme-based bg before first paint.
      // applySettings() runs immediately after _sessionRestore() and will apply the correct bg.
    }
    if (d.navOrder)  state.navOrder  = d.navOrder;
    if (d.gridSize)  state.gridSize  = d.gridSize;
    if (d.canvasW)   { state.canvasW = d.canvasW; state.canvasH = d.canvasH; }
    state.nextId = Math.max(state.nextId || 1,
      (d.elements || []).reduce((m, el) => Math.max(m, (parseInt(el.id.replace('el-','')) || 0) + 1), 1));
    _memberNextId = (d.members || []).reduce((mx, m) =>
      Math.max(mx, (parseInt(String(m.id).replace('m','')) || 0) + 1), 1);
    _segNextId = (d.segments || []).reduce((mx, s) => Math.max(mx, (s.id || 0) + 1), 1);
    if (d.elements?.length) { renderAll(); }
    // Recovery: if session has no members but the project backup does, restore them
    if (!state.members?.length) {
      try {
        const backup = JSON.parse(localStorage.getItem('stagecoreProject') || '{}');
        if (backup.members?.length) {
          state.members = JSON.parse(JSON.stringify(backup.members));
          _memberNextId = state.members.reduce((mx, m) =>
            Math.max(mx, (parseInt(String(m.id).replace('m','')) || 0) + 1), 1);
        }
      } catch {}
    }
    renderMembersView();
    renderGear();
    renderRiderNeeds();
    renderSetlist();
  } catch(e) {
    loadSaved();
  }
}
function loadSaved() {
  try {
    const raw = localStorage.getItem('stagecoreProject');
    if (!raw) return;
    const d = JSON.parse(raw);
    // Only restore members, riderNeeds, lang — everything else starts fresh each session
    state.members = (d.schemaVersion >= 3) ? (d.members || []) : [];
    _memberNextId = state.members.reduce((max, m) => {
      const n = parseInt(String(m.id).replace('m', '')) || 0;
      return Math.max(max, n + 1);
    }, 1);
    if (d.schemaVersion >= 4) {
      if (d.riderNeeds && Array.isArray(d.riderNeeds)) {
        state.riderNeeds = d.riderNeeds;
        const maxId = d.riderNeeds.reduce((mx, n) => {
          const num = parseInt(String(n.id).replace('rn','')) || 0;
          return Math.max(mx, num + 1);
        }, state._rnNextId);
        state._rnNextId = maxId;
      }
      if (d.lang) {
        state.lang = d.lang;
      }
    }
    if (d.schemaVersion >= 5) {
      if (d.segments && Array.isArray(d.segments)) {
        state.segments = d.segments;
        _segNextId = state.segments.reduce((max, s) => Math.max(max, (s.id || 0) + 1), 1);
      }
      if (d.setlist && Array.isArray(d.setlist)) {
        state.setlist = d.setlist;
      }
    }
    if (d.schemaVersion >= 6) {
      if (d.timeline && Array.isArray(d.timeline)) {
        state.timeline = d.timeline;
      }
    }
    if (d.schemaVersion >= 7) {
      if (d.gear && Array.isArray(d.gear)) {
        state.gear = d.gear;
        _gearNextId = state.gear.reduce((max, g) => Math.max(max, (g.id || 0) + 1), 1);
      }
    }
    // Theme can be saved in any schema version
    if (d.theme && THEMES[d.theme]) {
      state.theme = d.theme;
      applyTheme(d.theme);
    }
    renderMembersView();
    renderGear();
    renderRiderNeeds();
    renderSetlist();
  } catch(e) {}
}

function exportCSV() {
  if (state.elements.length === 0) { showToast(T('noElemsToExport')); return; }
  // Headers adapt to current language
  const hdrs = state.lang === 'es'
    ? ['CH#','Etiqueta','Tipo','Fuente de Entrada','Salida','Phantom','Notas']
    : ['CH#','Label','Type','Input Source','Output','Phantom','Notes'];
  const rows = [hdrs];
  state.elements.forEach(el => rows.push([
    el.channelId, el.label, Ttype(el.type || el.name),
    TSource(el.source), el.output || 'FOH',
    el.phantom ? '+48V' : 'No', el.notes || ''
  ]));
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'stage-input-list.csv';
  a.click();
  showToast(T('csvExported'));
}

function _loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script'); s.src = src;
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
async function exportPDF() {
  // Lazy-load heavy PDF libs only when actually needed
  await Promise.all([
    window.html2canvas ? Promise.resolve() : _loadScript('/stage-core/vendor/html2canvas.min.js'),
    window.jspdf       ? Promise.resolve() : _loadScript('/stage-core/vendor/jspdf.umd.min.js'),
  ]);

  // Helper: html2canvas with a hard 12 s timeout so it can never freeze forever
  function canvasWithTimeout(el, opts) {
    return Promise.race([
      html2canvas(el, opts),
      new Promise((_, rej) => setTimeout(() => rej(new Error('html2canvas timeout')), 12000))
    ]);
  }

  // Show loading state on the Generate PDF button
  const genBtn = document.getElementById('exp-gen-pdf-btn');
  const mobBtn = document.getElementById('mob-exp-pdf-btn');
  const origHTML = genBtn ? genBtn.innerHTML : '';
  const origMob  = mobBtn ? mobBtn.innerHTML : '';
  if (genBtn) { genBtn.disabled = true; genBtn.innerHTML = '<span style="font-size:11px;letter-spacing:0.1em;">GENERATING…</span>'; }
  if (mobBtn) { mobBtn.disabled = true; }

  try {
    const { jsPDF } = window.jspdf;
    const source = document.getElementById('export-document');

    const CAPTURE_WIDTH = 900;
    const SCALE      = 1.5;
    const GAP_MM     = 8;

    const SECTION_IDS = [
      'exp-cover', 'exp-stage-section', 'exp-input-section',
      'exp-members-section', 'exp-connectivity-section',
      'exp-setlist-section', 'exp-lighting-section',
      'exp-notes-section', 'exp-gear-section', 'exp-footer'
    ];

    // ── 1. Build all clones in one pass ──
    const wraps = [];
    for (const id of SECTION_IDS) {
      const el = source.querySelector('#' + id);
      if (!el || el.style.display === 'none') continue;

      const wrap = document.createElement('div');
      wrap.style.cssText =
        `position:absolute;left:-9999px;top:0;width:${CAPTURE_WIDTH}px;` +
        `background:#0e0e0e;z-index:-9999;pointer-events:none;font-family:Inter,sans-serif;`;
      const clone = el.cloneNode(true);
      clone.style.margin = '0';
      // Give every section generous padding so text never clips
      if (!clone.style.padding || clone.style.padding === '0px') {
        clone.style.paddingTop    = '32px';
        clone.style.paddingBottom = '32px';
        clone.style.paddingLeft   = '28px';
        clone.style.paddingRight  = '28px';
      } else {
        clone.style.paddingTop    = '32px';
        clone.style.paddingBottom = '32px';
      }
      // Ensure all text wraps and never overflows
      clone.style.wordBreak     = 'break-word';
      clone.style.overflowWrap  = 'break-word';
      clone.style.overflow      = 'visible';
      clone.style.height        = 'auto';
      clone.style.maxHeight     = 'none';
      // Fix editable notes: remove fixed height so it fully expands
      clone.querySelectorAll('[contenteditable]').forEach(e => {
        e.setAttribute('contenteditable', 'false');
        e.style.minHeight  = 'auto';
        e.style.height     = 'auto';
        e.style.maxHeight  = 'none';
        e.style.overflow   = 'visible';
        e.style.wordBreak  = 'break-word';
        e.style.overflowWrap = 'break-word';
      });
      wrap.appendChild(clone);
      document.body.appendChild(wrap);
      wraps.push(wrap);
    }

    // ── 2. Two animation frames so all clones are painted ──
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    // ── 3. Capture each section (skip zero-height to avoid hangs) ──
    const sections = await Promise.all(wraps.map(wrap => {
      const h = Math.max(wrap.scrollHeight, 1);
      if (h <= 1) return Promise.resolve(null);
      return canvasWithTimeout(wrap, {
        scale: SCALE, useCORS: true, allowTaint: true,
        backgroundColor: '#0e0e0e', logging: false,
        width: CAPTURE_WIDTH, height: h,
        windowWidth: CAPTURE_WIDTH, windowHeight: h,
        imageTimeout: 8000,
        onclone: (doc) => {
          // Ensure all SVGs inside cloned doc are inlined and sized
          doc.querySelectorAll('svg').forEach(s => {
            if (!s.getAttribute('width'))  s.setAttribute('width',  s.getBoundingClientRect().width  || CAPTURE_WIDTH);
            if (!s.getAttribute('height')) s.setAttribute('height', s.getBoundingClientRect().height || 40);
          });
        }
      }).catch(() => null);
    }));

    // ── 4. Remove all clones ──
    wraps.forEach(w => { try { document.body.removeChild(w); } catch(_){} });

    // ── PDF layout ──────────────────────────────────────────
    const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();   // 210 mm
    const pdfH = pdf.internal.pageSize.getHeight();  // 297 mm

    // mm per source pixel  (cvs was rendered at SCALE×, so effective px = width*SCALE)
    const mmPerPx = pdfW / (CAPTURE_WIDTH * SCALE);

    let pageY     = 0;
    let firstPage = true;

    function fillBg() {
      pdf.setFillColor(14, 14, 14);
      pdf.rect(0, 0, pdfW, pdfH, 'F');
    }
    fillBg();

    function startNewPage() {
      pdf.addPage();
      fillBg();
      pageY = 0;
    }

    function placeSection(cvs) {
      const hMm    = cvs.height * mmPerPx;
      const imgData = cvs.toDataURL('image/jpeg', 0.94);

      if (hMm <= pdfH) {
        // ── Short section: keep whole, move to next page if needed ──
        if (pageY > 0 && pageY + hMm > pdfH) startNewPage();
        pdf.addImage(imgData, 'JPEG', 0, pageY, pdfW, hMm);
        pageY += hMm + GAP_MM;

      } else {
        // ── Tall section (e.g. long input list): tile cleanly ──
        let sliceTopPx = 0;

        while (sliceTopPx < cvs.height) {
          const availMm = pdfH - pageY;
          const availPx = availMm / mmPerPx;
          const slicePx = Math.min(availPx, cvs.height - sliceTopPx);

          // Draw the slice onto a temp canvas
          const sc  = document.createElement('canvas');
          sc.width  = cvs.width;
          sc.height = Math.ceil(slicePx);
          const ctx = sc.getContext('2d');
          ctx.fillStyle = '#0e0e0e';
          ctx.fillRect(0, 0, sc.width, sc.height);
          ctx.drawImage(cvs, 0, -sliceTopPx);

          const sliceHMm = slicePx * mmPerPx;
          pdf.addImage(sc.toDataURL('image/jpeg', 0.94), 'JPEG', 0, pageY, pdfW, sliceHMm);
          pageY    += sliceHMm;
          sliceTopPx += availPx;

          if (sliceTopPx < cvs.height) startNewPage();
        }
        pageY += GAP_MM;
      }
    }

    for (const cvs of sections) { if (cvs) placeSection(cvs); }

    const projectName = (document.getElementById('exp-project-name') || {}).textContent || 'STAGE_CORE_V1';
    pdf.save(projectName.trim().replace(/\s+/g, '_') + '_Export.pdf');
    showToast(T('pdfSaved'));
  } catch (err) {
    console.error('PDF export error:', err);
    showToast(T('pdfFailed'));
  } finally {
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = origHTML; }
    if (mobBtn) { mobBtn.disabled = false; mobBtn.innerHTML = origMob; }
  }
}

function setExportFormat() {
  state.exportFormat = 'pdf';
}

function toggleExportSection(sectionId, visible) {
  const el = document.getElementById(sectionId);
  if (el) el.style.display = visible ? '' : 'none';
}

// ── Bottom-bar chip toggle ────────────────────────────────────
function toggleExpChip(sectionId, chipId) {
  const chip = document.getElementById(chipId);
  if (!chip) return;
  const isOn = chip.classList.toggle('exp-chip--on');
  const el = document.getElementById(sectionId);
  if (el) el.style.display = isOn ? '' : 'none';
  // Keep drawer toggle in sync if drawer is open
  const drawer = document.getElementById('exp-options-drawer');
  if (drawer && drawer.classList.contains('exp-options-open')) {
    const map = {
      'exp-stage-section':   'drw-tog-stage',
      'exp-input-section':   'drw-tog-input',
      'exp-notes-section':   'drw-tog-notes',
      'exp-gear-section':    'drw-tog-gear',
      'exp-lighting-section':'drw-tog-lighting',
    };
    const togId = map[sectionId];
    if (togId) {
      const tog = document.getElementById(togId);
      if (tog) {
        tog.textContent = isOn ? 'toggle_on' : 'toggle_off';
        tog.style.color = isOn ? 'var(--accent)' : '#3a3a3a';
      }
    }
  }
}

// Sync a single drawer row icon from section visibility
function syncDrawerRow(sectionId, togId) {
  const sec = document.getElementById(sectionId);
  const tog = document.getElementById(togId);
  if (!sec || !tog) return;
  const isOn = sec.style.display !== 'none';
  tog.textContent = isOn ? 'toggle_on' : 'toggle_off';
  tog.style.color = isOn ? 'var(--accent)' : '#3a3a3a';
}

// Open/close the options drawer and sync all rows on open
function toggleExportOptions() {
  const drawer = document.getElementById('exp-options-drawer');
  const btn    = document.getElementById('exp-opts-btn');
  if (!drawer) return;
  const isOpen = drawer.classList.toggle('exp-options-open');
  if (btn) btn.style.background = isOpen ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
  if (!isOpen) return;
  // Sync all drawer toggles from current section visibility
  [
    ['exp-stage-section',    'drw-tog-stage'],
    ['exp-input-section',    'drw-tog-input'],
    ['exp-notes-section',    'drw-tog-notes'],
    ['exp-gear-section',     'drw-tog-gear'],
    ['exp-lighting-section', 'drw-tog-lighting'],
  ].forEach(([secId, togId]) => {
    const sec = document.getElementById(secId);
    const tog = document.getElementById(togId);
    if (!sec || !tog) return;
    const isOn = sec.style.display !== 'none';
    tog.textContent = isOn ? 'toggle_on' : 'toggle_off';
    tog.style.color = isOn ? 'var(--accent)' : '#3a3a3a';
  });
}

// ── Export bar scroll-hide wiring ────────────────────────────
function shareLink() {
  navigator.clipboard.writeText(window.location.href).catch(() => {});
  showToast(T('linkCopied'));
}

function refreshExport() {
  const now = new Date();
  const locale = state.lang === 'es' ? 'es-MX' : 'en-US';
  const dateStr = now.toLocaleDateString(locale, { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
  const dateEl = document.getElementById('exp-date');
  if (dateEl) dateEl.textContent = dateStr;
  // Sync topbar name to the editable project name
  const topbarName = document.getElementById('exp-topbar-name');
  const projName   = document.getElementById('exp-project-name');
  if (topbarName && projName) topbarName.textContent = projName.textContent || 'Technical Rider';

  const elCount = document.getElementById('exp-el-count');
  if (elCount) elCount.textContent = state.elements.length;
  const elStatus = document.getElementById('exp-element-status');
  if (elStatus) {
    const n = state.elements.length;
    elStatus.textContent = n + ' ' + (n === 1 ? T('elementSingular') : T('elements')) + ' — ' + T('elementsOnStage');
  }

  refreshExportCanvas();
  refreshExportInputList();
  refreshExportMembers();
  refreshExportConnectivity();
  refreshExportSetlist();
  refreshExportGear();
  const footerDate = document.getElementById('exp-footer-date');
  if (footerDate) footerDate.textContent = dateStr;

  // ── Last Updated / Version ────────────────────────────────
  const showLU = state.showLastUpdated !== false;
  const luBox     = document.getElementById('exp-last-updated-box');
  const verBox    = document.getElementById('exp-version-box');
  const staleWarn = document.getElementById('exp-stale-warning');
  const luFooter  = document.getElementById('exp-footer-last-updated');

  if (luBox)  luBox.style.display  = showLU ? '' : 'none';
  if (verBox) verBox.style.display = showLU ? 'inline-flex' : 'none';
  if (staleWarn) staleWarn.style.display = 'none';
  if (luFooter)  luFooter.style.display  = showLU ? '' : 'none';

  if (showLU && state.lastModified) {
    const lm = new Date(state.lastModified);
    const luStr = lm.toLocaleDateString(locale, { month: 'short', day: '2-digit', year: 'numeric' })
                + ' – ' + lm.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
    const luEl = document.getElementById('exp-last-updated');
    if (luEl) luEl.textContent = luStr.toUpperCase();
    if (luFooter) luFooter.textContent = ('LAST UPDATED: ' + luStr).toUpperCase();
    // Stale warning: if last modified > 30 days ago
    if (staleWarn) {
      const daysSince = (Date.now() - lm.getTime()) / 86400000;
      staleWarn.style.display = daysSince > 30 ? '' : 'none';
    }
  } else if (showLU) {
    const luEl = document.getElementById('exp-last-updated');
    if (luEl) luEl.textContent = '—';
    if (luFooter) luFooter.textContent = '';
  }

  const versionEl = document.getElementById('exp-version');
  if (versionEl) versionEl.textContent = showLU ? 'v' + (state.plotVersion || 1) : '';
  const versionInput = document.getElementById('exp-version-input');
  if (versionInput) versionInput.value = state.plotVersion || 1;

  // Sync the export options toggle
  const luToggle = document.getElementById('exp-show-lu-toggle');
  if (luToggle) luToggle.classList.toggle('on', showLU);
  // Sync the settings panel toggle
  const settingsLuToggle = document.getElementById('settings-lu-toggle');
  if (settingsLuToggle) settingsLuToggle.classList.toggle('on', showLU);

  const notesEl = document.getElementById('exp-notes-text');
  if (notesEl && state.exportNotes !== undefined) {
    notesEl.textContent = state.exportNotes;
  }
  applyTranslations();
  _initExportSwipeBack();
}

function refreshExportCanvas() {
  const wrap = document.getElementById('exp-canvas-wrap');
  const layer = document.getElementById('exp-canvas-elements');
  const empty = document.getElementById('exp-canvas-empty');
  if (!wrap || !layer) return;

  layer.innerHTML = '';

  if (state.elements.length === 0) {
    wrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  wrap.style.display = 'block';
  if (empty) empty.style.display = 'none';

  // Use the saved real canvas dimensions for 1:1 position mapping
  const refW = state.canvasW || stageCanvas.offsetWidth || 650;
  const refH = state.canvasH || stageCanvas.offsetHeight || 420;

  // Set the mini canvas height to match the real canvas aspect ratio
  // so elements appear in the same relative layout as the editor
  const containerW = wrap.offsetWidth || 900;
  const miniH = Math.round(containerW * (refH / refW));
  // Clamp between 160px and 300px so it doesn't become absurd
  wrap.style.height = Math.min(300, Math.max(160, miniH)) + 'px';

  state.elements.forEach(el => {
    const pctX = el.x / refW;
    const pctY = el.y / refH;

    const dot = document.createElement('div');
    dot.style.cssText = `
      position:absolute;
      left:${pctX * 100}%;
      top:${pctY * 100}%;
      transform:translate(-50%,-50%);
      display:flex;flex-direction:column;align-items:center;
      pointer-events:none;
    `;

    const exportRoles = el.roles || [];
    const exportAll = [el, ...exportRoles];
    const exportSz = exportAll.length > 1 ? 14 : 26;
    const icoWrap = document.createElement('div');
    icoWrap.style.cssText = `display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:2px;max-width:${exportAll.length > 1 ? '36px' : '30px'};color:${el.color || '#7aafff'};filter:drop-shadow(0 0 4px ${el.color || '#7aafff'}88);`;
    exportAll.forEach(r => {
      const tmp = document.createElement('div');
      tmp.innerHTML = iconHtml(r.icon, exportSz);
      icoWrap.appendChild(tmp.firstChild);
    });
    const ico = icoWrap;

    const lbl = document.createElement('div');
    lbl.style.cssText = `
      font-family:Inter,Arial,sans-serif;font-size:10px;font-weight:700;
      color:${el.color || '#7aafff'};text-transform:uppercase;
      margin-top:5px;text-align:center;letter-spacing:0.04em;
      max-width:100px;word-break:break-word;line-height:1.2;
    `;
    lbl.textContent = el.label;

    dot.appendChild(ico);
    dot.appendChild(lbl);
    layer.appendChild(dot);
  });
  // Draw connection lines over the mini stage — clean curved style matching the editor
  if (state.connections.length > 0) {
    const connSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;');

    // Per-color arrowhead markers for the mini export canvas
    const cDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    connSvg.appendChild(cDefs);
    const _expMarkers = new Set();
    function _ensureExpMarker(color) {
      if (_expMarkers.has(color)) return;
      _expMarkers.add(color);
      const safe = color.replace(/[^a-z0-9]/gi, '_');
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', 'exp_arr_' + safe);
      m.setAttribute('markerWidth', '6'); m.setAttribute('markerHeight', '6');
      m.setAttribute('refX', '5.5'); m.setAttribute('refY', '3');
      m.setAttribute('orient', 'auto'); m.setAttribute('markerUnits', 'strokeWidth');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M0,0 L0,6 L6,3 z'); p.setAttribute('fill', color);
      m.appendChild(p); cDefs.appendChild(m);
    }

    state.connections.forEach((c, idx) => {
      const a = state.elements.find(e => e.id === c.from);
      const b = state.elements.find(e => e.id === c.to);
      if (!a || !b) return;

      const lineColor = a.color || '#ff7439';
      _ensureExpMarker(lineColor);
      const markerId = 'exp_arr_' + lineColor.replace(/[^a-z0-9]/gi, '_');

      // Convert absolute px coords → percentage coords inside the mini canvas
      const x1 = a.x / refW * 100, y1 = a.y / refH * 100;
      const x2 = b.x / refW * 100, y2 = b.y / refH * 100;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const offset = Math.min(8, len * 0.14) * (idx % 2 === 0 ? 1 : -1);
      const cpx = (x1+x2)/2 - (dy/len)*offset;
      const cpy = (y1+y2)/2 + (dx/len)*offset;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1}% ${y1}% Q ${cpx}% ${cpy}% ${x2}% ${y2}%`);
      path.setAttribute('stroke', lineColor);
      path.setAttribute('stroke-opacity', '0.6');
      path.setAttribute('stroke-width', '1.2');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('marker-end', `url(#${markerId})`);
      connSvg.appendChild(path);

      // Small filled origin dot in source color
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x1 + '%'); dot.setAttribute('cy', y1 + '%'); dot.setAttribute('r', '0.7%');
      dot.setAttribute('fill', lineColor); dot.setAttribute('fill-opacity', '0.75');
      connSvg.appendChild(dot);
    });

    wrap.appendChild(connSvg);
  }

  lcIcons();
}

function refreshExportInputList() {
  const tbody = document.getElementById('exp-input-tbody');
  const empty = document.getElementById('exp-input-empty');
  if (!tbody) return;

  if (state.elements.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...state.elements].sort((a, b) => a.channelId.localeCompare(b.channelId));
  tbody.innerHTML = sorted.map((el, i) => {
    const micDI = Ttype(el.type || el.name) || '—';
    const source = TSource(el.source) || el.source || '—';
    const rolesCount = (el.roles || []).length;
    const member = _getMember(el.memberId);
    const performerCell = member
      ? `<div style="display:flex;align-items:center;gap:5px;"><div style="width:7px;height:7px;border-radius:50%;background:${member.color};flex-shrink:0;"></div><span style="font-size:12px;color:${member.color};font-weight:700;">${member.name}</span></div>`
      : '<span style="color:#484847;font-size:12px;">—</span>';
    let rows = `
    <tr style="background:${i % 2 === 0 ? '#131313' : '#0e0e0e'};">
      <td style="padding:10px 14px;font-family:'Space Grotesk';font-size:15px;font-weight:700;color:#7aafff;">${el.channelId || '—'}</td>
      <td style="padding:10px 14px;font-weight:600;color:#fff;font-size:13px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:10px;height:10px;background:${el.color || '#7aafff'};flex-shrink:0;"></div>
          ${el.label}${rolesCount > 0 ? `<span style="font-size:9px;color:#484847;margin-left:4px;">[+${rolesCount} ${rolesCount > 1 ? T('rolePlural') : T('role')}]</span>` : ''}
        </div>
      </td>
      <td style="padding:10px 14px;">${performerCell}</td>
      <td style="padding:10px 14px;color:#adaaaa;font-size:12px;">${micDI}</td>
      <td style="padding:10px 14px;color:#c5ffc9;font-size:12px;font-family:'Space Grotesk';">${source}</td>
      <td style="padding:10px 14px;color:#767575;font-size:12px;font-style:italic;">${el.notes || '—'}</td>
    </tr>`;
    (el.roles || []).forEach(role => {
      const roleSrc = TSource(role.source) || role.source || '—';
      rows += `
      <tr style="background:${i % 2 === 0 ? '#0f0f0f' : '#0a0a0a'};">
        <td style="padding:6px 14px 6px 26px;font-family:'Space Grotesk';font-size:12px;color:#7aafff;">
          <span style="color:#333;margin-right:4px;">↳</span>${role.channelId || '—'}
        </td>
        <td style="padding:6px 14px 6px 26px;font-weight:500;color:#adaaaa;font-size:11px;">${role.name}</td>
        <td style="padding:6px 14px;color:#484847;font-size:11px;">—</td>
        <td style="padding:6px 14px;color:#adaaaa;font-size:11px;">${Ttype(role.type)}</td>
        <td style="padding:6px 14px;color:#c5ffc9;font-size:11px;font-family:'Space Grotesk';">${roleSrc}</td>
        <td style="padding:6px 14px;color:#484847;font-size:11px;font-style:italic;">${role.notes || '—'}</td>
      </tr>`;
    });
    return rows;
  }).join('');
}

function refreshExportMembers() {
  const section = document.getElementById('exp-members-section');
  const body = document.getElementById('exp-members-body');
  if (!section || !body) return;
  if (state.members.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  // Build a grid: each member card shows name, color, and assigned elements
  const cards = state.members.map(m => {
    const assigned = state.elements.filter(el => el.memberId === m.id);
    const items = assigned.length > 0
      ? assigned.map(el => `<div style="font-size:11px;color:#adaaaa;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.04);">${el.label || el.name}${el.channelId ? ' <span style="color:#7aafff;">CH' + el.channelId + '</span>' : ''}</div>`).join('')
      : `<div style="font-size:10px;color:#484847;padding:2px 0;font-style:italic;">${T('noAssignments')}</div>`;
    return `
      <div style="background:#131313;border-left:3px solid ${m.color};padding:14px 16px;flex:1;min-width:140px;max-width:220px;">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${m.color};flex-shrink:0;"></div>
          <span style="font-family:'Space Grotesk';font-size:13px;font-weight:800;color:#fff;text-transform:uppercase;">${m.name}</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:7px;">${items}</div>
      </div>`;
  }).join('');
  body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;">${cards}</div>`;
}

function refreshExportConnectivity() {
  const body = document.getElementById('exp-connectivity-body');
  if (!body) return;

  const sources = [...new Set(state.elements.map(e => e.source).filter(Boolean))];
  const outputs = [...new Set(state.elements.map(e => e.output).filter(Boolean))];
  const phantomCount = state.elements.filter(e => e.phantom).length;
  const connCount = state.connections.length;

  if (state.elements.length === 0 && state.riderNeeds.length === 0) {
    body.innerHTML = `<p style="font-size:12px;color:#484847;font-style:italic;margin:0;">${T('noElems')}</p>`;
    return;
  }

  let signalHtml = '';
  if (state.elements.length > 0) {
    // Signal patch list rows
    const patchRows = connCount > 0
      ? state.connections.map((c, i) => {
          const a = state.elements.find(e => e.id === c.from);
          const b = state.elements.find(e => e.id === c.to);
          const cableType = c.type || 'xlr';
          const cableColor = cableType === 'power' ? '#ffb347' : cableType === 'quarter' ? '#a8ff7a' : '#22d3ee';
          const cableLabel = CABLE_LABELS[cableType] || cableType;
          return `<div style="display:flex;align-items:center;gap:12px;padding:7px 12px;background:${i % 2 === 0 ? '#111' : '#131313'};border-left:2px solid rgba(122,175,255,0.25);">
            <span style="font-size:10px;font-weight:900;color:#484847;min-width:22px;flex-shrink:0;">${String(i + 1).padStart(2, '0')}</span>
            <span style="font-size:12px;font-weight:700;color:#e0e0e0;flex:1;text-transform:uppercase;letter-spacing:0.04em;">${a ? a.label : '?'}</span>
            <span style="font-size:14px;color:#7aafff;flex-shrink:0;font-weight:900;">⟶</span>
            <span style="font-size:12px;font-weight:700;color:#e0e0e0;flex:1;text-transform:uppercase;letter-spacing:0.04em;">${b ? b.label : '?'}</span>
            <span style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${cableColor};border:1px solid ${cableColor}44;padding:2px 5px;flex-shrink:0;">${cableLabel}</span>
          </div>`;
        }).join('')
      : `<div style="padding:14px 12px;color:#484847;font-size:11px;font-style:italic;font-weight:600;">${T('noConns')}</div>`;

    const statsBlock = `<div style="padding:12px 14px;border-left:2px solid #c5ffc9;background:#131313;">
      <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#c5ffc9;margin:0 0 6px;">${T('signalSummary')}</p>
      <p style="font-size:12px;color:#adaaaa;margin:0;line-height:1.9;">${T('phantomCh')}: ${phantomCount}<br>${T('signalPaths')}: ${connCount}<br>${T('totalEl')}: ${state.elements.length}</p>
    </div>`;

    const inputBlock = sources.length > 0
      ? `<div style="padding:12px 14px;border-left:2px solid #7aafff;background:#131313;">
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#7aafff;margin:0 0 6px;">${T('activeInputs')} (${sources.length})</p>
          <p style="font-size:12px;color:#adaaaa;margin:0;line-height:1.9;">${sources.map(s => inputSourceLabels[s] || s).join('<br>')}</p>
         </div>`
      : `<div></div>`;

    const outputBlock = outputs.length > 0
      ? `<div style="padding:12px 14px;border-left:2px solid #ff7439;background:#131313;">
          <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#ff7439;margin:0 0 6px;">${T('outputRoutes')} (${outputs.length})</p>
          <p style="font-size:12px;color:#adaaaa;margin:0;line-height:1.9;">${outputs.join('<br>')}</p>
         </div>`
      : `<div></div>`;

    signalHtml = `
      <div style="margin-bottom:10px;">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#7aafff;margin:0 0 6px;">${T('signalPatch')} (${connCount})</p>
        <div style="border:1px solid rgba(72,72,71,0.3);">${patchRows}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">${inputBlock}${outputBlock}${statsBlock}</div>`;
  }

  // Technical Requirements block from riderNeeds
  let reqsHtml = '';
  if (state.riderNeeds.length > 0) {
    const cards = state.riderNeeds.map(need => {
      const nt = NEED_TYPES[need.type] || NEED_TYPES.custom;
      const lbl = state.lang === 'es' ? (nt.labelEs || nt.label) : nt.label;
      return `<div style="padding:12px 14px;background:#131313;border-left:2px solid ${nt.color};">
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${nt.color};margin:0 0 6px;">${lbl}</p>
        <p style="font-size:12px;color:#adaaaa;margin:0;line-height:1.7;word-break:break-word;overflow-wrap:break-word;">${need.value || '—'}</p>
      </div>`;
    }).join('');
    reqsHtml = `
      <div>
        <p style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#c8a2ff;margin:0 0 6px;">${T('riderReqs')}</p>
        <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>
      </div>`;
  }

  body.innerHTML = signalHtml + reqsHtml;
}

function saveExportNotes() {
  const el = document.getElementById('exp-notes-text');
  if (el) state.exportNotes = el.textContent || el.innerText;
}

function refreshExportSetlist() {
  const container = document.getElementById('exp-setlist-items');
  if (!container) return;
  const segMap = Object.fromEntries((state.segments||[]).map(s => [s.id, s]));
  let html = '';
  let lastSegId = '__INIT__';
  state.setlist.forEach((s, i) => {
    const curSegId = s.segmentId || '';
    if (curSegId !== lastSegId) {
      if (curSegId && segMap[curSegId]) {
        const seg = segMap[curSegId];
        html += `<div style="padding:6px 0 3px;margin-top:4px;border-left:2px solid ${seg.color};padding-left:6px;">
          <span style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;color:${seg.color};">${seg.name}</span>
        </div>`;
      }
      lastSegId = curSegId;
    }
    html += `<div style="display:flex;align-items:baseline;gap:10px;padding:4px 0;border-bottom:1px solid rgba(72,72,71,0.12);">
      <span style="font-size:10px;font-weight:900;color:#484847;min-width:20px;">${String(i+1).padStart(2,'0')}.</span>
      <span style="font-size:12px;font-weight:600;color:#fff;flex:1;text-transform:uppercase;">${s.title}</span>
      <span style="font-size:10px;color:#767575;">${s.duration}</span>
    </div>`;
  });
  container.innerHTML = html;
}

function saveProjectFile() {
  const data = JSON.stringify({ schemaVersion: 5, elements: state.elements, connections: state.connections, setlist: state.setlist, segments: state.segments, gear: state.gear, members: state.members, riderNeeds: state.riderNeeds, lang: state.lang }, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
  a.download = 'stage-core-project.json';
  a.click();
  showToast(T('fileDownloaded'));
}

function loadProjectFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      state.elements = d.elements || [];
      state.connections = d.connections || [];
      state.setlist = d.setlist || state.setlist;
      state.gear = d.gear || state.gear;
      state.members = (d.schemaVersion >= 3) ? (d.members || []) : state.members;
      if (d.schemaVersion >= 4) {
        if (d.riderNeeds) state.riderNeeds = d.riderNeeds;
        if (d.lang) { state.lang = d.lang; setLang(d.lang); }
      }
      if (d.schemaVersion >= 5) {
        state.segments = d.segments || [];
        _segNextId = state.segments.reduce((max, s) => Math.max(max, (s.id || 0) + 1), 1);
      }
      state.nextId = state.elements.reduce((max, el) => {
        const n = parseInt(el.id.replace('el-','')) || 0;
        return Math.max(max, n + 1);
      }, 1);
      _gearNextId = state.gear.reduce((max, g) => Math.max(max, (g.id || 0) + 1), 1);
      _memberNextId = state.members.reduce((max, m) => {
        const n = parseInt(String(m.id).replace('m','')) || 0;
        return Math.max(max, n + 1);
      }, 1);
      state.selectedId = null;
      renderAll();
      renderGear();
      renderMembersView();
      updateDropHint();
      pushHistory();
      showToast(T('fileLoaded'));
      switchView('Editor');
    } catch { showToast(T('fileLoadFail')); }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveProject(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedId) { removeSelected(); }
  }
  if (e.key === 'Escape') {
    deselectAll();
    if (state.connectSource) { state.connectSource = null; _setConnectBanner(null); renderConnections(); }
    if (state.connectMode) { state.connectMode = false; state.connectSource = null; _setConnectBanner(null); toggleConnect(); toggleConnect(); }
  }
});

// ══════════════════════════════════════════════════════════
//  MOUSE COORDS
// ══════════════════════════════════════════════════════════
// RAF-throttled mousemove: getBoundingClientRect on every mousemove event
// causes forced layout at 500+ fps — throttle to one read per animation frame
let _mmRaf = null;
stageCanvas.addEventListener('mousemove', e => {
  if (_mmRaf) return;
  _mmRaf = requestAnimationFrame(() => {
    _mmRaf = null;
    const rect = stageCanvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / state.zoom);
    const y = Math.round((e.clientY - rect.top) / state.zoom);
    const coords = document.getElementById('status-coords');
    if (coords) coords.textContent = `X: ${x} | Y: ${y}`;
  });
}, { passive: true });

// ══════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════
function showToast(msg) {
  const c = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  c.appendChild(div);
  setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 1500);
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
// Session data is preserved across reloads (autosave enabled)

// (beforeunload warning removed — reload without prompting)

setLang(state.lang);
updateDropHint();
updateHistoryButtons();
pushHistory();
renderSetlist();

// ══════════════════════════════════════════════════════════
//  SETTINGS — persistence
// ══════════════════════════════════════════════════════════
const SETTINGS_KEY = 'stagecoreSettings';

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      navOrder: state.navOrder,
      gridSize: state.gridSize,
      canvasBg: state.canvasBg,
      showStatusBar: state.showStatusBar,
      snapToGrid: state.snapToGrid,
      connectionsVisible: state.connectionsVisible,
      labelsVisible: state.labelsVisible,
      connLineStyle: state.connLineStyle,
      reducedAnimations: state.reducedAnimations,
      amoled: state.amoled,
      gigMode: state.gigMode,
      smartSuggestionsEnabled: state.smartSuggestionsEnabled,
      stageBalanceVisible: state.stageBalanceVisible,
      smIntelligenceEnabled: state.smIntelligenceEnabled,
      smAutoOptEnabled: state.smAutoOptEnabled,
      smConflictEnabled: state.smConflictEnabled,
      smPredictEnabled: state.smPredictEnabled,
      showLastUpdated: state.showLastUpdated,
    }));
  } catch(e) {}
  scheduleCloudAutosave();
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (Array.isArray(s.navOrder) && s.navOrder.length === 5) state.navOrder = s.navOrder;
    if (s.gridSize) state.gridSize = s.gridSize;
    if (s.canvasBg) state.canvasBg = s.canvasBg;
    /* showStatusBar intentionally not restored — always hidden in embedded view */
    if (s.snapToGrid !== undefined) state.snapToGrid = s.snapToGrid;
    if (s.connectionsVisible !== undefined) state.connectionsVisible = s.connectionsVisible;
    if (s.labelsVisible !== undefined) state.labelsVisible = s.labelsVisible;
    if (s.connLineStyle) state.connLineStyle = s.connLineStyle;
    if (s.reducedAnimations !== undefined) state.reducedAnimations = s.reducedAnimations;
    if (s.amoled !== undefined) state.amoled = s.amoled;
    if (s.gigMode !== undefined) state.gigMode = s.gigMode;
    if (s.smartSuggestionsEnabled !== undefined) state.smartSuggestionsEnabled = s.smartSuggestionsEnabled;
    if (s.stageBalanceVisible !== undefined) state.stageBalanceVisible = s.stageBalanceVisible;
    if (s.smIntelligenceEnabled !== undefined) state.smIntelligenceEnabled = s.smIntelligenceEnabled;
    if (s.smAutoOptEnabled !== undefined) state.smAutoOptEnabled = s.smAutoOptEnabled;
    if (s.smConflictEnabled !== undefined) state.smConflictEnabled = s.smConflictEnabled;
    if (s.smPredictEnabled !== undefined) state.smPredictEnabled = s.smPredictEnabled;
    if (s.showLastUpdated !== undefined) state.showLastUpdated = s.showLastUpdated;
  } catch(e) {}
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — apply to DOM
// ══════════════════════════════════════════════════════════
// ── Export navigation helpers ─────────────────────────────────
function leaveExport() {
  // Close options drawer before leaving
  const drawer = document.getElementById('exp-options-drawer');
  const btn    = document.getElementById('exp-opts-btn');
  if (drawer) drawer.classList.remove('exp-options-open');
  if (btn) btn.style.background = 'rgba(255,255,255,0.05)';
  const target = state.prevView || 'Editor';
  switchView(target);
}

// Exposed for the React wrapper and Android back button
window.stageGoBack = function() {
  if (state.currentView === 'Export') { leaveExport(); return true; }
  if (state.currentView === 'Rider' || state.currentView === 'Setlist' ||
      state.currentView === 'Gear' || state.currentView === 'Members') {
    switchView('SetupHub'); return true;
  }
  if (state.currentView === 'SetupHub' || state.currentView === 'Preferences' || state.currentView === 'Assistant') {
    switchView('Editor'); return true;
  }
  return false;
};

function _initExportSwipeBack() {
  const scroll = document.getElementById('export-preview-scroll');
  if (!scroll || scroll._swipeBackInit) return;
  scroll._swipeBackInit = true;
  let startX = 0, startY = 0, triggered = false;
  scroll.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    triggered = false;
  }, { passive: true });
  scroll.addEventListener('touchmove', function(e) {
    if (triggered) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    // Swipe right from left edge (first 40px) with more horizontal than vertical movement
    if (startX < 40 && dx > 60 && dy < 80) {
      triggered = true;
      leaveExport();
    }
  }, { passive: true });
}

function _applyAmoled(on) {
  if (on) {
    document.documentElement.setAttribute('data-amoled', '1');
  } else {
    document.documentElement.removeAttribute('data-amoled');
  }
}

function toggleAmoled() {
  state.amoled = !state.amoled;
  _applyAmoled(state.amoled);
  const toggle = document.getElementById('settings-amoled-toggle');
  if (toggle) toggle.classList.toggle('on', state.amoled);
  saveSettings();
  showToast(state.amoled ? 'AMOLED mode on' : 'AMOLED mode off');
}

function applySettings() {
  // Canvas background is intentionally NOT set here.
  // The CSS rule (#stage-canvas / html[data-theme="light"] #stage-canvas) sets the correct
  // initial color before first paint, and injectTheme() from the React parent corrects it
  // after the iframe loads. Setting it here would cause a flash when the saved bg is cross-theme.

  // Grid size: update CSS background-size
  _applyGridSize(state.gridSize);

  // Status bar
  const sb = document.getElementById('status-bar');
  if (sb) sb.style.display = state.showStatusBar ? 'flex' : 'none';
  const sbToggle = document.getElementById('settings-sb-toggle');
  if (sbToggle) sbToggle.classList.toggle('on', state.showStatusBar);

  // Connections visibility
  const connSvg = document.getElementById('connections-svg');
  if (connSvg) connSvg.style.display = state.connectionsVisible ? '' : 'none';
  const connToggle = document.getElementById('settings-conn-toggle');
  if (connToggle) connToggle.classList.toggle('on', state.connectionsVisible);

  // Snap to grid
  const snapToggle = document.getElementById('settings-snap-toggle');
  if (snapToggle) snapToggle.classList.toggle('on', state.snapToGrid);

  // Labels visibility
  document.querySelectorAll('.el-label').forEach(el => {
    el.style.display = state.labelsVisible ? '' : 'none';
  });
  const lblToggle = document.getElementById('settings-labels-toggle');
  if (lblToggle) lblToggle.classList.toggle('on', state.labelsVisible);

  // Connection line style chips
  document.querySelectorAll('.setting-chip[data-ls]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ls === state.connLineStyle);
  });

  // AMOLED mode
  _applyAmoled(state.amoled);
  const amoledToggle = document.getElementById('settings-amoled-toggle');
  if (amoledToggle) amoledToggle.classList.toggle('on', state.amoled);

  // Reduced animations
  document.documentElement.classList.toggle('reduced-motion', state.reducedAnimations);
  const animToggle = document.getElementById('settings-anim-toggle');
  if (animToggle) animToggle.classList.toggle('on', !state.reducedAnimations);

  // Smart Suggestions
  const ssToggle = document.getElementById('settings-ss-toggle');
  if (ssToggle) ssToggle.classList.toggle('on', state.smartSuggestionsEnabled);

  // Stage Balance Visualizer
  const sbvToggle = document.getElementById('settings-sbv-toggle');
  if (sbvToggle) sbvToggle.classList.toggle('on', state.stageBalanceVisible);
  requestAnimationFrame(updateStageBalance);

  // StageMind Intelligence toggles
  const smiToggle = document.getElementById('settings-smi-toggle');
  if (smiToggle) smiToggle.classList.toggle('on', state.smIntelligenceEnabled);
  const smiSub = document.getElementById('smi-sub-toggles');
  if (smiSub) smiSub.style.opacity = state.smIntelligenceEnabled ? '1' : '0.4';
  const smiAoToggle = document.getElementById('settings-smi-ao-toggle');
  if (smiAoToggle) smiAoToggle.classList.toggle('on', state.smAutoOptEnabled);
  const smiCdToggle = document.getElementById('settings-smi-cd-toggle');
  if (smiCdToggle) smiCdToggle.classList.toggle('on', state.smConflictEnabled);
  const smiPsToggle = document.getElementById('settings-smi-ps-toggle');
  if (smiPsToggle) smiPsToggle.classList.toggle('on', state.smPredictEnabled);

  // Last Updated in Exports
  const luToggle = document.getElementById('settings-lu-toggle');
  if (luToggle) luToggle.classList.toggle('on', state.showLastUpdated !== false);
  const expLuToggle = document.getElementById('exp-show-lu-toggle');
  if (expLuToggle) expLuToggle.classList.toggle('on', state.showLastUpdated !== false);

  // Gig Mode
  _applyGigMode();
}

function _applyGridSize(size) {
  const sc = document.getElementById('stage-canvas');
  if (!sc) return;
  const isMobile = window.innerWidth <= 767;
  const displaySize = isMobile ? Math.round(size / 2) : size;
  const minor = displaySize / 4;
  sc.style.backgroundSize = `${displaySize}px ${displaySize}px, ${displaySize}px ${displaySize}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — nav re-render
// ══════════════════════════════════════════════════════════
function renderNav() {
  const nav = document.getElementById('desktop-nav');
  if (!nav) return;
  nav.innerHTML = '';
  state.navOrder.forEach(view => {
    const btn = document.createElement('button');
    btn.className = 'nav-link font-headline font-bold tracking-tight uppercase text-sm';
    btn.dataset.view = view;
    btn.textContent = view;
    if (view === state.currentView) btn.classList.add('active');
    btn.addEventListener('click', () => switchView(view));
    nav.appendChild(btn);
  });
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — nav drag-and-drop list
// ══════════════════════════════════════════════════════════
function renderSettingsNavList() {
  const list = document.getElementById('settings-nav-list');
  if (!list) return;
  list.innerHTML = '';
  let dragSrcView = null;

  state.navOrder.forEach(view => {
    const li = document.createElement('li');
    li.className = 'nav-order-item';
    li.draggable = true;
    li.dataset.view = view;
    li.innerHTML = `<span class="material-symbols-outlined drag-handle">drag_indicator</span><span>${view}</span>`;

    li.addEventListener('dragstart', e => {
      dragSrcView = view;
      li.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.style.opacity = '1';
      list.querySelectorAll('.nav-order-item').forEach(el => el.classList.remove('drag-over'));
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.nav-order-item').forEach(el => el.classList.remove('drag-over'));
      if (view !== dragSrcView) li.classList.add('drag-over');
    });
    li.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrcView || dragSrcView === view) return;
      const fromIdx = state.navOrder.indexOf(dragSrcView);
      const toIdx   = state.navOrder.indexOf(view);
      if (fromIdx === -1 || toIdx === -1) return;
      state.navOrder.splice(fromIdx, 1);
      state.navOrder.splice(toIdx, 0, dragSrcView);
      dragSrcView = null;
      renderNav();
      renderSettingsNavList();
      saveSettings();
    });

    list.appendChild(li);
  });
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — canvas background
// ══════════════════════════════════════════════════════════
function updateCanvasBg(color) {
  state.canvasBg = color;
  const sc = document.getElementById('stage-canvas');
  if (sc) sc.style.backgroundColor = color;
  // Update swatch active states
  document.querySelectorAll('#settings-canvas-bg .bg-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bg === color);
  });
  saveSettings();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — grid size
// ══════════════════════════════════════════════════════════
function updateGridSize(size) {
  state.gridSize = size;
  _applyGridSize(size);
  // Update chip active states (selector is document-wide; old #settings-panel is hidden)
  document.querySelectorAll('.setting-chip[data-gs]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.gs) === size);
  });
  saveSettings();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — status bar toggle
// ══════════════════════════════════════════════════════════
function toggleStatusBarVis() {
  state.showStatusBar = !state.showStatusBar;
  const sb = document.getElementById('status-bar');
  if (sb) sb.style.display = state.showStatusBar ? 'flex' : 'none';
  const toggle = document.getElementById('settings-sb-toggle');
  if (toggle) toggle.classList.toggle('on', state.showStatusBar);
  saveSettings();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — snap toggle (from settings)
// ══════════════════════════════════════════════════════════
function toggleSnapFromSettings() {
  state.snapToGrid = !state.snapToGrid;
  const toggle = document.getElementById('settings-snap-toggle');
  if (toggle) toggle.classList.toggle('on', state.snapToGrid);
  updateStatusBar();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — connections toggle (from settings)
// ══════════════════════════════════════════════════════════
function toggleConnectionsFromSettings() {
  state.connectionsVisible = !state.connectionsVisible;
  const svg = document.getElementById('connections-svg');
  if (svg) svg.style.display = state.connectionsVisible ? '' : 'none';
  const toggle = document.getElementById('settings-conn-toggle');
  if (toggle) toggle.classList.toggle('on', state.connectionsVisible);
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — labels visibility toggle
// ══════════════════════════════════════════════════════════
function toggleLabelsFromSettings() {
  state.labelsVisible = !state.labelsVisible;
  document.querySelectorAll('.el-label').forEach(el => {
    el.style.display = state.labelsVisible ? '' : 'none';
  });
  const toggle = document.getElementById('settings-labels-toggle');
  if (toggle) toggle.classList.toggle('on', state.labelsVisible);
  saveSettings();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — connection line style
// ══════════════════════════════════════════════════════════
function setConnLineStyle(style) {
  state.connLineStyle = style;
  document.querySelectorAll('.setting-chip[data-ls]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ls === style);
  });
  _connFP = '';
  renderConnections();
  saveSettings();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — animations toggle
// ══════════════════════════════════════════════════════════
function toggleAnimationsFromSettings() {
  state.reducedAnimations = !state.reducedAnimations;
  document.documentElement.classList.toggle('reduced-motion', state.reducedAnimations);
  const toggle = document.getElementById('settings-anim-toggle');
  if (toggle) toggle.classList.toggle('on', !state.reducedAnimations);
  saveSettings();
}

function toggleShowLastUpdated() {
  state.showLastUpdated = state.showLastUpdated === false ? true : false;
  applySettings();
  // Re-run export refresh if export view is visible
  const expView = document.getElementById('view-Export');
  if (expView && expView.style.display !== 'none') refreshExport();
  saveSettings();
}

function setPlotVersion(v) {
  const n = parseInt(v, 10);
  if (!isNaN(n) && n >= 1) {
    state.plotVersion = n;
    const versionEl = document.getElementById('exp-version');
    if (versionEl) versionEl.textContent = 'v' + n;
    _scheduleSessionSave();
  }
}

// ══════════════════════════════════════════════════════════
//  DUPLICATE SELECTED ELEMENT
// ══════════════════════════════════════════════════════════
function duplicateSelected() {
  if (!state.selectedId) return;
  const src = state.elements.find(e => e.id === state.selectedId);
  if (!src) return;
  const clone = JSON.parse(JSON.stringify(src));
  clone.id = state.nextId++;
  clone.x = src.x + 48;
  clone.y = src.y + 48;

  // Auto-assign a fresh channel ID so the duplicate never conflicts
  if (clone.channelId) {
    const usedNums = (state.elements || [])
      .map(e => e.channelId || e.chid || '')
      .map(c => { const m = c.match(/^CH-?(\d+)$/i); return m ? parseInt(m[1], 10) : 0; });
    const nextNum = (Math.max(0, ...usedNums) + 1);
    clone.channelId = 'CH-' + String(nextNum).padStart(2, '0');
  }
  if (clone.chid) {
    const usedNums = (state.elements || [])
      .map(e => e.chid || e.channelId || '')
      .map(c => { const m = c.match(/^CH-?(\d+)$/i); return m ? parseInt(m[1], 10) : 0; });
    const nextNum = (Math.max(0, ...usedNums) + 1);
    clone.chid = 'CH-' + String(nextNum).padStart(2, '0');
  }

  pushHistory();
  state.elements.push(clone);
  renderElements();
  lcIcons();
  selectElement(clone.id);
  showToast('Element duplicated');
  applySettings();
}

// ══════════════════════════════════════════════════════════
//  BACKUP & RESTORE (local JSON)
// ══════════════════════════════════════════════════════════
function backupJSON() {
  const data = getCloudState();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = (document.title || 'stage-core').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  a.href = url;
  a.download = `${name}-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded ✓');
}

function restoreFromJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        showConfirm('Restore from this backup? Current project will be replaced.', () => {
          _applyCloudData(data);
          showToast('Backup restored ✓');
        });
      } catch {
        showToast('Invalid file — could not parse JSON');
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — sync UI to current state
// ══════════════════════════════════════════════════════════
function syncSettingsUI() {
  // Canvas bg swatches
  document.querySelectorAll('#settings-canvas-bg .bg-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bg === state.canvasBg);
  });
  // Grid size chips (selector is document-wide; old #settings-panel is hidden)
  document.querySelectorAll('.setting-chip[data-gs]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.gs) === state.gridSize);
  });
  // Status bar toggle
  const sbToggle = document.getElementById('settings-sb-toggle');
  if (sbToggle) sbToggle.classList.toggle('on', state.showStatusBar);
  // Snap toggle
  const snapToggle = document.getElementById('settings-snap-toggle');
  if (snapToggle) snapToggle.classList.toggle('on', state.snapToGrid);
  // Connections toggle
  const connToggle = document.getElementById('settings-conn-toggle');
  if (connToggle) connToggle.classList.toggle('on', state.connectionsVisible);
}

// ══════════════════════════════════════════════════════════
//  SETTINGS — panel open / close
// ══════════════════════════════════════════════════════════
function openSettings() {
  renderSettingsNavList();
  syncSettingsUI();
  document.getElementById('settings-panel').classList.add('open');
  document.getElementById('settings-panel-backdrop').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('settings-panel-backdrop').classList.remove('open');
}

// ══════════════════════════════════════════════════════════
//  LOGO MENU — toggle
// ══════════════════════════════════════════════════════════
function toggleLogoMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('logo-menu');
  if (!menu) return;
  menu.classList.toggle('open');
}
function closeLogoMenu() {
  const menu = document.getElementById('logo-menu');
  if (menu) menu.classList.remove('open');
}
// Close logo menu when clicking elsewhere
document.addEventListener('click', function(e) {
  const btn  = document.getElementById('logo-btn');
  const menu = document.getElementById('logo-menu');
  if (!menu || !btn) return;
  if (menu.classList.contains('open') && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
loadSettings();
_sessionRestore(); // Restore all saved data (members, setlist, gear, rider, etc.)
applySettings();
renderNav();

// Ensure data is saved when the iframe is hidden (user switches app or navigates away)
window.addEventListener('pagehide', _sessionSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) _sessionSave(); });
// Trigger the view-switch side-effects so desktop cat bar / mobile bars are in the right state
switchView('Editor');

// Show drop hint if empty on load
if (state.elements.length === 0) {
  document.getElementById('drop-zone-hint').style.opacity = '0.6';
}

// ── Pull-to-refresh (mobile only, only from top 60px of screen) ──
(function() {
  if (window.innerWidth > 767) return;
  let startY = 0, pulling = false, triggered = false;
  const THRESHOLD = 90;
  const TOP_ZONE  = 60; // must start touch in top 60px
  const indicator = document.getElementById('ptr-indicator');
  const label     = document.getElementById('ptr-label');

  document.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    triggered = false;
    pulling = startY < TOP_ZONE; // only activate if touch starts near top
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling || triggered) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { pulling = false; return; }
    const pct = Math.min(dy / THRESHOLD, 1);
    indicator.style.display = 'block';
    indicator.style.opacity = pct;
    label.style.display = 'block';
    label.textContent = pct >= 1 ? '↑ Release to refresh' : '↓ Pull to refresh';
    label.style.color  = pct >= 1 ? '#ff7439' : '#7aafff';
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!pulling || triggered) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy >= THRESHOLD) {
      triggered = true;
      label.textContent = 'Refreshing…';
      label.style.color = '#c5ffc9';
      setTimeout(() => location.reload(), 300);
    } else {
      indicator.style.display = 'none';
      label.style.display = 'none';
    }
    pulling = false;
  }, { passive: true });
})();

function scheduleCloudAutosave() {}
window.onSCAuthChange = function() {};

function getCloudState() {
  return {
    schemaVersion: 8,
    savedAt: new Date().toISOString(),
    elements:    JSON.parse(JSON.stringify(state.elements)),
    connections: JSON.parse(JSON.stringify(state.connections)),
    setlist:     JSON.parse(JSON.stringify(state.setlist)),
    segments:    JSON.parse(JSON.stringify(state.segments)),
    gear:        JSON.parse(JSON.stringify(state.gear)),
    members:     JSON.parse(JSON.stringify(state.members)),
    riderNeeds:  JSON.parse(JSON.stringify(state.riderNeeds)),
    timeline:    JSON.parse(JSON.stringify(state.timeline)),
    _rnNextId:   state._rnNextId,
    lang:        state.lang,
    canvasBg:    state.canvasBg,
    navOrder:    [...state.navOrder],
    gridSize:    state.gridSize,
    canvasW:     state.canvasW,
    canvasH:     state.canvasH,
    nextId:      state.nextId,
    presets:     getPresets(),
    showStatusBar:           state.showStatusBar,
    snapToGrid:              state.snapToGrid,
    connectionsVisible:      state.connectionsVisible,
    labelsVisible:           state.labelsVisible,
    connLineStyle:           state.connLineStyle,
    reducedAnimations:       state.reducedAnimations,
    theme:                   state.theme,
    smartSuggestionsEnabled: state.smartSuggestionsEnabled,
    stageBalanceVisible:     state.stageBalanceVisible,
    smIntelligenceEnabled:   state.smIntelligenceEnabled,
    smAutoOptEnabled:        state.smAutoOptEnabled,
    smConflictEnabled:       state.smConflictEnabled,
    smPredictEnabled:        state.smPredictEnabled,
    lastModified:            state.lastModified,
    plotVersion:             state.plotVersion,
    showLastUpdated:         state.showLastUpdated,
  };
}

function _applyCloudData(d) {
  state.elements    = d.elements    ? JSON.parse(JSON.stringify(d.elements))    : [];
  state.connections = d.connections ? JSON.parse(JSON.stringify(d.connections)) : [];
  state.setlist     = d.setlist     ? JSON.parse(JSON.stringify(d.setlist))     : [];
  state.segments    = d.segments    ? JSON.parse(JSON.stringify(d.segments))    : [];
  state.gear        = d.gear        ? JSON.parse(JSON.stringify(d.gear))        : [];
  state.members     = d.members     ? JSON.parse(JSON.stringify(d.members))     : [];
  state.timeline    = d.timeline    ? JSON.parse(JSON.stringify(d.timeline))    : [];
  if (d.riderNeeds) state.riderNeeds = JSON.parse(JSON.stringify(d.riderNeeds));
  if (d._rnNextId)  state._rnNextId  = d._rnNextId;
  if (d.lang)       state.lang       = d.lang;
  if (d.canvasBg) {
    state.canvasBg = d.canvasBg;
    const cv = document.getElementById('stage-canvas');
    if (cv) cv.style.backgroundColor = d.canvasBg;
  }
  if (d.navOrder)  state.navOrder  = d.navOrder;
  if (d.gridSize)  state.gridSize  = d.gridSize;
  if (d.canvasW)  { state.canvasW = d.canvasW; state.canvasH = d.canvasH; }
  state.nextId = Math.max(state.nextId || 1,
    state.elements.reduce((m, el) => Math.max(m, (parseInt(el.id.replace('el-', '')) || 0) + 1), 1));
  if (typeof _memberNextId !== 'undefined') {
    _memberNextId = state.members.reduce((mx, m) =>
      Math.max(mx, (parseInt(String(m.id).replace('m','')) || 0) + 1), 1);
  }
  if (typeof _segNextId !== 'undefined') {
    _segNextId = state.segments.reduce((mx, s) => Math.max(mx, (s.id || 0) + 1), 1);
  }
  if (d.lang)  setLang(d.lang);
  if (Array.isArray(d.presets)) setPresets(d.presets);
  if (d.snapToGrid              !== undefined) state.snapToGrid              = d.snapToGrid;
  if (d.connectionsVisible      !== undefined) state.connectionsVisible      = d.connectionsVisible;
  if (d.labelsVisible           !== undefined) state.labelsVisible           = d.labelsVisible;
  if (d.connLineStyle)                         state.connLineStyle           = d.connLineStyle;
  if (d.reducedAnimations       !== undefined) state.reducedAnimations       = d.reducedAnimations;
  if (d.theme && THEMES[d.theme])              { state.theme = d.theme; applyTheme(d.theme); }
  if (d.smartSuggestionsEnabled !== undefined) state.smartSuggestionsEnabled = d.smartSuggestionsEnabled;
  if (d.stageBalanceVisible     !== undefined) state.stageBalanceVisible     = d.stageBalanceVisible;
  if (d.smIntelligenceEnabled   !== undefined) state.smIntelligenceEnabled   = d.smIntelligenceEnabled;
  if (d.smAutoOptEnabled        !== undefined) state.smAutoOptEnabled        = d.smAutoOptEnabled;
  if (d.smConflictEnabled       !== undefined) state.smConflictEnabled       = d.smConflictEnabled;
  if (d.smPredictEnabled        !== undefined) state.smPredictEnabled        = d.smPredictEnabled;
  if (d.lastModified)                          state.lastModified            = d.lastModified;
  if (d.plotVersion)                           state.plotVersion             = d.plotVersion;
  if (d.showLastUpdated         !== undefined) state.showLastUpdated         = d.showLastUpdated;
  saveSettings();
  renderAll();
  renderMembersView();
  renderSetlist();
  renderGear();
  renderRiderNeeds();
  renderNav();
  applySettings();
  updateDropHint();
  pushHistory();
}

// ══════════════════════════════════════════════════════════
//  SMART SUGGESTIONS
// ══════════════════════════════════════════════════════════
const SMART_RULES = {
  'Acoustic Drums':     { text: 'Full kit typically needs 6–8 inputs: Kick, Snare, Hi-Hat, Tom ×2, Overhead L/R — and optionally a Room mic.', apply: 'drums' },
  'Electronic Drums':   { text: 'E-drum brain outputs direct to DI — usually stereo (2 ch, L+R). Trigger pads may add extra outputs. Confirm with drummer.' },
  'Electric Guitar':    { text: 'Pair with a Guitar Amp on stage, or run a DI box for a direct signal. Adding an amp mic gives a warmer, more natural tone.', apply: 'elec-guitar' },
  'Acoustic Guitar':    { text: 'Acoustic pickup → DI box. Some systems need phantom power (+48V). Blending a condenser mic gives a fuller, more natural sound.' },
  'Bass Guitar':        { text: 'Bass DI recommended for a clean, consistent FOH tone. A direct split from the amp also works great for hybrid setups.', apply: 'bass' },
  'Keyboard DI':        { text: 'Stereo DI recommended — confirms 2 channels (L + R). Verify with the player whether they output mono or stereo.', apply: 'keys' },
  'Synthesizer':        { text: 'Many synths have multiple outputs. Confirm mono or stereo — stereo needs 2 channels. Some setups have separate sub-mixes.' },
  'Brass Instrument':   { text: 'Instrument condenser or clip mic recommended. Check if the player uses effects pedals that would need a separate DI.' },
  'String Instrument':  { text: 'Condenser mic or pickup DI. Confirm active or passive pickup — active may need phantom power (+48V).' },
  'Percussion':         { text: 'Overhead condenser recommended for full kit coverage. Close mic on key pieces (snare, rim) adds definition for dense setups.' },
  'Cajón':              { text: 'A single close mic or kick-style dynamic works great. Some players use a DI pickup mounted inside the cajón body.' },
  'Shaker':             { text: 'Small condenser or overhead pickup recommended. Usually shares a channel or is grouped with percussion bus.' },
  'Tambourine':         { text: 'Usually grouped with percussion overhead or shares a snare mic. A clip mic works well for louder, more prominent parts.' },
  'In-Ear Monitor':     { text: 'IEM packs need a dedicated stereo aux send. Confirm if the band supplies their own transmitters or if venue provides.' },
  'Wireless Mic':       { text: 'Check frequency coordination with other wireless systems on-site. IEM and wireless mic bands can conflict if not coordinated.' },
};

let _suggTimeout = null;
let _suggData    = null;
const _shownSuggTypes = new Set();

function _showSmartSuggestion(el) {
  if (!state.smartSuggestionsEnabled) return;
  const rule = SMART_RULES[el.type];
  if (!rule) return;
  if (_shownSuggTypes.has(el.type)) return;
  _shownSuggTypes.add(el.type);
  clearTimeout(_suggTimeout);
  _suggData = { rule, el };
  const card = document.getElementById('smart-suggest-card');
  const typeEl = document.getElementById('smart-suggest-type');
  const textEl = document.getElementById('smart-suggest-text');
  if (!card || !textEl) return;
  if (typeEl) typeEl.textContent = el.label || el.name;
  textEl.textContent = rule.text;
  card.style.display = 'block';
  requestAnimationFrame(() => card.classList.add('ss-visible'));
  _suggTimeout = setTimeout(dismissSuggestion, 7000);
}

function dismissSuggestion() {
  clearTimeout(_suggTimeout);
  const card = document.getElementById('smart-suggest-card');
  if (card) { card.classList.remove('ss-visible'); setTimeout(() => { if (!card.classList.contains('ss-visible')) card.style.display = 'none'; }, 250); }
  _suggData = null;
}

function acceptSuggestion() {
  if (!_suggData) { dismissSuggestion(); return; }
  const { rule, el } = _suggData;
  if (rule.apply === 'drums') {
    ['Kick mic', 'Snare mic', 'Hi-Hat mic', 'Tom L mic', 'Tom R mic', 'Overhead L', 'Overhead R'].forEach(n => {
      state.riderNeeds.push({ id: 'rn' + state._rnNextId++, type: 'custom', value: el.label + ' — ' + n });
    });
    renderRiderNeeds();
    showToast('Drum mic layout added to Technical Requirements');
  } else if (rule.apply === 'elec-guitar') {
    state.riderNeeds.push({ id: 'rn' + state._rnNextId++, type: 'custom', value: el.label + ' — Amp mic or DI box' });
    renderRiderNeeds();
    showToast('Guitar setup note added to Technical Requirements');
  } else if (rule.apply === 'bass') {
    state.riderNeeds.push({ id: 'rn' + state._rnNextId++, type: 'custom', value: el.label + ' — Bass DI (direct)' });
    renderRiderNeeds();
    showToast('Bass DI note added to Technical Requirements');
  } else if (rule.apply === 'keys') {
    state.riderNeeds.push({ id: 'rn' + state._rnNextId++, type: 'custom', value: el.label + ' — Stereo DI (L + R, 2 channels)' });
    renderRiderNeeds();
    showToast('Stereo DI note added to Technical Requirements');
  } else {
    showToast('Tip noted');
  }
  dismissSuggestion();
}

function toggleSmartSuggestions() {
  state.smartSuggestionsEnabled = !state.smartSuggestionsEnabled;
  const t = document.getElementById('settings-ss-toggle');
  if (t) t.classList.toggle('on', state.smartSuggestionsEnabled);
  saveSettings();
  showToast('Smart Suggestions ' + (state.smartSuggestionsEnabled ? 'enabled' : 'disabled'));
}

// ══════════════════════════════════════════════════════════
//  GIG MODE
// ══════════════════════════════════════════════════════════
function toggleGigMode() {
  const body = document.body;
  const FADE = 170;   // panel fade duration (ms)
  const MOVE = 230;   // canvas expand duration (ms)

  if (!state.gigMode) {
    // ── Entering focus mode ──────────────────────────────
    // 1. Enable transitions + start fading panels out
    body.classList.add('gig-transitioning', 'gig-fade-out');

    // 2. After panels fade, flip to gig-mode (display:none) and expand canvas
    setTimeout(() => {
      body.classList.add('gig-mode');
      body.classList.remove('gig-fade-out');
      state.gigMode = true;
      _applyGigEyeState();
      saveSettings();
      // 3. Clean up transition class once canvas finishes expanding
      setTimeout(() => body.classList.remove('gig-transitioning'), MOVE);
    }, FADE);

  } else {
    // ── Exiting focus mode ───────────────────────────────
    // 1. Enable transitions, remove gig-mode (display restored) and
    //    simultaneously set gig-fade-out so elements start at opacity:0
    body.classList.add('gig-transitioning');
    body.classList.remove('gig-mode');
    body.classList.add('gig-fade-out');

    // 2. Next paint: remove gig-fade-out → panels fade back in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.classList.remove('gig-fade-out');
        state.gigMode = false;
        _applyGigEyeState();
        saveSettings();
        setTimeout(() => body.classList.remove('gig-transitioning'), MOVE);
      });
    });
  }
}

function _applyGigEyeState() {
  const eyeBtn  = document.getElementById('btn-gig-eye');
  const eyeIcon = document.getElementById('gig-eye-icon');
  if (eyeBtn)  eyeBtn.style.color  = state.gigMode ? '#ff4444' : '#767575';
  if (eyeIcon) eyeIcon.textContent = state.gigMode ? 'visibility_off' : 'visibility';
}

function _applyGigMode() {
  document.body.classList.toggle('gig-mode', state.gigMode);
  _applyGigEyeState();
}

// ══════════════════════════════════════════════════════════
//  CUSTOM ELEMENTS
// ══════════════════════════════════════════════════════════
const CUSTOM_EL_KEY = 'scCustomElements';

function getCustomElements() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_EL_KEY) || '[]'); } catch { return []; }
}
function _saveCustomElements(items) {
  try { localStorage.setItem(CUSTOM_EL_KEY, JSON.stringify(items)); } catch {}
}

let _customElImageData = null; // base64 data URL for current modal session

function openCustomElementModal() {
  const m = document.getElementById('custom-el-modal');
  if (!m) return;
  _customElImageData = null;
  document.getElementById('cust-el-name').value = '';
  document.getElementById('cust-el-emoji').value = '🎵';
  document.getElementById('cust-el-color').value = '#7aafff';
  document.getElementById('cust-el-img-input').value = '';
  const catSel = document.getElementById('cust-el-category');
  if (catSel) catSel.value = 'custom';
  _setCustElImagePreview(null);
  m.style.display = 'flex';
  setTimeout(() => document.getElementById('cust-el-name').focus(), 80);
}

function closeCustomElementModal() {
  const m = document.getElementById('custom-el-modal');
  if (m) m.style.display = 'none';
  _customElImageData = null;
}

function _setCustElImagePreview(dataUrl) {
  const btn     = document.getElementById('cust-el-img-btn');
  const preview = document.getElementById('cust-el-img-preview');
  const thumb   = document.getElementById('cust-el-img-thumb');
  const emojiWrap = document.getElementById('cust-el-emoji-wrap');
  if (dataUrl) {
    if (btn)     btn.style.display     = 'none';
    if (preview) preview.style.display = 'flex';
    if (thumb)   thumb.src             = dataUrl;
    if (emojiWrap) emojiWrap.style.opacity = '0.3';
  } else {
    if (btn)     btn.style.display     = 'flex';
    if (preview) preview.style.display = 'none';
    if (thumb)   thumb.src             = '';
    if (emojiWrap) emojiWrap.style.opacity = '1';
  }
}

function handleCustomElImageUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      // Resize to max 48x48 on an offscreen canvas, then compress as JPEG
      const MAX = 48;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', 0.82);
      _customElImageData = dataUrl;
      _setCustElImagePreview(dataUrl);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function clearCustomElImage() {
  _customElImageData = null;
  document.getElementById('cust-el-img-input').value = '';
  _setCustElImagePreview(null);
}

function saveCustomElement() {
  const name     = (document.getElementById('cust-el-name').value || '').trim();
  const emoji    = (document.getElementById('cust-el-emoji').value || '').trim() || '🎵';
  const color    = document.getElementById('cust-el-color').value || '#7aafff';
  const category = (document.getElementById('cust-el-category')?.value) || 'custom';
  if (!name) { showToast('Enter a name for your element'); return; }
  const item = { id: 'cx_' + Date.now(), name, emoji, color, type: 'Custom', category };
  if (_customElImageData) item.imageData = _customElImageData;
  const items = getCustomElements();
  items.push(item);
  _saveCustomElements(items);
  _customElImageData = null;
  closeCustomElementModal();
  renderCustomElementsLibrary();
  showToast('Custom element created: ' + name);
}

function deleteCustomElement(id) {
  if (!confirm('Remove this custom element from the library?')) return;
  _saveCustomElements(getCustomElements().filter(el => el.id !== id));
  renderCustomElementsLibrary();
}

function renderCustomElementsLibrary() {
  try { _renderCustomElementsLibraryImpl(); } catch(e) { console.warn('[SC] renderCustomElementsLibrary error:', e); }
}
function _renderCustomElementsLibraryImpl() {
  const grid    = document.getElementById('grid-custom');
  const section = document.getElementById('accordion-custom');
  const emptyState = document.getElementById('custom-empty-state');
  if (!grid || !section) return;
  const items = getCustomElements();

  // Always show the Custom section
  section.style.display = 'block';
  if (emptyState) emptyState.style.display = items.length === 0 ? 'flex' : 'none';

  // Strip previously-injected custom items from all non-custom library sections
  const allCats = ['mics','drums','inst','amps','mon','util'];
  allCats.forEach(cat => {
    if (Array.isArray(library[cat])) library[cat] = library[cat].filter(i => !i._injectedCustom);
  });

  // Distribute items: those tagged to a specific section go there; the rest go to Custom
  const customItems = [];
  items.forEach(item => {
    const cat = item.category || 'custom';
    const libItem = {
      name: item.name, emoji: item.emoji, icon: item.emoji,
      type: 'Custom', isCustom: true, color: item.color,
      imageData: item.imageData || null, _injectedCustom: true,
    };
    if (cat !== 'custom' && Array.isArray(library[cat])) {
      library[cat].push(libItem);
      // Refresh that grid immediately
      const g = document.getElementById('grid-' + cat);
      if (g) { g.innerHTML = ''; library[cat].forEach(i => g.appendChild(buildLibraryItem(i))); lcIcons(); }
    } else {
      customItems.push(libItem);
    }
  });

  // Update library.custom for the desktop tray hover system
  library.custom = [
    { _isCreate: true },
    ...customItems,
  ];

  grid.innerHTML = '';
  items.filter(item => !item.category || item.category === 'custom').forEach(item => {
    const div = document.createElement('div');
    div.className = 'draggable-item bg-surface-container-highest flex flex-col items-center justify-center hover:bg-surface-bright transition-all';
    div.style.cssText = 'cursor:grab;border:1px solid transparent;padding:4px;width:60px;height:60px;flex-shrink:0;position:relative;';
    div.draggable = true;
    const iconHtmlStr = item.imageData
      ? `<img src="${item.imageData}" style="width:26px;height:26px;object-fit:contain;margin-bottom:3px;" draggable="false"/>`
      : `<span style="font-size:22px;margin-bottom:3px;line-height:1;">${item.emoji}</span>`;
    div.innerHTML = `
      ${iconHtmlStr}
      <span class="font-bold text-on-surface-variant text-center" style="font-size:8px;text-transform:uppercase;letter-spacing:-0.01em;line-height:1.1;word-break:break-all;">${item.name}</span>
      <button onclick="event.stopPropagation();deleteCustomElement('${item.id}')" title="Remove" style="position:absolute;top:1px;right:2px;background:none;border:none;cursor:pointer;color:#3a3a3a;font-size:12px;padding:0;line-height:1;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#3a3a3a'">×</button>`;
    div.addEventListener('dragstart', e => {
      const payload = { name: item.name, icon: item.emoji, type: 'Custom', emoji: item.emoji, color: item.color, isCustom: true };
      if (item.imageData) payload.imageData = item.imageData;
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      div.style.opacity = '0.5';
    });
    div.addEventListener('dragend', () => { div.style.opacity = '1'; });
    div.addEventListener('mouseover', () => { div.style.borderColor = 'rgba(122,175,255,0.2)'; });
    div.addEventListener('mouseout', () => { div.style.borderColor = 'transparent'; });
    div.addEventListener('click', () => _addCustomItemToStage(item));
    grid.appendChild(div);
  });
}

function _addCustomItemToStage(item) {
  const rect = stageCanvas.getBoundingClientRect();
  const jitter = () => (Math.random() - 0.5) * 60;
  const x = Math.max(40, Math.min(rect.width  - 40, rect.width  / 2 + jitter()));
  const y = Math.max(40, Math.min(rect.height - 40, rect.height / 2 + jitter()));
  const channelNum = (state.elements.length + 1).toString().padStart(2, '0');
  const el = {
    id: 'el-' + state.nextId++, name: item.name, label: item.name.toUpperCase(),
    icon: item.emoji, type: 'Custom', x, y, rotation: 0,
    scale: window.innerWidth < 768 ? 65 : 100,
    channelId: 'CH-' + channelNum, source: 'SL01', output: 'FOH',
    phantom: false, notes: '', color: item.color || '#7aafff', roles: [],
    isCustom: true, emoji: item.emoji,
    ...(item.imageData ? { imageData: item.imageData } : {}),
  };
  state.elements.push(el);
  renderElements();
  selectElement(el.id);
  pushHistory();
  updateDropHint();
}


// ══════════════════════════════════════════════════════════
//  INPUT LIST AUTO-GENERATOR
// ══════════════════════════════════════════════════════════
const INPUT_CHANNEL_COUNTS = {
  'Acoustic Drums':     6,
  'Electronic Drums':   2,
  'Electric Guitar':    1,
  'Acoustic Guitar':    1,
  'Bass Guitar':        1,
  'Keyboard DI':        2,
  'Synthesizer':        2,
  'Brass Instrument':   1,
  'String Instrument':  1,
  'Percussion':         1,
  'Cajón':              1,
  'Shaker':             1,
  'Tambourine':         1,
  'Dynamic Mic':        1,
  'Condenser Mic':      1,
  'Wireless Mic':       1,
  'PZM Mic':            1,
  'Instrument Mic':     1,
  'Instrument Clip':    1,
};

function _buildInputListItems() {
  const newNeeds = [];
  state.elements.forEach(el => {
    const count = INPUT_CHANNEL_COUNTS[el.type];
    if (!count) return;
    if (count === 1) {
      newNeeds.push({ id: 'rn' + state._rnNextId++, type: 'custom', value: (el.label || el.name) + ' — ' + el.type + ' (' + el.channelId + ')' });
    } else {
      for (let i = 1; i <= count; i++) {
        let suffix = '';
        if (el.type === 'Keyboard DI' || el.type === 'Synthesizer' || el.type === 'Electronic Drums') suffix = i === 1 ? ' L' : ' R';
        else if (el.type === 'Acoustic Drums') {
          const drumSuffix = ['Kick','Snare','Hi-Hat','Tom L','Tom R','OH L/R'];
          suffix = ' — ' + (drumSuffix[i-1] || 'Ch ' + i);
        }
        newNeeds.push({ id: 'rn' + state._rnNextId++, type: 'custom', value: (el.label || el.name) + suffix });
      }
    }
  });
  return newNeeds;
}

function generateInputListFromStage() {
  if (state.elements.length === 0) { showToast('No elements on stage yet'); return; }
  const newNeeds = _buildInputListItems();
  if (newNeeds.length === 0) { showToast('No mic/DI inputs detected for stage elements'); return; }
  if (state.riderNeeds.length > 0) {
    const existingVals = new Set(state.riderNeeds.map(n => n.value.trim().toLowerCase()));
    const dupeCount = newNeeds.filter(n => existingVals.has(n.value.trim().toLowerCase())).length;
    if (dupeCount > 0) {
      showConfirm(
        dupeCount + ' of the generated inputs already exist in Technical Requirements. Add duplicates anyway, or cancel?',
        () => {
          state.riderNeeds.push(...newNeeds);
          renderRiderNeeds();
          showToast(newNeeds.length + ' inputs added (includes duplicates)');
        }
      );
      return;
    }
  }
  state.riderNeeds.push(...newNeeds);
  renderRiderNeeds();
  showToast(newNeeds.length + ' inputs generated from stage layout');
}

// ══════════════════════════════════════════════════════════
//  STAGE BALANCE VISUALIZER
// ══════════════════════════════════════════════════════════
function toggleStageBalance() {
  state.stageBalanceVisible = !state.stageBalanceVisible;
  saveSettings();
  const sbvToggle = document.getElementById('settings-sbv-toggle');
  if (sbvToggle) sbvToggle.classList.toggle('on', state.stageBalanceVisible);
  requestAnimationFrame(updateStageBalance);
}

function toggleSmIntelligence() {
  state.smIntelligenceEnabled = !state.smIntelligenceEnabled;
  saveSettings();
  const t = document.getElementById('settings-smi-toggle');
  if (t) t.classList.toggle('on', state.smIntelligenceEnabled);
  const sub = document.getElementById('smi-sub-toggles');
  if (sub) sub.style.opacity = state.smIntelligenceEnabled ? '1' : '0.4';
  if (typeof smUpdateBadge === 'function') smUpdateBadge(0);
}

function toggleSmAutoOpt() {
  if (!state.smIntelligenceEnabled) return;
  state.smAutoOptEnabled = !state.smAutoOptEnabled;
  saveSettings();
  const t = document.getElementById('settings-smi-ao-toggle');
  if (t) t.classList.toggle('on', state.smAutoOptEnabled);
}

function toggleSmConflict() {
  if (!state.smIntelligenceEnabled) return;
  state.smConflictEnabled = !state.smConflictEnabled;
  saveSettings();
  const t = document.getElementById('settings-smi-cd-toggle');
  if (t) t.classList.toggle('on', state.smConflictEnabled);
}

function toggleSmPredict() {
  if (!state.smIntelligenceEnabled) return;
  state.smPredictEnabled = !state.smPredictEnabled;
  saveSettings();
  const t = document.getElementById('settings-smi-ps-toggle');
  if (t) t.classList.toggle('on', state.smPredictEnabled);
}

function updateStageBalance() {
  const bar = document.getElementById('stage-balance-bar');
  const lblL = document.getElementById('sbal-l');
  const lblC = document.getElementById('sbal-c');
  const lblR = document.getElementById('sbal-r');
  if (!bar) return;
  if (!state.stageBalanceVisible) { bar.style.display = 'none'; return; }
  const els = state.elements;
  if (els.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const rect = stageCanvas.getBoundingClientRect();
  const W = rect.width || state.canvasW || 800;
  let left = 0, center = 0, right = 0;
  els.forEach(el => {
    const pct = el.x / W;
    if (pct < 0.33) left++;
    else if (pct < 0.67) center++;
    else right++;
  });
  const total = els.length;
  const pL = Math.round(left   / total * 100);
  const pC = Math.round(center / total * 100);
  const pR = Math.round(right  / total * 100);
  const wL = document.getElementById('sbal-seg-l');
  const wC = document.getElementById('sbal-seg-c');
  const wR = document.getElementById('sbal-seg-r');
  if (wL) wL.style.width = pL + '%';
  if (wC) wC.style.width = pC + '%';
  if (wR) wR.style.width = pR + '%';
  if (lblL) lblL.textContent = pL + '%';
  if (lblC) lblC.textContent = pC + '%';
  if (lblR) lblR.textContent = pR + '%';
}

// ── Auto-sync balance after any drag-move event on stage ─────────────────────
(function() {
  let _balRaf = null;
  function _schedBalance() {
    cancelAnimationFrame(_balRaf);
    _balRaf = requestAnimationFrame(updateStageBalance);
  }
  document.addEventListener('mouseup', _schedBalance);
  document.addEventListener('touchend', _schedBalance);
})();

// Init: load custom elements library + initial balance
renderCustomElementsLibrary();
requestAnimationFrame(updateStageBalance);

// ══════════════════════════════════════════════════════════
//  SHARED UTILITIES (new features)
// ══════════════════════════════════════════════════════════

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ══════════════════════════════════════════════════════════
//  FEATURE: AUTO CLEAN LAYOUT
// ══════════════════════════════════════════════════════════

// Zone definitions: row (0=upstage … 4=downstage), side bias
const _ARRANGE_ZONES = {
  // Upstage row – rear tech / PA
  'PA Speaker':        { row: 0, side: 'edges' },
  'Amp Rack':          { row: 0, side: 'left'  },
  'Effects Rack':      { row: 0, side: 'right' },
  'Stage Snake':       { row: 0, side: 'right' },
  'Power Conditioner': { row: 0, side: 'left'  },
  'Patch Bay':         { row: 0, side: 'right' },
  // Mid-back row – amps & backline
  'Guitar Amplifier':  { row: 1, side: 'left'  },
  'Guitar Cabinet':    { row: 1, side: 'left'  },
  'Bass Amplifier':    { row: 1, side: 'right' },
  'Bass Cabinet':      { row: 1, side: 'right' },
  'Keyboard Amplifier':{ row: 1, side: 'right' },
  'Stage Mixer':       { row: 1, side: 'right' },
  // Center row – drums & instruments
  'Acoustic Drums':    { row: 2, side: 'center' },
  'Electronic Drums':  { row: 2, side: 'center' },
  'Drum Kit':          { row: 2, side: 'center' },
  'Percussion':        { row: 2, side: 'right'  },
  'Cajón':             { row: 2, side: 'right'  },
  'Electric Guitar':   { row: 2, side: 'left'   },
  'Acoustic Guitar':   { row: 2, side: 'left'   },
  'Bass Guitar':       { row: 2, side: 'right'  },
  'Keyboard DI':       { row: 2, side: 'right'  },
  'Synthesizer':       { row: 2, side: 'right'  },
  'Violin':            { row: 2, side: 'left'   },
  'Cello':             { row: 2, side: 'left'   },
  'Saxophone':         { row: 2, side: 'right'  },
  'Trumpet':           { row: 2, side: 'right'  },
  // Monitor row
  'Floor Wedge':       { row: 3, side: 'spread' },
  'Sidefill Monitor':  { row: 3, side: 'edges'  },
  'Drum Fill Monitor': { row: 3, side: 'center' },
  'In-Ear Monitor':    { row: 3, side: 'spread' },
  'IEM Pack':          { row: 3, side: 'spread' },
  // Downstage row – mics & stands
  'Dynamic Mic':       { row: 4, side: 'spread' },
  'Condenser Mic':     { row: 4, side: 'spread' },
  'Ribbon Mic':        { row: 4, side: 'spread' },
  'Wireless Mic':      { row: 4, side: 'spread' },
  'Boundary Mic':      { row: 4, side: 'spread' },
  'Overhead Mic':      { row: 4, side: 'center' },
  'Music Stand':       { row: 4, side: 'spread' },
  'Mic Stand':         { row: 4, side: 'spread' },
  // FOH / consoles
  'FOH Mixing Console':{ row: 0, side: 'center' },
  'Monitor Console':   { row: 0, side: 'right'  },
};


function autoArrangeElements() {
  if (state.elements.length === 0) { showToast('No elements on stage to arrange.'); return; }
  showConfirm(
    'Auto-arrange all elements by type (drums centered, mics downstage, amps upstage)?',
    () => _doAutoArrange()
  );
}

function _doAutoArrange() {
  pushHistory();
  const canvas = document.getElementById('stage-canvas');
  const W = canvas ? canvas.offsetWidth  : (state.canvasW || 900);
  const H = canvas ? canvas.offsetHeight : (state.canvasH || 506);

  const ICON_W   = 70;   // element bounding width
  const PAD_X    = Math.max(ICON_W * 0.8, W * 0.07);  // side padding
  const MIN_SEP  = ICON_W * 1.1; // minimum center-to-center distance
  const SUB_OFF  = H * 0.045;    // Y stagger for sub-groups sharing a row

  // Row Y fractions — well-spread for a real stage
  const ROW_Y = [0.08, 0.26, 0.50, 0.73, 0.91];

  // Collect old positions for animation
  const oldPos = {};
  state.elements.forEach(el => {
    const dom = document.getElementById('elem-' + el.id);
    if (dom) oldPos[el.id] = { x: parseFloat(dom.style.left), y: parseFloat(dom.style.top) };
  });

  // Bucket elements into rows
  const rows = Array.from({ length: 5 }, () =>
    ({ left: [], center: [], right: [], edges: [], spread: [] })
  );
  state.elements.forEach(el => {
    const zone = _ARRANGE_ZONES[el.type] || { row: 2, side: 'spread' };
    el._zone = zone;
    rows[zone.row][zone.side].push(el);
  });

  // Helper: evenly space a group across [xFrom, xTo], all at the given Y
  function placeGroup(group, xFrom, xTo, y) {
    if (!group.length) return;
    const n = group.length;
    if (n === 1) {
      group[0].x = (xFrom + xTo) / 2;
      group[0].y = y;
      return;
    }
    // Desired step between centers
    const span  = xTo - xFrom;
    const step  = Math.max(MIN_SEP, span / (n - 1));
    // If step * (n-1) > span, the group is wider than the zone — center it
    const totalW = step * (n - 1);
    const start  = (xFrom + xTo) / 2 - totalW / 2;
    group.forEach((el, i) => {
      el.x = Math.max(PAD_X, Math.min(W - PAD_X, start + i * step));
      el.y = y;
    });
  }

  rows.forEach((sides, rowIdx) => {
    const baseY = ROW_Y[rowIdx] * H;

    // ── Edges: outermost positions, alternating L/R ──────────────────
    const nEdge = sides.edges.length;
    sides.edges.forEach((el, i) => {
      const frac = nEdge === 1 ? 0.5 : i / (nEdge - 1);
      el.x = Math.max(PAD_X, Math.min(W - PAD_X, PAD_X + frac * (W - 2 * PAD_X)));
      el.y = baseY;
    });

    // ── Spread: full usable width ─────────────────────────────────────
    placeGroup(sides.spread, PAD_X, W - PAD_X, baseY);

    // ── Left / Center / Right — partition canvas into thirds with smart fallback
    const hasL = sides.left.length > 0;
    const hasC = sides.center.length > 0;
    const hasR = sides.right.length > 0;
    const activeZones = (hasL ? 1 : 0) + (hasC ? 1 : 0) + (hasR ? 1 : 0);

    if (activeZones === 0) return; // nothing to place

    // Divide canvas into equal thirds between the active zones
    const usable    = W - 2 * PAD_X;
    const zoneW     = usable / Math.max(activeZones, 1);
    let   zoneStart = PAD_X;

    // Assign X ranges in L → C → R order, skipping absent groups
    const zones = [];
    if (hasL) { zones.push({ group: sides.left,   from: zoneStart, to: zoneStart + zoneW }); zoneStart += zoneW; }
    if (hasC) { zones.push({ group: sides.center, from: zoneStart, to: zoneStart + zoneW }); zoneStart += zoneW; }
    if (hasR) { zones.push({ group: sides.right,  from: zoneStart, to: zoneStart + zoneW }); }

    // Sub-row Y stagger: if L/C/R coexist with spread in the same row, offset slightly
    const yOff = sides.spread.length > 0 ? -SUB_OFF : 0;

    zones.forEach(({ group, from, to }) => placeGroup(group, from, to, baseY + yOff));

    // ── Collision nudge: push any pair closer than MIN_SEP apart ─────
    const allInRow = [
      ...sides.left, ...sides.center, ...sides.right, ...sides.spread, ...sides.edges
    ].filter(el => el.x !== undefined);
    allInRow.sort((a, b) => a.x - b.x);
    for (let i = 1; i < allInRow.length; i++) {
      const prev = allInRow[i - 1], curr = allInRow[i];
      if (curr.y !== prev.y) continue; // different sub-rows — no collision
      const dx = curr.x - prev.x;
      if (dx < MIN_SEP) {
        const push = (MIN_SEP - dx) / 2;
        prev.x = Math.max(PAD_X, prev.x - push);
        curr.x = Math.min(W - PAD_X, curr.x + push);
      }
    }
  });

  // Clamp everything to canvas bounds
  state.elements.forEach(el => {
    el.x = Math.max(PAD_X * 0.6, Math.min(W - PAD_X * 0.6, el.x || W / 2));
    el.y = Math.max(ICON_W * 0.6, Math.min(H - ICON_W * 0.6, el.y || H / 2));
    delete el._zone;
  });

  // Render at final positions
  renderAll();
  updateStageBalance();

  // Animate elements from old positions to new
  requestAnimationFrame(() => {
    state.elements.forEach(el => {
      const dom = document.getElementById('elem-' + el.id);
      if (!dom || !oldPos[el.id]) return;
      const old = oldPos[el.id];
      const newX = el.x, newY = el.y;
      if (Math.abs(old.x - newX) < 1 && Math.abs(old.y - newY) < 1) return;
      // Jump to old position, then transition to new
      dom.style.transition = 'none';
      dom.style.left = old.x + 'px';
      dom.style.top  = old.y + 'px';
      dom.getBoundingClientRect(); // force reflow
      dom.style.transition = 'left 0.5s cubic-bezier(0.34,1.2,0.64,1), top 0.5s cubic-bezier(0.34,1.2,0.64,1)';
      dom.style.left = newX + 'px';
      dom.style.top  = newY + 'px';
    });
    setTimeout(() => {
      document.querySelectorAll('.stage-element').forEach(d => { d.style.transition = ''; });
    }, 560);
  });

  showToast('Stage arranged ✓ — Undo to revert.');
}


// ══════════════════════════════════════════════════════════
//  FEATURE: SHOW TIMELINE
// ══════════════════════════════════════════════════════════

let _tlDragSrcIdx = null;
let _tlEditEnergy = 3;

function openTimelinePanel() {
  const panel = document.getElementById('timeline-panel');
  if (!panel) return;
  panel.style.display = 'flex';
  renderTimeline();
}

function closeTimeline() {
  const panel = document.getElementById('timeline-panel');
  if (panel) panel.style.display = 'none';
}

function openTimelinePanel_fromShare() {
  closeShareModal();
  openTimelinePanel();
}

function _tlSecsToHM(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60), s = secs % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function renderTimeline() {
  const list  = document.getElementById('tl-list');
  const curve = document.getElementById('tl-curve');
  const bars  = document.getElementById('tl-bars');
  const total = document.getElementById('tl-total');
  if (!list) return;

  const items = state.timeline;
  const totalSecs = items.reduce((s, it) => s + _parseDurationSecs(it.duration || ''), 0);
  total.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} · ${_tlSecsToHM(totalSecs)} total`;

  // Energy curve bars
  const energyColors = ['#333','#7aafff','#c8a2ff','#ffb43c','#ff7439','#ff716c'];
  curve.innerHTML = items.map((it, i) => {
    const e = Math.max(1, Math.min(5, it.energy || 3));
    const h = 8 + (e - 1) * 8; // 8px .. 40px
    const col = energyColors[e] || '#7aafff';
    return `<div class="tl-energy-dot" style="flex:1;height:${h}px;background:${col};opacity:0.75;" title="${it.name}: Energy ${e}"></div>`;
  }).join('');

  // Duration bars (proportional width)
  bars.innerHTML = items.map(it => {
    const secs = _parseDurationSecs(it.duration || '');
    const w = totalSecs > 0 ? (secs / totalSecs * 100) : (100 / Math.max(1, items.length));
    const type = it.type || 'song';
    const col = type === 'break' ? '#ffb43c' : type === 'transition' ? '#ff716c' : '#7aafff';
    return `<div style="height:100%;background:${col};opacity:0.45;flex:${secs || 1};min-width:4px;" title="${it.name} · ${it.duration || '—'}"></div>`;
  }).join('');

  // Item list
  if (items.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px 16px;font-family:\'Space Grotesk\',sans-serif;font-size:11px;color:#333;">No items yet.<br><span style="color:#555;">Click + Song or sync from Setlist.</span></div>';
    return;
  }

  list.innerHTML = items.map((it, i) => {
    const type   = it.type || 'song';
    const dur    = it.duration || '—';
    const bpm    = it.bpm ? `${it.bpm} BPM` : '';
    const energy = it.energy || 3;
    const notes  = it.notes ? `<div style="font-size:10px;color:#555;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.notes)}</div>` : '';
    const energyDots = [1,2,3,4,5].map(n =>
      `<span style="display:inline-block;width:6px;height:6px;border-radius:0;background:${n <= energy ? '#c5ffc9' : '#222'};margin-right:2px;"></span>`
    ).join('');
    return `<div class="tl-item" draggable="true"
      ondragstart="_tlDragStart(event,${i})"
      ondragover="_tlDragOver(event,${i})"
      ondragend="_tlDragEnd(event)"
      ondrop="_tlDrop(event,${i})">
      <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          <span class="tl-type-badge tl-type-${type}">${type}</span>
          <span class="tl-item-name">${escapeHtml(it.name || 'Untitled')}</span>
        </div>
        <div class="tl-item-meta">${dur}${bpm ? ' · ' + bpm : ''} &nbsp;${energyDots}</div>
        ${notes}
      </div>
      <div class="tl-item-actions">
        <button class="tl-act-btn" onclick="editTlItem(${i})" title="Edit">✎</button>
        <button class="tl-act-btn del" onclick="deleteTlItem(${i})" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');
}

function _tlDragStart(e, idx) {
  _tlDragSrcIdx = idx;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function _tlDragOver(e, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.tl-item').forEach((el, i) => el.classList.toggle('tl-drag-over', i === idx && idx !== _tlDragSrcIdx));
}
function _tlDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.tl-item').forEach(el => el.classList.remove('tl-drag-over'));
}
function _tlDrop(e, toIdx) {
  e.preventDefault();
  if (_tlDragSrcIdx === null || _tlDragSrcIdx === toIdx) { _tlDragSrcIdx = null; return; }
  const moved = state.timeline.splice(_tlDragSrcIdx, 1)[0];
  state.timeline.splice(toIdx, 0, moved);
  _tlDragSrcIdx = null;
  saveProject();
  renderTimeline();
}

function addTimelineItem(type) {
  state.timeline.push({
    id: Date.now(),
    type,
    name: type === 'break' ? 'Break' : type === 'transition' ? 'Transition' : 'New Song',
    duration: type === 'break' ? '0:10' : '',
    bpm: '',
    energy: type === 'break' ? 1 : 3,
    notes: '',
  });
  saveProject();
  renderTimeline();
  // Auto-scroll to bottom
  const list = document.getElementById('tl-list');
  if (list) list.scrollTop = list.scrollHeight;
}

function deleteTlItem(idx) {
  state.timeline.splice(idx, 1);
  saveProject();
  renderTimeline();
}

function editTlItem(idx) {
  const it = state.timeline[idx];
  if (!it) return;
  document.getElementById('tl-edit-id').value = idx;
  document.getElementById('tl-edit-name').value = it.name || '';
  document.getElementById('tl-edit-duration').value = it.duration || '';
  document.getElementById('tl-edit-bpm').value = it.bpm || '';
  document.getElementById('tl-edit-notes').value = it.notes || '';
  _tlEditEnergy = it.energy || 3;
  document.querySelectorAll('.tl-energy-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.e) === _tlEditEnergy);
  });
  document.getElementById('tl-item-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('tl-edit-name').focus(), 50);
}

function setTlEnergy(n) {
  _tlEditEnergy = n;
  document.querySelectorAll('.tl-energy-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.e) === n);
  });
}

function saveTlItem() {
  const idx = parseInt(document.getElementById('tl-edit-id').value);
  const it  = state.timeline[idx];
  if (!it) return;
  it.name     = document.getElementById('tl-edit-name').value.trim() || it.name;
  it.duration = document.getElementById('tl-edit-duration').value.trim();
  it.bpm      = document.getElementById('tl-edit-bpm').value.trim();
  it.energy   = _tlEditEnergy;
  it.notes    = document.getElementById('tl-edit-notes').value.trim();
  closeTlItemModal();
  saveProject();
  renderTimeline();
}

function closeTlItemModal() {
  document.getElementById('tl-item-modal').style.display = 'none';
}

function syncTimelineFromSetlist() {
  if (!state.setlist.length) { showToast('Setlist is empty — add songs there first.'); return; }
  const existing = new Set(state.timeline.map(t => t.name));
  let added = 0;
  state.setlist.forEach(song => {
    const name = song.title || song.name || 'Song';
    if (!existing.has(name)) {
      state.timeline.push({
        id: Date.now() + Math.random(),
        type: 'song',
        name,
        duration: song.duration && song.duration !== '—' ? song.duration : '',
        bpm: song.bpm ? String(song.bpm) : '',
        energy: _deriveEnergyFromBpm(song.bpm || 120),
        notes: song.notes || '',
      });
      existing.add(name);
      added++;
    }
  });
  saveProject();
  renderTimeline();
  showToast(added ? `${added} song${added !== 1 ? 's' : ''} added to timeline.` : 'All setlist songs already in timeline.');
}

function _deriveEnergyFromBpm(bpm) {
  bpm = parseInt(bpm) || 120;
  if (bpm < 80)  return 1;
  if (bpm < 100) return 2;
  if (bpm < 130) return 3;
  if (bpm < 160) return 4;
  return 5;
}


// ══════════════════════════════════════════════════════════
//  FEATURE: SHARE VIEW (READ-ONLY MODE)
// ══════════════════════════════════════════════════════════

let _shareUrl = '';

function openShareModal() {
  document.getElementById('share-modal').style.display = 'flex';
  // If a share URL was already generated this session, keep it
  if (_shareUrl) {
    document.getElementById('share-url-input').value = _shareUrl;
  }
}

function closeShareModal() {
  document.getElementById('share-modal').style.display = 'none';
}

function generateShareLink() {
  // Build a lightweight share payload (strip imageData to keep URL manageable)
  const elements = state.elements.map(el => {
    const copy = Object.assign({}, el);
    if (copy.imageData && copy.imageData.length > 2000) delete copy.imageData;
    return copy;
  });

  const payload = {
    v: 1,
    projectName: state.projectName || 'Stage Plot',
    elements,
    connections: state.connections,
    setlist: state.setlist,
    riderNeeds: state.riderNeeds,
    segments: state.segments,
    canvasBg: state.canvasBg,
  };

  let encoded;
  try {
    const json = JSON.stringify(payload);
    // btoa / atob safe for unicode via encodeURIComponent
    encoded = btoa(unescape(encodeURIComponent(json)));
  } catch(e) {
    showToast('Failed to encode project — project may be too large.'); return;
  }

  // Warn if URL will be very large
  const warn = document.getElementById('share-size-warn');
  if (warn) warn.style.display = encoded.length > 50000 ? 'block' : 'none';

  _shareUrl = window.location.origin + window.location.pathname + '#share=' + encoded;
  const inp = document.getElementById('share-url-input');
  if (inp) inp.value = _shareUrl;

  // Reset QR output in case it was for a different URL
  const qrOut = document.getElementById('qr-output');
  if (qrOut) { qrOut.innerHTML = '<span style="font-size:11px;color:#aaa;text-align:center;padding:10px;">Click Generate QR</span>'; }
  const dlBtn = document.getElementById('btn-dl-qr');
  if (dlBtn) dlBtn.disabled = true;

  showToast('Share link generated — copy it!');
}

function copyShareLink() {
  const inp = document.getElementById('share-url-input');
  if (!inp || !inp.value || inp.value.includes('Generate')) {
    showToast('Generate a link first.'); return;
  }
  navigator.clipboard.writeText(inp.value).then(() => showToast('Link copied to clipboard!'))
    .catch(() => { inp.select(); document.execCommand('copy'); showToast('Link copied!'); });
}

// ── QR Code ──────────────────────────────────────────────

let _qrInstance = null;

function generateQRCode() {
  if (!_shareUrl) { showToast('Generate a share link first.'); return; }
  if (typeof QRCode === 'undefined') { showToast('QR library not loaded yet — try again.'); return; }

  const container = document.getElementById('qr-output');
  container.innerHTML = '';
  _qrInstance = null;
  try {
    _qrInstance = new QRCode(container, {
      text: _shareUrl,
      width: 160,
      height: 160,
      colorDark: '#0e0e0e',
      colorLight: '#f4f4f4',
      correctLevel: QRCode.CorrectLevel.M,
    });
    const dlBtn = document.getElementById('btn-dl-qr');
    if (dlBtn) { dlBtn.disabled = false; dlBtn.style.color = '#7aafff'; dlBtn.style.borderColor = 'rgba(122,175,255,0.3)'; }
  } catch(e) {
    container.innerHTML = '<span style="color:#ff716c;font-size:11px;padding:10px;">QR generation failed.</span>';
  }
}

function downloadQRCode() {
  if (!_qrInstance) { showToast('Generate QR first.'); return; }
  const img = document.querySelector('#qr-output img');
  const canvas = document.querySelector('#qr-output canvas');
  let dataURL;
  if (canvas) {
    // Scale up for high-res export
    const outCanvas = document.createElement('canvas');
    outCanvas.width  = 512;
    outCanvas.height = 512;
    const ctx = outCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(canvas, 0, 0, 512, 512);
    dataURL = outCanvas.toDataURL('image/png');
  } else if (img) {
    dataURL = img.src;
  } else {
    showToast('QR not ready yet.'); return;
  }
  const a = document.createElement('a');
  a.href     = dataURL;
  a.download = 'stage-core-qr.png';
  a.click();
  showToast('QR code downloaded.');
}

// ── On-load: detect share link in URL hash ────────────────
(function _detectShareMode() {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return;
  try {
    const encoded = hash.slice(7);
    const json    = decodeURIComponent(escape(atob(encoded)));
    const d       = JSON.parse(json);

    // Apply project data
    if (d.elements)    state.elements    = d.elements;
    if (d.connections) state.connections = d.connections;
    if (d.setlist)     state.setlist     = d.setlist;
    if (d.riderNeeds)  state.riderNeeds  = d.riderNeeds;
    if (d.segments)    state.segments    = d.segments;
    if (d.canvasBg) {
      state.canvasBg = d.canvasBg;
      const cv = document.getElementById('stage-canvas');
      if (cv) cv.style.backgroundColor = d.canvasBg;
    }

    // Mark read-only
    document.body.classList.add('share-mode');

    // ── Block ALL state-modifying interaction ──────────────────────────
    // Intercept every click: allow only nav-tab switches, block everything else
    document.addEventListener('click', e => {
      const isNav = e.target.closest('.nav-link') || e.target.closest('.mob-tab');
      if (isNav) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    // Block every mouse-down on stage canvas to prevent drag initiation
    document.addEventListener('mousedown', e => {
      if (e.target.closest('#stage-canvas')) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);

    // Block touch events on stage (mobile drag)
    document.addEventListener('touchstart', e => {
      if (e.target.closest('#stage-canvas')) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, { capture: true, passive: false });

    // Block all drag events globally
    document.addEventListener('dragstart', e => {
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);

    // Block ALL keyboard shortcuts (undo, delete, zoom, etc.)
    document.addEventListener('keydown', e => {
      e.stopImmediatePropagation();
      // Allow only Tab (for accessibility) and arrow keys for scroll
      if (!['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown'].includes(e.key)) {
        e.preventDefault();
      }
    }, true);

    // Re-render everything once DOM is ready
    requestAnimationFrame(() => {
      renderAll();
      if (typeof renderSetlist === 'function') renderSetlist();
      if (typeof renderRider   === 'function') renderRider();
    });
  } catch(e) {
    console.warn('[Stage Core] Failed to parse share link:', e);
  }
})();
