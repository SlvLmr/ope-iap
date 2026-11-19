/* ============================================================
   OPÉ IAP — accès aux données (fonctions Supabase protégées par code)
   ============================================================ */
const API = (() => {
    const { supabaseUrl, supabaseKey } = window.OPE_CONFIG;
    const CLE = 'ope_iap_code';
    const rpc = async (fn, args) => {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(args),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || `Erreur ${res.status}`);
        return data;
    };
    const lireCode = () => { try { return localStorage.getItem(CLE) || ''; } catch (e) { return ''; } };
    const ecrireCode = c => { try { c ? localStorage.setItem(CLE, c) : localStorage.removeItem(CLE); } catch (e) {} };
    let code = lireCode();
    return {
        get code() { return code; },
        async connexion(c) { const r = await rpc('boost_connexion', { p_code: c }); code = c.trim().toUpperCase(); ecrireCode(code); return r; },
        deconnexion() { code = ''; ecrireCode(''); },
        mesIap: () => rpc('boost_mes_iap', { p_code: code }),
        maj: (iap, data) => rpc('boost_maj', { p_code: code, p_iap: iap, p_data: data }),
        tableau: () => rpc('boost_tableau', { p_code: code }),
        codes: () => rpc('boost_codes', { p_code: code }),
        codeMaj: (nom, role, action) => rpc('boost_code_maj', { p_code: code, p_nom: nom, p_role: role, p_action: action }),
        importer: rows => rpc('boost_import', { p_code: code, p_rows: rows }),
    };
})();

function toast(msg, err) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), err ? 4500 : 2200);
}

// Compte à rebours de l'opération
function compteARebours(el) {
    const debut = new Date(OPE.debut + 'T08:00:00+01:00'), fin = new Date(OPE.fin);
    const tick = () => {
        const now = new Date();
        const fmt = ms => { const h = Math.floor(ms / 36e5), j = Math.floor(h / 24); return j ? `${j} j ${h % 24} h` : `${h} h ${Math.floor(ms / 6e4) % 60} min`; };
        if (now < debut) el.innerHTML = `<span>Lancement dans</span> <b>${fmt(debut - now)}</b>`;
        else if (now < fin) el.innerHTML = `<i class="dot-live"></i><span>En cours · fin dans</span> <b>${fmt(fin - now)}</b>`;
        else el.innerHTML = `<b>Opération terminée</b>`;
    };
    tick(); setInterval(tick, 30000);
}
