/* ============================================================
   OPÉ IAP — Espace ATC : to-do phoning
   ============================================================ */
const A = { moi: null, iap: [], filtre: 'todo', q: '', ouvert: null };
const $ = s => document.querySelector(s);
const ORDRE_STATUT = { ELITE: 0, PREMIUM: 1, OFFICIEL: 2 };
const auj = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }); // AAAA-MM-JJ
const jourCourt = ts => ts ? new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
const dateLongue = ts => new Date(ts).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fait = i => ETAPES.filter(e => i.suivi?.[e.k]).length;
const telHref = t => 'tel:' + String(t || '').replace(/[^\d+]/g, '');

// ─── Connexion ───
async function demarrer(code) {
    const err = $('#loginErr'); err.textContent = '';
    try {
        A.moi = await API.connexion(code);
        if (A.moi.role !== 'atc') { location.href = 'suivi.html'; return; }
        $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
        $('#qui').textContent = '· ' + A.moi.nom;
        $('#bonjour').textContent = `Bonjour ${A.moi.prenom || A.moi.nom} 👋`;
        compteARebours($('#cd'));
        await charger();
    } catch (e) {
        API.deconnexion(); $('#login').classList.remove('hidden'); $('#app').classList.add('hidden');
        if (code) err.textContent = e.message;
    }
}
$('#loginForm').onsubmit = e => { e.preventDefault(); demarrer($('#code').value); };
$('#logout').onclick = () => { API.deconnexion(); location.hash = ''; location.reload(); };
// Lien direct avec le code : atc.html#code=XXXX-XXXX (le code reste dans le navigateur)
const codeLien = new URLSearchParams(location.hash.slice(1)).get('code');
if (codeLien) history.replaceState(null, '', location.pathname);
if (codeLien || API.code) demarrer(codeLien || API.code); else $('#code').focus();

async function charger() {
    try { A.iap = await API.mesIap(); rendre(); }
    catch (e) { toast(e.message, true); }
}

// ─── Vues ───
document.querySelectorAll('#vues .tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('#vues .tab').forEach(x => x.classList.toggle('on', x === b));
    $('#vTodo').classList.toggle('hidden', b.dataset.v !== 'todo');
    $('#vKit').classList.toggle('hidden', b.dataset.v !== 'kit');
    $('#vArgs').classList.toggle('hidden', b.dataset.v !== 'args');
});
const signature = () => [A.moi?.prenom, A.moi?.nom].filter(Boolean).join(' ');

// ─── Kit : mail type & bon de commande vierge ───
function rendreKit() {
    $('#kObjet').textContent = mailObjet();
    $('#kApercu').innerHTML = mailHtml(MAIL_MODELE_IAP, signature());
    $('#kBon').href = 'bon.html#' + encodeURIComponent(JSON.stringify({ atc: signature() }));
    $('#kPost').textContent = POST_RS;
}
$('#kCop').onclick = async () => toast((await copierMail(MAIL_MODELE_IAP, signature())) === 'html' ? 'Mail copié : colle-le dans Outlook ✓' : 'Mail copié (texte) ✓');
$('#kCopTxt').onclick = async () => { await copierMail(MAIL_MODELE_IAP, signature(), true); toast('Texte copié ✓'); };
$('#kPostCop').onclick = async () => { await navigator.clipboard.writeText(POST_RS); toast('Post copié ✓ à coller sur la page de l’IAP'); };
$('#kCopObj').onclick = async () => { await navigator.clipboard.writeText(mailObjet()); toast('Objet copié ✓'); };
$('#q').oninput = e => { A.q = e.target.value.trim().toLowerCase(); rendreListe(); };

const FILTRES = [
    { k: 'todo', nom: 'À traiter', f: i => !i.suivi?.commande },
    { k: 'jour', nom: 'À rappeler', f: i => i.suivi?.rappel && i.suivi.rappel <= auj() && !i.suivi?.commande },
    { k: 'zero', nom: 'Pas encore appelés', f: i => !i.suivi?.appel },
    { k: 'cmd', nom: 'Commandés', f: i => !!i.suivi?.commande },
    { k: 'tous', nom: 'Tous', f: () => true },
];

function rendre() { rendreKpis(); rendreFiltres(); rendreListe(); rendreArgs(); rendreKit(); }

// Objectif annuel : CA actuel, objectif, reste à faire, et ce que l'opération y apporte
function rendreObjectif(caOpe) {
    const el = $('#objectif'), ca = +A.moi.ca_actuel, obj = +A.moi.objectif;
    if (!A.moi.objectif || !obj) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const reste = obj - ca, apres = reste - caOpe, max = Math.max(obj, ca + caOpe);
    const w = v => Math.max(0, v / max * 100).toFixed(2) + '%';
    const p3 = REFS.find(r => r.id === 'p3-ent-vigie');
    let msg;
    if (reste <= 0) msg = `Objectif déjà dépassé de <b>${euro(-reste, 0)}</b> 🎉 Chaque commande de l’opération est du bonus${caOpe ? ` : déjà <b>+${euro(caOpe, 0)}</b>` : ''}.`;
    else if (apres <= 0) msg = `Avec l’opération, ton objectif est <b>atteint</b> 🎉 (+${euro(-apres, 0)}).`;
    else if (caOpe) msg = `L’opération couvre déjà <b>${Math.round(caOpe / reste * 100)} %</b> de ton reste à faire. Encore <b>${euro(apres, 0)}</b>, soit l’équivalent de ${Math.ceil(apres / p3.promo)} Présence 3.`;
    else msg = `L’opération est l’occasion de le réduire : <b>${euro(reste, 0)}</b>, c’est l’équivalent de ${Math.ceil(reste / p3.promo)} Présence 3 au prix opé.`;
    el.innerHTML = `<div>
        <div class="l">Mon objectif annuel</div>
        <div class="big num">${reste > 0 ? `${euro(Math.max(0, apres), 0)}` : 'Atteint ✓'}</div>
        <div class="sub">${reste > 0 ? 'reste à faire' + (caOpe ? ' après tes commandes de l’opé' : '') : `dépassé de ${euro(-reste, 0)}`} · CA actuel <b class="num">${euro(ca, 0)}</b> · objectif <b class="num">${euro(obj, 0)}</b></div>
    </div><div>
        <div class="track"><span class="a" style="width:${w(ca)}"></span><span class="o" style="width:${w(caOpe)}"></span></div>
        <div class="leg"><span><i style="background:rgba(255,255,255,.55)"></i>CA actuel ${Math.round(ca / obj * 100)} %</span><span><i style="background:var(--accent)"></i>Opération +${euro(caOpe, 0)}</span><span>Objectif ${euro(obj, 0)}</span></div>
        <div class="msg">${msg}</div>
    </div>`;
}

function rendreKpis() {
    const n = A.iap.length, c = k => A.iap.filter(i => i.suivi?.[k]).length;
    const ca = A.iap.reduce((t, i) => t + (+i.suivi?.montant || 0), 0);
    const pct = (v) => n ? Math.round(v / n * 100) : 0;
    rendreObjectif(ca);
    $('#sous').textContent = `${n} IAP dans ton portefeuille · ${OPE.finTexte}`;
    $('#kpis').innerHTML = [
        ['Appelés', c('appel'), `sur ${n} IAP`, pct(c('appel'))],
        ['Mails envoyés', c('mail'), `${pct(c('mail'))} % des IAP`, pct(c('mail'))],
        ['Présentations', c('presentation'), `${pct(c('presentation'))} % des IAP`, pct(c('presentation'))],
        ['Commandes', c('commande'), c('appel') ? `${Math.round(c('commande') / c('appel') * 100)} % des appelés` : '—', pct(c('commande'))],
        ['CA opération', euro(ca, 0), 'HT, prix promo', null],
    ].map(([l, v, s, p]) => `<div class="card kpi"><div class="l">${l}</div><div class="v num">${v}</div><div class="s">${s}</div>${p == null ? '' : `<div class="bar"><i style="width:${p}%"></i></div>`}</div>`).join('');
}

function rendreFiltres() {
    $('#filtres').innerHTML = FILTRES.map(f => `<button class="tab ${A.filtre === f.k ? 'on' : ''}" data-f="${f.k}">${f.nom} <b>${A.iap.filter(f.f).length}</b></button>`).join('');
    document.querySelectorAll('#filtres .tab').forEach(b => b.onclick = () => { A.filtre = b.dataset.f; rendreFiltres(); rendreListe(); });
}

function trier(a, b) {
    const ra = a.suivi?.rappel && a.suivi.rappel <= auj() ? 0 : 1, rb = b.suivi?.rappel && b.suivi.rappel <= auj() ? 0 : 1;
    return ra - rb || (ORDRE_STATUT[a.statut] ?? 3) - (ORDRE_STATUT[b.statut] ?? 3) || fait(a) - fait(b) || a.raison.localeCompare(b.raison);
}

function ligne(i) {
    const s = i.suivi || {};
    const steps = ETAPES.map(e => `<button class="stp ${e.k === 'commande' ? 'cmd' : ''} ${s[e.k] ? 'on' : ''}" data-step="${e.k}" title="${s[e.k] ? e.nom + ' le ' + dateLongue(s[e.k]) : 'Cocher : ' + e.nom}">
        <span class="i">${e.icone}</span><span class="n">${e.nom === 'Présentation' ? 'Présent.' : e.nom}</span><span class="d">${jourCourt(s[e.k])}</span></button>`).join('');
    const rappel = s.rappel && !s.commande ? `<span class="${s.rappel <= auj() ? 'rappel' : ''}">⏰ ${new Date(s.rappel + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>` : '';
    return `<div class="card iap ${s.commande ? 'done' : ''}" data-id="${i.id}">
        <div class="who">
            <div class="r">${esc(i.raison)} ${i.statut ? `<span class="chip ${i.statut.toLowerCase()}">${esc(i.statut)}</span>` : ''}</div>
            <div class="c">
                <span>${esc([i.contact_prenom, i.contact_nom].filter(Boolean).join(' ')) || '—'} · ${esc(i.ville || '')}</span>
                ${i.portable ? `<a href="${telHref(i.portable)}">📞 ${esc(i.portable)}</a>` : '<span class="chip warn">sans téléphone</span>'}
                ${i.mail ? '' : '<span class="chip warn">sans mail</span>'}
                ${rappel}
            </div>
        </div>
        <div class="when"><label>Date contact</label><input type="date" class="input" data-date value="${s.date_contact || ''}"></div>
        <div class="steps">${steps}</div>
        <div class="mt"><div class="v num">${s.montant > 0 ? euro(s.montant, 0) : '—'}</div><div class="s">${s.montant > 0 ? 'commande HT' : (s.commentaire ? '💬 note' : '')}</div></div>
        <button class="more" data-open title="Fiche, mail, bon de commande">›</button>
    </div>`;
}

function rendreListe() {
    const f = FILTRES.find(x => x.k === A.filtre).f;
    const rows = A.iap.filter(f).filter(i => !A.q || [i.raison, i.ville, i.cp, i.contact_nom, i.contact_prenom, i.numero].join(' ').toLowerCase().includes(A.q)).sort(trier);
    $('#list').innerHTML = rows.length ? rows.map(ligne).join('') : `<div class="card empty">${A.filtre === 'jour' ? 'Aucun rappel prévu aujourd’hui.' : 'Rien ici pour le moment.'}</div>`;
}

// ─── Mises à jour ───
async function maj(id, data, silencieux) {
    const i = A.iap.find(x => x.id === id);
    try {
        const r = await API.maj(id, data);
        Object.assign(i, r);
        rendreKpis(); rendreFiltres();
        const el = document.querySelector(`.iap[data-id="${id}"]`); if (el) el.outerHTML = ligne(i);
        if (A.ouvert === id) rendreFiche(i, true);
        if (!silencieux) toast('Enregistré ✓');
        return i;
    } catch (e) { toast(e.message, true); rendreListe(); }
}

$('#list').addEventListener('click', e => {
    const card = e.target.closest('.iap'); if (!card) return;
    const id = +card.dataset.id, i = A.iap.find(x => x.id === id);
    const st = e.target.closest('[data-step]');
    if (st) {
        const k = st.dataset.step;
        if (k === 'commande' && !i.suivi?.commande) { ouvrir(id, true); return; } // la commande se saisit avec les quantités
        st.classList.toggle('on'); maj(id, { [k]: !i.suivi?.[k] });
    } else if (e.target.closest('[data-open]')) ouvrir(id);
});
$('#list').addEventListener('change', e => {
    if (e.target.matches('[data-date]')) maj(+e.target.closest('.iap').dataset.id, { date_contact: e.target.value });
});

// ─── Fiche IAP ───
function ouvrir(id, focusCommande) {
    A.ouvert = id; $('#modal').classList.remove('hidden'); document.body.style.overflow = 'hidden';
    rendreFiche(A.iap.find(x => x.id === id));
    if (focusCommande) setTimeout(() => $('#sheet input[data-q]')?.focus(), 50);
}
function fermer() { A.ouvert = null; $('#modal').classList.add('hidden'); document.body.style.overflow = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) fermer(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && A.ouvert) fermer(); });

function rendreFiche(i, garderSaisie) {
    const s = i.suivi || {}, q = s.quantites || {};
    if (garderSaisie && $('#sheet .body')) { // après enregistrement : on rafraîchit seulement les étapes
        $('#fSteps').innerHTML = etapesFiche(s); return;
    }
    $('#sheet').innerHTML = `
    <header><h3>${esc(i.raison)}</h3>${i.statut ? `<span class="chip ${i.statut.toLowerCase()}">${esc(i.statut)}</span>` : ''}<button class="btn sm ghost" data-close>✕</button></header>
    <div class="body" style="display:grid;gap:14px">
        <div class="grid2">
            <div class="bloc"><h4>Coordonnées</h4><div class="coord">
                <div><b>${esc([i.contact_prenom, i.contact_nom].filter(Boolean).join(' ')) || '—'}</b></div>
                ${i.portable ? `<div>📞 <a href="${telHref(i.portable)}">${esc(i.portable)}</a></div>` : ''}
                ${i.mail ? `<div>✉️ ${i.mail.split(';').map(m => `<a href="mailto:${esc(m.trim())}">${esc(m.trim())}</a>`).join(', ')}</div>` : '<div class="chip warn">Pas d’adresse mail</div>'}
                <div class="muted">${esc(i.adresse || '')}<br>${esc(i.cp || '')} ${esc(i.ville || '')}</div>
                <div class="muted">N° client ${esc(i.numero || '—')}</div>
            </div></div>
            <div class="bloc"><h4>Étapes</h4><div class="stepsBig" id="fSteps">${etapesFiche(s)}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
                    <label style="font-size:12px;font-weight:700;color:var(--muted)">DATE CONTACT<input type="date" class="input" id="fDate" value="${s.date_contact || ''}" style="margin-top:4px;height:38px"></label>
                    <label style="font-size:12px;font-weight:700;color:var(--muted)">À RAPPELER LE<input type="date" class="input" id="fRappel" value="${s.rappel || ''}" style="margin-top:4px;height:38px"></label>
                </div>
            </div>
        </div>
        <div class="bloc"><h4>Mail « Proposition et tarification suite à notre échange téléphonique »</h4>
            <div class="actions">
                <button class="btn primary" id="fMail" ${i.mail ? '' : 'disabled'}>✉️ Ouvrir dans ma messagerie</button>
                <button class="btn" id="fCopie">Copier le mail (mise en forme)</button>
                <button class="btn" id="fBon">🧾 Bon de commande prérempli</button>
            </div>
            <p class="muted" style="font-size:12px;margin:10px 0 0">Le mail s’ouvre dans ta messagerie avec l’adresse de l’IAP, et il est aussi copié (en cas de texte coupé, colle-le). Pense à joindre le bon de commande. L’étape « Mail » est cochée automatiquement.</p>
        </div>
        <div class="bloc"><h4>Commande (prix opération HT)</h4>
            <div class="qte">
                ${REFS.map(r => `<div class="l"><div>${esc(r.nom)}<small>${esc(r.cyl)}</small></div><div class="pu num muted">${euro(r.promo)}</div>
                    <input class="input num" type="number" min="0" max="999" inputmode="numeric" data-q="${r.id}" value="${q[r.id] || ''}" placeholder="0">
                    <div class="num" style="text-align:right;font-weight:700" data-st="${r.id}">${q[r.id] ? euro(q[r.id] * r.promo) : '—'}</div></div>`).join('')}
                <div class="tot"><span>Total HT</span><span class="num" id="fTot">${euro(montantDe(q))}</span></div>
            </div>
            <div class="actions" style="margin-top:12px"><button class="btn primary" id="fCmd">✅ Enregistrer la commande</button>
                ${s.commande ? '<button class="btn" id="fCmdAnn">Annuler la commande</button>' : ''}</div>
        </div>
        <div class="bloc"><h4>Commentaire</h4><textarea class="input" id="fCom" placeholder="Besoins, objections, prochain pas…">${esc(s.commentaire || '')}</textarea></div>
    </div>`;

    const lireQ = () => Object.fromEntries([...document.querySelectorAll('#sheet [data-q]')].map(x => [x.dataset.q, Math.max(0, parseInt(x.value) || 0)]).filter(([, v]) => v));
    document.querySelectorAll('#sheet [data-q]').forEach(inp => inp.oninput = () => {
        const qq = lireQ(); REFS.forEach(r => { document.querySelector(`[data-st="${r.id}"]`).textContent = qq[r.id] ? euro(qq[r.id] * r.promo) : '—'; });
        $('#fTot').textContent = euro(montantDe(qq));
    });
    $('#fSteps').onclick = e => { const b = e.target.closest('[data-step]'); if (b) maj(i.id, { [b.dataset.step]: !i.suivi?.[b.dataset.step] }); };
    $('#fDate').onchange = e => maj(i.id, { date_contact: e.target.value });
    $('#fRappel').onchange = e => maj(i.id, { rappel: e.target.value });
    $('#fCom').onchange = e => maj(i.id, { commentaire: e.target.value });
    $('#fCmd').onclick = async () => {
        const qq = lireQ();
        if (!Object.keys(qq).length) { toast('Saisis au moins une quantité.', true); return; }
        await maj(i.id, { quantites: qq, commande: true, appel: true }, true);
        toast(`Commande enregistrée : ${euro(montantDe(qq))} HT 🎉`); fermer();
    };
    $('#fCmdAnn') && ($('#fCmdAnn').onclick = async () => { await maj(i.id, { quantites: {}, commande: false }, true); toast('Commande annulée'); rendreFiche(i); });
    $('#fMail').onclick = async () => {
        const to = (i.mail || '').split(';').map(m => m.trim()).filter(Boolean).join(',');
        // Le mail mis en forme est aussi copié : si la messagerie tronque le texte, il suffit de le coller
        await copierMail(i, signature()).catch(() => {});
        location.href = `mailto:${to}?subject=${encodeURIComponent(mailObjet())}&body=${encodeURIComponent(mailTexte(i, signature()))}`;
        toast('Mail ouvert et copié : en cas de souci, colle-le (Ctrl+V)');
        if (!i.suivi?.mail) maj(i.id, { mail: true }, true).then(() => setTimeout(() => toast('Étape « Mail » cochée ✓'), 2500));
    };
    $('#fCopie').onclick = async () => {
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([mailHtml(i, signature())], { type: 'text/html' }), 'text/plain': new Blob([mailTexte(i, signature())], { type: 'text/plain' }) })]);
            toast('Mail copié : colle-le dans Outlook (objet ci-dessous).');
        } catch (e) { await navigator.clipboard.writeText(mailTexte(i, signature())).catch(() => {}); toast('Mail copié (texte).'); }
    };
    $('#fBon').onclick = () => {
        const d = { iap: { raison: i.raison, numero: i.numero, contact: [i.contact_prenom, i.contact_nom].filter(Boolean).join(' '), mail: i.mail, portable: i.portable, adresse: i.adresse, cp: i.cp, ville: i.ville }, atc: signature(), q: lireQ() };
        window.open('bon.html#' + encodeURIComponent(JSON.stringify(d)), '_blank');
    };
}
function etapesFiche(s) {
    return ETAPES.map(e => `<button class="stp ${e.k === 'commande' ? 'cmd' : ''} ${s[e.k] ? 'on' : ''}" data-step="${e.k}" ${e.k === 'commande' ? 'disabled style="cursor:default"' : ''}><span class="i">${e.icone}</span><span class="n">${e.nom}</span><span class="d">${jourCourt(s[e.k])}</span></button>`).join('');
}

// ─── Argumentaire ───
function rendreArgs() {
    $('#fiches').innerHTML = Object.entries(PRODUITS).map(([id, p]) => `<div class="card fiche"><img src="${p.img}" alt=""><div class="b">
        <h3>${esc(p.nom)} <span class="chip">A2P ${'★'.repeat(p.a2p)}</span></h3><div class="a">${esc(p.accroche)}</div>
        <ul>${p.args.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
        <div class="px">${REFS.filter(r => r.produit === id).map(r => `<span>${esc(r.cyl)} : ${euro(r.promo)} <s style="opacity:.6;font-weight:500">${euro(r.base)}</s> -${String(remise(r)).replace('.', ',')} %</span>`).join('')}</div>
        <a href="${p.url}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px;font-size:13px;color:var(--accent);font-weight:700">Fiche sur picard-serrures.com ↗</a></div></div>`).join('');
    $('#marque').innerHTML = MARQUE.map(m => `<li>${esc(m)}</li>`).join('') + `<li>${esc(OPE.livraison)}</li>`;
}
