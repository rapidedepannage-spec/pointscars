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
