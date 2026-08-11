(() => {
  const enabled = new URLSearchParams(location.search).get("test") === "1";
  const tests = [];
  const results = [];

  function esc(v){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

  async function run(){
    if(!enabled) return;
    results.length = 0;
    for(const t of tests){
      try{
        const r = await t.fn();
        if(typeof r === "object" && r !== null) results.push({name:t.name, ok:!!r.ok, message:r.message||""});
        else results.push({name:t.name, ok:!!r, message:""});
      }catch(e){
        results.push({name:t.name, ok:false, message:e.message||String(e)});
      }
    }
    render();
  }

  function render(){
    let panel = document.getElementById("kp-test-panel");
    if(!panel){
      panel = document.createElement("aside");
      panel.id = "kp-test-panel";
      panel.innerHTML = `
        <div class="kp-test-head"><strong>Küchenpilot-Test</strong><button id="kp-test-close">×</button></div>
        <div id="kp-test-summary"></div>
        <div id="kp-test-results"></div>
        <button id="kp-test-rerun">Tests erneut ausführen</button>`;
      document.body.appendChild(panel);
      panel.querySelector("#kp-test-close").onclick=()=>panel.hidden=true;
      panel.querySelector("#kp-test-rerun").onclick=run;
    }

    const ok = results.filter(r=>r.ok).length;
    panel.querySelector("#kp-test-summary").textContent = `${ok} bestanden · ${results.length-ok} Fehler`;
    panel.querySelector("#kp-test-results").innerHTML = results.map(r=>`
      <div class="kp-test-row ${r.ok?"is-ok":"is-fail"}">
        <span class="kp-test-icon">${r.ok?"✓":"✕"}</span>
        <div><div class="kp-test-name">${esc(r.name)}</div>${r.message?`<div class="kp-test-message">${esc(r.message)}</div>`:""}</div>
      </div>`).join("");
  }

  function add(name, fn){ tests.push({name, fn}); }

  if(enabled){
    add("Seitentitel vorhanden",()=>({ok:!!document.title.trim(),message:document.title||"Kein Titel"}));
    add("Schrift geladen",async()=>{await document.fonts.ready; const ok=document.fonts.check('16px "Architects Daughter"'); return {ok,message:ok?"Architects Daughter verfügbar":"Schrift nicht geladen"}});
    add("Bilder geladen",()=>{const bad=[...document.images].filter(i=>!i.complete||!i.naturalWidth); return {ok:!bad.length,message:bad.length?bad.map(i=>i.src).join(", "):`${document.images.length} Bild(er) geprüft`}});
    add("Keine doppelten IDs",()=>{const ids=[...document.querySelectorAll("[id]")].map(x=>x.id); const d=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))]; return {ok:!d.length,message:d.length?`Doppelt: ${d.join(", ")}`:"Alle IDs eindeutig"}});
    add("Buttons beschriftet",()=>{const bad=[...document.querySelectorAll("button")].filter(b=>!b.textContent.trim()&&!b.getAttribute("aria-label")); return {ok:!bad.length,message:bad.length?`${bad.length} ohne Beschriftung`:`${document.querySelectorAll("button").length} Button(s) geprüft`}});
    add("Zurück-Ziel vorhanden",()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Zurück")); return {ok:!!b,message:b?"Zurück-Button gefunden":"Kein Zurück-Button"}});
    add("Weiter-Ziel vorhanden",()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Weiter")); return {ok:!!b,message:b?"Weiter-Button gefunden":"Kein Weiter-Button"}});
    window.addEventListener("load",()=>setTimeout(run,100));
  }

  window.KPTest={add,run,get enabled(){return enabled;}};
})();