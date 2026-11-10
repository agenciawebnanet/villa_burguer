'use strict';

const demoScreen = document.querySelector('#demo');
const menuContent = document.querySelector('#menu-content');
const installButtons = document.querySelectorAll('[data-install]');
const standalone = window.matchMedia('(display-mode: standalone)');
const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let installPrompt = null;

document.querySelector('#enter-menu').addEventListener('click', () => {
  demoScreen.hidden = true;
  menuContent.hidden = false;
  document.querySelector('#menu-start').focus();
});

function updateInstallButtons(installed = standalone.matches || navigator.standalone === true) {
  for (const button of installButtons) {
    button.hidden = installed;
    button.setAttribute('aria-expanded', 'false');
    document.getElementById(button.getAttribute('aria-controls')).hidden = true;
  }
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  updateInstallButtons();
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  updateInstallButtons(true);
});

for (const button of installButtons) {
  button.addEventListener('click', async () => {
    if (installPrompt) {
      const promptEvent = installPrompt;
      installPrompt = null;
      try {
        await promptEvent.prompt();
        return;
      } catch {
        // A dismissed or expired prompt can fall back to the browser menu.
      }
    }

    const help = document.getElementById(button.getAttribute('aria-controls'));
    help.textContent = appleMobile
      ? 'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.'
      : 'No menu do navegador, procure Instalar aplicativo ou Adicionar à tela inicial, quando disponível.';
    help.hidden = !help.hidden;
    button.setAttribute('aria-expanded', String(!help.hidden));
  });
}

standalone.addEventListener('change', () => updateInstallButtons());
updateInstallButtons();

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Não foi possível ativar o modo offline.', error);
  });
}
