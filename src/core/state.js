// What the visitor is doing right now. mode: 'waiting' (intro card) → 'intro' (walking in) → 'play'
export const state = { mode: 'waiting', introT: 0, introWait: 0, tween: null, walk: null, panel: null, hover: null, simple: false };
