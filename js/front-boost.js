/* ============================================================
   SuperSim · Contador de atividade ao vivo
   Auto-injeta estilo e widget de presença.
   <script src="js/front-boost.js" defer></script>
   ============================================================ */
(function () {
  if (window.__cfBoost) return; window.__cfBoost = true;

  function rint(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  var css = ''
    + '.cfb-live{position:fixed;left:14px;bottom:16px;z-index:98000;background:rgba(30,25,20,.9);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#f7f1e6;font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;font-size:11.5px;font-weight:600;padding:8px 14px;border-radius:100px;display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.08);box-shadow:0 10px 24px -10px rgba(37,31,24,.55);opacity:0;transition:opacity .45s}'
    + '.cfb-live.cfb-show{opacity:1}'
    + '.cfb-live i{width:7px;height:7px;border-radius:50%;background:#3ddc84;box-shadow:0 0 0 0 rgba(61,220,132,.7);animation:cfbPulse 1.6s infinite}'
    + '@keyframes cfbPulse{0%{box-shadow:0 0 0 0 rgba(61,220,132,.6)}70%{box-shadow:0 0 0 7px rgba(61,220,132,0)}100%{box-shadow:0 0 0 0 rgba(61,220,132,0)}}'
    + '@media (prefers-reduced-motion:reduce){.cfb-live{transition:opacity .3s}}';

  function inject() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    /* contador "ao vivo" no canto inferior */
    var live = document.createElement('div'); live.className = 'cfb-live';
    var base = rint(180, 320);
    live.innerHTML = '<i></i> <span>' + base + ' pessoas analisando agora</span>';
    document.body.appendChild(live);

    /* guarda: não deixar o contador tampar selos de confiança / rodapé */
    var guardCount = 0;
    var guards = document.querySelectorAll('.ra-seal, .site-footer, footer');
    if ('IntersectionObserver' in window && guards.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { guardCount += e.isIntersecting ? 1 : -1; });
        if (guardCount < 0) guardCount = 0;
        if (guardCount > 0) live.classList.remove('cfb-show');
        else live.classList.add('cfb-show');
      }, { threshold: 0.1 });
      guards.forEach(function (g) { io.observe(g); });
    }

    setTimeout(function(){ if (guardCount === 0) live.classList.add('cfb-show'); }, 900);
    setInterval(function(){
      base += rint(-3, 5); if (base < 120) base = 120 + rint(0,30);
      live.querySelector('span').textContent = base + ' pessoas analisando agora';
    }, 4000);
  }

  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
