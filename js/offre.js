/* ============================================================
   OPÉ IAP — Données de l'opération (produits, prix, textes)
   Prix promo identiques à juin 2026, + Présence 3 et Sérénis 710.
   Si un prix change ici, le changer aussi dans sql/schema.sql (fonction boost_prix).
   ============================================================ */

const OPE = {
    nom: 'Coup de boost pour les ATC',
    debut: '2026-11-23',
    fin: '2026-11-27T18:00:00+01:00',
    finTexte: 'du 23 au 27 novembre 2026 (jusqu’à 18h)',
    visio: 'Vendredi 20 novembre — visio 30 min ATC + ADV',
    livraison: 'Toutes les commandes saisies pendant l’opération sont livrées avant la fin de l’année 2026.',
};

// Les 6 références en promotion (HT)
const REFS = [
    { id: 'p2-ent-vigie', produit: 'presence2', nom: 'Présence 2 Entrebâilleur', cyl: 'Vigie Mobile', promo: 269.10, base: 650.55 },
    { id: 'p2-ent-vtx', produit: 'presence2', nom: 'Présence 2 Entrebâilleur', cyl: 'VTX', promo: 278.10, base: 696.54 },
    { id: 'p2-etr-vigie', produit: 'presence2e', nom: 'Présence 2 Étroite', cyl: 'Vigie Mobile', promo: 251.10, base: 405.30 },
    { id: 'p2-etr-vtx', produit: 'presence2e', nom: 'Présence 2 Étroite', cyl: 'VTX', promo: 260.10, base: 433.76 },
    { id: 'p3-ent-vigie', produit: 'presence3', nom: 'Présence 3 Entrebâilleur', cyl: 'Vigie Mobile', promo: 450.00, base: 722.02 },
    { id: 's710-ent-vak', produit: 'serenis710', nom: 'Sérénis 710 Entrebâilleur', cyl: 'Vak Unik', promo: 490.00, base: 938.96 },
];

// Fiches produits (source : picard-serrures.com)
const PRODUITS = {
    presence2: {
        nom: 'Présence 2', accroche: 'Haute protection garantie', img: 'img/presence2.webp', a2p: 1,
        url: 'https://www.picard-serrures.com/global/fr/produits/presence-2',
        points: '5 points', resume: 'La serrure multipoints en applique fiable et confortable, montée à la main en France.',
        args: [
            '5 points de fermeture, évolutive à 7 points (points haut et bas Ø18 mm avec étriers anti-arrachement)',
            'Pênes latéraux chromés Ø22 mm, rotatifs anti-sciage',
            'Certifiée anti-effraction A2P★',
            'Entrebâilleur intégré, décondamnable de l’extérieur à la clé',
            'Clés brevetées Vigie Mobile (3 clés, à pompe) ou VTX (4 clés réversibles, débrayable), carte de propriété numérotée',
            'Silencieuse : amortisseur de bruit et bagues Delrin ; tous les points en un seul tour de clé',
        ],
    },
    presence2e: {
        nom: 'Présence 2 Étroite', accroche: 'Portes moulurées et vitrées sous haute sécurité', img: 'img/presence2-etroite.webp', a2p: 1,
        url: 'https://www.picard-serrures.com/global/fr/produits/presence-2-etroite',
        points: '5 points', resume: 'Toute la sécurité de Présence 2 dans un coffre étroit, pour les portes moulurées et vitrées.',
        args: [
            'Coffre étroit : la solution pour les portes moulurées et vitrées',
            '5 points de fermeture, évolutive à 7 points avec étriers de renfort',
            'Pênes latéraux chromés Ø22 mm, rotatifs anti-sciage',
            'Certifiée anti-effraction A2P★',
            'Clés brevetées Vigie Mobile ou VTX, sous emballage scellé avec carte de propriété',
            'Silencieuse, tous les points en un seul tour de clé',
        ],
    },
    presence3: {
        nom: 'Présence 3', accroche: 'Haute sécurité à la clé', img: 'img/presence3.webp', a2p: 3,
        url: 'https://www.picard-serrures.com/global/fr/produits/presence-3',
        points: '7 points', resume: 'Le plus haut niveau de certification anti-effraction, A2P★★★, au prix d’une A2P★ classique.',
        args: [
            '7 points de fermeture, évolutive à 9 points',
            'Plus haute certification anti-effraction : A2P★★★',
            'Pênes latéraux Ø22 mm rotatifs anti-sciage',
            'Entrebâilleur intégré, décondamnable de l’extérieur à la clé',
            '3 clés brevetées Vigie Mobile, carte de propriété numérotée : copie impossible sans les numéros',
            'Option détecteur de choc couplé à une alarme intégrée',
        ],
    },
    serenis710: {
        nom: 'Sérénis 710', accroche: 'La serrure qui va le plus loin en sécurité', img: 'img/serenis710.webp', a2p: 3,
        url: 'https://www.picard-serrures.com/global/fr/produits/serenis-710',
        points: '7 points', resume: 'Le haut de gamme Picard : A2P★★★, protecteur anti-arrachage et anti-perçage, clés inox VAK UNIK.',
        args: [
            '7 points de fermeture, évolutive à 9 points',
            'Plus haute certification anti-effraction : A2P★★★',
            'Protecteur rotatif anti-arrachage avec pastille anti-perçage',
            '4 clés inox brevetées VAK UNIK, sous emballage scellé avec carte de propriété',
            'Entrebâilleur intégré, décondamnable de l’extérieur à la clé',
            'Option SIGNAL : détecteur de choc couplé à une alarme intégrée',
        ],
    },
};

const MARQUE = [
    'Fondée en 1720 : concepteur et fabricant de systèmes de haute sécurité',
    'Mécanisme, combinaison et serrure montés à la main en France (Feuquières-en-Vimeu)',
    'Clés brevetées et cartes de propriété : la reproduction exige les numéros de clé et de carte',
    'Garantie 2 ans',
];

// Étapes de la to-do phoning
const ETAPES = [
    { k: 'appel', nom: 'Appel', icone: '📞' },
    { k: 'mail', nom: 'Mail', icone: '✉️' },
    { k: 'presentation', nom: 'Présentation', icone: '📋' },
    { k: 'commande', nom: 'Commande', icone: '✅' },
];

// ─── Outils ───
const euro = (n, dec = 2) => (+n || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' €';
const remise = r => Math.round((1 - r.promo / r.base) * 1000) / 10;
const economie = r => r.base - r.promo;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const montantDe = q => REFS.reduce((t, r) => t + (+q?.[r.id] || 0) * r.promo, 0);

// ─── Mail « Proposition et tarification suite à notre échange téléphonique » ───
function mailObjet() { return 'Proposition et tarification suite à notre échange téléphonique – Opération flash serrures Picard'; }
function mailTexte(iap, atc) {
    const bonjour = iap?.contact_prenom ? `Bonjour ${iap.contact_prenom},` : 'Bonjour,';
    const lignes = REFS.map(r => `• ${r.nom} ${r.cyl} : ${euro(r.promo)} HT au lieu de ${euro(r.base)} HT (-${String(remise(r)).replace('.', ',')} %)`).join('\n');
    return `${bonjour}

Suite à notre échange téléphonique, je vous confirme les conditions exceptionnelles réservées à notre réseau d’Installateurs Agréés Picard, ${OPE.finTexte} :

${lignes}

C’est le bon moment pour relancer vos devis en cours et proposer à vos clients une serrure certifiée A2P, montée à la main en France, alors que les cambriolages sont les plus fréquents en cette période de l’année.

${OPE.livraison}

Vous trouverez ci-joint le bon de commande : il vous suffit de me le retourner complété par retour de mail. Attention, l’opération est limitée dans le temps et dans les stocks.

Je reste à votre disposition pour tout complément d’information.

Bien cordialement,
${atc || ''}
Picard Serrures`;
}
function mailHtml(iap, atc) {
    const bonjour = iap?.contact_prenom ? `Bonjour ${esc(iap.contact_prenom)},` : 'Bonjour,';
    const td = 'padding:6px 10px;border-bottom:1px solid #e5e5e5;font:14px Arial,sans-serif;';
    const rows = REFS.map(r => `<tr><td style="${td}">${esc(r.nom)} <b>${esc(r.cyl)}</b></td><td style="${td}text-align:right;color:#999;text-decoration:line-through">${euro(r.base)}</td><td style="${td}text-align:right;font-weight:bold;color:#b8862f">${euro(r.promo)}</td><td style="${td}text-align:right">-${String(remise(r)).replace('.', ',')} %</td></tr>`).join('');
    const p = 'font:14px Arial,sans-serif;color:#222;margin:0 0 12px';
    return `<div style="${p}">${bonjour}</div>
<p style="${p}">Suite à notre échange téléphonique, je vous confirme les conditions exceptionnelles réservées à notre réseau d’<b>Installateurs Agréés Picard</b>, <b>${esc(OPE.finTexte)}</b> :</p>
<table style="border-collapse:collapse;margin:0 0 14px"><tr><th style="${td}text-align:left">Serrure (prix HT)</th><th style="${td}text-align:right">Prix tarif</th><th style="${td}text-align:right">Prix opération</th><th style="${td}text-align:right">Remise</th></tr>${rows}</table>
<p style="${p}">C’est le bon moment pour relancer vos devis en cours et proposer à vos clients une serrure certifiée A2P, montée à la main en France, alors que les cambriolages sont les plus fréquents en cette période de l’année.</p>
<p style="${p}"><b>${esc(OPE.livraison)}</b></p>
<p style="${p}">Vous trouverez ci-joint le bon de commande : il vous suffit de me le retourner complété par retour de mail. Attention, l’opération est limitée dans le temps et dans les stocks.</p>
<p style="${p}">Je reste à votre disposition pour tout complément d’information.</p>
<p style="${p}">Bien cordialement,<br>${esc(atc || '')}<br>Picard Serrures</p>`;
}

// ─── Copie du mail (mise en forme pour Outlook, avec repli en texte brut) ───
async function copierMail(iap, atc, texteSeul) {
    const texte = mailTexte(iap, atc);
    if (!texteSeul && window.ClipboardItem) {
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([mailHtml(iap, atc)], { type: 'text/html' }), 'text/plain': new Blob([texte], { type: 'text/plain' }) })]);
            return 'html';
        } catch (e) { /* repli ci-dessous */ }
    }
    await navigator.clipboard.writeText(texte);
    return 'texte';
}
// Modèle générique : prénom et signature à compléter
const MAIL_MODELE_IAP = { contact_prenom: '[Prénom]' };
