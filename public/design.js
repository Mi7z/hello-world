// Gewähltes Design sofort laden – vor dem ersten Zeichnen, damit nichts flackert.
// ?design=name in der Adresse zeigt ein Design nur zum Anschauen (wird nicht gespeichert).
(function () {
  var probe = new URLSearchParams(location.search).get('design');
  var name = (probe || localStorage.getItem('hw-design') || 'terminal').replace(/[^a-z0-9.@-]/g, '');
  document.write('<link rel="stylesheet" id="hwDesign" href="/api/design/' + name + '.css">');
  // Design mit eigener Anordnung: Startseite kurz verbergen, bis sie umgebaut ist (kein Flackern)
  if (localStorage.getItem('hw-layout-hat:' + name) === '1' && /^\/?(index\.html)?$/.test(location.pathname.replace(/^.*\//, ''))) document.documentElement.classList.add('hw-layout-laedt');
})();
