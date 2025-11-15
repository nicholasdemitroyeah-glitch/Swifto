// Haptic feedback utilities for satisfying mobile interactions

export function hapticLight() {
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

export function hapticMedium() {
  if ('vibrate' in navigator) {
    navigator.vibrate(20);
  }
}

export function hapticHeavy() {
  if ('vibrate' in navigator) {
    navigator.vibrate(30);
  }
}

export function hapticSuccess() {
  if ('vibrate' in navigator) {
    navigator.vibrate([10, 50, 10]);
  }
}

export function hapticError() {
  if ('vibrate' in navigator) {
    navigator.vibrate([20, 50, 20, 50, 20]);
  }
}

