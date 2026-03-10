import { db } from '../firebase'

// TecDoc API - recherche pieces par reference
export async function searchTecDoc(articleNo) {
  const TECDOC_KEY = import.meta.env.VITE_TECDOC_KEY
  const cleanRef = articleNo.replace(/\s+/g, '')
  const res = await fetch(
    'https://tecdoc-catalog.p.rapidapi.com/artlookup/search-articles-by-article-no/lang-id/6/article-type/ArticleNumber/article-no/' + encodeURIComponent(cleanRef),
    {
      method: 'GET',
      headers: {
        'x-rapidapi-key': TECDOC_KEY,
        'x-rapidapi-host': 'tecdoc-catalog.p.rapidapi.com',
      },
    }
  )
  if (!res.ok) {
    if (res.status === 403) throw new Error('Cle API TecDoc invalide ou abonnement expire')
    if (res.status === 429) throw new Error('429')
    throw new Error('Erreur TecDoc (code ' + res.status + ')')
  }
  return res.json()
}

// Perplexity AI - appel IA
export async function askPerplexity(systemPrompt, userMessage) {
  const snap = await db.collection('settings').doc('perplexityKey').get()
  const key = snap.exists ? (snap.data().key || '') : ''
  if (!key) throw new Error('Cle API Perplexity non configuree - allez dans Parametres')
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + key,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  })
  if (!res.ok) throw new Error('Erreur Perplexity: ' + res.status)
  const data = await res.json()
  return data.choices[0].message.content
}
