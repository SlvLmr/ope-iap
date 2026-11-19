/* Rendu vidéo du short : node short/render.js [sortie.mp4]
   Sert le dossier du projet, calcule chaque image avec render(t) et l'encode en MP4 (H.264, 30 i/s, 1080 × 1920). */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const RACINE = path.resolve(__dirname, '..'), FPS = 30, DUREE = 20;
const sortie = path.resolve(process.argv[2] || path.join(__dirname, 'short-coup-de-boost.mp4'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const serveur = http.createServer((q, r) => {
    const f = path.join(RACINE, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
    await new Promise(r => serveur.listen(0, '127.0.0.1', r));
    const port = serveur.address().port;
    const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
    const b = await chromium.launch({ proxy });
    const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(`http://127.0.0.1:${port}/short/index.html?render`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', sortie], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = FPS * DUREE;
    for (let i = 0; i < total; i++) {
        await page.evaluate(t => window.render(t), i / FPS);
        const img = await page.screenshot({ type: 'jpeg', quality: 95 });
        if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
        if (i % 60 === 0) process.stdout.write(`${Math.round(i / total * 100)} % `);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    await b.close(); serveur.close(); console.log('\nVidéo :', sortie);
})().catch(e => { console.error(e); process.exit(1); });
