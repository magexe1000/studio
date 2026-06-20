// ══════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════
const SEGMENT_COLORS = ['#7aafff','#ff7439','#c8a2ff','#c5ffc9','#ff716c','#ffd700','#ff8dd4','#80cfff'];
let _segNextId = 1;
const state = {
  elements: [],
  connections: [],
  // ── Scenes (v3.0.63+) ─────────────────────────────────────
  // Up to 3 scenes per project. Each scene captures a stage plot
  // (its own elements, connections, and nextId). Other data
  // (members, gear, setlist, rider…) is shared across scenes.
  // The currently-active scene's elements/connections live in
  // `state.elements` / `state.connections`; the inactive scenes
  // are kept in `state.scenes[i]` and synced via
  // `_persistCurrentScene()` whenever we swap or save.
  scenes: [{ id: 's1', name: 'Scene 1', elements: [], connections: [], nextId: 1 }],
  currentSceneIdx: 0,
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
  canvasBg: '#0e0e0e',
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
    includeSections:'Include Sections', gearShort:'Gear / Load-In',
    verLabel:'Ver', lastUpdatedLabel:'Last Updated',
    staleWarning:'⚠ Plot may be outdated — last updated more than 30 days ago',
    noElements:'No elements placed on stage',
    placeholderLabel:'Placeholder',
    lightingPlaceholderText:'Lighting rider module is part of a future development roadmap. Attach a separate lighting specification document as needed.',
    mobExport:'Export', mobOptions:'Options',
    exportSettingsLabel:'Export Settings', formatLabel:'Format', sectionsLabel:'Sections',
    techNotesShort:'Tech Notes', lightingShort:'Lighting', shareQR:'Share / QR',
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
    connectOn:'Connect Mode ON', connectOff:'Connect Mode OFF',
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
    settingsCableLen:'Show Cable Length', settingsCableLenHint:'Display the approximate length of every connection in meters.',
    settingsAutoWire:'Auto Wire', settingsAutoWireHint:'Automatically connect compatible elements when placed.',
    settingsTheme:'App Theme', settingsThemeHint:'Choose the accent color scheme for the entire interface.',
    themeElectric:'Electric', themeLime:'Lime', themeCyan:'Cyan', themeAmber:'Amber', themeViolet:'Violet', themeRose:'Rose',
    // Library — Mics
    libSM58:'SM58', libCondenser:'Condenser', libAmpMic:'Amp Mic',
    libWireless:'Wireless', libBoundary:'Boundary', libDrumClip:'Drum Clip', libMicStand:'Mic Stand',
    // Library — People
    libPerformer:'Performer', libVocalist:'Vocalist', libGuitarist:'Guitarist',
    libBassist:'Bassist', libDrummer:'Drummer', libKeyboardist:'Keyboardist', libSaxophonist:'Saxophonist', libTech:'Tech',
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
    setupTitle:'Setup', setupSubtitle:'Your show documents & band info',
    setupRiderSub:'Channel list, mic inputs & tech requirements',
    setupSetlistSub:'Song order, timing & performance flow',
    setupGearSub:'Instruments, amps & load-in checklist',
    setupMembersSub:'Band roster, roles & contact info',
    backToSetup:'Setup',
    slSongsCount:'Songs Count', slTotalDuration:'Total Duration', slAvgEnergy:'Avg Energy',
    slSegments:'Segments',
    slCurrentArrangement:'Current\nArrangement', slAddNewTrack:'Add New Track',
    slSetlistInsights:'Setlist Insights',
    slTempoStability:'Tempo Stability', slKeyVariety:'Key Variety', slTransitionFluidity:'Transition Fluidity',
    slSections:'Sections',
    slAddSection:'Add Section',
    slOpeningSegment:'Opening Segment', slOpeningDesc:'A strong, high-energy opener to grab attention and establish competence.',
    slMainSet:'Main Set', slMainDesc:'The core journey — 3–4 song clusters alternating high & low energy in a "W" shape.',
    slClosingSegment:'Closing Segment', slClosingDesc:'A powerful crowd-pleaser to end the main set on a high note.',
    slEncore:'Encore', slEncoreDesc:'An optional final song or two — often a major hit after the main set concludes.',
    sngNewSong:'New Song', sngTitle:'Song Title', sngArtist:'Artist', sngBpm:'BPM',
    sngKey:'Key', sngDuration:'Duration (MM:SS)', sngNotes:'Notes', sngCancel:'Cancel',
    sngAddToSection:'Add to Section',
    prefTitle:'Preferences', prefSubtitle:'Customize your Stagex experience',
    prefAppearance:'Appearance', prefCanvas:'Canvas', prefEditor:'Editor', prefExport:'Export',
    prefStageBalance:'Stage Balance Visualizer', prefStageBalanceHint:'Show stage weight distribution when elements are placed.',
    prefElementLabels:'Element Labels', prefElementLabelsHint:'Display category and type labels below each element on the canvas.',
    prefAnimations:'Animations', prefAnimationsHint:'Enable smooth transitions and micro-animations throughout the interface.',
    prefSmartSuggestions:'Smart Suggestions', prefSmartSuggestionsHint:'Suggest optimal placement based on common stage configurations.',
    prefLastUpdated:'Last Updated Timestamp', prefLastUpdatedHint:'Show when the project was last modified in the editor status area.',
    exportLabel:'Export', exportOptions:'Options', exportFormat:'Format', exportSections:'Sections',
    gearTitle:'Gear', gearAddItem:'Add Item',
    gearTotalItems:'Total Items', gearCategories:'Categories', gearChecked:'Checked',
    gearLoadProgress:'Load Progress', gearPacked:'Packed', gearRemaining:'Remaining', gearTotalUnits:'Total Units',
    gearActiveInventory:'Active Inventory',
    membersTitle:'Members',
    batchSetlistManager:'Setlist Manager', batchImportTitle:'Batch Import',
    batchPasteHint:'Paste your song list below — one title per line. Or upload a .txt or .pdf file. Smart parsing handles numbered lists, bullets, and BPM / key hints.',
    batchUpload:'Upload .txt / .pdf', batchCancel:'Cancel',
    segAddSegment:'Add Segment', segSegmentName:'Segment Name', segColor:'Color', segCancel:'Cancel', segCreate:'Create Segment',
    smartSortPreview:'Smart Sort Preview', smartSortCancel:'Cancel', smartSortApply:'Apply & Export PDF',
    riderTitle:'Rider', setlistLabel:'Setlist',
    techNotesTitle:'Technical Notes',
    rdAddNeed:'Add Need',
  },
  es: {
    // PDF / Export
    coverLabel:'Rider Técnico',
    docId:'ID del documento', expDate:'Fecha de exportación', elements:'Elementos',
    stagePlot:'Diagrama de escenario', inputList:'Lista de canales', bandMembers:'Integrantes',
    connectivity:'Conectividad', riderReqs:'Requerimientos técnicos',
    setlist:'Setlist', lightingRider:'Rider de iluminación',
    techNotes:'Notas técnicas', gear:'Equipo / Carga',
    colCh:'CH#', colInstrument:'Instrumento', colPerformer:'Músico',
    colMicDI:'Mic / DI', colSource:'Fuente', colNotes:'Notas',
    colItem:'Artículo', colCategory:'Categoría', colQty:'Cant.',
    inputEmpty:'Agrega elementos en el Editor para llenar esta lista.',
    noGear:'Sin equipo — ve a la pestaña Equipo para armar tu lista.',
    noAssignments:'Sin asignaciones',
    signalPatch:'Parche de señal', signalSummary:'Resumen de señal',
    phantomCh:'Canales +48V', signalPaths:'Rutas de señal', totalEl:'Total de elementos',
    activeInputs:'Entradas activas', outputRoutes:'Salidas',
    noConns:'Sin conexiones — usa Conectar en el Editor para enlazar elementos.',
    noElems:'Sin elementos — el resumen aparecerá aquí al agregarlos.',
    scaleLabel:'Escala: 1:50', clickEdit:'Toca para editar',
    footerSub:'Editor profesional de diagrama de escenario y rider técnico',
    reqs:'Requerimientos técnicos',
    includeSections:'Incluir secciones', gearShort:'Equipo / Carga',
    verLabel:'Ver', lastUpdatedLabel:'Última actualización',
    staleWarning:'⚠ El diagrama puede estar desactualizado — más de 30 días sin modificarse',
    noElements:'Sin elementos en el escenario',
    placeholderLabel:'Marcador',
    lightingPlaceholderText:'El módulo de rider de iluminación forma parte de la hoja de ruta de desarrollo. Adjunta un documento de especificación de iluminación por separado si es necesario.',
    mobExport:'Exportar', mobOptions:'Opciones',
    exportSettingsLabel:'Ajustes de exportación', formatLabel:'Formato', sectionsLabel:'Secciones',
    techNotesShort:'Notas técnicas', lightingShort:'Iluminación', shareQR:'Compartir / QR',
    // UI — views & actions
    elementsOnStage:'Elementos en escenario', elementSingular:'Elemento',
    role:'rol', rolePlural:'roles',
    noStageAssign:'Sin asignaciones en escenario',
    assignedElems:'Elementos asignados', assignments:'Asignaciones',
    noGearYet:'Sin equipo aún',
    addGearHint:'Toca "Agregar" para armar tu lista de carga',
    noElemsRider:'Sin elementos en escenario',
    dragToCanvas:'Arrastra elementos al lienzo en el Editor para llenar esta lista.',
    savedLabel:'Guardado:', autosaveNever:'Autoguardado: nunca',
    projectSaved:'Proyecto guardado', noElemsToExport:'No hay elementos que exportar',
    csvExported:'Lista exportada como CSV',
    pdfSaved:'PDF guardado', pdfFailed:'Error al exportar PDF — intenta de nuevo',
    linkCopied:'Enlace copiado',
    maxMembers:'Máximo 8 integrantes',
    connectOn:'Modo Conectar ON', connectOff:'Modo Conectar OFF',
    connected:'Conectados', alreadyConnected:'Ya conectados',
    presetSaved:'Preset guardado', presetLoaded:'Preset cargado', presetDeleted:'Preset eliminado',
    fileDownloaded:'Archivo descargado',
    fileLoaded:'Proyecto cargado', fileLoadFail:'No se pudo cargar el archivo',
    clearConfirm:'¿Borrar todos los elementos del escenario? No se puede deshacer.',
    loadPresetConfirm:'¿Cargar preset "{name}"? Reemplazará el escenario actual.',
    delPresetConfirm:'¿Eliminar preset "{name}"? No se puede deshacer.',
    // Nav
    navEditor:'Editor', navRider:'Rider', navSetlist:'Setlist', navGear:'Equipo', navMembers:'Banda',
    saveBtnDesk:'Guardar / Presets', saveBtnMob:'Guardar', exportPdfBtn:'Exportar PDF',
    // Category bar
    catMics:'Micros', catDrums:'Batería', catInst:'Instrumentos', catAmps:'Amps', catAudio:'Audio', catUtil:'Utilería',
    // Accordion
    accMics:'Micrófonos', accDrums:'Batería', accInst:'Instrumentos', accAmps:'Amplificadores', accAudio:'Audio', accUtil:'Utilería',
    // Sidebar
    sbSectionLabel:'Elementos',
    // Toolbar
    tbGrid:'Grilla', tbSnap:'Ajuste', tbConnect:'Conectar', tbLines:'Líneas', tbClear:'Limpiar',
    // Status bar
    sbZoom:'Zoom', sbElements:'Elementos', sbLines:'Líneas', sbSel:'Sel', sbSystemReady:'Listo',
    autosaveOff:'AUTOGUARDADO: OFF', autosaveOn:'AUTOGUARDADO: ON',
    // Stage labels
    downstageLabel:'Frente / Público', dragHere:'Arrastra elementos aquí',
    // Properties panel
    propLabel:'Etiqueta', propPerformer:'Músico', propChannel:'Canal',
    propRotation:'Rotación', propScale:'Escala', propInputSrc:'Fuente de entrada',
    propOutput:'Salida', propRoles:'Roles', propNotes:'Notas',
    // Settings
    settingsTitle:'Ajustes',
    settingsLang:'Idioma', settingsLangHint:'Cambia el idioma de la app.',
    settingsNavOrder:'Orden de navegación', settingsNavOrderHint:'Arrastra para reordenar las pestañas.',
    settingsCanvasBg:'Fondo del lienzo', settingsCanvasBgHint:'Color de fondo del escenario.',
    settingsGridSize:'Tamaño de grilla', settingsGridSizeHint:'Espaciado de las líneas de la grilla.',
    settingsGridFine:'Fino', settingsGridNormal:'Normal', settingsGridCoarse:'Grueso',
    settingsStatusBar:'Barra de estado', settingsStatusBarHint:'Info en la parte inferior del editor.',
    settingsSnap:'Ajuste a grilla', settingsSnapHint:'Los elementos se ajustan al arrastrar.',
    settingsConn:'Mostrar conexiones', settingsConnHint:'Líneas entre elementos conectados.',
    settingsCableLen:'Mostrar largo del cable', settingsCableLenHint:'Muestra la longitud aproximada de cada conexión en metros.',
    settingsAutoWire:'Cableado automático', settingsAutoWireHint:'Conecta automáticamente elementos compatibles al colocarlos.',
    settingsTheme:'Tema', settingsThemeHint:'Color de acento de la interfaz.',
    themeElectric:'Eléctrico', themeLime:'Lima', themeCyan:'Cian', themeAmber:'Ámbar', themeViolet:'Violeta', themeRose:'Rosa',
    // Library — Mics
    libSM58:'SM58', libCondenser:'Condensador', libAmpMic:'Mic de instrumento',
    libWireless:'Inalámbrico', libBoundary:'PZM', libDrumClip:'Clip de batería', libMicStand:'Pedestal',
    // Library — People
    libPerformer:'Músico', libVocalist:'Vocalista', libGuitarist:'Guitarrista',
    libBassist:'Bajista', libDrummer:'Baterista', libKeyboardist:'Tecladista', libSaxophonist:'Saxofonista', libTech:'Técnico',
    // Library — Drums
    libDrumKit:'Batería', libEDrums:'Batería elec.', libPercussion:'Percusión', libCajon:'Cajón',
    // Library — Instruments
    libElecGuitar:'Guitarra elec.', libAcouGuitar:'Guitarra acús.', libBassGuitar:'Bajo',
    libKeyboard:'Teclado', libSynth:'Sintetizador', libDIBox:'Caja DI',
    libLoopStation:'Looper', libPlayback:'Playback', libBrass:'Vientos', libStrings:'Cuerdas',
    libShaker:'Shaker', libTambourine:'Pandereta',
    // Library — Amps
    libGuitarAmp:'Amp guitarra', libBassAmp:'Amp bajo', libAmpCab:'Gabinete guit.', libBassCab:'Gabinete bajo',
    // Library — Audio
    libWedge:'Monitor', libFloorPA:'PA de piso', libStageSub:'Sub escenario', libIEMPack:'Pack IEM',
    libDrumFill:'Fill batería', libDrumSub:'Sub batería', libSideFill:'Side fill',
    libMainPAL:'PA principal I', libMainPAR:'PA principal D', libDelayTower:'Torre delay',
    libFrontFill:'Front fill', libHeadphoneAmp:'Amp audífonos',
    // Library — Utilities
    libMixer:'Mezcladora', libPowerDistro:'Distro de poder', libStageBox:'Stage box', libPatchBay:'Patchera',
    libRouter:'Router', libSplitter:'Splitter', libFOHConsole:'Consola FOH', libMONConsole:'Consola MON',
    libAmpRack:'Rack amp', libEffectsRack:'Rack efectos', libWirelessRack:'Rack inalám.',
    libLaptop:'Laptop', libIntercom:'Intercom', libOutlet:'Tomacorriente',
    setupTitle:'Configuración', setupSubtitle:'Documentos del show e info de la banda',
    setupRiderSub:'Lista de canales, entradas de mic y requerimientos técnicos',
    setupSetlistSub:'Orden de canciones, tiempos y flujo del show',
    setupGearSub:'Instrumentos, amps y lista de carga',
    setupMembersSub:'Integrantes, roles e info de contacto',
    backToSetup:'Configuración',
    slSongsCount:'Canciones', slTotalDuration:'Duración total', slAvgEnergy:'Energía prom.',
    slSegments:'Segmentos',
    slCurrentArrangement:'Arreglo\nactual', slAddNewTrack:'Agregar canción',
    slSetlistInsights:'Análisis del setlist',
    slTempoStability:'Estabilidad de tempo', slKeyVariety:'Variedad de tonalidades', slTransitionFluidity:'Fluidez de transiciones',
    slSections:'Secciones',
    slAddSection:'Agregar sección',
    slOpeningSegment:'Segmento de apertura', slOpeningDesc:'Un inicio potente y de alta energía para captar la atención y establecer presencia.',
    slMainSet:'Set principal', slMainDesc:'El viaje central — bloques de 3–4 canciones alternando energía alta y baja en forma de "W".',
    slClosingSegment:'Segmento de cierre', slClosingDesc:'Un tema fuerte para terminar el set principal en alto.',
    slEncore:'Encore', slEncoreDesc:'Una o dos canciones opcionales al final — generalmente un hit después de cerrar el set principal.',
    sngNewSong:'Nueva canción', sngTitle:'Título', sngArtist:'Artista', sngBpm:'BPM',
    sngKey:'Tonalidad', sngDuration:'Duración (MM:SS)', sngNotes:'Notas', sngCancel:'Cancelar',
    sngAddToSection:'Agregar a sección',
    prefTitle:'Preferencias', prefSubtitle:'Personaliza tu experiencia en Stagex',
    prefAppearance:'Apariencia', prefCanvas:'Lienzo', prefEditor:'Editor', prefExport:'Exportar',
    prefStageBalance:'Balance de escenario', prefStageBalanceHint:'Muestra la distribución de peso del escenario al colocar elementos.',
    prefElementLabels:'Etiquetas de elementos', prefElementLabelsHint:'Muestra categoría y tipo debajo de cada elemento en el lienzo.',
    prefAnimations:'Animaciones', prefAnimationsHint:'Activa transiciones suaves y micro-animaciones en toda la interfaz.',
    prefSmartSuggestions:'Sugerencias inteligentes', prefSmartSuggestionsHint:'Sugiere ubicaciones óptimas basándose en configuraciones de escenario comunes.',
    prefLastUpdated:'Última actualización', prefLastUpdatedHint:'Muestra cuándo se modificó el proyecto por última vez.',
    exportLabel:'Exportar', exportOptions:'Opciones', exportFormat:'Formato', exportSections:'Secciones',
    gearTitle:'Equipo', gearAddItem:'Agregar',
    gearTotalItems:'Total', gearCategories:'Categorías', gearChecked:'Revisados',
    gearLoadProgress:'Avance de carga', gearPacked:'Empacados', gearRemaining:'Pendientes', gearTotalUnits:'Unidades',
    gearActiveInventory:'Inventario activo',
    membersTitle:'Banda',
    batchSetlistManager:'Gestor de setlist', batchImportTitle:'Importar en lote',
    batchPasteHint:'Pega tu lista de canciones abajo — un título por línea. O sube un archivo .txt o .pdf. El parser detecta listas numeradas, viñetas, y pistas de BPM / tonalidad.',
    batchUpload:'Subir .txt / .pdf', batchCancel:'Cancelar',
    segAddSegment:'Agregar segmento', segSegmentName:'Nombre del segmento', segColor:'Color', segCancel:'Cancelar', segCreate:'Crear segmento',
    smartSortPreview:'Vista previa de orden inteligente', smartSortCancel:'Cancelar', smartSortApply:'Aplicar y exportar PDF',
    riderTitle:'Rider', setlistLabel:'Setlist',
    techNotesTitle:'Notas técnicas',
    rdAddNeed:'Agregar',
  }
};
function T(key) { return (TRANSLATIONS[state.lang]||TRANSLATIONS.en)[key] || TRANSLATIONS.en[key] || key; }
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = T(key);
    if (val.includes('\n')) {
      el.innerHTML = val.replace(/\n/g, '<br>');
    } else {
      el.textContent = val;
    }
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
    { name: 'Mic Stand',   nameKey:'libMicStand',    icon: 'cx-mic-stand',     type: 'Mic Stand' },
  ],
  people: [
    { name: 'Performer',   nameKey:'libPerformer',   icon: 'cx-person',        type: 'Person' },
    { name: 'Vocalist',    nameKey:'libVocalist',    icon: 'cx-vocalist',      type: 'Person' },
    { name: 'Guitarist',   nameKey:'libGuitarist',   icon: 'cx-guitarist',     type: 'Person' },
    { name: 'Bassist',     nameKey:'libBassist',     icon: 'cx-bassist',       type: 'Person' },
    { name: 'Drummer',     nameKey:'libDrummer',     icon: 'cx-drummer',       type: 'Person' },
    { name: 'Keyboardist', nameKey:'libKeyboardist', icon: 'cx-keyboardist',   type: 'Person' },
    { name: 'Saxophonist', nameKey:'libSaxophonist', icon: 'cx-saxophonist',   type: 'Person' },
    { name: 'Tech',        nameKey:'libTech',        icon: 'cx-tech',          type: 'Person' },
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
//  PHOTO ICON MAP — maps icon names to realistic SVG files
// ══════════════════════════════════════════════════════════
const ICON_IMAGES = {
  // ── Mics ──────────────────────────────────────────────
  'mic':                '/stage-core/icons/mic-sm58.png',
  'mic-2':              '/stage-core/icons/mic-condenser.png',
  'cx-wireless':        '/stage-core/icons/wireless-handheld.png',
  'cx-boundary':        '/stage-core/icons/boundary-mic.png',
  'cx-drum-clip':       '/stage-core/icons/drum-clip.png',
  'cx-mic-stand':       '/stage-core/icons/mic-stand.svg',
  // ── Drums ─────────────────────────────────────────────
  'drum':               '/stage-core/icons/drum-kit.png',
  'cx-edrum':           '/stage-core/icons/edrum.png',
  'cx-percussion':      '/stage-core/icons/percussion.png',
  'cx-cajon':           '/stage-core/icons/cajon.svg',
  'cx-shaker':          '/stage-core/icons/shaker.svg',
  'cx-tambourine':      '/stage-core/icons/tambourine.svg',
  // ── Instruments ───────────────────────────────────────
  'guitar':             '/stage-core/icons/acoustic-guitar.png',
  'cx-elec-guitar':     '/stage-core/icons/elec-guitar.png',
  'cx-bass-guitar':     '/stage-core/icons/bass-guitar.png',
  'piano':              '/stage-core/icons/keyboard.png',
  'cx-synth':           '/stage-core/icons/synth.png',
  'cx-trumpet':         '/stage-core/icons/trumpet.png',
  'cx-violin':          '/stage-core/icons/violin.png',
  // ── Amps ──────────────────────────────────────────────
  'cx-guitar-amp':      '/stage-core/icons/guitar-amp.png',
  'cx-bass-amp':        '/stage-core/icons/bass-amp.png',
  'cx-amp-cab':         '/stage-core/icons/amp-cab.png',
  'cx-bass-cab':        '/stage-core/icons/bass-cab.png',
  // ── Audio / Monitors ──────────────────────────────────
  'cx-wedge':           '/stage-core/icons/wedge.png',
  'volume-2':           '/stage-core/icons/main-pa.png',
  'disc':               '/stage-core/icons/stage-sub.png',
  'headphones':         '/stage-core/icons/iem-pack.png',
  'speaker':            '/stage-core/icons/drum-fill.png',
  'disc-2':             '/stage-core/icons/drum-sub.svg',
  'megaphone':          '/stage-core/icons/side-fill.png',
  'radio':              '/stage-core/icons/delay-tower.svg',
  'cx-front-fill':      '/stage-core/icons/front-fill.png',
  'headset':            '/stage-core/icons/headphone-amp.svg',
  // ── Utilities ─────────────────────────────────────────
  'sliders-vertical':   '/stage-core/icons/foh-console.png',
  'sliders-horizontal': '/stage-core/icons/mon-console.png',
  'server':             '/stage-core/icons/amp-rack.png',
  'cpu':                '/stage-core/icons/effects-rack.png',
  'cx-wireless-rack':   '/stage-core/icons/wireless-rack.png',
  'laptop':             '/stage-core/icons/laptop.svg',
  'cx-di-box':          '/stage-core/icons/di-box.png',
  'repeat-2':           '/stage-core/icons/loop-station.svg',
  'play-circle':        '/stage-core/icons/playback.svg',
  'box':                '/stage-core/icons/stage-box.png',
  'grid-3x3':           '/stage-core/icons/patch-bay.png',
  'zap':                '/stage-core/icons/power-distro.png',
  'git-branch':         '/stage-core/icons/splitter.png',
  'network':            '/stage-core/icons/router.svg',
  'cx-outlet':          '/stage-core/icons/outlet.webp',
  // ── People ────────────────────────────────────────────
  'cx-person':          '/stage-core/icons/person.png',
  'cx-vocalist':        '/stage-core/icons/vocalist.png',
  'cx-guitarist':       '/stage-core/icons/guitarist.png',
  'cx-bassist':         '/stage-core/icons/bassist.png',
  'cx-drummer':         '/stage-core/icons/drummer.png',
  'cx-keyboardist':     '/stage-core/icons/keyboardist.png',
  'cx-saxophonist':     '/stage-core/icons/saxophonist.png',
  'cx-tech':            '/stage-core/icons/tech.png',
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

  /* WIRELESS HANDHELD MIC — cylindrical body, antenna sticking out at side */
  'cx-wireless': `
    <rect x="9" y="8" width="6" height="13" rx="3"/>
    <circle cx="12" cy="5" r="3"/>
    <line x1="18" y1="9" x2="22" y2="5"/>
    <line x1="22" y1="5" x2="22" y2="1"/>`,

  /* PZM / BOUNDARY MIC — flat base plate, small capsule dome on top */
  'cx-boundary': `
    <rect x="3" y="16" width="18" height="4" rx="1.5"/>
    <path d="M9 16 Q9 11 12 11 Q15 11 15 16"/>
    <circle cx="12" cy="10" r="2" fill="currentColor"/>`,

  /* WIRELESS RACK — rack unit with two angled antennas */
  'cx-wireless-rack': `
    <rect x="2" y="7" width="20" height="10" rx="1.5"/>
    <line x1="7" y1="7" x2="4" y2="2"/>
    <line x1="4" y1="2" x2="6" y2="2"/>
    <line x1="17" y1="7" x2="20" y2="2"/>
    <line x1="20" y1="2" x2="18" y2="2"/>
    <circle cx="8"  cy="12" r="2.2"/>
    <circle cx="16" cy="12" r="2.2"/>`,

  /* FRONT FILL SPEAKER — small wide low-profile cabinet angled up */
  'cx-front-fill': `
    <path d="M3 20 L21 20 L21 14 L3 17 Z"/>
    <circle cx="12" cy="17.5" r="2.5"/>
    <circle cx="12" cy="17.5" r="1" fill="currentColor"/>`,

  /* DI BOX — compact box with XLR connectors on both sides */
  'cx-di-box': `
    <rect x="5" y="7" width="14" height="10" rx="2"/>
    <line x1="2" y1="12" x2="5" y2="12"/>
    <circle cx="2" cy="12" r="1.3"/>
    <line x1="19" y1="12" x2="22" y2="12"/>
    <circle cx="22" cy="12" r="1.3"/>
    <circle cx="12" cy="12" r="2"/>`,

  /* MIC STAND — boom stand with adjustable arm, tripod base */
  'cx-mic-stand': `
    <line x1="12" y1="3" x2="12" y2="19"/>
    <line x1="7" y1="3" x2="19" y2="3"/>
    <circle cx="7" cy="3" r="1.2" fill="currentColor"/>
    <circle cx="12" cy="3" r="1" fill="currentColor"/>
    <line x1="12" y1="19" x2="6"  y2="24"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="12" y1="19" x2="18" y2="24"/>`,

  /* PERSON / PERFORMER — simple human silhouette */
  'cx-person': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>`,

  'cx-vocalist': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <line x1="12" y1="14" x2="12" y2="24"/>
    <circle cx="12" cy="11" r="1.5" fill="currentColor"/>`,

  'cx-guitarist': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <path d="M7 16 L17 12 L18 14 L8 18 Z" fill="currentColor"/>`,

  'cx-bassist': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <path d="M7 17 L18 12 L19 14 L8 19 Z" fill="currentColor"/>`,

  'cx-drummer': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <rect x="6" y="16" width="12" height="6" rx="1" fill="none" stroke="currentColor"/>
    <ellipse cx="12" cy="16" rx="6" ry="1" fill="currentColor"/>`,

  'cx-keyboardist': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <rect x="4" y="15" width="16" height="3" fill="currentColor"/>`,

  'cx-saxophonist': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <path d="M12 9 Q10 11 10 16 Q13 18 14 16 L13 14" fill="none" stroke="currentColor"/>`,

  'cx-tech': `
    <circle cx="12" cy="5.5" r="3.5"/>
    <path d="M6 22 Q6 14 12 14 Q18 14 18 22"/>
    <rect x="9" y="14" width="6" height="7" rx="0.5" fill="currentColor"/>`,
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
    svg.innerHTML = DOMPurify.sanitize(svgContent);
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
function updateSetupHubCounts() {
  const riderBadge = document.getElementById('hub-counter-rider');
  const setlistBadge = document.getElementById('hub-counter-setlist');
  const gearBadge = document.getElementById('hub-counter-gear');
  const membersBadge = document.getElementById('hub-counter-members');

  if (riderBadge) {
    const activeChannels = state.elements.length;
    riderBadge.textContent = activeChannels === 1 ? '1 Channel' : `${activeChannels} Channels`;
  }
  if (setlistBadge) {
    const songCount = state.setlist.length;
    setlistBadge.textContent = songCount === 1 ? '1 Song' : `${songCount} Songs`;
  }
  if (gearBadge) {
    const gearCount = state.gear.length;
    gearBadge.textContent = gearCount === 1 ? '1 Item' : `${gearCount} Items`;
  }
  if (membersBadge) {
    const memberCount = state.members.length;
    membersBadge.textContent = memberCount === 1 ? '1 Member' : `${memberCount} Members`;
  }
}

function switchView(view) {
  // Map React-facing view names to internal iframe view names
  if (view === 'Preferences') view = 'Assistant';
  // Capture real canvas size before the Editor gets hidden
  if (state.currentView === 'Editor') {
    const r = stageCanvas.getBoundingClientRect();
    if (r.width > 0) { state.canvasW = r.width; state.canvasH = r.height; }
  }
  if (state.currentView === 'Rider' && _riderPreviewObserver) {
    _riderPreviewObserver.disconnect(); _riderPreviewObserver = null;
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
      page.style.transform = 'translateY(10px) scale(0.985)';
      page.classList.add('view-entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          page.style.opacity = '1';
          page.style.transform = 'translateY(0) scale(1)';
        });
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
  try {
    if (view === 'Editor') { renderElements(); lcIcons(); renderScenesBar(); }
    else { const _sb = document.getElementById('sc-scenes-bar'); if (_sb) _sb.style.display = 'none'; }
    if (view === 'SetupHub') updateSetupHubCounts();
    if (view === 'Rider') refreshRider();
    if (view === 'Setlist') renderSetlist();
    if (view === 'Gear') { renderGear(); lcIcons(); }
    if (view === 'Members') { renderMembersView(); lcIcons(); }
    if (view === 'Export') { if (prevView !== 'Export') state.prevView = prevView || 'Editor'; refreshExport(); }
  } catch (err) {
    console.error("Error refreshing view content for: " + view, err);
  }
  // Notify the React wrapper of view changes (shows/hides its back button)
  try { if (window.__onViewChange) window.__onViewChange(view); } catch(e) {}
  // Desktop: show category top bar only on Editor view
  const deskBar  = document.getElementById('desktop-cat-bar');
  const deskTray = document.getElementById('desktop-el-tray');
  if (deskBar) deskBar.classList.toggle('desk-bar-visible', view === 'Editor' && window.innerWidth >= 768);
  if (deskTray) { deskTray.classList.remove('desk-tray-open'); deskTray.innerHTML = DOMPurify.sanitize(''); }
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

  // ── Sticky-focus killer for the left toolbar ──────────────────────────
  // On touch, tapped buttons keep focus / pseudo-state until the user taps
  // somewhere else, which made the toggles look "stuck selected" after
  // toggling them off. Removing focusability + blurring on touchend gives a
  // clean unselected look the instant the finger lifts.
  document.querySelectorAll('.sc-vtool-btn').forEach(b => {
    b.setAttribute('tabindex', '-1');
  });
  const _toolbarBlur = () => {
    const el = document.activeElement;
    if (el && el.classList && el.classList.contains('sc-vtool-btn')) {
      try { el.blur(); } catch (_) {}
    }
  };
  document.addEventListener('touchend',  _toolbarBlur, { passive: true });
  document.addEventListener('pointerup', _toolbarBlur, { passive: true });

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
  tray.innerHTML = DOMPurify.sanitize('');
  (library[cat] || []).forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'mob-el-btn';
    if (item._isCreate) {
      btn.style.cssText = 'border:1px dashed rgba(122,175,255,0.4);color:#7aafff;';
      btn.innerHTML = DOMPurify.sanitize(`<span style="font-size:18px;line-height:1;">+</span><span>New</span>`);
      btn.addEventListener('click', () => { closeMobileElTray(); openCustomElementModal(); });
    } else if (item.isCustom) {
      const iconMob = item.imageData
        ? `<img src="${item.imageData}" style="width:22px;height:22px;object-fit:contain;" draggable="false"/>`
        : `<span style="font-size:18px;line-height:1;">${item.emoji || '🎵'}</span>`;
      btn.innerHTML = DOMPurify.sanitize(`${iconMob}<span>${item.name}</span>`);
      btn.addEventListener('click', () => { addItemToStage(item); });
    } else {
      btn.innerHTML = DOMPurify.sanitize(`${iconHtml(item.icon,22,'color:#7aafff;')}<span>${item.name}</span>`);
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
  { cat: 'people', icon: 'person',                    label: 'People'      },
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
    chip.innerHTML = DOMPurify.sanitize(`<span class="material-symbols-outlined sc-dial-chip-icon" style="color:${iconColor}">${item.icon}</span><span>${item.label}</span>`);
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
  updateDropHint();
  try { window.parent.postMessage({ type: 'sc-dial-state', open: true }, '*'); } catch(e) {}
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
  updateDropHint();
  try { window.parent.postMessage({ type: 'sc-dial-state', open: false }, '*'); } catch(e) {}
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
  try { window.parent.postMessage({ type: 'sc-dial-state', open: true }, '*'); } catch(e) {}

  const sheet   = document.getElementById('sc-item-sheet');
  const titleEl = document.getElementById('sc-item-sheet-title');
  const listEl  = document.getElementById('sc-item-list');
  const wrap    = document.getElementById('sc-fab-wrap');
  if (!sheet || !listEl) return;

  if (titleEl) titleEl.textContent = label;
  listEl.innerHTML = DOMPurify.sanitize('');

  (library[cat] || []).forEach(item => {
    const btn = document.createElement('button');
    if (item._isCreate) {
      btn.className = 'sc-item-btn sc-item-btn--create';
      btn.innerHTML = DOMPurify.sanitize(`<span class="sc-item-btn-icon"><span class="material-symbols-outlined" style="font-size:15px;">add</span></span><span class="sc-item-btn-name">New Custom</span>`);
      btn.addEventListener('click', () => { closeItemSheet(false); openCustomElementModal(); });
    } else if (item.isCustom) {
      btn.className = 'sc-item-btn';
      const ico = item.imageData
        ? `<img src="${item.imageData}" style="width:20px;height:20px;object-fit:contain;" draggable="false"/>`
        : `<span style="font-size:15px;line-height:1;">${item.emoji || '🎵'}</span>`;
      btn.innerHTML = DOMPurify.sanitize(`<span class="sc-item-btn-icon">${ico}</span><span class="sc-item-btn-name">${item.name}</span>`);
      btn.addEventListener('click', () => { addItemToStage(item); closeItemSheet(false); });
    } else {
      btn.className = 'sc-item-btn';
      btn.innerHTML = DOMPurify.sanitize(`<span class="sc-item-btn-icon">${iconHtml(item.icon, 16, 'color:#7aafff;')}</span><span class="sc-item-btn-name">${item.name}</span>`);
      btn.addEventListener('click', () => { addItemToStage(item); closeItemSheet(false); });
    }
    listEl.appendChild(btn);
  });
  lcIcons();

  // Show sheet + keep FAB in × state
  setTimeout(() => {
    if (wrap) wrap.classList.add('sc-items-open');
    sheet.classList.add('sc-sheet-open');
    updateDropHint();
  }, 100);
}

function closeItemSheet(goBackToChips) {
  const sheet = document.getElementById('sc-item-sheet');
  const wrap  = document.getElementById('sc-fab-wrap');
  if (sheet) sheet.classList.remove('sc-sheet-open');
  if (wrap)  wrap.classList.remove('sc-items-open');
  updateDropHint();
  if (goBackToChips) {
    setTimeout(() => openSCDial(), 190);
  } else {
    try { window.parent.postMessage({ type: 'sc-dial-state', open: false }, '*'); } catch(e) {}
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

const boundsCache = {};

function getAssetAlphaBounds(src, callback) {
  if (!src) { callback({ left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 }); return; }
  if (boundsCache[src]) {
    callback(boundsCache[src]);
    return;
  }
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const maxDim = 100;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let hasAlpha = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const alpha = data[idx + 3];
          if (alpha > 10) {
            hasAlpha = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      
      let result;
      if (!hasAlpha) {
        result = { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 };
      } else {
        result = {
          left: minX / w,
          top: minY / h,
          right: maxX / w,
          bottom: maxY / h,
          width: (maxX - minX) / w,
          height: (maxY - minY) / h
        };
      }
      boundsCache[src] = result;
      callback(result);
    } catch (e) {
      const fallback = { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 };
      boundsCache[src] = fallback;
      callback(fallback);
    }
  };
  img.onerror = () => {
    const fallback = { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 };
    boundsCache[src] = fallback;
    callback(fallback);
  };
  img.src = src;
}

function isPointerInBounds(e, dom, el) {
  const icon = dom.querySelector('.el-icon img');
  if (!icon) return true;
  
  const src = icon.getAttribute('src');
  const bounds = boundsCache[src];
  if (!bounds) return true;
  
  const rect = icon.getBoundingClientRect();
  const imgW = icon.offsetWidth || 44;
  const imgH = icon.offsetHeight || 44;
  
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  
  const rx = e.clientX - cx;
  const ry = e.clientY - cy;
  
  const angleRad = (el.rotation || 0) * Math.PI / 180;
  
  const rxUn = rx * Math.cos(-angleRad) - ry * Math.sin(-angleRad);
  const ryUn = rx * Math.sin(-angleRad) + ry * Math.cos(-angleRad);
  
  const lx = rxUn + imgW / 2;
  const ly = ryUn + imgH / 2;
  
  const px = lx / imgW;
  const py = ly / imgH;
  
  return px >= bounds.left && px <= bounds.right && py >= bounds.top && py <= bounds.bottom;
}

function repositionResizeBar(wrap) {
  const bar = wrap.querySelector('.el-resize-bar');
  if (!bar) return;
  if (!wrap.classList.contains('selected')) return;

  const canvas = document.getElementById('stage-canvas') || document.body;
  const canvasRect = canvas.getBoundingClientRect();

  const elId = wrap.id.replace('elem-', '');
  const elementObj = state.elements.find(e => e.id === elId);
  if (!elementObj) return;

  const scale = elementObj.scale / 100;
  const zoom = state.zoom || 1;

  const isMobile = window.innerWidth < 768;
  const targetOnScreenScale = isMobile ? 0.82 : 1.0;
  const scaleCorrection = targetOnScreenScale / (scale * zoom);

  const barW = 140;
  const barH = 32;

  let absX = elementObj.x - barW / 2;
  let absY = elementObj.y - 40;

  const pad = 12;
  let finalAbsX = Math.max(pad, Math.min(canvasRect.width - barW - pad, absX));
  let finalAbsY = Math.max(pad, Math.min(canvasRect.height - barH - pad, absY));

  const relX = (finalAbsX - elementObj.x) / (scale * zoom);
  const relY = (finalAbsY - elementObj.y) / (scale * zoom);

  bar.style.position = 'absolute';
  bar.style.top = '0px';
  bar.style.left = '0px';
  bar.style.transform = `translate(${relX}px, ${relY}px) scale(${scaleCorrection})`;
}

function getDefaultScale(item) {
  const isMobile = window.innerWidth < 768;
  const baseScale = isMobile ? 65 : 100;
  if (!item) return baseScale;
  const type = (item.type || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  const icon = (item.icon || '').toLowerCase();

  if (type.includes('drum') || icon.includes('drum')) {
    return isMobile ? 80 : 125;
  }
  if (type.includes('person') || icon.includes('person') || icon.includes('performer') || icon.includes('vocalist') || icon.includes('bassist') || icon.includes('drummer') || icon.includes('guitarist') || icon.includes('keyboardist') || icon.includes('saxophonist') || icon.includes('tech')) {
    return isMobile ? 78 : 120;
  }
  if (type.includes('mic') || type.includes('stand') || icon.includes('mic') || name.includes('sm58') || name.includes('wireless') || name.includes('condenser')) {
    return isMobile ? 55 : 85;
  }
  if (type.includes('guitar') || icon.includes('guitar') || name.includes('guitar') || icon.includes('bass')) {
    return isMobile ? 75 : 115;
  }
  if (type.includes('amplifier') || type.includes('cabinet') || type.includes('cab') || type.includes('speaker') || type.includes('wedge') || type.includes('fill') || type.includes('pa') || icon.includes('amp') || icon.includes('cab') || icon.includes('wedge') || icon.includes('speaker') || icon.includes('volume') || name.includes('amp') || name.includes('cab')) {
    return isMobile ? 75 : 115;
  }
  return isMobile ? 65 : 100;
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
    scale: getDefaultScale(item),
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
    div.innerHTML = DOMPurify.sanitize(`
      <span style="font-size:22px;line-height:1;margin-bottom:3px;">+</span>
      <span class="font-bold text-center" style="font-size:8px;text-transform:uppercase;letter-spacing:-0.01em;line-height:1.1;color:#7aafff;">New</span>`);
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
  div.innerHTML = DOMPurify.sanitize(`
    ${iconContent}
    <span class="font-bold text-on-surface-variant text-center" style="font-size:8px;text-transform:uppercase;letter-spacing:-0.01em;line-height:1.1;">${displayName}</span>`);
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
    grid.innerHTML = DOMPurify.sanitize('');
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

// ── Properties panel: no hover behavior needed for top-slide panel ──

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
    tray.innerHTML = DOMPurify.sanitize('');
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
      setTimeout(() => { if (!tray.classList.contains('desk-tray-open')) tray.innerHTML = DOMPurify.sanitize(''); }, 150);
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
    scale: getDefaultScale(raw),
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
  elIcon.innerHTML = DOMPurify.sanitize(buildIconsHTML(el));
  lcIcons();
}

function updatePropIconSym(el) {
  const propIconSym = document.getElementById('prop-icon-sym');
  if (!propIconSym) return;
  const roles = el.roles || [];
  if (roles.length === 0) {
    propIconSym.innerHTML = DOMPurify.sanitize(iconHtml(el.icon, 28));
    propIconSym.style.cssText = `width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:${el.color};`;
  } else {
    const all = [el, ...roles];
    const sz = all.length <= 2 ? 22 : 16;
    propIconSym.style.cssText = `width:56px;height:56px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:3px;color:${el.color};`;
    propIconSym.innerHTML = DOMPurify.sanitize(all.map(r => iconHtml(r.icon, sz)).join(''));
  }
  lcIcons();
}

function renderRolesList(el) {
  const list = document.getElementById('roles-list');
  const addBtn = document.getElementById('add-role-btn');
  if (!list) return;
  const roles = el.roles || [];
  if (roles.length === 0) {
    list.innerHTML = DOMPurify.sanitize(`<p style="font-size:10px;color:#484847;font-style:italic;padding:4px 0;">No additional roles assigned.</p>`);
  } else {
    list.innerHTML = DOMPurify.sanitize(roles.map(role => `
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
    `).join(''));
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
  grid.innerHTML = DOMPurify.sanitize('');
  (library[cat] || []).forEach(item => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:5px 2px;height:44px;width:100%;background:#0e0e0e;border:1px solid transparent;cursor:pointer;transition:border-color 0.15s;';
    btn.innerHTML = DOMPurify.sanitize(`${iconHtml(item.icon,16,'color:#7aafff;')}<span style="font-size:6px;font-weight:700;text-transform:uppercase;color:#adaaaa;text-align:center;line-height:1.2;word-break:break-all;">${item.name}</span>`);
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
  layer.innerHTML = DOMPurify.sanitize('');
  state.elements.forEach(el => createElementDOM(el));
  renderConnections();
  updateStatusBar();
  // Scope to the layer only — never scan the full document (very slow)
  lcIcons(layer);
  updateDropHint();
}

function createElementDOM(el) {
  const layer = document.getElementById('elements-layer');
  const wrap = document.createElement('div');
  wrap.className = 'stage-element' + (state.selectedId === el.id ? ' selected' : '') + (_spawnId === el.id ? ' spawning' : '');
  wrap.id = 'elem-' + el.id;
  wrap.style.cssText = `left:${el.x}px;top:${el.y}px;transform:translate(-50%,-50%) scale(${el.scale/100});--el-color:${el.color};`;

  wrap.innerHTML = DOMPurify.sanitize(`
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
      <button title="Larger" data-action="larger"><span class="material-symbols-outlined" style="font-size:15px;">add</span></button>
      <span class="el-scale-display">${el.scale}%</span>
      <button title="Smaller" data-action="smaller"><span class="material-symbols-outlined" style="font-size:15px;">remove</span></button>
      <button title="Rotate" data-action="rotate"><span class="material-symbols-outlined" style="font-size:15px;">rotate_left</span></button>
      <div style="width:1px;height:16px;background:rgba(255,255,255,0.08);margin:0 2px;"></div>
      <button title="Remove" data-action="remove" style="color:rgba(255,113,108,0.7);">
        <span class="material-symbols-outlined" style="font-size:15px;">delete</span>
      </button>
    </div>`);

  const src = el.imageData || ICON_IMAGES[el.icon];
  if (src) {
    getAssetAlphaBounds(src, (bounds) => {
      wrap.dataset.bounds = JSON.stringify(bounds);
      if (state.selectedId === el.id) {
        repositionResizeBar(wrap);
      }
    });
  }

  // Click to select / drag (pointer events – mouse & trackpad only; touch uses touchstart below)
  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // handled by touchstart
    if (e.button !== 0) return;
    if (!isPointerInBounds(e, wrap, el)) {
      const prevPE = wrap.style.pointerEvents;
      wrap.style.pointerEvents = 'none';
      const behind = document.elementFromPoint(e.clientX, e.clientY);
      wrap.style.pointerEvents = prevPE;
      if (behind && behind !== wrap) {
        const newEvent = new MouseEvent(e.type, e);
        behind.dispatchEvent(newEvent);
        return;
      }
    }
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
  // Touch: select + drag on mobile (or fire connect in connect mode)
  wrap.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!isPointerInBounds(touch, wrap, el)) {
      const prevPE = wrap.style.pointerEvents;
      wrap.style.pointerEvents = 'none';
      const behind = document.elementFromPoint(touch.clientX, touch.clientY);
      wrap.style.pointerEvents = prevPE;
      if (behind && behind !== wrap) {
        const newEvent = new TouchEvent(e.type, {
          touches: Array.from(e.touches),
          targetTouches: Array.from(e.targetTouches),
          changedTouches: Array.from(e.changedTouches),
          bubbles: true,
          cancelable: true
        });
        behind.dispatchEvent(newEvent);
        return;
      }
    }
    e.stopPropagation();
    // In connect mode, a tap means "pick this element for the connection",
    // NOT drag it. Mirrors the mouse path in the pointerdown handler above.
    if (state.connectMode) {
      handleConnectClick(el.id);
      return;
    }
    selectElement(el.id);
    if (!e.target.closest('.el-resize-bar')) {
      startTouchDragElement(touch, el);
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
    repositionResizeBar(wrap);
  });
  const removeBtn = wrap.querySelector('[data-action="remove"]');
  removeBtn.addEventListener('mousedown', e => { e.stopPropagation(); removeSelected(); });
  removeBtn.addEventListener('click',     e => { e.stopPropagation(); });

  layer.appendChild(wrap);
}

let _scaleHistoryTid = 0;
let _scaleAnimTid = 0;
function scaleElementBy(el, delta) {
  el.scale = Math.max(30, Math.min(300, (el.scale || 100) + delta));
  const dom = document.getElementById('elem-' + el.id);
  if (dom) {
    dom.classList.add('scaling');
    dom.style.transform = `translate(-50%,-50%) scale(${el.scale/100})`;
    const disp = dom.querySelector('.el-scale-display');
    if (disp) disp.textContent = el.scale + '%';
    clearTimeout(_scaleAnimTid);
    _scaleAnimTid = setTimeout(() => dom.classList.remove('scaling'), 250);
    repositionResizeBar(dom);
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
  var isLand = _isLandscapeMobile();
  if (isLand && newState === 'peek') newState = 'open';
  const p = document.getElementById('properties-panel');
  if (!p) return;
  p.classList.remove('prop-open', 'prop-peek');
  if (newState === 'open') p.classList.add('prop-open');
  else if (newState === 'peek') p.classList.add('prop-peek');
  var _tb = document.getElementById('bottom-toolbar');
  if (_tb) {
    if (newState === 'open') _tb.classList.add('tb-dragging');
    else _tb.classList.remove('tb-dragging');
  }
  if ((newState === 'open' || newState === 'peek') && _dialOpen) {
    closeSCDial();
  }
  if (isLand) {
    var fab = document.getElementById('sc-fab-wrap');
    if (fab) {
      var hide = (newState === 'open' || newState === 'peek');
      fab.style.opacity = hide ? '0' : '';
      fab.style.pointerEvents = hide ? 'none' : '';
      fab.style.visibility = hide ? 'hidden' : '';
    }
  }
  try {
    window.parent.postMessage({ type: 'sc-prop-state', state: newState }, '*');
  } catch(e) {}
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
window.addEventListener('orientationchange', function() {
  setPropState('hidden');
  _rescaleElementsOnResize();
});
try {
  var _landscapeMql = window.matchMedia('(orientation: landscape) and (max-width: 960px)');
  _landscapeMql.addEventListener('change', function(e) {
    setPropState('hidden');
    setTimeout(_rescaleElementsOnResize, 200);
  });
} catch(e) {}

function _rescaleElementsOnResize() {
  var canvas = document.getElementById('stage-canvas');
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  if (!state.canvasW || !state.canvasH) {
    state.canvasW = rect.width;
    state.canvasH = rect.height;
    return;
  }
  var oldW = state.canvasW;
  var oldH = state.canvasH;
  if (Math.abs(oldW - rect.width) < 2 && Math.abs(oldH - rect.height) < 2) return;
  var scaleX = rect.width / oldW;
  var scaleY = rect.height / oldH;
  state.elements.forEach(function(el) {
    el.x = Math.max(20, Math.min(rect.width - 20, el.x * scaleX));
    el.y = Math.max(20, Math.min(rect.height - 20, el.y * scaleY));
  });
  state.canvasW = rect.width;
  state.canvasH = rect.height;
  renderElements();
}
// Drag peek — fully hidden while moving, peek when released (unless dismissed)
function _propPeek(on) {
  if (on) {
    if (_getPropState() !== 'hidden') setPropState('hidden');
  } else {
    if (!_propUserDismissed && state.selectedId) setPropState('open');
  }
}
function _isLandscapeMobile() {
  try { return window.matchMedia('(orientation: landscape) and (max-width: 960px)').matches; } catch(e) { return false; }
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
  wrap.style.willChange = 'left, top';
  _propPeek(true);
  var _tb = document.getElementById('bottom-toolbar');
  if (_tb) _tb.classList.add('tb-dragging');

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
    window._cancelActiveDrag = null;
    wrap.removeEventListener('pointermove', onMove);
    wrap.removeEventListener('pointerup', onUp);
    wrap.removeEventListener('pointercancel', cleanup);
    wrap.removeEventListener('lostpointercapture', cleanup);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    try { wrap.releasePointerCapture(e.pointerId); } catch(_) {}
    wrap.classList.remove('dragging');
    wrap.style.willChange = '';
    _propPeek(false);
    var _tb2 = document.getElementById('bottom-toolbar');
    if (_tb2) _tb2.classList.remove('tb-dragging');
    repositionResizeBar(wrap);
  };

  window._cancelActiveDrag = cleanup;
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
  var _tb = document.getElementById('bottom-toolbar');
  if (_tb) _tb.classList.add('tb-dragging');
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
    window._cancelActiveDrag = null;
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onEnd);
    window.removeEventListener('touchcancel', onEnd);
    state.canvasW = rect.width; state.canvasH = rect.height;
    _propPeek(false);
    var _tb2 = document.getElementById('bottom-toolbar');
    if (_tb2) _tb2.classList.remove('tb-dragging');
    pushHistory();
    const dom = document.getElementById('elem-' + el.id);
    if (dom) repositionResizeBar(dom);
  };
  window._cancelActiveDrag = onEnd;
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
  window.addEventListener('touchcancel', onEnd);
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
  if (dom) {
    dom.classList.add('selected');
    repositionResizeBar(dom);
  }
  updatePropertiesPanel();
  updateStatusBar(); // refresh SEL stat
  // Selecting a different element always resets the dismissed flag and peeks
  if (differentElement) _propUserDismissed = false;
  if (!_propUserDismissed) setPropState('open');
  updateDropHint();
}

function deselectAll() {
  state.selectedId = null;
  _propUserDismissed = false; // reset so next selection shows peek
  document.querySelectorAll('.stage-element').forEach(d => d.classList.remove('selected'));
  updatePropertiesPanel();
  updateStatusBar(); // refresh SEL stat
  setPropState('hidden');
  updateDropHint();
}

// Tap anywhere on the panel to ensure it's open
document.addEventListener('DOMContentLoaded', function() {
  const panel = document.getElementById('properties-panel');
  if (!panel) return;
  panel.addEventListener('click', function(e) {
    e.stopPropagation();
    if (_getPropState() === 'peek') {
      setPropState('open');
    }
  });
  panel.addEventListener('touchstart', function(e) {
    e.stopPropagation();
  }, { passive: true });
  panel.addEventListener('touchend', function(e) {
    e.stopPropagation();
  }, { passive: true });
});


// Click/tap canvas background to deselect
const _canvasBg = e => {
  if (e.target === stageCanvas || e.target === document.getElementById('elements-layer')) deselectAll();
};
document.getElementById('stage-canvas').addEventListener('mousedown', _canvasBg);
document.getElementById('stage-canvas').addEventListener('touchstart', _canvasBg, { passive: true });

function togglePropMoreFields() {
  const container = document.getElementById('prop-more-fields');
  const icon = document.getElementById('prop-more-toggle-icon');
  if (!container) return;
  const isHidden = container.classList.contains('hidden');
  if (isHidden) {
    container.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    container.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
}

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

  const moreFields = document.getElementById('prop-more-fields');
  const moreIcon = document.getElementById('prop-more-toggle-icon');
  if (moreFields) {
    moreFields.classList.add('hidden');
    if (moreIcon) moreIcon.style.transform = 'rotate(0deg)';
  }
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

window.deleteSelectedElement = removeSelected;

window.rotateSelectedElement = function() {
  if (state.selectedId) {
    var el = state.elements.find(function(x) { return x.id === state.selectedId; });
    if (el) {
      el.rotation = (el.rotation + 45) % 360;
      var dom = document.getElementById('elem-' + el.id);
      if (dom) {
        var iconWrap = dom.querySelector('.el-icon-wrap');
        if (iconWrap) iconWrap.style.transform = 'rotate(' + el.rotation + 'deg)';
        repositionResizeBar(dom);
      }
      var inputRot = document.getElementById('input-rotation');
      if (inputRot) inputRot.value = el.rotation;
      pushHistory();
    }
  }
};

window.scaleSelectedElement = function(delta) {
  if (state.selectedId) {
    var el = state.elements.find(function(x) { return x.id === state.selectedId; });
    if (el) {
      scaleElementBy(el, delta);
    }
  }
};

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
  const hint = document.getElementById('drop-zone-hint');
  if (!hint) return;
  const sheet = document.getElementById('sc-item-sheet');
  const sheetOpen = sheet && sheet.classList.contains('sc-sheet-open');
  const show = state.elements.length === 0 && !_dialOpen && !sheetOpen && !_mobileScenesOpen && !state.selectedId;
  hint.style.opacity = show ? '1' : '0';
  hint.style.transform = show ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -44%) scale(0.96)';
  hint.style.pointerEvents = show ? 'auto' : 'none';
}

// ══════════════════════════════════════════════════════════
//  CONNECTIONS
// ══════════════════════════════════════════════════════════
function _setConnectBanner(_msg) {
  // Banner intentionally disabled — connect mode status is shown via the
  // toolbar button highlight + a toast at the bottom. No floating overlay.
  const pill = document.getElementById('mode-pill');
  if (pill) pill.classList.remove('visible');
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
    _clearConnectPreview();
    _connFP = '';
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
  _clearConnectPreview();
  _connFP = ''; // force fresh render so the new cable shows
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
  svg.innerHTML = DOMPurify.sanitize('');
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
    hndl.setAttribute('style', 'pointer-events:none;transition:stroke-opacity 0.22s ease,fill-opacity 0.22s ease;');
    svg.appendChild(hndl);
    // Invisible larger hit target (finger-friendly on mobile)
    const hitR = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) ? 22 : 14;
    const hndlHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hndlHit.setAttribute('cx', hx); hndlHit.setAttribute('cy', hy);
    hndlHit.setAttribute('r', String(hitR));
    hndlHit.setAttribute('fill', 'transparent');
    hndlHit.setAttribute('style', 'pointer-events:all;cursor:grab;touch-action:none;');
    hndlHit.dataset.handleConn = idx;
    svg.appendChild(hndlHit);

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
      lbTxt.setAttribute('font-family', 'Manrope, Inter, sans-serif');
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
    txt.setAttribute('font-family', 'Manrope, Inter, sans-serif');
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
  txt.setAttribute('font-family', 'Manrope, Inter, sans-serif');
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

  // Update selection state via CSS class
  menu.querySelectorAll('.ccm-item').forEach(item => {
    item.classList.toggle('is-selected', item.dataset.ctype === currentType);
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
  const mw = 230, mh = 220;
  let left = Math.min(clientX, vw - mw - 8);
  let top  = Math.min(clientY, vh - mh - 8);
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top  = Math.max(8, top)  + 'px';
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
        const c = state.connections[connIdx];
        const a = c && state.elements.find(el => el.id === c.from);
        const b = c && state.elements.find(el => el.id === c.to);
        if (!a || !b) return;
        // Capture the source/target endpoint coords + the CURRENT auto-curve
        // CP at drag-start so we can solve for the new CP analytically (no
        // delta accumulation drift, no jitter from lagged renders).
        const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.max(1, Math.hypot(dx, dy));
        // Must match renderConnections() exactly — same cap, scale, AND parity
        // sign. Otherwise the cached baseline drifts from the rendered baseline
        // and the handle won't track the cursor pixel-perfectly.
        const autoOffset = Math.min(35, len * 0.14) * (connIdx % 2 === 0 ? 1 : -1);
        const autoCpx = (x1 + x2) / 2 - (dy / len) * autoOffset;
        const autoCpy = (y1 + y2) / 2 + (dx / len) * autoOffset;
        _cableDragState = { connIdx, x1, y1, x2, y2, autoCpx, autoCpy, dirty: false, raf: 0 };
        canvas.style.cursor = 'grabbing';
        e.stopPropagation();
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        return;
      }
    });

    // ── Pointer-move: update bend OR hover-highlight ─────────────
    canvas.addEventListener('pointermove', function(e) {
      if (state.currentView !== 'Editor') return;
      const { cx, cy } = toCanvas(e.clientX, e.clientY);

      // (Connect mode preview disabled — cables only render after a 2nd
      // element is tapped, so users can't see "cables to nowhere".)

      // Active bend drag — solve for CP so the handle position EQUALS
      // the cursor position. The bezier midpoint formula is:
      //   midpoint = 0.25*P0 + 0.5*CP + 0.25*P2
      // Solving for CP:  CP = 2*midpoint - 0.5*(P0 + P2)
      // Using absolute positioning eliminates lag/drift entirely and the
      // handle tracks the finger/cursor pixel-perfectly.
      if (_cableDragState) {
        const s = _cableDragState;
        const c = state.connections[s.connIdx];
        if (c) {
          const newCpx = 2 * cx - 0.5 * (s.x1 + s.x2);
          const newCpy = 2 * cy - 0.5 * (s.y1 + s.y2);
          c.cpDx = newCpx - s.autoCpx;
          c.cpDy = newCpy - s.autoCpy;
          s.dirty = true;
          // Throttle redraw to one per animation frame for smooth 60fps
          if (!s.raf) {
            s.raf = requestAnimationFrame(() => {
              s.raf = 0;
              if (!_cableDragState) return;
              _connFP = '';
              renderConnections();
            });
          }
        }
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
        if (_cableDragState.raf) cancelAnimationFrame(_cableDragState.raf);
        const wasDirty = _cableDragState.dirty;
        _cableDragState = null;
        canvas.style.cursor = 'grab';
        // Final render to make sure last frame is shown, then commit history
        _connFP = '';
        renderConnections();
        if (wasDirty) {
          pushHistory();
          markAutosaveDirty();
        }
        try { canvas.releasePointerCapture(e.pointerId); } catch(_) {}
      }
    });

    canvas.addEventListener('pointercancel', function() {
      if (_cableDragState) {
        if (_cableDragState.raf) cancelAnimationFrame(_cableDragState.raf);
        const wasDirty = _cableDragState.dirty;
        _cableDragState = null;
        canvas.style.cursor = '';
        if (wasDirty) { _connFP = ''; renderConnections(); }
      }
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
  void activeColor;
  // Write inline styles with !important so they beat every theme/hover rule
  // unconditionally. The `is-active` class is kept in sync purely for
  // semantic / debugging purposes.
  btn.classList.toggle('is-active', !!active);
  if (active) {
    btn.style.setProperty('background', 'var(--accent-22)', 'important');
    btn.style.setProperty('color',      'var(--accent)',    'important');
  } else {
    btn.style.setProperty('background', 'transparent', 'important');
    // Use the theme-appropriate dim color (light theme = #555, dark = #767575).
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    btn.style.setProperty('color', isLight ? '#555' : '#767575', 'important');
  }
  try { btn.blur(); } catch (_) {}
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
  _setToolBtn('btn-connect', state.connectMode, 'primary');
  document.getElementById('canvas-container').style.cursor = state.connectMode ? 'crosshair' : 'default';
  _setConnectBanner(null);
  showToast(state.connectMode ? T('connectOn') : T('connectOff'));
  // Self-heal: connect mode should always show cables so the user can see them
  if (state.connectMode && !state.connectionsVisible) {
    state.connectionsVisible = true;
    _setToolBtn('btn-connections', true, 'primary');
    const connSvg = document.getElementById('connections-svg');
    if (connSvg) { connSvg.style.display = ''; connSvg.style.opacity = '1'; }
  }
  if (!state.connectMode) _clearConnectPreview();
  _connFP = ''; // force fresh render
  renderConnections();
}

// ── Live preview line: source → cursor while connecting ───────
let _connectPreviewEl = null;
function _ensureConnectPreview() {
  if (_connectPreviewEl) return _connectPreviewEl;
  const svg = document.getElementById('connections-svg');
  if (!svg) return null;
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('id', 'connect-preview-line');
  p.setAttribute('stroke', '#ff7439');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-dasharray', '6,4');
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke-linecap', 'round');
  p.setAttribute('opacity', '0.85');
  p.setAttribute('pointer-events', 'none');
  svg.appendChild(p);
  _connectPreviewEl = p;
  return p;
}
function _updateConnectPreview(cx, cy) {
  if (!state.connectMode || !state.connectSource) { _clearConnectPreview(); return; }
  const src = state.elements.find(e => e.id === state.connectSource);
  if (!src) { _clearConnectPreview(); return; }
  const p = _ensureConnectPreview();
  if (!p) return;
  // Re-attach if a render wiped the SVG
  const svg = document.getElementById('connections-svg');
  if (svg && p.parentNode !== svg) svg.appendChild(p);
  p.setAttribute('d', `M ${src.x} ${src.y} L ${cx} ${cy}`);
}
function _clearConnectPreview() {
  if (_connectPreviewEl && _connectPreviewEl.parentNode) {
    _connectPreviewEl.parentNode.removeChild(_connectPreviewEl);
  }
  _connectPreviewEl = null;
}
function zoomIn() { state.zoom = Math.min(state.zoom + 0.15, 3); applyZoom(); }
function zoomOut() { state.zoom = Math.max(state.zoom - 0.15, 0.3); applyZoom(); }
function resetView() { state.zoom = 1; applyZoom(); }
function applyZoom() {
  stageCanvas.style.transform = `scale(${state.zoom})`;
  stageCanvas.style.transformOrigin = 'center center';
  updateStatusBar();
  const selectedDom = document.querySelector('.stage-element.selected');
  if (selectedDom) {
    repositionResizeBar(selectedDom);
  }
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
  const enBtn = document.getElementById('settings-lang-en');
  const esBtn = document.getElementById('settings-lang-es');
  if (!enBtn || !esBtn) return;
  const isEn = state.lang === 'en';
  enBtn.style.background  = isEn  ? 'var(--accent)' : '#262626';
  enBtn.style.color        = isEn  ? 'var(--accent-dark, #fff)' : '#767575';
  esBtn.style.background  = !isEn ? 'var(--accent)' : '#262626';
  esBtn.style.color        = !isEn ? 'var(--accent-dark, #fff)' : '#767575';
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
  list.innerHTML = DOMPurify.sanitize(state.members.map(m => `
    <div style="display:flex;align-items:center;gap:5px;padding:4px 6px;background:#111;border-left:2px solid ${m.color};">
      <div style="width:7px;height:7px;border-radius:50%;background:${m.color};flex-shrink:0;"></div>
      <span style="flex:1;font-size:10px;font-weight:700;color:#e0e0e0;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Manrope',sans-serif;">${m.name}</span>
      <button onclick="removeMember('${m.id}')" title="Remove" style="color:#484847;background:none;border:none;cursor:pointer;font-size:13px;padding:0 2px;line-height:1;flex-shrink:0;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#484847'">×</button>
    </div>`).join(''));
}

function _repopulateMemberDropdown() {
  const sel = document.getElementById('input-member');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = DOMPurify.sanitize('<option value="">— None —</option>' +
    state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join(''));
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

function renderAvatarGroup() {
  const container = document.getElementById('members-avatar-group');
  if (!container) return;
  if (state.members.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  const maxAvatars = 5;
  const visibleMembers = state.members.slice(0, maxAvatars);
  const overflow = state.members.length - maxAvatars;

  let html = visibleMembers.map((m, idx) => {
    const letter = m.name ? m.name.charAt(0).toUpperCase() : '?';
    return `<div class="sc-avatar" style="background:${m.color};color:#fff;z-index:${visibleMembers.length - idx};" title="${m.name}">${letter}</div>`;
  }).join('');

  if (overflow > 0) {
    html += `<div class="sc-avatar sc-avatar-more" style="background:#27272a;color:#a1a1aa;z-index:0;">+${overflow}</div>`;
  }
  container.innerHTML = DOMPurify.sanitize(html);
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

  if (statCount) statCount.innerHTML = DOMPurify.sanitize(state.members.length + '<span style="color:#484847;font-size:15px;font-weight:500;">/8</span>');
  if (statAssigned) statAssigned.textContent = assignedMembers;
  if (statElements) statElements.textContent = totalElements;
  if (statUnassigned) statUnassigned.textContent = Math.max(0, unassigned);
  if (maxWarn) maxWarn.style.display = state.members.length >= 8 ? 'block' : 'none';
  if (addBtn) { addBtn.disabled = state.members.length >= 8; addBtn.style.opacity = state.members.length >= 8 ? '0.35' : '1'; addBtn.style.cursor = state.members.length >= 8 ? 'not-allowed' : 'pointer'; }

  renderAvatarGroup();

  if (state.members.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }
  grid.style.display = 'grid';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = DOMPurify.sanitize(state.members.map(m => {
    const assigned = state.elements.filter(el => el.memberId === m.id);
    
    let role = state.lang === 'es' ? 'Artista' : 'Performer';
    if (assigned.length > 0) {
      const names = assigned.map(el => (el.name || '').toLowerCase());
      if (names.some(n => n.includes('drum'))) role = state.lang === 'es' ? 'Baterista' : 'Drummer';
      else if (names.some(n => n.includes('guitar'))) role = state.lang === 'es' ? 'Guitarrista' : 'Guitarist';
      else if (names.some(n => n.includes('bass'))) role = state.lang === 'es' ? 'Bajista' : 'Bassist';
      else if (names.some(n => n.includes('vocal') || n.includes('mic'))) role = state.lang === 'es' ? 'Vocalista' : 'Vocalist';
      else if (names.some(n => n.includes('key') || n.includes('piano'))) role = state.lang === 'es' ? 'Tecladista' : 'Keyboardist';
      else role = assigned[0].name || (state.lang === 'es' ? 'Artista' : 'Performer');
    }

    const itemsHtml = assigned.length > 0
      ? assigned.map(el => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="width:6px;height:6px;border-radius:50%;background:${el.color || m.color};flex-shrink:0;"></div>
            <span style="font-size:11px;color:#d4d4d4;font-weight:500;font-family:'Inter',sans-serif;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${el.label || el.name || '—'}</span>
            ${el.channelId ? `<span style="font-size:9px;font-weight:700;font-family:'Manrope',sans-serif;color:#3b82f6;letter-spacing:0.05em;">CH&nbsp;${el.channelId}</span>` : ''}
          </div>`).join('')
      : `<div style="padding:16px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#5a5a59;text-align:center;">${T('noStageAssign')}</div>`;

    const avatarLetter = m.name ? m.name.charAt(0).toUpperCase() : '?';

    return `
    <div class="sc-member-card">
      <div class="sc-member-card-hdr">
        <div class="sc-member-avatar" style="background:${m.color};" onclick="cycleColor('${m.id}')" title="${state.lang === 'es' ? 'Haz clic para cambiar color' : 'Click to cycle color'}">
          ${avatarLetter}
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
          <span class="sc-member-name" title="${m.name}">${m.name}</span>
          <span class="sc-member-role">${role}</span>
        </div>
        <button onclick="removeMember('${m.id}')" title="${state.lang === 'es' ? 'Eliminar ' + m.name : 'Remove ' + m.name}" class="sc-member-del-btn">
          <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
      </div>
      <div class="sc-member-assignments">
        <div class="sc-member-assignments-lbl">
          ${assigned.length > 0 ? T('assignedElems') : T('assignments')}
        </div>
        <div class="sc-member-assignments-list">
          ${itemsHtml}
        </div>
      </div>
    </div>`;
  }).join(''));
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
  var elems = state.elements;
  document.getElementById('rider-ch-count').textContent = elems.length + ' / 32';
  document.getElementById('rider-el-count').textContent = elems.length;
  const dateEl = document.getElementById('rider-date-val');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString(state.lang === 'es' ? 'es-MX' : 'en-US', { year:'numeric', month:'short', day:'numeric' });
  renderRiderNeeds();
  var tbody = document.getElementById('rider-table-body');
  if (elems.length === 0) {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    var emptyRow = document.createElement('tr');
    var emptyTd = document.createElement('td');
    emptyTd.colSpan = 7;
    emptyTd.style.cssText = 'padding:32px 16px;text-align:center;white-space:normal;';
    emptyTd.innerHTML = '<div style="font-family:Manrope,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;color:#484847;">' + (T('noElemsRider') || 'No stage elements yet') + '</div><div style="font-size:10px;color:#333;margin-top:5px;font-family:Inter,sans-serif;">Add elements to the stage — they appear here automatically</div>';
    emptyRow.appendChild(emptyTd);
    tbody.appendChild(emptyRow);
  } else {
    var sorted = [...elems].sort(function(a, b) {
      return String(a.channelId ?? '').localeCompare(String(b.channelId ?? ''), undefined, {numeric: true, sensitivity: 'base'});
    });
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    sorted.forEach(function(el, i) {
      var chNum = 'CH-' + String(i + 1).padStart(2, '0');
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      td1.innerHTML = '<span class="rd-ch-num">' + (el.channelId || chNum) + '</span>';
      td1.setAttribute('data-label', 'CH#');
      var td2 = document.createElement('td');
      td2.style.fontWeight = '600';
      td2.textContent = el.label || el.name || '—';
      td2.setAttribute('data-label', 'Source Name');
      var td3 = document.createElement('td');
      td3.innerHTML = '<span class="rd-type-badge">' + (el.type || el.name || '—') + '</span>';
      td3.setAttribute('data-label', 'Type');
      var td4 = document.createElement('td');
      td4.style.color = '#acabaa';
      td4.textContent = TSource(el.source);
      td4.setAttribute('data-label', 'Input Source');
      var td5 = document.createElement('td');
      td5.style.cssText = 'color:#e7e5e4;font-weight:600;';
      td5.textContent = el.output || 'FOH';
      td5.setAttribute('data-label', 'Output');
      var td6 = document.createElement('td');
      td6.style.textAlign = 'center';
      var phSpan = document.createElement('span');
      phSpan.className = el.phantom ? 'rd-phantom-on' : 'rd-phantom-off';
      phSpan.textContent = el.phantom ? 'ON' : 'OFF';
      td6.appendChild(phSpan);
      td6.setAttribute('data-label', '+48V');
      var td7 = document.createElement('td');
      td7.style.cssText = 'color:#767575;font-style:italic;';
      td7.textContent = el.notes || '—';
      td7.setAttribute('data-label', 'Notes');
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      tr.appendChild(td5);
      tr.appendChild(td6);
      tr.appendChild(td7);
      tbody.appendChild(tr);
    });
  }
  refreshRiderStagePreview();
}

if (!state.riderChannels) state.riderChannels = [];
function addRiderChannel() {
  var label = prompt(T('channelLabel') || 'Channel label:');
  if (!label || !label.trim()) return;
  var ch = { id: 'rc-' + Date.now(), label: label.trim(), type: 'Custom', source: '', phantom: false, output: 'FOH', notes: '', channelId: '' };
  state.riderChannels.push(ch);
  refreshRider();
  markAutosaveDirty();
}
function addRiderFromStage() {
  var added = 0;
  state.elements.forEach(function(el) {
    if (el._riderExcluded) return;
    var already = state.riderChannels.some(function(rc) { return rc._stageRef === el.id; });
    if (!already) {
      state.riderChannels.push({
        id: 'rc-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
        _stageRef: el.id,
        label: el.label || el.name || 'Element',
        type: el.type || el.name || '',
        source: el.source || '',
        phantom: !!el.phantom,
        output: el.output || 'FOH',
        notes: el.notes || '',
        channelId: el.channelId || ''
      });
      added++;
    }
  });
  if (added === 0) showToast(T('allSynced') || 'All stage elements already in rider');
  else showToast(added + ' channel(s) added');
  refreshRider();
  markAutosaveDirty();
}
function removeRiderChannel(idx) {
  if (idx >= 0 && idx < state.riderChannels.length) {
    state.riderChannels.splice(idx, 1);
    refreshRider();
    markAutosaveDirty();
  }
}

if (!state.riderConfig) state.riderConfig = {};
function updateRiderConfig(key, val) {
  state.riderConfig[key] = val;
  markAutosaveDirty();
}

function toggleRiderCheck(key, rowEl) {
  var cb = rowEl.querySelector('.rd-config-checkbox');
  if (!cb) return;
  var isChecked = cb.classList.toggle('checked');
  if (isChecked) {
    cb.innerHTML = '<span class="material-symbols-outlined" style="font-size:10px;color:#0e0e0e;font-weight:bold;">check</span>';
  } else {
    cb.innerHTML = '';
  }
  if (!state.riderConfig) state.riderConfig = {};
  state.riderConfig[key] = isChecked;
  markAutosaveDirty();
}

if (!state.riderMixes) state.riderMixes = [];
function addRiderMix(name) {
  if (state.riderMixes.some(m => m === name)) { showToast(name + ' already added'); return; }
  state.riderMixes.push(name);
  renderRiderMixes();
  markAutosaveDirty();
}
function removeRiderMix(idx) {
  state.riderMixes.splice(idx, 1);
  renderRiderMixes();
  markAutosaveDirty();
}
function renderRiderMixes() {
  var container = document.getElementById('rider-mixes-list');
  if (!container) return;
  if (state.riderMixes.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  container.innerHTML = DOMPurify.sanitize(state.riderMixes.map((m, i) =>
    `<div class="rd-mix-item">
      <span>#${i + 1} ${m}</span>
      <button class="rd-mix-del" onclick="removeRiderMix(${i})"><span class="material-symbols-outlined" style="font-size:14px;">close</span></button>
    </div>`
  ).join(''));
}

function toggleRiderDrop(el) {
  var isActive = el.classList.toggle('active');
  var icon = el.querySelector('.material-symbols-outlined');
  if (isActive) {
    icon.textContent = 'check_circle';
    icon.style.color = 'var(--accent)';
    icon.style.fontVariationSettings = "'FILL' 1";
    el.querySelector('.rd-drop-label').style.color = '#e7e5e4';
  } else {
    icon.textContent = 'add_circle';
    icon.style.color = '#767575';
    icon.style.fontVariationSettings = "'FILL' 0";
    el.querySelector('.rd-drop-label').style.color = '#767575';
  }
  markAutosaveDirty();
}

var _riderPreviewRAF = null;
var _riderPreviewObserver = null;
function refreshRiderStagePreview() {
  var slot = document.getElementById('rider-stage-preview-slot');
  if (!slot) return;
  var src = document.getElementById('stage-canvas');
  if (!src) return;
  if (!state.canvasW || state.canvasW <= 0) {
    var edPage = document.getElementById('view-Editor');
    if (edPage) {
      var wasHidden = edPage.style.display === 'none';
      if (wasHidden) { edPage.style.display = 'block'; edPage.style.visibility = 'hidden'; edPage.style.position = 'absolute'; edPage.style.left = '-9999px'; }
      var r = src.getBoundingClientRect();
      if (r.width > 0) { state.canvasW = r.width; state.canvasH = r.height; }
      if (wasHidden) { edPage.style.display = 'none'; edPage.style.visibility = ''; edPage.style.position = ''; edPage.style.left = ''; }
    }
  }
  _riderCloneStage(slot, src);
  _riderScalePreview(slot, src);
  if (_riderPreviewObserver) { _riderPreviewObserver.disconnect(); _riderPreviewObserver = null; }
  if (state.currentView === 'Rider') {
    _riderPreviewObserver = new MutationObserver(function() {
      if (_riderPreviewRAF) return;
      _riderPreviewRAF = requestAnimationFrame(function() {
        _riderPreviewRAF = null;
        var s = document.getElementById('rider-stage-preview-slot');
        var c = document.getElementById('stage-canvas');
        if (s && c) { _riderCloneStage(s, c); _riderScalePreview(s, c); }
      });
    });
    _riderPreviewObserver.observe(src, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class','transform'] });
  }
}
function _riderCloneStage(slot, src) {
  var existing = slot.querySelector('.rd-stage-clone');
  if (existing) existing.remove();
  var clone = src.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('rd-stage-clone');
  clone.style.cssText = 'pointer-events:none;border-color:rgba(72,72,71,0.12);border-style:solid;border-width:1px;transform-origin:top left;overflow:visible;position:relative;box-sizing:border-box;';
  clone.querySelectorAll('[id]').forEach(function(n) { n.removeAttribute('id'); });
  var dsLabel = clone.querySelector('[data-i18n="downstageLabel"]');
  if (dsLabel) {
    dsLabel.style.fontSize = '7px';
    dsLabel.style.letterSpacing = '0.3em';
    dsLabel.style.bottom = '-16px';
    dsLabel.style.left = '50%';
    dsLabel.style.transform = 'translateX(-50%)';
    dsLabel.style.width = '100%';
    dsLabel.style.textAlign = 'center';
  }
  slot.appendChild(clone);
}
function _riderScalePreview(slot, src) {
  var clone = slot.querySelector('.rd-stage-clone');
  if (!clone) return;
  var srcW = state.canvasW || src.scrollWidth || src.offsetWidth || 650;
  var srcH = state.canvasH || src.scrollHeight || src.offsetHeight || 420;
  if (srcW <= 0) srcW = 650;
  if (srcH <= 0) srcH = 420;
  var extraBottom = 20;
  var totalH = srcH + extraBottom;
  var slotW = slot.clientWidth || 350;
  var pad = 12;
  var usableW = slotW - pad * 2;
  var scale = usableW / srcW;
  clone.style.width = srcW + 'px';
  clone.style.height = srcH + 'px';
  clone.style.transform = 'scale(' + scale + ')';
  clone.style.marginLeft = pad + 'px';
  clone.style.marginTop = pad + 'px';
  slot.style.height = Math.ceil(totalH * scale + pad * 2) + 'px';
}

// ══════════════════════════════════════════════════════════
//  RIDER NEEDS (editable requirements)
// ══════════════════════════════════════════════════════════
function renderRiderNeeds() {
  const container = document.getElementById('rider-needs-list');
  if (!container) return;
  if (state.riderNeeds.length === 0) {
    container.innerHTML = DOMPurify.sanitize('<p style="font-size:12px;color:#484847;font-style:italic;padding:8px 0;">No requirements yet. Click + Add to begin.</p>');
    return;
  }
  container.innerHTML = DOMPurify.sanitize(state.riderNeeds.map(need => {
    const nt = NEED_TYPES[need.type] || NEED_TYPES.custom;
    const isEs = state.lang === 'es';
    const typeOptions = Object.entries(NEED_TYPES).map(([k, v]) => {
      const lbl = isEs ? (v.labelEs || v.label) : v.label;
      return `<option value="${k}" ${need.type === k ? 'selected' : ''}>${lbl}</option>`;
    }).join('');
    const activePresets = (isEs ? (nt.presetsEs || nt.presets) : nt.presets);
    const presets = activePresets.map(p =>
      `<button onclick="applyNeedPreset('${need.id}',this.textContent)" title="${p}"
        style="padding:3px 8px;font-size:10px;font-family:'Manrope',sans-serif;background:var(--rn-chip-bg);color:var(--rn-muted);border:1px solid var(--rn-border);border-radius:4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;transition:all 0.2s;"
        onmouseover="this.style.color='var(--rn-text)';this.style.borderColor='var(--rn-text)'"
        onmouseout="this.style.color='var(--rn-muted)';this.style.borderColor='var(--rn-border)'">${p}</button>`
    ).join('');
    return `
    <div style="border:1px solid var(--rn-border);background:var(--rn-card-bg);color:var(--rn-text);border-radius:8px;margin-bottom:8px;overflow:hidden;transition:border-color 0.2s;">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px 6px;">
        <select onchange="updateNeedType('${need.id}',this.value)"
          style="flex:1;padding:5px 8px;font-family:'Manrope',sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;background:var(--rn-input-bg);color:var(--rn-text);border:1px solid var(--rn-border);border-radius:4px;cursor:pointer;">
          ${typeOptions}
        </select>
        <button onclick="removeRiderNeed('${need.id}')"
          style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:none;border:1px solid var(--rn-border);color:var(--rn-muted);cursor:pointer;font-size:14px;flex-shrink:0;border-radius:4px;transition:all 0.2s;"
          onmouseover="this.style.color='#f43f5e';this.style.borderColor='#f43f5e';this.style.background='rgba(244,63,94,0.05)'"
          onmouseout="this.style.color='var(--rn-muted)';this.style.borderColor='var(--rn-border)';this.style.background='none'">×</button>
      </div>
      ${presets ? `<div style="display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 8px;">${presets}</div>` : ''}
      <div style="padding:0 12px 10px;">
        <textarea rows="2" onchange="updateNeedValue('${need.id}',this.value)"
          style="width:100%;resize:none;background:var(--rn-input-bg);color:var(--rn-text);border:1px solid var(--rn-border);border-radius:4px;padding:7px 10px;font-family:'Inter';font-size:12px;line-height:1.5;box-sizing:border-box;">${need.value}</textarea>
      </div>
    </div>`;
  }).join(''));
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
    if (g) { g.innerHTML = DOMPurify.sanitize(''); library[cat].forEach(item => g.appendChild(buildLibraryItem(item))); }
  });
  // Close any open desktop/mobile tray (user will re-open with updated language)
  const deskTray = document.getElementById('desktop-el-tray');
  if (deskTray) { deskTray.classList.remove('desk-tray-open'); deskTray.innerHTML = DOMPurify.sanitize(''); }
  document.querySelectorAll('.desk-cat-btn').forEach(b => b.classList.remove('active'));
  const mobTray = document.getElementById('mobile-el-tray');
  if (mobTray) { mobTray.classList.remove('mob-tray-open'); mobTray.innerHTML = DOMPurify.sanitize(''); }
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
    tbody.innerHTML = DOMPurify.sanitize(`<div style="padding:56px 0;text-align:center;">
      <div style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#484847;">No songs yet — tap ADD NEW TRACK to start your setlist.</div>
    </div>`);
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
  tbody.innerHTML = DOMPurify.sanitize(html);
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
  bar.innerHTML = DOMPurify.sanitize(segs.map(seg => {
    const count = _onlySongs().filter(s => s.segmentId === seg.id).length;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:${seg.color}18;border:1px solid ${seg.color}44;">
      <div style="width:8px;height:8px;background:${seg.color};flex-shrink:0;"></div>
      <span style="font-family:'Manrope',sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:${seg.color};">${seg.name}</span>
      <span style="font-size:9px;color:#484847;">(${count})</span>
      <button onclick="removeSegment(${seg.id})" style="background:none;border:none;color:#484847;cursor:pointer;padding:0;margin-left:2px;line-height:1;font-size:13px;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#484847'" title="Remove segment">×</button>
    </div>`;
  }).join(''));
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
    pillsWrap.innerHTML = DOMPurify.sanitize(sections.map(sec => `
      <button class="sng-section-pill" data-sid="${sec.id}"
        style="border-color:${sec.color}55;"
        onclick="_toggleSngSection(this,'${sec.id}','${sec.color}')">
        <span style="width:7px;height:7px;border-radius:50%;background:${sec.color};flex-shrink:0;box-shadow:0 0 5px ${sec.color}88;"></span>
        <span>${sec.name}</span>
      </button>`).join(''));
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
  picker.innerHTML = DOMPurify.sanitize(SEGMENT_COLORS.map(c => `
    <div onclick="_pickSegColor('${c}')" id="seg-swatch-${c.replace('#','')}"
      style="width:28px;height:28px;background:${c};cursor:pointer;outline:${c===first?'2px solid #fff':'2px solid transparent'};outline-offset:2px;transition:outline 0.1s;">
    </div>`).join(''));
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
          <span style="font-family:'Manrope',sans-serif;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:0.25em;color:${seg.color};">${seg.name}</span>
        </div>`;
      }
      lastSegId = curSegId;
    }
    const seg = proposedSegs.find(s => s.id === curSegId);
    const derived = _derivedEnergy(song);
    const bpmLabel = song.bpm ? `${song.bpm} BPM` : '— BPM';
    previewHtml += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:#111;margin-bottom:2px;">
      <span style="font-family:'Manrope',sans-serif;font-size:11px;font-weight:900;color:#484847;min-width:24px;">${String(i+1).padStart(2,'0')}.</span>
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
  document.getElementById('smart-sort-preview').innerHTML = DOMPurify.sanitize(previewHtml);
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
function showConfirm(message, onOk, options = {}) {
  _confirmCb = onOk;
  const title = options.title || (state.lang === 'es' ? 'Confirmar' : 'Confirm');
  const okText = options.okText || (state.lang === 'es' ? 'Confirmar' : 'Confirm');
  const cancelText = options.cancelText || (state.lang === 'es' ? 'Cancelar' : 'Cancel');
  const isDestructive = options.isDestructive || false;

  const titleEl = document.getElementById('confirm-title');
  if (titleEl) titleEl.textContent = title;
  
  const msgEl = document.getElementById('confirm-msg');
  if (msgEl) msgEl.textContent = message;
  
  const okBtn = document.getElementById('confirm-ok-btn');
  if (okBtn) {
    okBtn.textContent = okText;
    if (isDestructive) {
      okBtn.style.background = 'var(--hot)';
    } else {
      okBtn.style.background = 'var(--accent)';
    }
  }
  
  const cancelBtn = document.getElementById('confirm-cancel-btn');
  if (cancelBtn) {
    cancelBtn.textContent = cancelText;
    cancelBtn.focus();
  }

  const el = document.getElementById('confirm-modal');
  if (el) el.style.display = 'flex';
  if (typeof lcIcons === 'function') lcIcons();
}

function doConfirm(ok) {
  const el = document.getElementById('confirm-modal');
  if (el) el.style.display = 'none';
  if (ok && typeof _confirmCb === 'function') _confirmCb();
  _confirmCb = null;
}

// Close confirm modal on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const el = document.getElementById('confirm-modal');
    if (el && el.style.display !== 'none') {
      doConfirm(false);
    }
  }
});


const PRESETS_KEY = 'stagecorePresets_v1';

function getPresets() {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
}
function setPresets(arr) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(arr));
  scheduleCloudAutosave();
}

function openPresetsPanel(triggerEl) {
  // Mutual exclusion: never overlap with the history timeline panel
  if (typeof closeTimelinePanel === 'function') {
    try { closeTimelinePanel(); } catch(e) { /* noop */ }
  }
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
  if (typeof _persistCurrentScene === 'function') _persistCurrentScene();
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
    schemaVersion: 9,
    scenes: Array.isArray(state.scenes) ? JSON.parse(JSON.stringify(state.scenes)) : undefined,
    currentSceneIdx: typeof state.currentSceneIdx === 'number' ? state.currentSceneIdx : 0,
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
    // Restore scenes if the preset has them (schemaVersion >= 9). Otherwise
    // wrap the loaded plot into Scene 1 so the multi-scene UI still works.
    if (p.schemaVersion >= 9 && Array.isArray(p.scenes) && p.scenes.length > 0) {
      state.scenes = p.scenes.slice(0, SCENES_MAX).map((s, i) => ({
        id: s.id || ('s' + (i + 1)),
        name: (typeof s.name === 'string' && s.name.trim()) ? s.name.trim().slice(0, 24) : ('Scene ' + (i + 1)),
        elements: Array.isArray(s.elements) ? JSON.parse(JSON.stringify(s.elements)) : [],
        connections: Array.isArray(s.connections) ? JSON.parse(JSON.stringify(s.connections)) : [],
        nextId: typeof s.nextId === 'number' ? s.nextId : 1,
      }));
      state.currentSceneIdx = (typeof p.currentSceneIdx === 'number' &&
                                p.currentSceneIdx >= 0 &&
                                p.currentSceneIdx < state.scenes.length)
        ? p.currentSceneIdx : 0;
      const cur = state.scenes[state.currentSceneIdx];
      state.elements = JSON.parse(JSON.stringify(cur.elements));
      state.connections = JSON.parse(JSON.stringify(cur.connections));
      state.nextId = cur.nextId || state.nextId;
    } else {
      state.scenes = [{
        id: 's1', name: 'Scene 1',
        elements: JSON.parse(JSON.stringify(state.elements)),
        connections: JSON.parse(JSON.stringify(state.connections)),
        nextId: state.nextId,
      }];
      state.currentSceneIdx = 0;
    }
    renderAll();
    if (typeof renderScenesBar === 'function') renderScenesBar();
    updateDropHint();
    // Reset history — undo should not cross a preset-load boundary
    state.history = []; state.historyIndex = -1;
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
    container.innerHTML = DOMPurify.sanitize(`<div class="presets-empty">No presets yet.<br>Save your current stage setup.</div>`);
    return;
  }
  container.innerHTML = DOMPurify.sanitize(presets.map(p => `
    <div class="preset-item">
      <div class="preset-item-info">
        <div class="preset-item-name">${p.name}</div>
        <div class="preset-item-meta">${p.elements.length} element${p.elements.length!==1?'s':''}</div>
      </div>
      <button class="preset-item-load" onclick="loadPreset(${p.id})" title="Load preset">Load</button>
      <button class="preset-item-del" onclick="deletePreset(${p.id})" title="Delete preset">
        <i data-lucide="trash-2" style="width:13px;height:13px;stroke-width:2;pointer-events:none;"></i>
      </button>
    </div>`).join(''));
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
  'Instruments':'#a3a3a3','Microphones':'#a3a3a3','Audio':'#a3a3a3',
  'Cables':'#a3a3a3','Power':'#a3a3a3','Outboard':'#a3a3a3',
  'Stands':'#a3a3a3','Misc':'#a3a3a3'
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
var _gearJustAdded = null;
function saveGearItem() {
  const name = document.getElementById('gear-name').value.trim();
  if (!name) {
    document.getElementById('gear-name').style.borderColor = '#ff716c';
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
  _gearJustAdded = item.id;
  closeGearModal();
  renderGear();
  refreshExportGear();
  saveProject();
}
function deleteGearItem(id) {
  var row = document.querySelector('[data-gear-id="' + id + '"]');
  if (row) {
    row.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateX(30px)';
    setTimeout(function() {
      state.gear = state.gear.filter(g => g.id !== id);
      renderGear();
      refreshExportGear();
      saveProject();
    }, 250);
  } else {
    state.gear = state.gear.filter(g => g.id !== id);
    renderGear();
    refreshExportGear();
    saveProject();
  }
}
var _gearJustToggled = null;
function toggleGearPacked(id) {
  const item = state.gear.find(g => g.id === id);
  if (item) {
    item.packed = !item.packed;
    _gearJustToggled = { id: id, packed: item.packed };
  }
  renderGear();
  refreshExportGear();
  saveProject();
}
function renderGear() {
  const container = document.getElementById('gear-body');
  if (!container) return;

  const searchEl = document.getElementById('gear-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';

  const sorted = [...state.gear].sort((a, b) =>
    GEAR_CATS.indexOf(a.category) - GEAR_CATS.indexOf(b.category) || a.name.localeCompare(b.name)
  );

  const filtered = q ? sorted.filter(g =>
    g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || (g.notes && g.notes.toLowerCase().includes(q))
  ) : sorted;

  var isFiltering = q.length > 0;
  if (!filtered.length) {
    container.innerHTML = DOMPurify.sanitize(`<div class="gear-empty">
      <div class="gear-empty-icon"><span class="material-symbols-outlined" style="font-size:40px;">inventory_2</span></div>
      <div class="gear-empty-title">${T('noGearYet')}</div>
      <div class="gear-empty-sub">${T('addGearHint')}</div>
    </div>`);
  } else {
    let lastCat = null;
    container.innerHTML = DOMPurify.sanitize(filtered.map(g => {
      let catHdr = '';
      if (g.category !== lastCat) {
        lastCat = g.category;
        const col = GEAR_CAT_COLORS[g.category] || '#484847';
        catHdr = `<div class="gear-cat-header" style="color:${col};">${Tcat(g.category)}</div>`;
      }
      var isNew = _gearJustAdded === g.id;
      var rowCls = 'gear-item-row' + (g.packed ? ' packed' : '') + (isNew ? ' gear-new' : '') + (isFiltering && !isNew ? ' gear-filter-in' : '');
      return catHdr + `<div class="${rowCls}" data-gear-id="${g.id}">
        <div class="gear-item-check${g.packed ? ' checked' : ''}" onclick="toggleGearPacked(${g.id})" data-check-id="${g.id}">
          ${g.packed ? '<span class="material-symbols-outlined" style="font-size:15px;color:#ffffff;">check</span>' : ''}
        </div>
        <div class="gear-item-info">
          <p class="gear-item-name${g.packed ? ' struck' : ''}">${escapeHtml(g.name)}</p>
          ${g.notes ? `<p class="gear-item-sub">${escapeHtml(g.notes)}</p>` : ''}
        </div>
        <span class="gear-cat-badge" style="color:${GEAR_CAT_COLORS[g.category]||'#484847'};">${Tcat(g.category)}</span>
        <span class="gear-item-qty">${String(g.qty).padStart(2,'0')}</span>
        <button class="gear-item-del" onclick="deleteGearItem(${g.id})">×</button>
      </div>`;
    }).join(''));
  }

  if (_gearJustAdded !== null) {
    var newRow = container.querySelector('[data-gear-id="' + _gearJustAdded + '"]');
    if (newRow) newRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    _gearJustAdded = null;
  }

  if (_gearJustToggled !== null) {
    var checkEl = container.querySelector('[data-check-id="' + _gearJustToggled.id + '"]');
    if (checkEl) {
      var animCls = _gearJustToggled.packed ? 'animate-check' : 'animate-uncheck';
      checkEl.classList.add(animCls);
      checkEl.addEventListener('animationend', function() { checkEl.classList.remove(animCls); }, { once: true });
    }
    var row = container.querySelector('[data-gear-id="' + _gearJustToggled.id + '"]');
    if (row) {
      row.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      if (_gearJustToggled.packed) {
        row.style.transform = 'scale(0.98)';
        setTimeout(function() { row.style.transform = ''; }, 350);
      }
    }
    _gearJustToggled = null;
  }

  if (isFiltering) {
    var rows = container.querySelectorAll('.gear-filter-in');
    rows.forEach(function(r, i) { r.style.animationDelay = (i * 30) + 'ms'; });
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
  tbody.innerHTML = DOMPurify.sanitize(sorted.map((g, i) => {
    let catRow = '';
    if (g.category !== lastCat) {
      lastCat = g.category;
      catRow = `<tr><td colspan="5" style="padding:8px 12px 3px;font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:${GEAR_CAT_COLORS[g.category]||'#484847'};border-top:1px solid rgba(72,72,71,0.3);">${Tcat(g.category)}</td></tr>`;
    }
    const bg = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    return catRow + `<tr style="background:${bg};">
      <td style="padding:7px 12px;font-size:12px;font-weight:600;color:#fff;">${escapeHtml(g.name)}</td>
      <td style="padding:7px 12px;font-size:10px;color:#767575;">${Tcat(g.category)}</td>
      <td style="padding:7px 12px;font-size:12px;font-weight:700;color:#ff7439;text-align:center;">${g.qty}</td>
      <td style="padding:7px 12px;font-size:10px;color:#767575;">${g.notes ? escapeHtml(g.notes) : '—'}</td>
      <td style="padding:7px 12px;text-align:center;">
        <div style="width:14px;height:14px;border:1.5px solid ${g.packed ? '#c5ffc9' : '#484847'};background:${g.packed ? '#c5ffc9' : 'transparent'};margin:0 auto;display:flex;align-items:center;justify-content:center;">
          ${g.packed ? '<span style="font-size:9px;color:#002e00;line-height:1;">✓</span>' : ''}
        </div>
      </td>
    </tr>`;
  }).join(''));
}

// ══════════════════════════════════════════════════════════
//  AUTOSAVE
// ══════════════════════════════════════════════════════════
let _sessionDirty = false;   // true after any user change — triggers reload warning
let _asState = 'off';        // 'off' | 'on' | 'saving'
let _asPresetId = null;
let _asPresetName = null;
let _asTimer = null;
let _mobileScenesOpen = false;

function scOpenMobileScenes() {
  const backdrop = _createScenesBackdrop();
  const sheet = _createScenesSheet();
  
  backdrop.style.display = 'block';
  sheet.style.display = 'flex';
  
  setTimeout(() => {
    sheet.classList.add('open');
  }, 10);
  
  _mobileScenesOpen = true;
  renderMobileScenesList();
  updateDropHint();
}

function closeScenesSheet() {
  const sheet = document.getElementById('sc-scenes-sheet');
  const backdrop = document.getElementById('sc-scenes-backdrop');
  if (sheet) {
    sheet.classList.remove('open');
    setTimeout(() => {
      sheet.style.display = 'none';
      if (backdrop) backdrop.style.display = 'none';
    }, 300);
  }
  _mobileScenesOpen = false;
  updateDropHint();
}

function _createScenesBackdrop() {
  let backdrop = document.getElementById('sc-scenes-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sc-scenes-backdrop';
    backdrop.style.cssText = 'display:none;position:absolute;inset:0;background:rgba(0,0,0,0.5);z-index:8999;transition:opacity 0.2s;';
    backdrop.onclick = closeScenesSheet;
    document.body.appendChild(backdrop);
  }
  return backdrop;
}

function _createScenesSheet() {
  let sheet = document.getElementById('sc-scenes-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.id = 'sc-scenes-sheet';
    sheet.innerHTML = DOMPurify.sanitize(`
      <div id="sc-scenes-sheet-header">
        <span id="sc-scenes-sheet-title">Scenes</span>
        <button id="sc-scenes-sheet-close" onclick="closeScenesSheet()">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      </div>
      <div id="sc-scenes-list-container"></div>
      <button id="sc-scenes-add-sheet-btn" class="sc-btn sc-btn-primary" onclick="addSceneFromSheet()">
        <span class="material-symbols-outlined" style="font-size:14px;">add</span>
        <span id="sc-add-scene-label">Add Scene</span>
      </button>
    `);
    document.body.appendChild(sheet);
    
    let style = document.getElementById('sc-scenes-sheet-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'sc-scenes-sheet-styles';
      style.textContent = `
        #sc-scenes-sheet {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: auto;
          max-height: 70%;
          z-index: 9000;
          display: flex;
          flex-direction: column;
          background: var(--studio-surface-elevated, rgba(14,14,18,0.98));
          border-top: 1px solid var(--studio-border, rgba(255,255,255,0.09));
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          overflow: hidden;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.80);
          font-family: 'Manrope', sans-serif;
          transform: translateY(100%);
          transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        #sc-scenes-sheet.open {
          transform: translateY(0);
        }
        #sc-scenes-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        #sc-scenes-sheet-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--accent);
        }
        #sc-scenes-sheet-close {
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.6);
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        #sc-scenes-list-container {
          flex: 1;
          overflow-y: auto;
          padding: 12px 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sc-scene-sheet-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
          transition: all 0.15s;
          cursor: pointer;
        }
        .sc-scene-sheet-row.active {
          border-color: var(--accent);
          background: var(--accent-08);
        }
        .sc-scene-sheet-name-input {
          background: transparent;
          border: none;
          color: #fff;
          font-family: 'Manrope', sans-serif;
          font-size: 12px;
          font-weight: 700;
          outline: none;
          flex: 1;
          padding: 4px 0;
          cursor: text;
        }
        .sc-scene-sheet-row.active .sc-scene-sheet-name-input {
          color: var(--accent);
        }
        .sc-scene-sheet-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sc-scene-sheet-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }
        .sc-scene-sheet-btn:hover {
          color: #fff;
          background: rgba(255,255,255,0.08);
        }
        .sc-scene-sheet-btn.delete {
          color: rgba(255,113,108,0.7);
        }
        .sc-scene-sheet-btn.delete:hover {
          background: rgba(255,113,108,0.12);
          color: #ff716c;
        }
        #sc-scenes-add-sheet-btn {
          margin: 10px 20px 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border-radius: 10px;
          font-family: 'Manrope', sans-serif;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        html[data-theme="light"] #sc-scenes-sheet {
          background: rgba(255, 255, 255, 0.98);
          border-top-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.15);
        }
        html[data-theme="light"] #sc-scenes-sheet-header {
          border-bottom-color: rgba(0, 0, 0, 0.08);
        }
        html[data-theme="light"] #sc-scenes-sheet-close {
          color: rgba(0, 0, 0, 0.6);
        }
        html[data-theme="light"] .sc-scene-sheet-row {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.05);
        }
        html[data-theme="light"] .sc-scene-sheet-row.active {
          border-color: var(--accent);
          background: var(--accent-08);
        }
        html[data-theme="light"] .sc-scene-sheet-name-input {
          color: #000;
        }
        html[data-theme="light"] .sc-scene-sheet-row.active .sc-scene-sheet-name-input {
          color: var(--accent);
        }
        html[data-theme="light"] .sc-scene-sheet-btn {
          color: rgba(0, 0, 0, 0.55);
        }
        html[data-theme="light"] .sc-scene-sheet-btn:hover {
          color: #000;
          background: rgba(0, 0, 0, 0.08);
        }
        html[data-amoled="1"] #sc-scenes-sheet {
          background: #000000;
          border-top-color: rgba(255, 255, 255, 0.14);
          box-shadow: none;
        }
      `;
      document.head.appendChild(style);
    }
  }
  return sheet;
}

function renderMobileScenesList() {
  const container = document.getElementById('sc-scenes-list-container');
  if (!container) return;
  _ensureScenes();
  let html = '';
  state.scenes.forEach((s, idx) => {
    const isActive = idx === state.currentSceneIdx;
    const canDelete = state.scenes.length > 1;
    html += `
      <div class="sc-scene-sheet-row ${isActive ? 'active' : ''}" onclick="switchScene(${idx})">
        <input type="text" class="sc-scene-sheet-name-input" value="${s.name}" 
          onclick="event.stopPropagation()" 
          onchange="renameSceneInline(${idx}, this.value)" 
          onblur="renameSceneInline(${idx}, this.value)" />
        <div class="sc-scene-sheet-actions" onclick="event.stopPropagation()">
          <button class="sc-scene-sheet-btn" onclick="duplicateScene(${idx})" title="${state.lang === 'es' ? 'Duplicar' : 'Duplicate'}">
            <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
          </button>
          ${canDelete ? `
            <button class="sc-scene-sheet-btn delete" onclick="removeSceneFromSheet(${idx})" title="${state.lang === 'es' ? 'Eliminar' : 'Delete'}">
              <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });
  container.innerHTML = DOMPurify.sanitize(html);
  const addBtnLabel = document.getElementById('sc-add-scene-label');
  if (addBtnLabel) {
    addBtnLabel.textContent = state.lang === 'es' ? 'Añadir escena' : 'Add Scene';
  }
  const addBtn = document.getElementById('sc-scenes-add-sheet-btn');
  if (addBtn) {
    if (state.scenes.length >= SCENES_MAX) {
      addBtn.style.opacity = '0.4';
      addBtn.style.pointerEvents = 'none';
    } else {
      addBtn.style.opacity = '1';
      addBtn.style.pointerEvents = 'auto';
    }
  }
}

function addSceneFromSheet() {
  addScene();
  if (_mobileScenesOpen) renderMobileScenesList();
}

function removeSceneFromSheet(idx) {
  removeScene(idx);
}

function renameSceneInline(idx, name) {
  _ensureScenes();
  if (idx < 0 || idx >= state.scenes.length) return;
  const v = String(name).trim().slice(0, 24);
  if (!v) return;
  state.scenes[idx].name = v;
  renderScenesBar();
  saveProject();
}

function duplicateScene(idx) {
  _ensureScenes();
  if (state.scenes.length >= SCENES_MAX) {
    showToast(state.lang === 'es' ? 'Máximo 3 escenas' : 'Max 3 scenes');
    return;
  }
  _persistCurrentScene();
  const source = state.scenes[idx];
  const copy = {
    id: 's' + Date.now(),
    name: source.name + ' (Copy)',
    elements: JSON.parse(JSON.stringify(source.elements)),
    connections: JSON.parse(JSON.stringify(source.connections)),
    nextId: source.nextId || 1
  };
  state.scenes.push(copy);
  _loadScene(state.scenes.length - 1);
  renderAll();
  renderScenesBar();
  saveProject();
}

function renderScenesBar() {
  const bar = document.getElementById('sc-scenes-bar');
  if (!bar) return;
  _ensureScenes();
  if (_mobileScenesOpen) {
    renderMobileScenesList();
  }
  if (state.currentView !== 'Editor') {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const tabsHtml = state.scenes.map((s, i) => {
    const active = (i === state.currentSceneIdx);
    return `
      <button onclick="switchScene(${i})" ontouchend="event.preventDefault();switchScene(${i})" title="${s.name}"
        oncontextmenu="event.preventDefault();renameScenePrompt(${i});return false;"
        class="sc-scene-btn ${active ? 'active' : ''}">
        <span>${s.name}</span>
        ${state.scenes.length > 1 ? `<span onclick="event.stopPropagation();removeScene(${i})" ontouchend="event.preventDefault();event.stopPropagation();removeScene(${i})" class="sc-scene-close">×</span>` : ''}
      </button>`;
  }).join('');
  
  const addHtml = state.scenes.length < SCENES_MAX
    ? `<button onclick="addScene()" ontouchend="event.preventDefault();addScene()" title="${state.lang === 'es' ? 'Añadir escena' : 'Add scene'}" class="sc-scene-add-btn">
         <span class="material-symbols-outlined" style="font-size:14px;line-height:1;">add</span>
       </button>`
    : '';

  bar.innerHTML = DOMPurify.sanitize(
    `<span class="sc-scene-label">${state.lang === 'es' ? 'Escenas' : 'Scenes'}</span>` +
    tabsHtml + addHtml
  );
  requestAnimationFrame(positionScenesBar);
}

function positionScenesBar() {}

function renameScenePrompt(idx) {
  _ensureScenes();
  if (idx < 0 || idx >= state.scenes.length) return;
  const cur = state.scenes[idx].name;
  const nv = window.prompt(state.lang === 'es' ? 'Nombre de la escena:' : 'Scene name:', cur);
  if (nv == null) return;
  const v = String(nv).trim().slice(0, 24);
  if (!v) return;
  state.scenes[idx].name = v;
  renderScenesBar();
  saveProject();
}

// Expose for inline onclick handlers
window.switchScene = switchScene;
window.addScene = addScene;
window.removeScene = removeScene;
window.renameScenePrompt = renameScenePrompt;
window.scOpenMobileScenes = scOpenMobileScenes;
window.closeScenesSheet = closeScenesSheet;
window.renameSceneInline = renameSceneInline;
window.duplicateScene = duplicateScene;
window.addSceneFromSheet = addSceneFromSheet;
window.removeSceneFromSheet = removeSceneFromSheet;

window.switchView = switchView;
window.toggleSCDial = toggleSCDial;
window.toggleGigMode = toggleGigMode;
window.openPresetsPanel = openPresetsPanel;

function setAutosaveUI(mode) {
  const dot = document.getElementById('autosave-dot');
  const lbl = document.getElementById('status-save');
  if (!dot || !lbl) return;
  if (mode === 'off') {
    dot.className = '';
    dot.innerHTML = DOMPurify.sanitize('');
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#484847;flex-shrink:0;transition:background 0.2s,box-shadow 0.2s;box-shadow:none;';
    lbl.textContent = 'AUTOSAVE: OFF';
    lbl.style.color = '#484847';
  } else if (mode === 'on') {
    dot.className = '';
    dot.innerHTML = DOMPurify.sanitize('');
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#3ddc84;flex-shrink:0;transition:background 0.2s,box-shadow 0.2s;box-shadow:0 0 6px rgba(61,220,132,0.55);';
    lbl.textContent = 'AUTOSAVE: ON';
    lbl.style.color = '#3ddc84';
  } else if (mode === 'saving') {
    dot.innerHTML = DOMPurify.sanitize('');
    dot.style.cssText = 'width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;';
    dot.innerHTML = DOMPurify.sanitize('<span class="material-symbols-outlined as-spinning" style="font-size:15px;color:#ff9930;">sync</span>');
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
    // Mirror live elements/connections into the active scene first so the
    // serialized scenes[] is current. Safe even if scenes never enabled.
    if (typeof _persistCurrentScene === 'function') _persistCurrentScene();
    const presets = getPresets();
    const idx = presets.findIndex(p => p.id === _asPresetId);
    const slot = { id: _asPresetId, name: _asPresetName, savedAt: new Date().toLocaleString(),
      elements: JSON.parse(JSON.stringify(state.elements)),
      connections: JSON.parse(JSON.stringify(state.connections)),
      setlist: JSON.parse(JSON.stringify(state.setlist)),
      canvasW: state.canvasW, canvasH: state.canvasH,
      schemaVersion: 9,
      scenes: Array.isArray(state.scenes) ? JSON.parse(JSON.stringify(state.scenes)) : undefined,
      currentSceneIdx: typeof state.currentSceneIdx === 'number' ? state.currentSceneIdx : 0 };
    if (idx >= 0) presets[idx] = slot; else presets.unshift(slot);
    setPresets(presets);
  } catch(e) {}
  setTimeout(() => { if (_asState === 'saving') { _asState = 'on'; setAutosaveUI('on'); } }, 900);
}

// ══════════════════════════════════════════════════════════
//  SCENES (v3.0.63+) — up to 3 stage-plot scenes per project
// ══════════════════════════════════════════════════════════
const SCENES_MAX = 3;

function _ensureScenes() {
  if (!Array.isArray(state.scenes) || state.scenes.length === 0) {
    state.scenes = [{
      id: 's1', name: 'Scene 1',
      elements: JSON.parse(JSON.stringify(state.elements || [])),
      connections: JSON.parse(JSON.stringify(state.connections || [])),
      nextId: state.nextId || 1,
    }];
    state.currentSceneIdx = 0;
  }
  if (typeof state.currentSceneIdx !== 'number' ||
      state.currentSceneIdx < 0 ||
      state.currentSceneIdx >= state.scenes.length) {
    state.currentSceneIdx = 0;
  }
}

function _persistCurrentScene() {
  _ensureScenes();
  const idx = state.currentSceneIdx;
  state.scenes[idx] = {
    id: state.scenes[idx].id,
    name: state.scenes[idx].name,
    elements: JSON.parse(JSON.stringify(state.elements)),
    connections: JSON.parse(JSON.stringify(state.connections)),
    nextId: state.nextId,
  };
}

function _loadScene(idx) {
  _ensureScenes();
  if (idx < 0 || idx >= state.scenes.length) return;
  const sc = state.scenes[idx];
  state.elements = JSON.parse(JSON.stringify(sc.elements || []));
  state.connections = JSON.parse(JSON.stringify(sc.connections || []));
  state.nextId = sc.nextId || 1;
  state.currentSceneIdx = idx;
  state.selectedId = null;
}

function switchScene(idx) {
  _ensureScenes();
  if (idx === state.currentSceneIdx) return;
  if (idx < 0 || idx >= state.scenes.length) return;
  _persistCurrentScene();
  _loadScene(idx);
  // Reset undo/redo history so the user cannot undo INTO the previous scene's
  // layout — history is scoped to the active scene's lifetime.
  state.history = [];
  state.historyIndex = -1;
  renderAll();
  renderScenesBar();
  pushHistory(); // seed new scene's history with current snapshot
  saveProject();
}

function addScene() {
  _ensureScenes();
  if (state.scenes.length >= SCENES_MAX) {
    showToast(state.lang === 'es' ? 'Máximo 3 escenas' : 'Max 3 scenes');
    return;
  }
  _persistCurrentScene();
  const nextIdx = state.scenes.length + 1;
  state.scenes.push({
    id: 's' + Date.now(),
    name: 'Scene ' + nextIdx,
    elements: [],
    connections: [],
    nextId: 1,
  });
  _loadScene(state.scenes.length - 1);
  renderAll();
  renderScenesBar();
  saveProject();
}

function removeScene(idx) {
  _ensureScenes();
  if (state.scenes.length <= 1) return; // keep at least one
  if (idx < 0 || idx >= state.scenes.length) return;
  const sceneName = state.scenes[idx].name;
  
  const title = state.lang === 'es' ? '¿Eliminar escena?' : 'Delete scene?';
  const body = state.lang === 'es' 
    ? 'Esto eliminará esta escena de tu plano de escenario. Esta acción no se puede deshacer.'
    : 'This will remove this scene from your stage plot. This action cannot be undone.';
  const deleteBtnText = state.lang === 'es' ? 'Eliminar' : 'Delete';
  const cancelBtnText = state.lang === 'es' ? 'Cancelar' : 'Cancel';
  
  showConfirm(body, () => {
    const wasActive = (idx === state.currentSceneIdx);
    if (!wasActive) _persistCurrentScene();
    state.scenes.splice(idx, 1);
    state.scenes.forEach((s, i) => {
      if (/^Scene\s+\d+$/.test(s.name)) s.name = 'Scene ' + (i + 1);
    });
    let target = state.currentSceneIdx;
    if (wasActive) target = Math.max(0, idx - 1);
    else if (idx < state.currentSceneIdx) target = state.currentSceneIdx - 1;
    state.currentSceneIdx = -1; // force load
    switchScene(target);
    renderAll();
    renderScenesBar();
    saveProject();
  }, { title: title, okText: deleteBtnText, cancelText: cancelBtnText, isDestructive: true });
}

// ══════════════════════════════════════════════════════════
//  SAVE / EXPORT
// ══════════════════════════════════════════════════════════
function saveProject() {
  try {
    _persistCurrentScene();
    localStorage.setItem('stagecoreProject', JSON.stringify({
      schemaVersion: 9,
      elements: JSON.parse(JSON.stringify(state.elements)),
      connections: JSON.parse(JSON.stringify(state.connections)),
      scenes: JSON.parse(JSON.stringify(state.scenes)),
      currentSceneIdx: state.currentSceneIdx,
      members: state.members,
      riderNeeds: state.riderNeeds,
      riderChannels: state.riderChannels || [],
      riderConfig: state.riderConfig || {},
      riderMixes: state.riderMixes || [],
      lang: state.lang,
      segments: state.segments,
      setlist: state.setlist,
      timeline: state.timeline,
      gear: state.gear,
      canvasW: state.canvasW,
      canvasH: state.canvasH,
      nextId: state.nextId,
    }));
  } catch(e) {}
  _sessionSave();
  showToast(T('projectSaved'));
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
  localStorage.removeItem('sc_session');
  loadSaved();
}
function loadSaved() {
  try {
    const raw = localStorage.getItem('stagecoreProject');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.elements && Array.isArray(d.elements)) {
      state.elements = JSON.parse(JSON.stringify(d.elements));
    }
    if (d.connections && Array.isArray(d.connections)) {
      state.connections = JSON.parse(JSON.stringify(d.connections));
    }
    if (d.canvasW) { state.canvasW = d.canvasW; state.canvasH = d.canvasH; }
    if (d.nextId) state.nextId = d.nextId;
    // ── Scenes (schemaVersion 9+) ─────────────────────────────
    // Older saves had no scenes array — wrap the loaded
    // elements/connections into Scene 1 for backwards compat.
    if (d.schemaVersion >= 9 && Array.isArray(d.scenes) && d.scenes.length > 0) {
      state.scenes = d.scenes
        .slice(0, SCENES_MAX)
        .map((s, i) => ({
          id: s.id || ('s' + (i + 1)),
          name: (typeof s.name === 'string' && s.name.trim()) ? s.name.trim().slice(0, 24) : ('Scene ' + (i + 1)),
          elements: Array.isArray(s.elements) ? JSON.parse(JSON.stringify(s.elements)) : [],
          connections: Array.isArray(s.connections) ? JSON.parse(JSON.stringify(s.connections)) : [],
          nextId: typeof s.nextId === 'number' ? s.nextId : 1,
        }));
      state.currentSceneIdx = (typeof d.currentSceneIdx === 'number' &&
                                d.currentSceneIdx >= 0 &&
                                d.currentSceneIdx < state.scenes.length)
        ? d.currentSceneIdx : 0;
      // Mirror the active scene back into the live state
      const cur = state.scenes[state.currentSceneIdx];
      state.elements = JSON.parse(JSON.stringify(cur.elements));
      state.connections = JSON.parse(JSON.stringify(cur.connections));
      state.nextId = cur.nextId || state.nextId;
    } else {
      // Migrate: treat the existing plot as Scene 1
      state.scenes = [{
        id: 's1', name: 'Scene 1',
        elements: JSON.parse(JSON.stringify(state.elements)),
        connections: JSON.parse(JSON.stringify(state.connections)),
        nextId: state.nextId,
      }];
      state.currentSceneIdx = 0;
    }
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
    if (d.riderChannels && Array.isArray(d.riderChannels)) state.riderChannels = d.riderChannels;
    if (d.riderConfig && typeof d.riderConfig === 'object') state.riderConfig = d.riderConfig;
    if (d.riderMixes && Array.isArray(d.riderMixes)) state.riderMixes = d.riderMixes;
    // Theme can be saved in any schema version
    if (d.theme && THEMES[d.theme]) {
      state.theme = d.theme;
      applyTheme(d.theme);
    }
    if (state.elements.length) renderAll();
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

// Preload heavy PDF libs at idle so the first export is instant.
// Without this, tapping Save/Share waits ~300-1500ms for html2canvas + jsPDF
// to download and parse before any work begins.
(function preloadPdfLibs() {
  const kick = () => {
    if (!window.html2canvas) _loadScript('/stage-core/vendor/html2canvas.min.js').catch(() => {});
    if (!window.jspdf)       _loadScript('/stage-core/vendor/jspdf.umd.min.js').catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(kick, { timeout: 3000 });
  } else {
    setTimeout(kick, 1500);
  }
})();
// Allow external callers (parent React shell) to override filename + action.
// action: 'save' (default, downloads) | 'share' (Web Share API with file)
window.__pdfExportOptions = null;
window.exportPDFWithOptions = function(opts) {
  window.__pdfExportOptions = opts || null;
  return exportPDF();
};

// ── Scene info bridge for the React PDF sheet ────────────────
window.__getSceneInfo = function() {
  _ensureScenes();
  return {
    count: state.scenes.length,
    currentIdx: state.currentSceneIdx,
    names: state.scenes.map(s => s.name),
    max: SCENES_MAX,
  };
};

// Render a single scene's elements + connections into an arbitrary
// (wrap, layer) pair. Pure function of `scene` — does not touch
// global `state`. Used by both the live preview canvas and the PDF
// export "all scenes" pathway.
function _renderSceneIntoMini(wrap, layer, scene) {
  if (!wrap || !layer || !scene) return;
  layer.innerHTML = DOMPurify.sanitize('');
  const els = scene.elements || [];
  const conns = scene.connections || [];
  if (els.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';

  const refW = state.canvasW || stageCanvas.offsetWidth || 650;
  const refH = state.canvasH || stageCanvas.offsetHeight || 420;
  const containerW = wrap.offsetWidth || 900;
  const miniH = Math.round(containerW * (refH / refW));
  wrap.style.height = Math.min(300, Math.max(160, miniH)) + 'px';

  els.forEach(el => {
    const pctX = el.x / refW, pctY = el.y / refH;
    const dot = document.createElement('div');
    dot.style.cssText =
      `position:absolute;left:${pctX*100}%;top:${pctY*100}%;` +
      `transform:translate(-50%,-50%);display:flex;flex-direction:column;` +
      `align-items:center;pointer-events:none;`;
    const exportRoles = el.roles || [];
    const exportAll = [el, ...exportRoles];
    const exportSz = exportAll.length > 1 ? 14 : 26;
    const icoWrap = document.createElement('div');
    icoWrap.style.cssText =
      `display:flex;flex-wrap:wrap;align-items:center;justify-content:center;` +
      `gap:2px;max-width:${exportAll.length > 1 ? '36px' : '30px'};` +
      `color:${el.color || '#7aafff'};` +
      `filter:drop-shadow(0 0 4px ${el.color || '#7aafff'}88);`;
    exportAll.forEach(r => {
      const tmp = document.createElement('div');
      tmp.innerHTML = DOMPurify.sanitize(iconHtml(r.icon, exportSz));
      if (tmp.firstChild) icoWrap.appendChild(tmp.firstChild);
    });
    const lbl = document.createElement('div');
    lbl.style.cssText =
      `font-family:Inter,Arial,sans-serif;font-size:10px;font-weight:700;` +
      `color:${el.color || '#7aafff'};text-transform:uppercase;` +
      `margin-top:5px;text-align:center;letter-spacing:0.04em;` +
      `max-width:100px;word-break:break-word;line-height:1.2;`;
    lbl.textContent = el.label;
    dot.appendChild(icoWrap); dot.appendChild(lbl);
    layer.appendChild(dot);
  });

  if (conns.length > 0) {
    const connSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    connSvg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;');
    const cDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    connSvg.appendChild(cDefs);
    const seen = new Set();
    function ensureMarker(color) {
      if (seen.has(color)) return;
      seen.add(color);
      const safe = color.replace(/[^a-z0-9]/gi, '_');
      const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      m.setAttribute('id', 'expmini_arr_' + safe);
      m.setAttribute('markerWidth', '6'); m.setAttribute('markerHeight', '6');
      m.setAttribute('refX', '5.5'); m.setAttribute('refY', '3');
      m.setAttribute('orient', 'auto'); m.setAttribute('markerUnits', 'strokeWidth');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M0,0 L0,6 L6,3 z'); p.setAttribute('fill', color);
      m.appendChild(p); cDefs.appendChild(m);
    }
    conns.forEach((c, idx) => {
      const a = els.find(e => e.id === c.from);
      const b = els.find(e => e.id === c.to);
      if (!a || !b) return;
      const lineColor = a.color || '#ff7439';
      ensureMarker(lineColor);
      const markerId = 'expmini_arr_' + lineColor.replace(/[^a-z0-9]/gi, '_');
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
    });
    layer.appendChild(connSvg);
  }
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
  // Disable buttons immediately to prevent double-tap, but only show
  // the "GENERATING…" label if export runs longer than 400ms — most
  // exports finish before then and feel truly instant (no label flash).
  if (genBtn) { genBtn.disabled = true; }
  if (mobBtn) { mobBtn.disabled = true; }
  const spinnerTimer = genBtn ? setTimeout(() => {
    genBtn.innerHTML = DOMPurify.sanitize('<span style="font-size:11px;letter-spacing:0.1em;">GENERATING…</span>');
  }, 400) : null;

  try {
    const { jsPDF } = window.jspdf;
    const source = document.getElementById('export-document');

    // ─────────────────────────────────────────────────────────────────
    // FAST PDF EXPORT — single-capture strategy
    // ─────────────────────────────────────────────────────────────────
    // Key insight: html2canvas's per-call overhead (DOM walk + style
    // resolution + font loading + container setup) is huge. The previous
    // implementation did 10 separate captures, paying that overhead 10×.
    // We now clone the whole #export-document ONCE, capture it ONCE, and
    // slice the resulting bitmap into A4 pages — breaking only on natural
    // section boundaries (recorded BEFORE capture from the cloned DOM).
    //
    // We also strip box-shadow / backdrop-filter / filter:blur() from the
    // clone in onclone — those are extremely expensive to rasterize and
    // contribute almost nothing visible against a flat #0e0e0e background.
    // ─────────────────────────────────────────────────────────────────
    const CAPTURE_WIDTH = 794;   // A4 width @ 96dpi
    const SCALE         = 1.0;
    const JPEG_Q        = 0.7;   // crisp at A4 print scale, faster encode

    const SECTION_IDS = [
      'exp-cover', 'exp-stage-section', 'exp-input-section',
      'exp-members-section', 'exp-connectivity-section',
      'exp-setlist-section', 'exp-lighting-section',
      'exp-notes-section', 'exp-gear-section', 'exp-footer'
    ];

    // ── 1. Clone the WHOLE export document once ──
    const wrap = document.createElement('div');
    wrap.style.cssText =
      `position:absolute;left:-9999px;top:0;width:${CAPTURE_WIDTH}px;` +
      `background:#0e0e0e;z-index:-9999;pointer-events:none;font-family:Inter,sans-serif;`;
    const docClone = source.cloneNode(true);
    docClone.style.margin     = '0';
    docClone.style.padding    = '0';
    docClone.style.height     = 'auto';
    docClone.style.maxHeight  = 'none';
    docClone.style.overflow   = 'visible';
    docClone.style.background = '#0e0e0e';

    // ── Scene-aware stage section(s) for PDF export ──────────
    // The live #exp-stage-section reflects the active scene. If the
    // user picked a different single scene or "all scenes", swap the
    // clone's stage section(s) accordingly. We mutate ONLY docClone —
    // the live preview is left untouched.
    (function _applySceneChoice() {
      const choice = window.__pdfExportOptions && window.__pdfExportOptions.scene;
      if (choice == null || choice === 'current') return;
      _ensureScenes();
      _persistCurrentScene(); // make sure active scene is fresh
      const scenes = state.scenes;
      const stageSec = docClone.querySelector('#exp-stage-section');
      if (!stageSec) return;
      const sceneLabel = (state.lang === 'es' ? 'Escena ' : 'Scene ');

      // Helper: clone the stage section and repaint its mini canvas with
      // a chosen scene's elements, optionally tagging it with a label.
      function buildSectionForScene(scene, idx, labelText) {
        const clone = stageSec.cloneNode(true);
        clone.id = idx === 0 ? 'exp-stage-section' : ('exp-stage-section-' + (idx + 1));
        const wrapEl = clone.querySelector('#exp-canvas-wrap');
        const layerEl = clone.querySelector('#exp-canvas-elements');
        const emptyEl = clone.querySelector('#exp-canvas-empty');
        // Strip duplicate ids on cloned wrap/layer/empty so querySelectors
        // on docClone don't collide.
        if (wrapEl)  wrapEl.id  = 'exp-canvas-wrap-'  + (idx + 1);
        if (layerEl) layerEl.id = 'exp-canvas-elements-' + (idx + 1);
        if (emptyEl) emptyEl.id = 'exp-canvas-empty-'  + (idx + 1);
        // Repaint mini canvas with this scene's data
        if (wrapEl && layerEl) _renderSceneIntoMini(wrapEl, layerEl, scene);
        if ((!scene.elements || scene.elements.length === 0) && emptyEl) {
          emptyEl.style.display = 'block';
        }
        // Add a per-scene label badge under the section title
        if (labelText) {
          const titleRow = clone.querySelector('h2');
          if (titleRow) {
            const badge = document.createElement('span');
            badge.textContent = labelText;
            badge.style.cssText =
              'margin-left:10px;padding:2px 8px;border-radius:4px;' +
              'background:rgba(255,255,255,0.06);color:var(--accent);' +
              "font-family:'Manrope',sans-serif;font-size:10px;font-weight:800;" +
              'text-transform:uppercase;letter-spacing:0.14em;';
            titleRow.appendChild(badge);
          }
        }
        return clone;
      }

      if (choice === 'all' && scenes.length > 1) {
        // Replace the single stage section with one section per scene
        const parent = stageSec.parentNode;
        const replacements = scenes.map((sc, i) =>
          buildSectionForScene(sc, i, sceneLabel + (i + 1) + ' · ' + sc.name));
        parent.insertBefore(replacements[0], stageSec);
        for (let i = 1; i < replacements.length; i++) {
          parent.insertBefore(replacements[i], stageSec);
          // Add the new ids to SECTION_IDS so page-break detection knows
          // about them as natural break boundaries.
          SECTION_IDS.splice(2 + i - 1, 0, replacements[i].id);
        }
        parent.removeChild(stageSec);
      } else if (typeof choice === 'number' && scenes[choice]) {
        // Replace with just the chosen single scene
        const repl = buildSectionForScene(
          scenes[choice], 0,
          sceneLabel + (choice + 1) + ' · ' + scenes[choice].name
        );
        stageSec.parentNode.replaceChild(repl, stageSec);
      }
    })();

    // Apply per-section padding + neutralize editable / overflow constraints
    SECTION_IDS.forEach(id => {
      const sec = docClone.querySelector('#' + id);
      if (!sec) return;
      sec.style.height        = 'auto';
      sec.style.maxHeight     = 'none';
      sec.style.overflow      = 'visible';
      sec.style.wordBreak     = 'break-word';
      sec.style.overflowWrap  = 'break-word';
      // Ensure consistent breathing room around every section
      sec.style.paddingTop    = '32px';
      sec.style.paddingBottom = '32px';
      if (!sec.style.paddingLeft || sec.style.paddingLeft === '0px') sec.style.paddingLeft = '28px';
      if (!sec.style.paddingRight || sec.style.paddingRight === '0px') sec.style.paddingRight = '28px';
    });
    docClone.querySelectorAll('[contenteditable]').forEach(e => {
      e.setAttribute('contenteditable', 'false');
      e.style.minHeight  = 'auto';
      e.style.height     = 'auto';
      e.style.maxHeight  = 'none';
      e.style.overflow   = 'visible';
    });

    wrap.appendChild(docClone);
    document.body.appendChild(wrap);

    // ── 2. One animation frame so layout settles ──
    await new Promise(r => requestAnimationFrame(r));

    // ── 3. Record section break points + total height BEFORE capture ──
    // We use these as the only "safe" places to cut between PDF pages so
    // text and diagrams are never sliced mid-content.
    const wrapTop = wrap.getBoundingClientRect().top;
    const breakPx = [0];
    SECTION_IDS.forEach(id => {
      const sec = docClone.querySelector('#' + id);
      if (!sec) return;
      const rect = sec.getBoundingClientRect();
      const top  = rect.top - wrapTop;
      if (top > 0) breakPx.push(top);
    });
    const totalH = Math.max(wrap.scrollHeight, 1);
    breakPx.push(totalH);
    const breaks = [...new Set(breakPx.map(v => Math.round(v)))].sort((a,b) => a - b);

    const onclone = (doc) => {
      // Strip the most expensive CSS effects from the cloned document.
      // These are invisible (or nearly so) against the flat #0e0e0e
      // background but cost html2canvas heavily to rasterize.
      const kill = doc.createElement('style');
      kill.textContent =
        `#export-document, #export-document * {` +
        `box-shadow:none !important;` +
        `text-shadow:none !important;` +
        `backdrop-filter:none !important;` +
        `-webkit-backdrop-filter:none !important;` +
        `filter:none !important;` +
        `transition:none !important;` +
        `animation:none !important;` +
        `}`;
      doc.head.appendChild(kill);
      doc.querySelectorAll('svg').forEach(s => {
        if (!s.getAttribute('width'))  s.setAttribute('width',  s.getBoundingClientRect().width  || CAPTURE_WIDTH);
        if (!s.getAttribute('height')) s.setAttribute('height', s.getBoundingClientRect().height || 40);
      });
    };

    // ── 4. Try the fast single-capture path. Cleanup is guaranteed in
    //      finally. If it fails (e.g., very tall doc exceeding the
    //      browser's max canvas dimension/memory) we fall back to a
    //      per-section capture below so export degrades gracefully.
    // Most browsers cap canvas height around 16k–32k px. Stay well under.
    const MAX_SAFE_H = 14000;
    let bigCvs = null;
    if (totalH <= MAX_SAFE_H) {
      try {
        bigCvs = await canvasWithTimeout(wrap, {
          scale: SCALE, useCORS: true, allowTaint: true,
          backgroundColor: '#0e0e0e', logging: false,
          width: CAPTURE_WIDTH, height: totalH,
          windowWidth: CAPTURE_WIDTH, windowHeight: totalH,
          imageTimeout: 8000,
          onclone
        });
      } catch (e) {
        console.warn('Fast PDF capture failed, falling back to per-section:', e);
        bigCvs = null;
      }
    }
    // Always remove the offscreen clone, success or failure.
    try { document.body.removeChild(wrap); } catch(_) {}

    // ── PDF document ──────────────────────────────────────
    const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const cssPerMm = CAPTURE_WIDTH / pdfW;
    const pageHpx  = Math.floor(pdfH * cssPerMm);

    function fillPageBg() {
      pdf.setFillColor(14, 14, 14);
      pdf.rect(0, 0, pdfW, pdfH, 'F');
    }

    if (bigCvs) {
      // ── 5a. FAST PATH: slice the single big canvas into A4 pages,
      //         breaking only at recorded section boundaries.
      const cvsPerCss = bigCvs.width / CAPTURE_WIDTH;

      const pages = [];
      let pageStart = 0;
      for (let i = 1; i < breaks.length; i++) {
        const segStart = breaks[i - 1];
        const segEnd   = breaks[i];
        const segH     = segEnd - segStart;
        if (segH > pageHpx) {
          if (pageStart < segStart) pages.push({ s: pageStart, e: segStart });
          let s = segStart;
          while (s < segEnd) {
            const e = Math.min(s + pageHpx, segEnd);
            pages.push({ s, e });
            s = e;
          }
          pageStart = segEnd;
        } else if (segEnd - pageStart > pageHpx) {
          pages.push({ s: pageStart, e: segStart });
          pageStart = segStart;
        }
      }
      if (pageStart < totalH) pages.push({ s: pageStart, e: totalH });

      const pageCvs = document.createElement('canvas');
      const pageCtx = pageCvs.getContext('2d');
      for (let p = 0; p < pages.length; p++) {
        const { s, e } = pages[p];
        const sliceCss = e - s;
        pageCvs.width  = bigCvs.width;
        pageCvs.height = Math.max(1, Math.round(sliceCss * cvsPerCss));
        pageCtx.fillStyle = '#0e0e0e';
        pageCtx.fillRect(0, 0, pageCvs.width, pageCvs.height);
        pageCtx.drawImage(bigCvs, 0, -Math.round(s * cvsPerCss));

        const imgData = pageCvs.toDataURL('image/jpeg', JPEG_Q);
        const hMm = sliceCss / cssPerMm;
        if (p > 0) pdf.addPage();
        fillPageBg();
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, hMm, undefined, 'FAST');
      }
    } else {
      // ── 5b. FALLBACK PATH: capture each section individually.
      //         Slower but more resilient for very long documents or
      //         environments where the single capture fails.
      const GAP_MM = 8;
      let pageY = 0;
      fillPageBg();
      const startNewPage = () => { pdf.addPage(); fillPageBg(); pageY = 0; };
      const mmPerPx = pdfW / (CAPTURE_WIDTH * SCALE);

      for (const id of SECTION_IDS) {
        const el = source.querySelector('#' + id);
        if (!el || el.style.display === 'none') continue;
        const w = document.createElement('div');
        w.style.cssText =
          `position:absolute;left:-9999px;top:0;width:${CAPTURE_WIDTH}px;` +
          `background:#0e0e0e;z-index:-9999;pointer-events:none;font-family:Inter,sans-serif;`;
        const c = el.cloneNode(true);
        c.style.margin = '0';
        c.style.paddingTop = '32px'; c.style.paddingBottom = '32px';
        if (!c.style.paddingLeft  || c.style.paddingLeft  === '0px') c.style.paddingLeft  = '28px';
        if (!c.style.paddingRight || c.style.paddingRight === '0px') c.style.paddingRight = '28px';
        c.style.wordBreak = 'break-word';
        c.style.overflowWrap = 'break-word';
        c.style.overflow = 'visible';
        c.style.height = 'auto';
        c.style.maxHeight = 'none';
        c.querySelectorAll('[contenteditable]').forEach(x => {
          x.setAttribute('contenteditable', 'false');
          x.style.height = 'auto'; x.style.maxHeight = 'none'; x.style.overflow = 'visible';
        });
        w.appendChild(c);
        document.body.appendChild(w);
        try {
          await new Promise(r => requestAnimationFrame(r));
          const h = Math.max(w.scrollHeight, 1);
          if (h <= 1) continue;
          let cvs = null;
          try {
            cvs = await canvasWithTimeout(w, {
              scale: SCALE, useCORS: true, allowTaint: true,
              backgroundColor: '#0e0e0e', logging: false,
              width: CAPTURE_WIDTH, height: h,
              windowWidth: CAPTURE_WIDTH, windowHeight: h,
              imageTimeout: 8000, onclone
            });
          } catch (_) { cvs = null; }
          if (!cvs) continue;
          const hMm = cvs.height * mmPerPx;
          const imgData = cvs.toDataURL('image/jpeg', JPEG_Q);
          if (hMm <= pdfH) {
            if (pageY > 0 && pageY + hMm > pdfH) startNewPage();
            pdf.addImage(imgData, 'JPEG', 0, pageY, pdfW, hMm, undefined, 'FAST');
            pageY += hMm + GAP_MM;
          } else {
            let topPx = 0;
            while (topPx < cvs.height) {
              const availMm = pdfH - pageY;
              const availPx = availMm / mmPerPx;
              const slicePx = Math.min(availPx, cvs.height - topPx);
              const sc = document.createElement('canvas');
              sc.width = cvs.width; sc.height = Math.ceil(slicePx);
              const sctx = sc.getContext('2d');
              sctx.fillStyle = '#0e0e0e';
              sctx.fillRect(0, 0, sc.width, sc.height);
              sctx.drawImage(cvs, 0, -topPx);
              const sliceHMm = slicePx * mmPerPx;
              pdf.addImage(sc.toDataURL('image/jpeg', JPEG_Q), 'JPEG', 0, pageY, pdfW, sliceHMm, undefined, 'FAST');
              pageY += sliceHMm;
              topPx += availPx;
              if (topPx < cvs.height) startNewPage();
            }
            pageY += GAP_MM;
          }
        } finally {
          try { document.body.removeChild(w); } catch(_){}
        }
      }
    }

    const projectName = (document.getElementById('exp-project-name') || {}).textContent || 'STAGE_CORE_V1';
    const opts = window.__pdfExportOptions || {};
    window.__pdfExportOptions = null;
    const baseName = (opts.name && opts.name.trim()) || projectName.trim();
    const fileName = baseName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').replace(/\.pdf$/i, '') + '.pdf';

    if (opts.action === 'share' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      const blob = pdf.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });
      // Try a real file share first (Web Share API Level 2). Some Android
      // WebViews report canShare({files})===false even though share() works,
      // so we attempt the share regardless and only fall back on real errors.
      let shared = false;
      try {
        await navigator.share({ files: [file], title: baseName, text: baseName });
        shared = true;
      } catch (shareErr) {
        if (shareErr && shareErr.name === 'AbortError') {
          // User dismissed the native share sheet — leave the file unsaved.
          shared = true;
        }
      }
      if (!shared) {
        // File share rejected by the platform. Fall back to a URL share so the
        // user still gets the native share sheet, then also save the PDF so it
        // isn't lost. If even URL share fails, we just save.
        try {
          await navigator.share({ title: baseName, text: baseName });
        } catch (_) { /* ignored — saving below */ }
        pdf.save(fileName);
      }
      showToast(T('pdfSaved'));
    } else {
      pdf.save(fileName);
      showToast(T('pdfSaved'));
    }
  } catch (err) {
    console.error('PDF export error:', err);
    showToast(T('pdfFailed'));
  } finally {
    if (spinnerTimer) clearTimeout(spinnerTimer);
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = DOMPurify.sanitize(origHTML); }
    if (mobBtn) { mobBtn.disabled = false; mobBtn.innerHTML = DOMPurify.sanitize(origMob); }
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
  _initExportScrollHide();
}

function refreshExportCanvas() {
  const wrap = document.getElementById('exp-canvas-wrap');
  const layer = document.getElementById('exp-canvas-elements');
  const empty = document.getElementById('exp-canvas-empty');
  if (!wrap || !layer) return;

  layer.innerHTML = DOMPurify.sanitize('');

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
      tmp.innerHTML = DOMPurify.sanitize(iconHtml(r.icon, exportSz));
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
    tbody.innerHTML = DOMPurify.sanitize('');
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const sorted = [...state.elements].sort((a, b) => String(a.channelId ?? '').localeCompare(String(b.channelId ?? ''), undefined, {numeric: true, sensitivity: 'base'}));
  const rowsHtml = sorted.map((el, i) => {
    const micDI = Ttype(el.type || el.name) || '—';
    const source = TSource(el.source) || el.source || '—';
    const rolesCount = (el.roles || []).length;
    const member = _getMember(el.memberId);
    const performerCell = member
      ? `<div style="display:flex;align-items:center;gap:5px;"><div style="width:7px;height:7px;border-radius:50%;background:${member.color};flex-shrink:0;"></div><span style="font-size:12px;color:${member.color};font-weight:700;">${member.name}</span></div>`
      : '<span style="color:#484847;font-size:12px;">—</span>';
    let rows = `
    <tr style="background:${i % 2 === 0 ? '#131313' : '#0e0e0e'};">
      <td style="padding:10px 14px;font-family:'Manrope',sans-serif;font-size:15px;font-weight:700;color:#7aafff;">${el.channelId || '—'}</td>
      <td style="padding:10px 14px;font-weight:600;color:#fff;font-size:13px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:10px;height:10px;background:${el.color || '#7aafff'};flex-shrink:0;"></div>
          ${el.label}${rolesCount > 0 ? `<span style="font-size:9px;color:#484847;margin-left:4px;">[+${rolesCount} ${rolesCount > 1 ? T('rolePlural') : T('role')}]</span>` : ''}
        </div>
      </td>
      <td style="padding:10px 14px;">${performerCell}</td>
      <td style="padding:10px 14px;color:#adaaaa;font-size:12px;">${micDI}</td>
      <td style="padding:10px 14px;color:#c5ffc9;font-size:12px;font-family:'Manrope',sans-serif;">${source}</td>
      <td style="padding:10px 14px;color:#767575;font-size:12px;font-style:italic;">${el.notes || '—'}</td>
    </tr>`;
    (el.roles || []).forEach(role => {
      const roleSrc = TSource(role.source) || role.source || '—';
      rows += `
      <tr style="background:${i % 2 === 0 ? '#0f0f0f' : '#0a0a0a'};">
        <td style="padding:6px 14px 6px 26px;font-family:'Manrope',sans-serif;font-size:12px;color:#7aafff;">
          <span style="color:#333;margin-right:4px;">↳</span>${role.channelId || '—'}
        </td>
        <td style="padding:6px 14px 6px 26px;font-weight:500;color:#adaaaa;font-size:11px;">${role.name}</td>
        <td style="padding:6px 14px;color:#484847;font-size:11px;">—</td>
        <td style="padding:6px 14px;color:#adaaaa;font-size:11px;">${Ttype(role.type)}</td>
        <td style="padding:6px 14px;color:#c5ffc9;font-size:11px;font-family:'Manrope',sans-serif;">${roleSrc}</td>
        <td style="padding:6px 14px;color:#484847;font-size:11px;font-style:italic;">${role.notes || '—'}</td>
      </tr>`;
    });
    return rows;
  }).join('');

  // The HTML5 parser strips orphan <tr>/<td> tags when they aren't inside a
  // <table>, so wrap before sanitizing and then move the parsed rows over.
  const wrapped = `<table><tbody>${rowsHtml}</tbody></table>`;
  const tmp = document.createElement('div');
  tmp.innerHTML = DOMPurify.sanitize(wrapped);
  const parsedTbody = tmp.querySelector('tbody');
  tbody.innerHTML = '';
  if (parsedTbody) {
    while (parsedTbody.firstChild) tbody.appendChild(parsedTbody.firstChild);
  }
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
          <span style="font-family:'Manrope',sans-serif;font-size:13px;font-weight:800;color:#fff;text-transform:uppercase;">${m.name}</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:7px;">${items}</div>
      </div>`;
  }).join('');
  body.innerHTML = DOMPurify.sanitize(`<div style="display:flex;flex-wrap:wrap;gap:10px;">${cards}</div>`);
}

function refreshExportConnectivity() {
  const body = document.getElementById('exp-connectivity-body');
  if (!body) return;

  const sources = [...new Set(state.elements.map(e => e.source).filter(Boolean))];
  const outputs = [...new Set(state.elements.map(e => e.output).filter(Boolean))];
  const phantomCount = state.elements.filter(e => e.phantom).length;
  const connCount = state.connections.length;

  if (state.elements.length === 0 && state.riderNeeds.length === 0) {
    body.innerHTML = DOMPurify.sanitize(`<p style="font-size:12px;color:#484847;font-style:italic;margin:0;">${T('noElems')}</p>`);
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

  body.innerHTML = DOMPurify.sanitize(signalHtml + reqsHtml);
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
  container.innerHTML = DOMPurify.sanitize(html);
}

function saveProjectFile() {
  const data = JSON.stringify({ schemaVersion: 8, elements: state.elements, connections: state.connections, setlist: state.setlist, segments: state.segments, gear: state.gear, members: state.members, riderNeeds: state.riderNeeds, riderChannels: state.riderChannels || [], riderConfig: state.riderConfig || {}, riderMixes: state.riderMixes || [], lang: state.lang }, null, 2);
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
        if (d.riderChannels) state.riderChannels = d.riderChannels;
        if (d.riderConfig) state.riderConfig = d.riderConfig;
        if (d.riderMixes) state.riderMixes = d.riderMixes;
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
  // 1. Context menus
  const ccm = document.getElementById('cable-context-menu');
  if (ccm && ccm.classList.contains('visible')) {
    _closeCableMenu();
    return true;
  }
  // 2. Gear modal
  const gm = document.getElementById('gear-modal');
  if (gm && gm.style.display !== 'none') {
    closeGearModal();
    return true;
  }
  // 3. Sections modal
  const sectM = document.getElementById('sections-modal');
  if (sectM && sectM.style.display !== 'none') {
    closeSectionsModal();
    return true;
  }
  // 4. Batch import modal
  const bim = document.getElementById('batch-import-modal');
  if (bim && bim.style.display !== 'none') {
    closeBatchImport();
    return true;
  }
  // 5. Segment modal
  const segmM = document.getElementById('segment-modal');
  if (segmM && segmM.style.display !== 'none') {
    closeSegmentModal();
    return true;
  }
  // 6. Smart sort modal
  const ssm = document.getElementById('smart-sort-modal');
  if (ssm && ssm.style.display !== 'none') {
    closeSmartSortModal();
    return true;
  }
  // 7. Autosave modal
  const asm = document.getElementById('autosave-modal');
  if (asm && asm.style.display !== 'none') {
    asm.style.display = 'none';
    return true;
  }
  // 8. Share modal
  const shm = document.getElementById('share-modal');
  if (shm && shm.style.display !== 'none') {
    closeShareModal();
    return true;
  }
  // 9. Timeline item modal
  const tim = document.getElementById('tl-item-modal');
  if (tim && tim.style.display !== 'none') {
    closeTlItemModal();
    return true;
  }
  // 10. Custom element modal
  const cem = document.getElementById('custom-el-modal');
  if (cem && cem.style.display !== 'none') {
    closeCustomElementModal();
    return true;
  }
  // 11. Song modal
  const sm = document.getElementById('song-modal');
  if (sm && sm.style.display !== 'none') {
    closeSongModal();
    return true;
  }
  // 12. Confirm modal
  const cm = document.getElementById('confirm-modal');
  if (cm && cm.style.display !== 'none') {
    doConfirm(false);
    return true;
  }
  // 12.5 Mobile Scenes sheet
  if (typeof _mobileScenesOpen !== 'undefined' && _mobileScenesOpen) {
    closeScenesSheet();
    return true;
  }
  // 13. Layouts/presets panel
  const pm = document.getElementById('presets-panel');
  if (pm && pm.style.display !== 'none') {
    closePresetsPanel();
    return true;
  }
  // 14. Timeline panel
  const tl = document.getElementById('timeline-panel');
  if (tl && tl.style.display !== 'none') {
    closeTimeline();
    return true;
  }
  // 15. Item sheet
  const sheet = document.getElementById('sc-item-sheet');
  if (sheet && sheet.classList.contains('sc-sheet-open')) {
    closeItemSheet();
    return true;
  }
  // 16. Elements dial
  if (typeof _dialOpen !== 'undefined' && _dialOpen) {
    closeSCDial();
    return true;
  }
  // 17. Active element selection
  if (state.selectedId) {
    deselectAll();
    return true;
  }

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

// Hide parent's top header + bottom nav while scrolling down inside the export
// preview, and reveal them when scrolling up. Posts {type:'sc-scroll-dir', down}
// to the React parent (StageCorePanel listens for this).
//
// Anti-bounce strategy (this is what kills the infinite oscillation when you
// fling-scroll all the way to the bottom):
//
//   1. Clamp scrollTop into [0, maxScroll]. iOS/Android rubber-band can report
//      negative or beyond-max values; ignoring them stops phantom direction
//      changes during the elastic snap-back.
//   2. Asymmetric hysteresis: hiding is instant on any meaningful downward
//      delta, but *showing* requires UP_SHOW_THRESHOLD pixels of cumulative
//      upward motion. Momentum-bounce reversals at the bottom are tiny
//      (a few px), so they never reach the threshold and the nav stays put.
//   3. Lock the hidden state in a small zone near the bottom so the bounce
//      itself can't even start a "show" attempt.
//   4. Always show near the top; reset the upward accumulator once shown.
function _initExportScrollHide() {
  const scroll = document.getElementById('export-preview-scroll');
  if (!scroll || scroll._scrollHideInit) return;
  scroll._scrollHideInit = true;

  const TOP_THRESHOLD     = 30;   // always show bars within this of the top
  const BOTTOM_LOCK_ZONE  = 80;   // within this of bottom: stay hidden, ignore reversals
  const UP_SHOW_THRESHOLD = 40;   // need 40px of cumulative up-scroll to reveal

  let lastY = 0;
  let lastDir = false; // false = shown, true = hidden
  let upAccum = 0;     // cumulative upward distance since last hide
  let ticking = false;

  const post = (down) => {
    if (down === lastDir) return;
    lastDir = down;
    try { window.parent?.postMessage({ type: 'sc-scroll-dir', down }, '*'); } catch (_) {}
  };

  const update = () => {
    ticking = false;
    const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    // Clamp so rubber-band overscroll values don't enter the math at all.
    const y = Math.max(0, Math.min(max, scroll.scrollTop));
    const dy = y - lastY;
    lastY = y;

    // Near the top: force-show, reset upward accumulator.
    if (y <= TOP_THRESHOLD) {
      upAccum = 0;
      post(false);
      return;
    }

    // Near the bottom: lock hidden so the elastic snap-back can't cause
    // alternating hide/show signals.
    if (max - y <= BOTTOM_LOCK_ZONE) {
      upAccum = 0;
      post(true);
      return;
    }

    if (dy > 0) {
      // Scrolling down — hide immediately and reset the upward counter.
      upAccum = 0;
      post(true);
    } else if (dy < 0) {
      // Scrolling up — only show after enough sustained upward motion.
      // Ignore single-pixel reversals so jitter never registers.
      if (dy <= -1) upAccum += -dy;
      if (upAccum >= UP_SHOW_THRESHOLD) post(false);
    }
  };

  scroll.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  // Reset state every time we (re-)enter the export view.
  lastY = scroll.scrollTop || 0;
  lastDir = false;
  upAccum = 0;
  try { window.parent?.postMessage({ type: 'sc-scroll-dir', down: false }, '*'); } catch (_) {}
}

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

  // Connections visibility (controlled by left toolbar button only)
  const connSvg = document.getElementById('connections-svg');
  if (connSvg) connSvg.style.display = state.connectionsVisible ? '' : 'none';
  // Cable length labels toggle (preferences)
  const cableLenToggle = document.getElementById('settings-cablelen-toggle');
  if (cableLenToggle) cableLenToggle.classList.toggle('on', !!(typeof scCableLengthVisible !== 'undefined' && scCableLengthVisible));

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
  nav.innerHTML = DOMPurify.sanitize('');
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
  list.innerHTML = DOMPurify.sanitize('');
  let dragSrcView = null;

  state.navOrder.forEach(view => {
    const li = document.createElement('li');
    li.className = 'nav-order-item';
    li.draggable = true;
    li.dataset.view = view;
    li.innerHTML = DOMPurify.sanitize(`<span class="material-symbols-outlined drag-handle">drag_indicator</span><span>${view}</span>`);

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
function toggleCableLengthFromSettings() {
  if (typeof scToggleCableLength === 'function') scToggleCableLength();
  const toggle = document.getElementById('settings-cablelen-toggle');
  if (toggle) toggle.classList.toggle('on', !!(typeof scCableLengthVisible !== 'undefined' && scCableLengthVisible));
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
  // Cable length labels toggle
  const cableLenToggle = document.getElementById('settings-cablelen-toggle');
  if (cableLenToggle) cableLenToggle.classList.toggle('on', !!(typeof scCableLengthVisible !== 'undefined' && scCableLengthVisible));
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

// Drop hint is only shown during active drag-over, not on load

// Pull-to-refresh removed (was disorienting on mobile)

function scheduleCloudAutosave() {}
window.onSCAuthChange = function() {};

function getCloudState() {
  // Mirror live elements/connections into the active scene before serializing
  // so the cloud copy of scenes[] reflects unsaved edits in the current scene.
  if (typeof _persistCurrentScene === 'function') _persistCurrentScene();
  return {
    schemaVersion: 9,
    savedAt: new Date().toISOString(),
    elements:    JSON.parse(JSON.stringify(state.elements)),
    connections: JSON.parse(JSON.stringify(state.connections)),
    scenes:          Array.isArray(state.scenes) ? JSON.parse(JSON.stringify(state.scenes)) : undefined,
    currentSceneIdx: typeof state.currentSceneIdx === 'number' ? state.currentSceneIdx : 0,
    setlist:     JSON.parse(JSON.stringify(state.setlist)),
    segments:    JSON.parse(JSON.stringify(state.segments)),
    gear:        JSON.parse(JSON.stringify(state.gear)),
    members:     JSON.parse(JSON.stringify(state.members)),
    riderNeeds:  JSON.parse(JSON.stringify(state.riderNeeds)),
    riderChannels: JSON.parse(JSON.stringify(state.riderChannels || [])),
    riderConfig: JSON.parse(JSON.stringify(state.riderConfig || {})),
    riderMixes:  JSON.parse(JSON.stringify(state.riderMixes || [])),
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
  // ── Scenes (schemaVersion 9+) ─────────────────────────────────────────
  // Wrap legacy cloud payloads (schemaVersion < 9) into Scene 1 so users
  // who upgrade with existing cloud data don't lose their plot.
  if (d.schemaVersion >= 9 && Array.isArray(d.scenes) && d.scenes.length > 0) {
    state.scenes = d.scenes.slice(0, SCENES_MAX).map((s, i) => ({
      id: s.id || ('s' + (i + 1)),
      name: (typeof s.name === 'string' && s.name.trim()) ? s.name.trim().slice(0, 24) : ('Scene ' + (i + 1)),
      elements: Array.isArray(s.elements) ? JSON.parse(JSON.stringify(s.elements)) : [],
      connections: Array.isArray(s.connections) ? JSON.parse(JSON.stringify(s.connections)) : [],
      nextId: typeof s.nextId === 'number' ? s.nextId : 1,
    }));
    state.currentSceneIdx = (typeof d.currentSceneIdx === 'number' &&
                              d.currentSceneIdx >= 0 &&
                              d.currentSceneIdx < state.scenes.length)
      ? d.currentSceneIdx : 0;
    const cur = state.scenes[state.currentSceneIdx];
    state.elements = JSON.parse(JSON.stringify(cur.elements));
    state.connections = JSON.parse(JSON.stringify(cur.connections));
  } else {
    state.scenes = [{
      id: 's1', name: 'Scene 1',
      elements: JSON.parse(JSON.stringify(state.elements)),
      connections: JSON.parse(JSON.stringify(state.connections)),
      nextId: state.nextId || 1,
    }];
    state.currentSceneIdx = 0;
  }
  state.setlist     = d.setlist     ? JSON.parse(JSON.stringify(d.setlist))     : [];
  state.segments    = d.segments    ? JSON.parse(JSON.stringify(d.segments))    : [];
  state.gear        = d.gear        ? JSON.parse(JSON.stringify(d.gear))        : [];
  state.members     = d.members     ? JSON.parse(JSON.stringify(d.members))     : [];
  state.timeline    = d.timeline    ? JSON.parse(JSON.stringify(d.timeline))    : [];
  if (d.riderNeeds) state.riderNeeds = JSON.parse(JSON.stringify(d.riderNeeds));
  if (d.riderChannels) state.riderChannels = JSON.parse(JSON.stringify(d.riderChannels));
  if (d.riderConfig) state.riderConfig = JSON.parse(JSON.stringify(d.riderConfig));
  if (d.riderMixes) state.riderMixes = JSON.parse(JSON.stringify(d.riderMixes));
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
// Remember whether the left vtools panel was expanded before live mode so
// we can restore it on exit. (Default state is collapsed.)
let _gigVtoolsWasOpen = false;

function toggleGigMode() {
  const body = document.body;
  const FADE = 170;   // panel fade duration (ms)
  const MOVE = 230;   // canvas expand duration (ms)

  if (!state.gigMode) {
    // ── Entering focus mode ──────────────────────────────
    // Auto-collapse the left vertical toolbar so the stage plot has the
    // full canvas width before we start the fade.
    const vbody = document.getElementById('sc-vtools-body');
    _gigVtoolsWasOpen = !!(vbody && !vbody.classList.contains('vtools-collapsed'));
    if (_gigVtoolsWasOpen && typeof toggleSCVTools === 'function') toggleSCVTools();

    // 1. Enable transitions + start fading panels out
    body.classList.add('gig-transitioning', 'gig-fade-out');

    // 2. After panels fade, flip to gig-mode (display:none) and expand canvas
    setTimeout(() => {
      body.classList.add('gig-mode');
      body.classList.remove('gig-fade-out');
      state.gigMode = true;
      _applyGigEyeState();
      _notifyLiveMode(true);
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
        _notifyLiveMode(false);
        saveSettings();
        setTimeout(() => body.classList.remove('gig-transitioning'), MOVE);
        // Restore the left vtools panel to whatever it was before live mode
        const vbody = document.getElementById('sc-vtools-body');
        const isCollapsed = vbody && vbody.classList.contains('vtools-collapsed');
        if (_gigVtoolsWasOpen && isCollapsed && typeof toggleSCVTools === 'function') {
          toggleSCVTools();
        }
        _gigVtoolsWasOpen = false;
      });
    });
  }
}

function _applyGigEyeState() {
  // Legacy left-toolbar eye is gone; live-mode-exit (bottom-right) is
  // entirely CSS-driven via body.gig-mode. Kept as a no-op for any
  // callers that still invoke it.
  const eyeBtn  = document.getElementById('btn-gig-eye');
  const eyeIcon = document.getElementById('gig-eye-icon');
  if (eyeBtn)  eyeBtn.style.color  = state.gigMode ? '#ff4444' : '#767575';
  if (eyeIcon) eyeIcon.textContent = state.gigMode ? 'visibility_off' : 'visibility';
}

function _notifyLiveMode(on) {
  try {
    window.parent?.postMessage({ type: 'sc-live-mode', on: !!on }, '*');
  } catch (_) {}
}

function _applyGigMode() {
  document.body.classList.toggle('gig-mode', state.gigMode);
  _applyGigEyeState();
  _notifyLiveMode(state.gigMode);
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
      if (g) { g.innerHTML = DOMPurify.sanitize(''); library[cat].forEach(i => g.appendChild(buildLibraryItem(i))); lcIcons(); }
    } else {
      customItems.push(libItem);
    }
  });

  // Update library.custom for the desktop tray hover system
  library.custom = [
    { _isCreate: true },
    ...customItems,
  ];

  grid.innerHTML = DOMPurify.sanitize('');
  items.filter(item => !item.category || item.category === 'custom').forEach(item => {
    const div = document.createElement('div');
    div.className = 'draggable-item bg-surface-container-highest flex flex-col items-center justify-center hover:bg-surface-bright transition-all';
    div.style.cssText = 'cursor:grab;border:1px solid transparent;padding:4px;width:60px;height:60px;flex-shrink:0;position:relative;';
    div.draggable = true;
    const iconHtmlStr = item.imageData
      ? `<img src="${item.imageData}" style="width:26px;height:26px;object-fit:contain;margin-bottom:3px;" draggable="false"/>`
      : `<span style="font-size:22px;margin-bottom:3px;line-height:1;">${item.emoji}</span>`;
    div.innerHTML = DOMPurify.sanitize(`
      ${iconHtmlStr}
      <span class="font-bold text-on-surface-variant text-center" style="font-size:8px;text-transform:uppercase;letter-spacing:-0.01em;line-height:1.1;word-break:break-all;">${item.name}</span>
      <button onclick="event.stopPropagation();deleteCustomElement('${item.id}')" title="Remove" style="position:absolute;top:1px;right:2px;background:none;border:none;cursor:pointer;color:#3a3a3a;font-size:12px;padding:0;line-height:1;" onmouseover="this.style.color='#ff716c'" onmouseout="this.style.color='#3a3a3a'">×</button>`);
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
    scale: getDefaultScale(item),
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

// Shared anchor-based placement used by both _doAutoArrange (toolbar button)
// and _scBuildPlot (AI assistant). Items are anchored to natural stage
// positions (left ~18%, center 50%, right ~82%) and fan out around the
// anchor when several share a side, instead of being centered inside an
// inner third — which made everything look bunched toward the middle.
function _smartPlaceElements(elements, W, H) {
  const ICON_W = 70;
  const PAD_X  = Math.max(ICON_W * 0.8, W * 0.07);
  const MIN_SEP = ICON_W * 1.15;
  const SUB_OFF = H * 0.045;

  // Row Y fractions — well-spread for a real stage
  const ROW_Y = [0.08, 0.26, 0.50, 0.73, 0.91];

  // Side anchors as fractions of W. Push left/right outward so single
  // items land near the edges of the stage, not inside an inner third.
  const ANCHOR = { left: 0.18, center: 0.50, right: 0.82 };

  // Bucket elements into rows
  const rows = Array.from({ length: 5 }, () =>
    ({ left: [], center: [], right: [], edges: [], spread: [] })
  );

  // Lead-vocal detection: any mic-type element whose label/name hints at the
  // lead/main vocal goes to row 4 (downstage) center, ahead of the band.
  const _isMicType = (t) => /\bMic\b|Microphone/i.test(t || '');
  const _isLeadVocal = (el) => {
    if (!_isMicType(el.type)) return false;
    const txt = `${el.label || ''} ${el.name || ''}`.toLowerCase();
    return /\b(lead|main|vox|vocal|singer)\b/.test(txt);
  };
  elements.forEach(el => {
    let zone = _ARRANGE_ZONES[el.type] || { row: 2, side: 'spread' };
    if (_isLeadVocal(el)) zone = { row: 4, side: 'center' };
    rows[zone.row][zone.side].push(el);
  });

  // Place a side group: fan items out symmetrically around an anchor X,
  // clamped so the whole group stays inside [PAD_X, W - PAD_X].
  function placeAnchored(group, anchorX, y) {
    if (!group.length) return;
    const n = group.length;
    if (n === 1) { group[0].x = anchorX; group[0].y = y; return; }
    const totalW = MIN_SEP * (n - 1);
    let startX = anchorX - totalW / 2;
    if (startX < PAD_X) startX = PAD_X;
    if (startX + totalW > W - PAD_X) startX = W - PAD_X - totalW;
    group.forEach((el, i) => { el.x = startX + i * MIN_SEP; el.y = y; });
  }

  // Place a 'spread' group across the full usable stage width.
  function placeSpread(group, y) {
    if (!group.length) return;
    const n = group.length;
    if (n === 1) { group[0].x = W / 2; group[0].y = y; return; }
    const usable = W - 2 * PAD_X;
    const step = usable / (n - 1);
    group.forEach((el, i) => { el.x = PAD_X + i * step; el.y = y; });
  }

  rows.forEach((sides, rowIdx) => {
    const baseY = ROW_Y[rowIdx] * H;

    // ── Edges: alternate left / right at the outermost positions ──────
    sides.edges.forEach((el, i) => {
      el.x = i % 2 === 0 ? PAD_X : W - PAD_X;
      el.y = baseY;
    });

    // ── Spread: items use the full stage width ────────────────────────
    placeSpread(sides.spread, baseY);

    // ── L / C / R via anchor placement. If a row also has spread items,
    // nudge L/C/R up slightly so they don't overlap the spread row.
    const yOff = sides.spread.length > 0 ? -SUB_OFF : 0;
    placeAnchored(sides.left,   W * ANCHOR.left,   baseY + yOff);
    placeAnchored(sides.center, W * ANCHOR.center, baseY + yOff);
    placeAnchored(sides.right,  W * ANCHOR.right,  baseY + yOff);

    // ── Collision nudge: push any same-row pair closer than MIN_SEP ──
    const allInRow = [
      ...sides.left, ...sides.center, ...sides.right, ...sides.spread, ...sides.edges
    ].filter(el => el.x !== undefined);
    allInRow.sort((a, b) => a.x - b.x);
    for (let i = 1; i < allInRow.length; i++) {
      const prev = allInRow[i - 1], curr = allInRow[i];
      if (curr.y !== prev.y) continue;
      const dx = curr.x - prev.x;
      if (dx < MIN_SEP) {
        const push = (MIN_SEP - dx) / 2;
        prev.x = Math.max(PAD_X, prev.x - push);
        curr.x = Math.min(W - PAD_X, curr.x + push);
      }
    }
  });

  // Final clamp inside the canvas
  elements.forEach(el => {
    el.x = Math.max(PAD_X * 0.6, Math.min(W - PAD_X * 0.6, el.x || W / 2));
    el.y = Math.max(ICON_W * 0.6, Math.min(H - ICON_W * 0.6, el.y || H / 2));
  });
}


function _doAutoArrange() {
  pushHistory();
  const canvas = document.getElementById('stage-canvas');
  const W = canvas ? canvas.offsetWidth  : (state.canvasW || 900);
  const H = canvas ? canvas.offsetHeight : (state.canvasH || 506);

  // Collect old positions for the smooth animation pass
  const oldPos = {};
  state.elements.forEach(el => {
    const dom = document.getElementById('elem-' + el.id);
    if (dom) oldPos[el.id] = { x: parseFloat(dom.style.left), y: parseFloat(dom.style.top) };
  });

  // New anchor-based placement (shared with the AI assistant's _scBuildPlot)
  _smartPlaceElements(state.elements, W, H);

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
  curve.innerHTML = DOMPurify.sanitize(items.map((it, i) => {
    const e = Math.max(1, Math.min(5, it.energy || 3));
    const h = 8 + (e - 1) * 8; // 8px .. 40px
    const col = energyColors[e] || '#7aafff';
    return `<div class="tl-energy-dot" style="flex:1;height:${h}px;background:${col};opacity:0.75;" title="${it.name}: Energy ${e}"></div>`;
  }).join(''));

  // Duration bars (proportional width)
  bars.innerHTML = DOMPurify.sanitize(items.map(it => {
    const secs = _parseDurationSecs(it.duration || '');
    const w = totalSecs > 0 ? (secs / totalSecs * 100) : (100 / Math.max(1, items.length));
    const type = it.type || 'song';
    const col = type === 'break' ? '#ffb43c' : type === 'transition' ? '#ff716c' : '#7aafff';
    return `<div style="height:100%;background:${col};opacity:0.45;flex:${secs || 1};min-width:4px;" title="${it.name} · ${it.duration || '—'}"></div>`;
  }).join(''));

  // Item list
  if (items.length === 0) {
    list.innerHTML = DOMPurify.sanitize('<div style="text-align:center;padding:32px 16px;font-family:\'Manrope\',sans-serif,sans-serif;font-size:11px;color:#333;">No items yet.<br><span style="color:#555;">Click + Song or sync from Setlist.</span></div>');
    return;
  }

  list.innerHTML = DOMPurify.sanitize(items.map((it, i) => {
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
  }).join(''));
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
    riderChannels: state.riderChannels || [],
    riderConfig: state.riderConfig || {},
    riderMixes: state.riderMixes || [],
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
  if (qrOut) { qrOut.innerHTML = DOMPurify.sanitize('<span style="font-size:11px;color:#aaa;text-align:center;padding:10px;">Click Generate QR</span>'); }
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
  container.innerHTML = DOMPurify.sanitize('');
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
    container.innerHTML = DOMPurify.sanitize('<span style="color:#ff716c;font-size:11px;padding:10px;">QR generation failed.</span>');
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
    if (d.riderChannels) state.riderChannels = d.riderChannels;
    if (d.riderConfig) state.riderConfig = d.riderConfig;
    if (d.riderMixes)  state.riderMixes  = d.riderMixes;
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
    console.warn('[Stagex] Failed to parse share link:', e);
  }
})();

// ── Cloud sync bridge ────────────────────────────────────────────────────────
// Receives postMessage from the parent (Chordex shell) to snapshot or restore
// StageX localStorage. Audio blobs/IndexedDB are NOT included — only the JSON
// state listed below.
(function () {
  var SYNC_KEYS = [
    'stagecoreProject',
    'stagecorePresets_v1',
    'stagecoreSettings',
    'sc_session',
    'scCustomElements',
    'sc-offline-mode',
    'sm_behavior',
    'sc_el_presets_v1'
  ];

  function snapshot() {
    var out = {};
    for (var i = 0; i < SYNC_KEYS.length; i++) {
      try {
        var v = localStorage.getItem(SYNC_KEYS[i]);
        if (v != null) out[SYNC_KEYS[i]] = v;
      } catch (e) {}
    }
    return out;
  }

  function restore(payload) {
    if (!payload || typeof payload !== 'object') return;
    for (var i = 0; i < SYNC_KEYS.length; i++) {
      var k = SYNC_KEYS[i];
      try {
        if (Object.prototype.hasOwnProperty.call(payload, k)) {
          var val = payload[k];
          if (val == null) localStorage.removeItem(k);
          else localStorage.setItem(k, String(val));
        }
      } catch (e) {}
    }
  }
  window.stageHasOpenOverlay = function() {
    const ccm = document.getElementById('cable-context-menu');
    if (ccm && ccm.classList.contains('visible')) return true;
    const ids = [
      'gear-modal', 'sections-modal', 'batch-import-modal', 'segment-modal',
      'smart-sort-modal', 'autosave-modal', 'share-modal', 'tl-item-modal',
      'custom-el-modal', 'song-modal', 'confirm-modal', 'presets-panel',
      'timeline-panel'
    ];
    for (var i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el && el.style.display !== 'none') return true;
    }
    if (typeof _mobileScenesOpen !== 'undefined' && _mobileScenesOpen) return true;
    const sheet = document.getElementById('sc-item-sheet');
    if (sheet && sheet.classList.contains('sc-sheet-open')) return true;
    if (typeof _dialOpen !== 'undefined' && _dialOpen) return true;
    return false;
  };

  function cancelActiveDrag() {
    if (typeof window._cancelActiveDrag === 'function') {
      try { window._cancelActiveDrag(); } catch (e) {}
    }
  }

  window.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      cancelActiveDrag();
      if (typeof deselectAll === 'function') deselectAll();
      if (typeof msClear === 'function') msClear();
    }
  });

  window.addEventListener('orientationchange', function() {
    cancelActiveDrag();
    if (typeof deselectAll === 'function') deselectAll();
    if (typeof msClear === 'function') msClear();
  });

  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    var isAllowedOrigin = !e.origin || e.origin === window.location.origin ||
      e.origin === 'https://localhost' ||
      e.origin === 'http://localhost' ||
      e.origin === 'capacitor://localhost';
    if (!isAllowedOrigin) return;
    var t = e.data.type;
    if (t === 'sc-sync-snapshot') {
      try {
        var src = e.source || window.parent;
        src.postMessage({
          type: 'sc-sync-snapshot-result',
          data: snapshot()
        }, '*');
      } catch (err) {}
    } else if (t === 'sc-sync-restore') {
      restore(e.data.data);
      // After restoring, soft-reload so the app re-reads its state cleanly.
      try {
        if (e.data.reload !== false) {
          setTimeout(function () { try { location.reload(); } catch (e) {} }, 50);
        }
      } catch (err) {}
    }
  });
})();
