export function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '' && text !== null && text !== undefined) node.textContent = String(text);
  return node;
}
export function icon(name, weather = false) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS(node.namespaceURI, 'use');
  use.setAttribute('href', `#${weather ? 'w' : 'i'}-${name}`);
  node.setAttribute('aria-hidden', 'true');
  if (weather) node.classList.add('weather-icon');
  node.append(use); return node;
}
export function announce(message) {
  const node = document.getElementById('announcements');
  node.textContent = '';
  requestAnimationFrame(() => { node.textContent = message; });
}
