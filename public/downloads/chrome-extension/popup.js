document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const sealBtn = document.getElementById('sealBtn');
  const status = document.getElementById('status');

  chrome.storage.local.get(['sceau_apiKey'], (result) => {
    if (result.sceau_apiKey) apiKeyInput.value = result.sceau_apiKey;
  });

  sealBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return alert("Veuillez entrer votre clé API.");

    chrome.storage.local.set({ sceau_apiKey: apiKey });
    sealBtn.innerText = 'Envoi en cours...';
    sealBtn.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0].url;
      const title = tabs[0].title || url;
      
      try {
        const res = await fetch('https://sceau-app.vercel.app/api/v1/plugin/seal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, title, content: `URL: ${url}`, category: 'Web' })
        });
        
        if (res.ok) {
          sealBtn.style.display = 'none';
          status.style.display = 'block';
        } else {
          const d = await res.json();
          alert("Erreur : " + (d.error || "Inconnue"));
          sealBtn.innerText = '🔒 Sceller cette page';
          sealBtn.disabled = false;
        }
      } catch (e) {
        alert("Erreur réseau. Vérifiez votre connexion.");
        sealBtn.innerText = '🔒 Sceller cette page';
        sealBtn.disabled = false;
      }
    });
  });
});
