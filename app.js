/* Tesco Productivity App – front-end logic */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const fmt = (s)=> s.toString().padStart(2,'0');
  const timerEl = $("#timer");
  const statusEl = $("#status");
  const startBtn = $("#startBtn");
  const pauseBtn = $("#pauseBtn");
  const resumeBtn = $("#resumeBtn");
  const stopBtn = $("#stopBtn");
  const palletInput = $("#palletCode");
  const nameInput = $("#workerName");
  const scanToggle = $("#scanToggle");
  const scannerWrap = $("#scanner");
  const videoEl = $("#videoPreview");
  const pauseDialog = document.getElementById("pauseDialog");
  const pauseForm = document.getElementById("pauseForm");
  const pauseReason = document.getElementById("pauseReason");
  const otherWrap = document.getElementById("otherReasonWrap");
  const otherReason = document.getElementById("otherReason");
  const stopDialog = document.getElementById("stopDialog");
  const leftoverInput = document.getElementById("leftover");
  const yearEl = document.getElementById("year");
  yearEl.textContent = new Date().getFullYear();

  // Helper: resolve ZXing namespace (supports ZXing, ZXingBrowser)
  function getZX(){
    const z = window.ZXing || window.ZXingBrowser || null;
    return z;
  }
  async function stopScanner(){
    try{
      if(codeReader && codeReader.reset){ await codeReader.reset(); }
    }catch(e){}
    if(currentStream){ currentStream.getTracks().forEach(t=>t.stop()); currentStream=null; }
    if(scanInterval){ clearInterval(scanInterval); scanInterval=null; }
    scanning=false;
    scannerWrap.classList.add("hidden");
    scanToggle.setAttribute("aria-pressed","false");
  }


  // State
  let ticker = null;
  let startedAt = null;
  let pausedAt = null;
  let totalPausedMs = 0;
  let pauseCount = 0;
  const pauseReasons = [];
  let scanning = false;
  let codeReader = null;
  let currentStream = null;
  let scanInterval = null;

  function msToHMS(ms){
    const sec = Math.floor(ms/1000);
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    return `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
  }

  function setStatus(text){ statusEl.textContent = text; }

  function refreshTimer(){
    if(!startedAt){ timerEl.textContent = "00:00:00"; return; }
    const now = Date.now();
    const activeMs = (now - startedAt) - totalPausedMs - (pausedAt ? (now - pausedAt) : 0);
    timerEl.textContent = msToHMS(Math.max(0, activeMs));
  }

  function setRunningUI(running){
    if(running){
      startBtn.classList.add("hidden");
      pauseBtn.classList.remove("hidden");
      stopBtn.classList.remove("hidden");
      resumeBtn.classList.add("hidden");
    }else{
      startBtn.classList.remove("hidden");
      pauseBtn.classList.add("hidden");
      resumeBtn.classList.add("hidden");
      stopBtn.classList.add("hidden");
    }
  }

  function setPausedUI(paused){
    if(paused){
      pauseBtn.classList.add("hidden");
      resumeBtn.classList.remove("hidden");
      setStatus("Pozastavené");
    }else{
      pauseBtn.classList.remove("hidden");
      resumeBtn.classList.add("hidden");
    }
  }

  function resetAll(){
    clearInterval(ticker); ticker=null;
    startedAt = null; pausedAt = null; totalPausedMs=0;
    pauseCount=0; pauseReasons.length=0;
    setStatus("Pripravené"); refreshTimer();
    setRunningUI(false); setPausedUI(false);
    leftoverInput.value = "";
    // Keep name pre-filled for rýchlosť, vymaž kód palety
    palletInput.value = "";
    stopScanner();
  }

  function requireInputs(){
    if(!palletInput.value.trim()){
      palletInput.focus(); throw new Error("Zadaj kód palety.");
    }
    if(!nameInput.value.trim()){
      nameInput.focus(); throw new Error("Zadaj meno.");
    }
  }

  // ZXing scanning
  
  async function toggleScanner(){
    try{
      if(scanning){ await stopScanner(); return; }
      scanning = true;
      scanToggle.setAttribute("aria-pressed","true");
      scannerWrap.classList.remove("hidden");

      // Try ZXing first
      const ZX = getZX();
      if (ZX && (ZX.BrowserMultiFormatReader || (ZX.default && ZX.default.BrowserMultiFormatReader))) {
        const Reader = ZX.BrowserMultiFormatReader || ZX.default.BrowserMultiFormatReader;
        codeReader = new Reader();
        const devices = await (Reader.listVideoInputDevices ? Reader.listVideoInputDevices() : ZX.BrowserCodeReader.listVideoInputDevices());
        const backCam = devices && devices.find(d=>/back|rear|environment/i.test(d.label)) || (devices && devices[0]) || null;
        currentStream = await navigator.mediaDevices.getUserMedia({video: backCam ? {deviceId: backCam.deviceId} : {facingMode:'environment'}});
        videoEl.srcObject = currentStream;
        await videoEl.play();
        await codeReader.decodeFromVideoDevice(backCam ? backCam.deviceId : null, videoEl, (result, err) => {
          if(result){
            palletInput.value = result.getText ? result.getText() : (result.text || '');
            stopScanner();
          }
        });
        return;
      }

      // Fallback: BarcodeDetector (Chrome/Edge/Samsung)
      if ('BarcodeDetector' in window) {
        const formats = ['ean_13','code_128','ean_8','upc_a','upc_e','code_39','itf'];
        const detector = new window.BarcodeDetector({formats});
        currentStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
        videoEl.srcObject = currentStream;
        await videoEl.play();
        scanInterval = setInterval(async () => {
          try{
            const codes = await detector.detect(videoEl);
            if(codes && codes.length){
              palletInput.value = codes[0].rawValue || codes[0].raw || '';
              await stopScanner();
            }
          }catch(e){ /* silent */ }
        }, 250);
        return;
      }

      throw new Error('Skenovanie nie je podporované v tomto prehliadači.');
    }catch(e){
      console.error(e);
      alert("Skenovanie zlyhalo: " + (e.message || e));
      await stopScanner();
    }
  }


  // Events
  scanToggle.addEventListener("click", toggleScanner);

  startBtn.addEventListener("click", () => {
    try{
      requireInputs();
    }catch(e){ return; }

    startedAt = Date.now();
    setRunningUI(true);
    setPausedUI(false);
    setStatus("Beží");
    refreshTimer();
    ticker = setInterval(refreshTimer, 1000);
  });

  pauseBtn.addEventListener("click", () => {
    if(!startedAt) return;
    pausedAt = Date.now();
    setPausedUI(true);
    pauseReason.value = "";
    otherReason.value = "";
    otherWrap.classList.add("hidden");
    pauseDialog.showModal();
  });

  pauseReason.addEventListener("change", () => {
    if(pauseReason.value === "Iné"){
      otherWrap.classList.remove("hidden");
      otherReason.setAttribute("required","required");
      otherReason.focus();
    }else{
      otherWrap.classList.add("hidden");
      otherReason.removeAttribute("required");
      otherReason.value = "";
    }
  });

  $("#confirmPauseBtn").addEventListener("click", (ev) => {
    ev.preventDefault();
    if(!pauseReason.value){
      pauseForm.reportValidity();
      return;
    }
    if(pauseReason.value === "Iné" && !otherReason.value.trim()){
      otherReason.reportValidity();
      return;
    }
    // record pause
    const reason = pauseReason.value === "Iné" ? `Iné: ${otherReason.value.trim()}` : pauseReason.value;
    pauseReasons.push(reason);
    pauseCount++;
    pauseDialog.close();
  });

  resumeBtn.addEventListener("click", () => {
    if(!startedAt || !pausedAt) return;
    const pausedDur = Date.now() - pausedAt;
    totalPausedMs += pausedDur;
    pausedAt = null;
    setPausedUI(false);
    setStatus("Beží");
  });

  stopBtn.addEventListener("click", () => {
    if(!startedAt) return;
    stopDialog.showModal();
  });

  $("#confirmStopBtn").addEventListener("click", async (ev) => {
    ev.preventDefault();
    if(leftoverInput.value === "" || Number(leftoverInput.value) < 0){
      leftoverInput.reportValidity(); return;
    }
    const endedAt = Date.now();
    const netMs = (endedAt - startedAt) - totalPausedMs - (pausedAt ? (endedAt - pausedAt) : 0);
    const payload = {
      palletCode: palletInput.value.trim(),
      name: nameInput.value.trim(),
      start: new Date(startedAt).toISOString(),
      end: new Date(endedAt).toISOString(),
      netSeconds: Math.max(0, Math.round(netMs/1000)),
      pauseCount: pauseCount,
      pauseReasons: pauseReasons.join("; "),
      leftover: Number(leftoverInput.value)
    };

    try{
      const res = await fetch("save.php", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      stopDialog.close();
      resetAll();
      alert("Uložené. ID: " + data.id);
    }catch(e){
      console.error(e);
      alert("Ukladanie zlyhalo. Skús neskôr alebo kontaktuj správcu.");
    }
  });

  // Guard: when paused and user cancels dialog, keep paused UI
  pauseDialog.addEventListener("close", () => {
    if(pausedAt){ setStatus("Pozastavené"); }
  });

  // Accessibility: Enter to start if inputs filled
  ["keydown","change","input"].forEach(evName => {
    document.addEventListener(evName, () => {
      startBtn.disabled = !(palletInput.value.trim() && nameInput.value.trim());
    });
  });
  startBtn.disabled = true;
})();