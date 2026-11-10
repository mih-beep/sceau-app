document.addEventListener('DOMContentLoaded', () => {
  const pubkeyInput = document.getElementById('pubkey');
  const sealBtn = document.getElementById('sealBtn');
  const status = document.getElementById('status');

  chrome.storage.local.get(['sceau_pubkey'], (result) => {
    if (result.sceau_pubkey) pubkeyInput.value = result.sceau_pubkey;
  });

  sealBtn.addEventListener('click', async () => {
    const pubkey = pubkeyInput.value.trim();
    if (!pubkey) return alert("Veuillez entrer votre clé publique.");

    chrome.storage.local.set({ sceau_pubkey: pubkey });
    sealBtn.innerText = 'Envoi en cours...';

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0].url;
      
      try {
        const res = await fetch('https://sceau-app.vercel.app/api/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pubkey, url })
        });
        
        if (res.ok) {
          sealBtn.style.display = 'none';
          status.style.display = 'block';
        } else {
          const d = await res.json();
          alert("Erreur : " + d.error);
          sealBtn.innerText = 'Sceller cette page';
        }
      } catch (e) {
        alert("Erreur réseau. Vérifiez votre connexion.");
        sealBtn.innerText = 'Sceller cette page';
      }
    });
  });
});
