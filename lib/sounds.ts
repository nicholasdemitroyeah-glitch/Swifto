'use client';

let clickAudio: HTMLAudioElement | null = null;
let arriveAudio: HTMLAudioElement | null = null;
let addLoadAudio: HTMLAudioElement | null = null;
let menuExitAudio: HTMLAudioElement | null = null;
let introAudio: HTMLAudioElement | null = null;

export function initSounds() {
  if (typeof window === 'undefined') return;
  if (!clickAudio) clickAudio = new Audio('/resources/UI_AllButtonSounds.mp3');
  if (!arriveAudio) arriveAudio = new Audio('/resources/UI_ArriveAtStopSound.mp3');
  if (!addLoadAudio) addLoadAudio = new Audio('/resources/UI_AddLoadSound.mp3');
  if (!menuExitAudio) menuExitAudio = new Audio('/resources/UI_MenuExitSounds.mp3');
  if (!introAudio) introAudio = new Audio('/resources/UI_StartAppSoundIntro.mp3');
}

export function playClick() {
  try {
    if (clickAudio) { clickAudio.currentTime = 0; void clickAudio.play(); }
  } catch {}
}

export function playArrive() {
  try {
    if (arriveAudio) { arriveAudio.currentTime = 0; void arriveAudio.play(); }
  } catch {}
}

export function playAddLoad() {
  try {
    if (addLoadAudio) { addLoadAudio.currentTime = 0; void addLoadAudio.play(); }
  } catch {}
}

export function playMenuExit() {
  try {
    if (menuExitAudio) { menuExitAudio.currentTime = 0; void menuExitAudio.play(); }
  } catch {}
}

export function playIntro() {
  try {
    if (introAudio) { introAudio.currentTime = 0; void introAudio.play(); }
  } catch {}
}


