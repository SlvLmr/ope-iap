/* ============================================================
   OPÉ IAP — Suivi (direction, ADV)
   ============================================================ */
const S = { moi: null, data: null, codes: [], fAtc: '', fEtat: '', fQ: '' };
const $ = s => document.querySelector(s);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const heure = ts => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const NOM_ETAPE = Object.fromEntries(ETAPES.map(e => [e.k, e.nom]));

async function demarrer(code) {
    $('#loginErr').textContent = '';
    try {
        S.moi = await API.connexion(code);
        if (S.moi.role === 'atc') { location.href = 'atc.html'; return; }
        $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
        $('#qui').textContent = '· ' + S.moi.nom;
        $('#tabCodes').classList.toggle('hidden', S.moi.role !== 'direction');
        compteARebours($('#cd'));
        await charger();
        setInterval(() => { if (!document.hidden) charger(true); }, 60000);
    } catch (e) {
        API.deconnexion(); $('#login').classList.remove('hidden'); $('#app').classList.add('hidden');
        if (code) $('#loginErr').textContent = e.message;
    }
}
$('#loginForm').onsubmit = e => { e.preventDefault(); demarrer($('#code').value); };
$('#logout').onclick = () => { API.deconnexion(); location.reload(); };
$('#refresh').onclick = () => charger();
if (API.code) demarrer(API.code); else $('#code').focus();

async function charger(silencieux) {
    try {
        S.data = await API.tableau();
        if (S.moi.role === 'direction') S.codes = await API.codes();
        rendre();
        $('#maj').textContent = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · actualisation automatique chaque minute`;
    } catch (e) { if (!silencieux) toast(e.message, true); }
}

document.querySelectorAll('#vues .tab').forEach(b => b.onclick = () => vue(b.dataset.v));
function vue(v) {
    document.querySelectorAll('#vues .tab').forEach(x => x.classList.toggle('on', x.dataset.v === v));
    ['board', 'detail', 'codes'].forEach(k => $('#v' + k[0].toUpperCase() + k.slice(1)).classList.toggle('hidden', k !== v));
}

function rendre() { rendreBoard(); rendreDetail(); if (S.moi.role === 'direction') rendreCodes(); }

// ─── Tableau de bord ───
function stats(list) {
    const c = k => list.filter(i => i.suivi?.[k]).length;
    const ca = list.reduce((t, i) => t + (+i.suivi?.montant || 0), 0);
    const unites = list.reduce((t, i) => t + Object.values(i.suivi?.quantites || {}).reduce((a, b) => a + b, 0), 0);
    return { n: list.length, appel: c('appel'), mail: c('mail'), presentation: c('presentation'), commande: c('commande'), ca, unites };
}
const reste = a => a.objectif == null ? null : +a.objectif - (+a.ca_actuel || 0);
function rendreBoard() {
    const iap = S.data.iap, t = stats(iap);
    const avecObj = S.data.atc.filter(a => reste(a) > 0);
    const resteTotal = avecObj.reduce((s, a) => s + reste(a), 0);
    const resteApres = avecObj.reduce((s, a) => s + Math.max(0, reste(a) - stats(iap.filter(i => i.atc === a.nom)).ca), 0);
    $('#kpis').innerHTML = [
        ['CA opération', euro(t.ca, 0), 'HT, prix promo'],
        ['Commandes', t.commande, `${pct(t.commande, t.appel)} % des IAP appelés`],
        ['Serrures vendues', t.unites, t.commande ? `${(t.unites / t.commande).toFixed(1).replace('.', ',')} par commande` : '—'],
        ['Panier moyen', t.commande ? euro(t.ca / t.commande, 0) : '—', 'HT par commande'],
        ['IAP appelés', `${t.appel} / ${t.n}`, `${pct(t.appel, t.n)} % du réseau`, pct(t.appel, t.n)],
        ...(resteTotal > 0 ? [['Reste à faire ATC', euro(resteApres, 0), `objectifs annuels · l’opé en couvre ${pct(resteTotal - resteApres, resteTotal)} %`, pct(resteTotal - resteApres, resteTotal)]] : []),
    ].map(([l, v, s, p]) => `<div class="card kpi"><div class="l">${l}</div><div class="v num">${v}</div><div class="s">${s}</div>${p == null ? '' : `<div class="bar"><i style="width:${p}%"></i></div>`}</div>`).join('');

    $('#funnel').innerHTML = [['IAP', t.n], ...ETAPES.map(e => [e.nom, t[e.k]])].map(([l, v]) =>
        `<div class="f"><span>${l}</span><div class="t"><i style="width:${pct(v, t.n)}%">${pct(v, t.n) >= 8 ? pct(v, t.n) + ' %' : ''}</i></div><span class="v">${v}</span></div>`).join('');

    const parRef = REFS.map(r => { const u = iap.reduce((a, i) => a + (+i.suivi?.quantites?.[r.id] || 0), 0); return { r, u, ca: u * r.promo }; });
    $('#refs').innerHTML = `<thead><tr><th>Référence</th><th class="r">Qté</th><th class="r">CA HT</th></tr></thead><tbody>` +
        parRef.map(x => `<tr><td><b>${esc(x.r.nom)}</b> <span class="muted">${esc(x.r.cyl)}</span></td><td class="r num">${x.u}</td><td class="r num">${euro(x.ca, 0)}</td></tr>`).join('') +
        `<tr><td><b>Total</b></td><td class="r num"><b>${t.unites}</b></td><td class="r num"><b>${euro(t.ca, 0)}</b></td></tr></tbody>`;

    const atcs = S.data.atc.map(a => ({ ...a, ...stats(iap.filter(i => i.atc === a.nom)) })).sort((a, b) => b.ca - a.ca || b.commande - a.commande || b.appel / (b.n || 1) - a.appel / (a.n || 1));
    $('#atcs').innerHTML = `<thead><tr><th></th><th>ATC</th><th class="r">IAP</th><th>Appelés</th><th class="r">Mails</th><th class="r">Présent.</th><th class="r">Cdes</th><th class="r">CA opé HT</th>
        <th class="r">CA actuel</th><th class="r">Objectif</th><th class="r">Reste à faire</th><th>Atteinte (avec opé)</th><th>Connexion</th></tr></thead><tbody>` +
        atcs.map((a, k) => {
            const r = reste(a), apres = r == null ? null : r - a.ca, att = a.objectif ? Math.round(((+a.ca_actuel || 0) + a.ca) / a.objectif * 100) : null;
            return `<tr class="click" data-atc="${esc(a.nom)}"><td><span class="rk ${k < 3 && a.ca > 0 ? 'g' : ''}">${k + 1}</span></td><td><b>${esc(a.nom)}</b>${a.prenom ? `<div class="muted" style="font-size:12px">${esc(a.prenom)}</div>` : ''}</td><td class="r num">${a.n}</td>
        <td><div class="mini"><div class="t"><i style="width:${pct(a.appel, a.n)}%"></i></div><span>${pct(a.appel, a.n)} %</span></div></td>
        <td class="r num">${a.mail}</td><td class="r num">${a.presentation}</td><td class="r num"><b>${a.commande}</b></td><td class="r num"><b>${euro(a.ca, 0)}</b></td>
        <td class="r num">${a.ca_actuel == null ? '—' : euro(a.ca_actuel, 0)}</td><td class="r num">${a.objectif == null ? '—' : euro(a.objectif, 0)}</td>
        <td class="r num">${apres == null ? '—' : apres <= 0 ? `<span class="neg">atteint (+${euro(-apres, 0)})</span>` : `<b>${euro(apres, 0)}</b>`}</td>
        <td>${att == null ? '<span class="muted">—</span>' : `<div class="mini"><div class="t"><i style="width:${Math.min(100, att)}%"></i></div><span>${att} %</span></div>`}</td>
        <td class="muted" style="font-size:12px">${a.derniere_connexion ? heure(a.derniere_connexion) : '<span class="chip warn">jamais</span>'}</td></tr>`; }).join('') + '</tbody>';
    document.querySelectorAll('#atcs tr[data-atc]').forEach(tr => tr.onclick = () => { S.fAtc = tr.dataset.atc; $('#fAtc').value = S.fAtc; rendreDetail(); vue('detail'); });

    $('#journal').innerHTML = S.data.journal.length ? S.data.journal.map(j => {
        let txt = '';
        if (j.action === 'maj') {
            const d = j.detail || {};
            const parts = Object.entries(d).map(([k, v]) => k === 'quantites' ? `commande ${euro(montantDe(v), 0)}` : NOM_ETAPE[k] ? `${NOM_ETAPE[k]} ${v ? '✓' : '✗'}` : k === 'commentaire' ? 'note' : k === 'rappel' ? 'rappel prévu' : k === 'date_contact' ? 'date de contact' : k);
            txt = `<b>${esc(j.par)}</b> · ${esc(j.raison || '')} : ${esc(parts.join(', '))}`;
        } else if (j.action === 'import') txt = `<b>${esc(j.par)}</b> a importé le listing (${j.detail?.lignes} IAP)`;
        else if (j.action === 'objectif') txt = `<b>${esc(j.par)}</b> a mis à jour l’objectif de ${esc(j.detail?.nom || '')}`;
        else txt = `<b>${esc(j.par)}</b> · code ${esc(j.detail?.nom || '')} : ${esc(j.detail?.action || '')}`;
        return `<div><time>${heure(j.at)}</time><span>${txt}</span></div>`;
    }).join('') : '<div class="muted">Aucune activité pour le moment.</div>';
}

// ─── Détail ───
function filtrees() {
    return S.data.iap.filter(i => (!S.fAtc || i.atc === S.fAtc)
        && (!S.fEtat || (S.fEtat === 'zero' ? !i.suivi?.appel : !!i.suivi?.[S.fEtat]))
        && (!S.fQ || [i.raison, i.ville, i.cp, i.atc, i.contact_nom, i.numero].join(' ').toLowerCase().includes(S.fQ)));
}
function rendreDetail() {
    const atcs = [...new Set(S.data.iap.map(i => i.atc))].sort();
    $('#fAtc').innerHTML = `<option value="">Tous les ATC</option>` + atcs.map(a => `<option ${a === S.fAtc ? 'selected' : ''}>${esc(a)}</option>`).join('');
    const rows = filtrees();
    $('#detail').innerHTML = `<thead><tr><th>IAP</th><th>ATC</th><th>Statut</th><th>Ville</th><th>Contact le</th><th>Étapes</th><th class="r">Montant HT</th><th>Note</th></tr></thead><tbody>` +
        (rows.length ? rows.map(i => { const s = i.suivi || {}; return `<tr><td><b>${esc(i.raison)}</b><div class="muted" style="font-size:12px">${esc(i.numero || '')}</div></td><td>${esc(i.atc)}</td>
        <td>${i.statut ? `<span class="chip ${i.statut.toLowerCase()}">${esc(i.statut)}</span>` : ''}</td><td>${esc(i.ville || '')}</td>
        <td class="num">${s.date_contact ? new Date(s.date_contact + 'T12:00').toLocaleDateString('fr-FR') : '—'}</td>
        <td><div class="dots">${ETAPES.map(e => `<i class="${s[e.k] ? 'on' : ''} ${e.k === 'commande' ? 'c' : ''}" title="${e.nom}${s[e.k] ? ' : ' + heure(s[e.k]) : ''}">✓</i>`).join('')}</div></td>
        <td class="r num">${s.montant > 0 ? `<b>${euro(s.montant, 0)}</b>` : '—'}</td><td style="max-width:260px;font-size:12px;color:var(--text-2)">${esc(s.commentaire || '')}</td></tr>`; }).join('')
        : `<tr><td colspan="8" class="muted" style="text-align:center;padding:30px">Aucun IAP.</td></tr>`) + '</tbody>';
}
$('#fAtc').onchange = e => { S.fAtc = e.target.value; rendreDetail(); };
$('#fEtat').onchange = e => { S.fEtat = e.target.value; rendreDetail(); };
$('#fQ').oninput = e => { S.fQ = e.target.value.trim().toLowerCase(); rendreDetail(); };

// ─── Exports Excel ───
const dt = ts => ts ? new Date(ts).toLocaleString('fr-FR') : '';
function exporter(lignes, nom) {
    if (!window.XLSX) { toast('Export indisponible (bibliothèque non chargée).', true); return; }
    const ws = XLSX.utils.json_to_sheet(lignes); const wb = XLSX.utils.book_new();
    ws['!cols'] = Object.keys(lignes[0] || {}).map(k => ({ wch: Math.max(10, Math.min(40, k.length + 4)) }));
    XLSX.utils.book_append_sheet(wb, ws, nom.slice(0, 30)); XLSX.writeFile(wb, `${nom}.xlsx`);
}
$('#xCmd').onclick = () => {
    const rows = S.data.iap.filter(i => i.suivi?.commande).map(i => ({
        'Date commande': dt(i.suivi.commande), ATC: i.atc, 'N° client': i.numero, IAP: i.raison, Contact: [i.contact_prenom, i.contact_nom].filter(Boolean).join(' '),
        Mail: i.mail, Téléphone: i.portable, Adresse: i.adresse, CP: i.cp, Ville: i.ville,
        ...Object.fromEntries(REFS.map(r => [`${r.nom} ${r.cyl}`, i.suivi.quantites?.[r.id] || 0])), 'Montant HT': +i.suivi.montant, Commentaire: i.suivi.commentaire || '' }));
    if (!rows.length) { toast('Aucune commande pour le moment.'); return; }
    exporter(rows, `Commandes opé IAP ${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`);
};
$('#xAll').onclick = () => exporter(filtrees().map(i => ({ ATC: i.atc, 'N° client': i.numero, IAP: i.raison, Statut: i.statut, Contact: [i.contact_prenom, i.contact_nom].filter(Boolean).join(' '),
    Mail: i.mail, Téléphone: i.portable, CP: i.cp, Ville: i.ville, 'Date contact': i.suivi?.date_contact || '', Appel: dt(i.suivi?.appel), Mail_envoyé: dt(i.suivi?.mail),
    Présentation: dt(i.suivi?.presentation), Commande: dt(i.suivi?.commande), 'Montant HT': +(i.suivi?.montant || 0), 'À rappeler le': i.suivi?.rappel || '', Commentaire: i.suivi?.commentaire || '' })),
    `Suivi opé IAP ${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`);

// ─── Codes (direction) ───
const lienAtc = c => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}atc.html#code=${c}`;
function rendreObjectifs() {
    const atcs = S.codes.filter(c => c.role === 'atc');
    const n0 = v => v == null ? '' : Math.round(v);
    $('#objectifs').innerHTML = `<thead><tr><th>ATC</th><th>Prénom</th><th class="r">CA actuel (€)</th><th class="r">Objectif (€)</th><th class="r">Reste à faire</th><th>Mis à jour</th></tr></thead><tbody>` +
        atcs.map(c => { const r = c.objectif == null ? null : c.objectif - (c.ca_actuel || 0); return `<tr data-nom="${esc(c.nom)}"><td><b>${esc(c.nom)}</b></td>
        <td><input class="p" data-f="prenom" value="${esc(c.prenom || '')}"></td>
        <td class="r"><input data-f="ca" inputmode="decimal" value="${n0(c.ca_actuel)}"></td><td class="r"><input data-f="obj" inputmode="decimal" value="${n0(c.objectif)}"></td>
        <td class="r num">${r == null ? '—' : r <= 0 ? `<span class="neg">dépassé de ${euro(-r, 0)}</span>` : `<b>${euro(r, 0)}</b>`}</td>
        <td class="muted" style="font-size:12px">${c.ca_maj ? heure(c.ca_maj) : '—'}</td></tr>`; }).join('') + '</tbody>';
}
$('#objectifs').addEventListener('change', async e => {
    const tr = e.target.closest('tr[data-nom]'); if (!tr) return;
    const v = f => tr.querySelector(`[data-f="${f}"]`).value.trim();
    const num = x => { const n = parseFloat(x.replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
    try { S.codes = await API.objectifMaj(tr.dataset.nom, v('prenom'), num(v('ca')), num(v('obj'))); rendreObjectifs(); toast('Objectif enregistré'); charger(true); }
    catch (err) { toast(err.message, true); }
});

function rendreCodes() {
    rendreObjectifs();
    const ROLE = { atc: 'ATC', adv: 'ADV', direction: 'Direction' };
    $('#codes').innerHTML = `<thead><tr><th>Nom</th><th>Rôle</th><th>Code</th><th>Dernière connexion</th><th></th></tr></thead><tbody>` +
        S.codes.map(c => `<tr style="${c.actif ? '' : 'opacity:.5'}"><td><b>${esc(c.nom)}</b></td><td>${ROLE[c.role]}</td><td><span class="code">${esc(c.code)}</span></td>
        <td class="muted" style="font-size:12px">${c.derniere_connexion ? heure(c.derniere_connexion) : 'jamais'}</td>
        <td class="r" style="white-space:nowrap">${c.role === 'atc' ? `<button class="btn sm" data-copy="${esc(c.code)}">Copier le lien</button>` : ''}
        ${c.nom === S.moi.nom && c.role === S.moi.role ? '' : `<button class="btn sm" data-act="regenerer" data-nom="${esc(c.nom)}" data-role="${c.role}">Régénérer</button>
        <button class="btn sm" data-act="${c.actif ? 'desactiver' : 'activer'}" data-nom="${esc(c.nom)}" data-role="${c.role}">${c.actif ? 'Désactiver' : 'Activer'}</button>`}</td></tr>`).join('') + '</tbody>';
}
$('#codes').addEventListener('click', async e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { await navigator.clipboard.writeText(lienAtc(cp.dataset.copy)); toast('Lien copié : il connecte directement l’ATC.'); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'regenerer' && !confirm(`Régénérer le code de ${b.dataset.nom} ? L’ancien code ne fonctionnera plus.`)) return;
    try { S.codes = await API.codeMaj(b.dataset.nom, b.dataset.role, b.dataset.act); rendreCodes(); toast('Code mis à jour'); } catch (err) { toast(err.message, true); }
});
$('#copyAll').onclick = async () => {
    const txt = S.codes.filter(c => c.role === 'atc' && c.actif).map(c => `${c.nom} : code ${c.code} · ${lienAtc(c.code)}`).join('\n');
    await navigator.clipboard.writeText(txt); toast('Liens de tous les ATC copiés');
};
$('#addCode').onsubmit = async e => {
    e.preventDefault();
    try { S.codes = await API.codeMaj($('#newNom').value.trim(), $('#newRole').value, 'creer'); $('#newNom').value = ''; rendreCodes(); toast('Code créé'); } catch (err) { toast(err.message, true); }
};

// ─── Import du listing ───
const drop = $('#drop');
drop.ondragover = e => { e.preventDefault(); drop.style.borderColor = 'var(--accent)'; };
drop.ondragleave = () => drop.style.borderColor = '';
drop.ondrop = e => { e.preventDefault(); drop.style.borderColor = ''; if (e.dataTransfer.files[0]) importer(e.dataTransfer.files[0]); };
$('#file').onchange = e => e.target.files[0] && importer(e.target.files[0]);
async function importer(f) {
    try {
        const wb = XLSX.read(await f.arrayBuffer());
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }).slice(1).filter(r => r.some(Boolean));
        const t = v => String(v ?? '').replace(/\s+/g, ' ').trim();
        const cap = v => t(v).toLowerCase().replace(/(^|[\s-])\S/g, m => m.toUpperCase());
        const data = rows.map(r => {
            const cp = t(r[9]); const tel = t(r[7]).replace(/\D/g, '');
            return { atc: cap(r[0]), numero: t(r[1]), raison: t(r[2]), statut: t(r[3]).toUpperCase(), contact_nom: t(r[4]).toUpperCase(), contact_prenom: cap(r[5]),
                mail: t(r[6]).split(/[;/,\s]+/).filter(m => m.includes('@')).join('; ').toLowerCase(), portable: tel.length === 10 ? tel.replace(/(\d\d)(?=\d)/g, '$1 ') : t(r[7]),
                adresse: t(r[8]), cp: /^\d{4}$/.test(cp) ? '0' + cp : cp, ville: t(r[10]).toUpperCase() };
        }).filter(r => r.atc && r.numero && r.raison);
        if (!data.length) throw new Error('Aucune ligne reconnue dans le fichier.');
        if (!confirm(`${data.length} IAP trouvés. Remplacer le listing actuel ? (le suivi des IAP existants est conservé)`)) return;
        const r = await API.importer(data);
        toast(`${r.lignes} IAP importés`); charger();
    } catch (e) { toast(e.message, true); }
}
