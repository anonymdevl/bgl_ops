(function(){
	if (window.location.pathname.indexOf('/login') !== 0) return;
	var cv = document.createElement('canvas');
	cv.id = 'bgl-login-sky';
	document.body.appendChild(cv);
	var x = cv.getContext('2d'), W, H, pts = [];
	function size(){ W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
	size(); window.addEventListener('resize', size);
	// toned Betonsa red + silver/graphite on the white login page
	var COLS = ['241,7,48', '150,158,172', '110,118,132', '241,7,48', '190,196,206'];
	var N = Math.min(60, Math.round(window.innerWidth / 24));
	for (var i = 0; i < N; i++) pts.push({
		x: Math.random() * W, y: Math.random() * H,
		vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
		c: COLS[i % COLS.length], r: Math.random() * 1.7 + .7,
		ph: Math.random() * 6.283, tw: .8 + Math.random() * 1.8
	});
	(function tick(){
		x.clearRect(0, 0, W, H);
		pts.forEach(function(p){
			p.x += p.vx; p.y += p.vy;
			if (p.x < 0 || p.x > W) p.vx *= -1;
			if (p.y < 0 || p.y > H) p.vy *= -1;
			var red = p.c === '241,7,48';
			var tk = .2 + .8 * (.5 + .5 * Math.sin(performance.now() / 1000 * p.tw + p.ph));
			x.beginPath(); x.arc(p.x, p.y, p.r * (0.75 + 0.45 * tk), 0, 6.283);
			x.fillStyle = 'rgba(' + p.c + ',' + ((red ? 0.5 : 0.7) * tk).toFixed(3) + ')'; x.fill();
		});
		for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++) {
			var a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
			if (d < 120) {
				x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y);
				x.strokeStyle = 'rgba(120,128,142,' + (0.16 * (1 - d / 120)).toFixed(3) + ')';
				x.lineWidth = 1; x.stroke();
			}
		}
		requestAnimationFrame(tick);
	})();
})();
