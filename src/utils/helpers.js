// Genere un ID court aleatoire
export const uid = () => Math.random().toString(36).slice(2, 8)

// Total pieces : somme de (quantite x prix)
export const tot = (pcs) => (pcs || []).reduce((s, x) => s + (x.q || 0) * (x.p || 0), 0)

// Formate une date ISO "YYYY-MM-DD" en "DD/MM/YYYY"
export const fd = (d) => (d ? d.split('-').reverse().join('/') : '\u2014')

// Formate un nombre en euros "1 234 EUR"
export const fmt = (n) => (n ? Number(n).toLocaleString('fr-FR') + ' \u20AC' : '\u2014')
