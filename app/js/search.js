// Bilingual search over element names: French (and English) words are turned into the English keywords the
// packs are named with. "tableau" finds tables, "flèche" arrows, "étoile" stars…
import { lang } from './i18n.js';

// French -> English keywords (several when one French word covers several ideas)
const FR = {
  // shapes
  carre: 'square', rectangle: 'rectangle rect', cercle: 'circle', rond: 'circle round', ovale: 'ellipse oval', triangle: 'triangle', losange: 'diamond rhombus',
  pentagone: 'pentagon', hexagone: 'hexagon', octogone: 'octagon', etoile: 'star', eclat: 'burst sparkle', scintillement: 'sparkle', explosion: 'burst', coeur: 'heart',
  fleche: 'arrow', chevron: 'chevron', etiquette: 'tag label', croix: 'cross', parallelogramme: 'parallelogram', trapeze: 'trapezoid', bulle: 'bubble speech',
  nuage: 'cloud', arche: 'arch', anneau: 'ring donut', tache: 'blob', galet: 'pebble', vague: 'wave', ligne: 'line', trait: 'line', tirets: 'dashed', pointilles: 'dotted',
  connecteur: 'connector line', banniere: 'banner', ruban: 'ribbon', badge: 'badge', bouclier: 'shield', cadre: 'frame', bordure: 'border frame', coin: 'corner',
  grille: 'grid', collage: 'grid collage', maquette: 'mockup device', telephone: 'phone mobile', tablette: 'tablet', portable: 'laptop', ecran: 'screen monitor display',
  navigateur: 'browser window', montre: 'watch', forme: 'shape', formes: 'shape', organique: 'blob organic', goutte: 'drop droplet', sceau: 'seal', medaille: 'medal',
  organigramme: 'flowchart org chart', accolade: 'brace bracket', crochet: 'bracket', parenthese: 'parenthesis', engrenage: 'gear cog', puzzle: 'puzzle', lune: 'moon',
  eclair: 'lightning zap bolt', flamme: 'flame fire', feu: 'fire flame', soleil: 'sun', pluie: 'rain', neige: 'snow', couronne: 'crown', trophee: 'trophy cup', coupe: 'trophy cup',
  // tables, charts, data
  tableau: 'table chart', tableaux: 'table', tableur: 'table spreadsheet', graphique: 'chart graph', graphe: 'chart graph', diagramme: 'diagram chart', camembert: 'pie',
  barres: 'bar column', barre: 'bar', colonnes: 'column bar', colonne: 'column', courbe: 'line curve', aires: 'area', jauge: 'gauge progress', progression: 'progress',
  pourcentage: 'percent', frise: 'timeline', chronologie: 'timeline', entonnoir: 'funnel', pyramide: 'pyramid', calendrier: 'calendar', horloge: 'clock', chiffre: 'number',
  nombre: 'number', statistique: 'statistics chart', statistiques: 'statistics chart', croissance: 'growth trending-up', baisse: 'trending-down', cible: 'target bullseye',
  carte: 'map card', epingle: 'pin', repere: 'pin marker', globe: 'globe world', monde: 'world globe', drapeau: 'flag', drapeaux: 'flag', donnees: 'data chart', qr: 'qr',
  // objects
  argent: 'money cash', piece: 'coin', billet: 'banknote money', banque: 'bank', panier: 'cart basket', sac: 'bag', cadeau: 'gift present', boutique: 'shop store', magasin: 'shop store',
  usine: 'factory', batiment: 'building', maison: 'house home', bureau: 'office desk', mallette: 'briefcase', dossier: 'folder', document: 'file document', fichier: 'file',
  livre: 'book', stylo: 'pen', crayon: 'pencil', pinceau: 'brush paint', ciseaux: 'scissors', enveloppe: 'mail envelope', courriel: 'mail email', mail: 'mail', appel: 'phone call',
  message: 'message chat', cloche: 'bell', megaphone: 'megaphone', micro: 'microphone mic', photo: 'camera photo image', camera: 'camera', video: 'video film', musique: 'music note',
  casque: 'headphones', ampoule: 'bulb lightbulb idea', idee: 'idea bulb', cerveau: 'brain', reglages: 'settings gear', parametres: 'settings gear', outil: 'tool wrench',
  marteau: 'hammer', cadenas: 'lock', cle: 'key wrench', securite: 'security shield lock', loupe: 'search magnifier zoom', recherche: 'search', filtre: 'filter', utilisateur: 'user person',
  personne: 'person user', gens: 'people users', equipe: 'team group users', groupe: 'group users', poignee: 'handshake', pouce: 'thumbs', main: 'hand', applaudir: 'clap',
  aime: 'like heart', favori: 'star favorite', coche: 'check', valide: 'check', fermer: 'x close', avertissement: 'warning alert', attention: 'warning alert', interdit: 'ban forbidden',
  information: 'info', question: 'question help', aide: 'help question', ajouter: 'plus add', corbeille: 'trash', supprimer: 'trash delete', telecharger: 'download',
  importer: 'upload', partager: 'share', lien: 'link', imprimante: 'printer', batterie: 'battery', fusee: 'rocket', recompense: 'award medal', diamant: 'diamond gem', gemme: 'gem',
  arbre: 'tree', feuille: 'leaf', fleur: 'flower', plante: 'plant', montagne: 'mountain', plage: 'beach', mer: 'sea ocean', ville: 'city building', voiture: 'car', velo: 'bike bicycle',
  avion: 'plane airplane', bateau: 'boat ship', valise: 'suitcase luggage', nourriture: 'food', cafe: 'coffee', gateau: 'cake', verre: 'glass drink', boisson: 'drink',
  bouteille: 'bottle', fourchette: 'fork', couverts: 'cutlery fork', chien: 'dog', chat: 'cat', oiseau: 'bird', poisson: 'fish', sante: 'health medical', hopital: 'hospital',
  medecin: 'doctor', medicament: 'pill medicine', pilule: 'pill', seringue: 'syringe', sport: 'sport ball', ballon: 'ball balloon', football: 'soccer football', haltere: 'dumbbell',
  musculation: 'dumbbell gym', course: 'running run', ecole: 'school', diplome: 'graduation diploma', etudiant: 'student', eleve: 'student', professeur: 'teacher', regle: 'ruler',
  calculatrice: 'calculator', ordinateur: 'computer laptop', clavier: 'keyboard', souris: 'mouse', code: 'code', robot: 'robot', ia: 'ai robot', base: 'database', serveur: 'server',
  reseau: 'network', oeil: 'eye', voir: 'eye view', sourire: 'smile', content: 'smile happy', heureux: 'happy', triste: 'sad', colere: 'angry', rire: 'laugh', surpris: 'surprised',
  amour: 'love heart', fete: 'party confetti', confettis: 'confetti', noel: 'christmas', sapin: 'christmas tree', halloween: 'halloween', citrouille: 'pumpkin', anniversaire: 'birthday cake',
  travail: 'work job briefcase', emploi: 'job briefcase', reunion: 'meeting', presentation: 'presentation', agenda: 'schedule calendar', tache: 'task', liste: 'list checklist',
  objectif: 'goal target', strategie: 'strategy chess', echecs: 'chess', jeu: 'game gamepad', manette: 'gamepad', titre: 'heading title', texte: 'text', police: 'font',
  couleur: 'color', degrade: 'gradient', motif: 'pattern', texture: 'texture', ombre: 'shadow', dessin: 'draw drawing', dessiner: 'draw', gomme: 'eraser', surligneur: 'highlighter',
  marqueur: 'marker', temps: 'time clock', heure: 'clock time', date: 'calendar', lieu: 'location pin', adresse: 'location pin map', maison2: 'home', bebe: 'baby', enfant: 'child',
  femme: 'woman', homme: 'man', famille: 'family', visage: 'face', smiley: 'smile face', animal: 'animal', animaux: 'animal', fruit: 'fruit', legume: 'vegetable',
  vetement: 'clothes shirt', chaussure: 'shoe', lunettes: 'glasses', science: 'science flask', chimie: 'flask chemistry', espace: 'space planet rocket', planete: 'planet',
  terre: 'earth globe', meteo: 'weather', nuit: 'night moon', jour: 'day sun', mariage: 'wedding', voyage: 'travel plane', vacances: 'holiday beach', hotel: 'hotel bed',
  lit: 'bed', cuisine: 'kitchen', restaurant: 'restaurant food', livraison: 'delivery truck', camion: 'truck', train: 'train', bus: 'bus', metro: 'subway train',
  energie: 'energy zap', solaire: 'solar sun', eau: 'water drop', ecologie: 'eco leaf', recyclage: 'recycle', signal: 'signal wifi', bluetooth: 'bluetooth', nuage2: 'cloud',
  alarme: 'alarm', minuteur: 'timer', sablier: 'hourglass', boussole: 'compass', ancre: 'anchor', clef: 'key', porte: 'door', fenetre: 'window', escalier: 'stairs',
  virus: 'virus', masque: 'mask', vaccin: 'syringe vaccine', dent: 'tooth', os: 'bone', ADN: 'dna', adn: 'dna', microscope: 'microscope', telescope: 'telescope',
  pays: 'flag country', france: 'fr france', europe: 'eu europe', etatsunis: 'us usa', allemagne: 'de germany', espagne: 'es spain', italie: 'it italy', canada: 'ca canada',
  rond2: 'circle', ronde: 'round circle', carree: 'square', arrondi: 'rounded', pointu: 'pointed', fin: 'thin', epais: 'bold thick', vide: 'outline hollow', plein: 'filled solid',
  contour: 'outline', rempli: 'filled', double: 'double', simple: 'single', horizontal: 'horizontal', vertical: 'vertical', gauche: 'left', droite: 'right', haut: 'up top', bas: 'down bottom',
  lettre: 'letter', lettres: 'letter', numero: 'number', chiffres: 'number', emoji: 'emoji', sticker: 'sticker', autocollant: 'sticker', icone: 'icon', icones: 'icon', illustration: 'illustration',
  logo: 'logo', marque: 'brand logo', photos: 'photo', image: 'image photo', images: 'image photo',
};

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss').replace(/[’']/g, ' ');
// singular form of a French / English word (simple rules, enough for search)
function singular(w) {
  if (w.length < 4) return w;
  if (w.endsWith('aux')) return w.slice(0, -3) + 'al';
  if (w.endsWith('eaux')) return w.slice(0, -1);
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.endsWith('x')) return w.slice(0, -1);
  return w;
}
// query -> list of English keyword alternatives per word: "flèches rouges" -> [["arrow","fleche"],["red","rouge"]]
export function queryTerms(q) {
  const words = norm(q).split(/[\s,;/-]+/).filter(Boolean);
  return words.map((w) => {
    const s = singular(w);
    const alts = new Set([w, s]);
    for (const k of [w, s]) if (FR[k]) FR[k].split(' ').forEach((x) => alts.add(x));
    return [...alts];
  });
}
// does a hyphenated element name (and optional extra keywords) match every term of the query?
export function matches(name, terms, extra = '') {
  const hay = ' ' + norm(name).replace(/[-_:]/g, ' ') + (extra ? ' ' + norm(extra) : '') + ' ';
  return terms.every((alts) => alts.some((a) => a.length >= 2 && (hay.includes(' ' + a) || (a.length >= 4 && hay.includes(a)))));
}
// score: exact word 3, word start 2, inside 1 (sum over terms)
export function score(name, terms, extra = '') {
  const hay = ' ' + norm(name).replace(/[-_:]/g, ' ') + (extra ? ' ' + norm(extra) : '') + ' ';
  let s = 0;
  for (const alts of terms) {
    let best = 0;
    for (const a of alts) {
      if (hay.includes(' ' + a + ' ')) best = Math.max(best, 3);
      else if (hay.includes(' ' + a)) best = Math.max(best, 2);
      else if (hay.includes(a)) best = Math.max(best, 1);
    }
    s += best;
  }
  return s - name.length / 200; // shorter names first when equal
}
// the words a French speaker would type for an English element name (for the "Did you mean" suggestions)
export function suggestions(q, limit = 6) {
  const n = norm(q);
  if (n.length < 2) return [];
  const keys = Object.keys(FR).filter((k) => k.startsWith(n.slice(0, 2)));
  return keys.sort((a, b) => lev(n, a) - lev(n, b)).slice(0, limit);
}
function lev(a, b) {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
export const isFrench = () => lang === 'fr';
