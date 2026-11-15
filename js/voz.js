// Lee en voz alta con la voz del teléfono, en español.

export function hayVoz() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function vozEspanol() {
  const voces = window.speechSynthesis.getVoices() || [];
  return (
    voces.find((v) => v.lang && v.lang.toLowerCase().startsWith('es-co')) ||
    voces.find((v) => v.lang && v.lang.toLowerCase().startsWith('es-419')) ||
    voces.find((v) => v.lang && v.lang.toLowerCase().startsWith('es-mx')) ||
    voces.find((v) => v.lang && v.lang.toLowerCase().startsWith('es')) ||
    null
  );
}

export function leer(texto) {
  if (!hayVoz() || !texto) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  const v = vozEspanol();
  if (v) u.voice = v;
  u.lang = v ? v.lang : 'es-CO';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
  return true;
}

export function callar() {
  if (hayVoz()) window.speechSynthesis.cancel();
}
