// Statuts des dossiers sinistres
export const STATUTS = [
  { id: 'nouveau', l: 'Nouveau', c: '#3B82F6' },
  { id: 'contact', l: 'Contacte', c: '#8B5CF6' },
  { id: 'attente_rapport', l: 'Attente rapport', c: '#A855F7' },
  { id: 'expertise', l: 'Expertise', c: '#F59E0B' },
  { id: 'attente', l: 'Attente accord', c: '#EF4444' },
  { id: 'ead_a_faire', l: 'EAD a faire', c: '#EC4899' },
  { id: 'ead_envoye', l: 'EAD envoye', c: '#8B5CF6' },
  { id: 'reparation', l: 'Reparation', c: '#F97316' },
  { id: 'termine', l: 'Termine', c: '#10B981' },
  { id: 'facture', l: 'Facture', c: '#06B6D4' },
  { id: 'relance', l: 'Relance', c: '#DC2626' },
  { id: 'regle', l: 'Regle', c: '#6B7280' },
]

// Assureurs
export const ASSUREURS = [
  'MAAF', 'MMA', 'GMF', 'AXA', 'Allianz', 'Macif',
  'MAIF', 'Groupama', 'Matmut', 'Generali', 'Direct Assurance', 'Autre',
]

// Roles utilisateurs
export const ROLES = [
  { id: 'admin', l: 'Administrateur', c: '#F59E0B' },
  { id: 'reception', l: 'Reception', c: '#3B82F6' },
  { id: 'atelier', l: 'Atelier', c: '#10B981' },
  { id: 'comptable', l: 'Comptabilite', c: '#8B5CF6' },
]

// Checklist quotidienne
export const CHECKLIST = [
  { id: 'c1', t: 'Verifier mails experts/assureurs (matin)', h: '8h30', m: true },
  { id: 'c2', t: 'MAJ tableau de suivi', h: '9h00' },
  { id: 'c3', t: 'Relancer attente accord > 48h', h: '9h30' },
  { id: 'c4', t: 'Point avec l\'atelier', h: '10h00' },
  { id: 'c5', t: 'Verifier mails experts/assureurs (midi)', h: '12h00', m: true },
  { id: 'c6', t: 'Contacter clients vehicule pret', h: '14h00' },
  { id: 'c7', t: 'Verifier mails experts/assureurs (16h)', h: '16h00', m: true },
  { id: 'c8', t: 'Factures a emettre', h: '16h30' },
  { id: 'c9', t: 'Classer les mails traites', h: '17h00' },
]

// Utilisateur par defaut (premier acces)
export const DEFAULT_USERS = [
  { id: 'u1', nom: 'Gerant', login: 'admin', pwd: 'admin', role: 'admin', actif: true },
]

// Scopes Outlook
export const OUTLOOK_SCOPES = ['User.Read', 'Mail.Read', 'Mail.Send']

// Code maitre pour reset mot de passe
export const MASTER_CODE = 'POINTS77390'

// Logo Point S (base64 webp)
export const LOGO = "data:image/webp;base64,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"

// Messages motivants pour le bot
export const MOTIV_MSGS = [
  "Bonjour {nom} ! Bien dormi ? Allez c'est parti ! \u{1F4AA}",
  "Salut {nom} ! Encore un effort, on lâche rien ! \u{1F525}",
  "{nom}, reste concentré(e) aujourd'hui, tu gères ! \u{1F44A}",
  "Force {nom} ! Ne faiblis pas, la journée est à toi ! \u26A1",
  "Hey {nom} ! On donne tout aujourd'hui ! \u{1F4AF}",
  "Courage {nom} ! Chaque dossier rapproche du succès ! \u{1F680}",
  "{nom}, aujourd'hui on fait du bon boulot ! \u{1F3C6}",
  "Bienvenue {nom} ! Un café et c'est reparti ! \u2615",
  "Allez {nom}, montre ce que tu sais faire ! \u{1F3AF}",
  "{nom}, la team compte sur toi, en route ! \u{1F91D}",
]
