import type { Lang } from '../engine/types';

export interface ChapterText {
  name: string;
  /** Texte d'ouverture du chapitre. */
  intro: string;
  /** Ce qui change dans le jeu à partir de ce chapitre. */
  twist: string;
  /** Phrase chiffrée du dernier niveau : le message d'Ada. */
  phrase: string;
  /** Ce que le joueur comprend une fois le message déchiffré. */
  outro: string;
}

export interface StoryText {
  title: string;
  prologue: string;
  cycle: string;
  chapters: ChapterText[];
}

export const STORY: Record<Lang, StoryText> = {
  fr: {
    title: 'Le Cabinet noir',
    prologue: "Ada, la vieille cryptographe, a disparu. Elle a laissé derrière elle une piste de messages chiffrés, et ton nom griffonné sur le premier.",
    cycle: 'Cycle',
    chapters: [
      {
        name: "L'Atelier",
        intro: "L'atelier d'Ada est resté ouvert. Sur l'établi, une grille inachevée t'attend. Commence par là où elle s'est arrêtée.",
        twist: 'Les bases : des indices directs pour apprendre à faire parler les numéros.',
        phrase: 'Cherche le livre sans titre à la bibliothèque',
        outro: "Un livre sans titre. Ada voulait que tu apprennes à lire entre les lignes.",
      },
      {
        name: 'La Bibliothèque',
        intro: "Entre les rayonnages, les livres murmurent. Ada aimait les détours : ici, les indices ne disent plus les choses en face.",
        twist: 'Indices plus subtils et moins de lettres offertes.',
        phrase: 'Le prochain message part ce soir en train de nuit',
        outro: 'Dans la reliure, un billet pour le train de nuit.',
      },
      {
        name: 'Le Train de nuit',
        intro: "Le train file dans l'obscurité. Chaque message doit être déchiffré avant le prochain arrêt, sinon il descend sans toi.",
        twist: 'Chaque niveau est chronométré.',
        phrase: 'Descends au dernier arrêt, les archives brûlent',
        outro: "Au terminus, une odeur de fumée flotte déjà dans l'air.",
      },
      {
        name: 'Les Archives brûlées',
        intro: "Le feu a rongé les registres. Sous la suie, certains numéros ont disparu : il faudra deviner où se cachent les lettres.",
        twist: "Taches d'encre : une partie des numéros des mots est cachée jusqu'à ce que la lettre soit trouvée.",
        phrase: "Ce que l'encre cache, les étoiles le révèlent",
        outro: 'Les étoiles, bien sûr. Ada observait tout de là-haut.',
      },
      {
        name: "L'Observatoire",
        intro: "Sous la coupole, Ada ne parlait que par énigmes. Ses indices s'ouvrent un à un, et ils ne disent jamais tout.",
        twist: "Indices enchaînés : chaque indice s'ouvre quand le mot précédent est résolu. Les indices deviennent malins.",
        phrase: 'Sous la grande horloge dort la salle des machines',
        outro: 'Un tic-tac sous tes pieds. La grande horloge.',
      },
      {
        name: 'La Salle des machines',
        intro: "Les engrenages ne pardonnent pas : trois erreurs et la machine s'arrête. L'huile a même délavé les indices.",
        twist: 'Trois vies, encre et indices délavés : des lettres manquent dans les indices.',
        phrase: 'Monte en haut de la tour, sans clé ni indice',
        outro: "La machine se tait. Un escalier s'ouvre vers le sommet.",
      },
      {
        name: 'La Tour du chiffre',
        intro: "Au sommet de la tour, plus aucun mot pour t'aider. Seule la phrase, chiffrée, et ce que tu sais de la langue.",
        twist: 'Cryptogrammes purs : la phrase seule, sans aucun mot indice.',
        phrase: "Le cabinet noir t'attend derrière le miroir",
        outro: 'Dans le miroir, ton reflet sourit avant toi.',
      },
      {
        name: 'Le Cabinet noir',
        intro: "Tout ce que tu as appris, en même temps. Ada est derrière la dernière porte, et elle ne t'aidera pas.",
        twist: "Brume sur la phrase, encre, indices enchaînés et malins, chrono et trois vies. Tout à la fois.",
        phrase: "Désormais, c'est toi qui gardes le code",
        outro: "Ada te tend la clé du Cabinet noir. Le cycle recommence, plus dur, et cette fois c'est toi qui écris les messages.",
      },
    ],
  },
  en: {
    title: 'The Black Chamber',
    prologue: 'Ada, the old cryptographer, has vanished. She left a trail of coded messages behind her, with your name scribbled on the first one.',
    cycle: 'Cycle',
    chapters: [
      {
        name: 'The Workshop',
        intro: "Ada's workshop was left open. On the workbench, an unfinished grid is waiting. Start where she stopped.",
        twist: 'The basics: direct clues to learn how numbers talk.',
        phrase: 'Look for the book with no title in the library',
        outro: 'A book with no title. Ada wanted you to learn to read between the lines.',
      },
      {
        name: 'The Library',
        intro: "Between the shelves, the books whisper. Ada loved detours: here, the clues no longer say things plainly.",
        twist: 'Subtler clues and fewer free letters.',
        phrase: 'The next message leaves tonight on the night train',
        outro: 'Inside the binding, a ticket for the night train.',
      },
      {
        name: 'The Night Train',
        intro: 'The train races through the dark. Each message must be decoded before the next stop, or it leaves without you.',
        twist: 'Every level is timed.',
        phrase: 'Get off at the last stop, the archives are burning',
        outro: 'At the terminus, smoke is already in the air.',
      },
      {
        name: 'The Burnt Archives',
        intro: 'Fire has eaten the ledgers. Under the soot, some numbers are gone: you will have to guess where the letters hide.',
        twist: 'Ink stains: some numbers in the words stay hidden until the letter is found.',
        phrase: 'What the ink hides, the stars reveal',
        outro: 'The stars, of course. Ada watched everything from above.',
      },
      {
        name: 'The Observatory',
        intro: 'Under the dome, Ada only spoke in riddles. Her clues open one by one, and they never tell the whole story.',
        twist: 'Chained clues: each clue opens once the previous word is solved. Clues turn cryptic.',
        phrase: 'Beneath the great clock sleeps the engine room',
        outro: 'A ticking under your feet. The great clock.',
      },
      {
        name: 'The Engine Room',
        intro: 'The gears do not forgive: three mistakes and the machine stops. The oil has even washed out the clues.',
        twist: 'Three lives, ink stains and smudged clues with missing letters.',
        phrase: 'Climb to the top of the tower, with no key and no clue',
        outro: 'The machine falls silent. A staircase opens toward the top.',
      },
      {
        name: 'The Cipher Tower',
        intro: 'At the top of the tower, no more words to help you. Only the phrase, encoded, and what you know of the language.',
        twist: 'Pure cryptograms: the phrase alone, with no clue words.',
        phrase: 'The black chamber waits behind the mirror',
        outro: 'In the mirror, your reflection smiles before you do.',
      },
      {
        name: 'The Black Chamber',
        intro: 'Everything you have learned, all at once. Ada is behind the last door, and she will not help you.',
        twist: 'Fog over the phrase, ink, chained cryptic clues, a clock and three lives. All at once.',
        phrase: 'From now on, you are the keeper of the code',
        outro: 'Ada hands you the key to the Black Chamber. The cycle begins again, harder, and this time you write the messages.',
      },
    ],
  },
  es: {
    title: 'El Gabinete Negro',
    prologue: 'Ada, la vieja criptógrafa, ha desaparecido. Dejó un rastro de mensajes cifrados, con tu nombre garabateado en el primero.',
    cycle: 'Ciclo',
    chapters: [
      {
        name: 'El Taller',
        intro: 'El taller de Ada quedó abierto. Sobre el banco, una cuadrícula a medias te espera. Empieza donde ella lo dejó.',
        twist: 'Lo básico: pistas directas para aprender a hacer hablar a los números.',
        phrase: 'Busca el libro sin título en la biblioteca',
        outro: 'Un libro sin título. Ada quería que aprendieras a leer entre líneas.',
      },
      {
        name: 'La Biblioteca',
        intro: 'Entre las estanterías, los libros susurran. A Ada le encantaban los rodeos: aquí las pistas ya no dicen las cosas a la cara.',
        twist: 'Pistas más sutiles y menos letras regaladas.',
        phrase: 'El próximo mensaje sale esta noche en el tren nocturno',
        outro: 'En la encuadernación, un billete para el tren nocturno.',
      },
      {
        name: 'El Tren Nocturno',
        intro: 'El tren corre en la oscuridad. Cada mensaje debe descifrarse antes de la próxima parada, o se baja sin ti.',
        twist: 'Todos los niveles tienen reloj.',
        phrase: 'Baja en la última estación, los archivos arden',
        outro: 'En la terminal, ya huele a humo.',
      },
      {
        name: 'Los Archivos Quemados',
        intro: 'El fuego devoró los registros. Bajo el hollín, algunos números han desaparecido: habrá que adivinar dónde se esconden las letras.',
        twist: 'Manchas de tinta: parte de los números de las palabras se ocultan hasta encontrar la letra.',
        phrase: 'Lo que la tinta esconde, las estrellas lo revelan',
        outro: 'Las estrellas, claro. Ada lo observaba todo desde arriba.',
      },
      {
        name: 'El Observatorio',
        intro: 'Bajo la cúpula, Ada solo hablaba con enigmas. Sus pistas se abren una a una, y nunca lo dicen todo.',
        twist: 'Pistas encadenadas: cada pista se abre al resolver la palabra anterior. Las pistas se vuelven ingeniosas.',
        phrase: 'Bajo el gran reloj duerme la sala de máquinas',
        outro: 'Un tictac bajo tus pies. El gran reloj.',
      },
      {
        name: 'La Sala de Máquinas',
        intro: 'Los engranajes no perdonan: tres errores y la máquina se detiene. El aceite ha borrado hasta las pistas.',
        twist: 'Tres vidas, manchas de tinta y pistas borrosas a las que les faltan letras.',
        phrase: 'Sube a lo alto de la torre, sin llave y sin pista',
        outro: 'La máquina calla. Se abre una escalera hacia la cima.',
      },
      {
        name: 'La Torre del Cifrado',
        intro: 'En lo alto de la torre, ya no hay palabras que ayuden. Solo la frase, cifrada, y lo que sabes del idioma.',
        twist: 'Criptogramas puros: la frase sola, sin palabras pista.',
        phrase: 'El gabinete negro te espera tras el espejo',
        outro: 'En el espejo, tu reflejo sonríe antes que tú.',
      },
      {
        name: 'El Gabinete Negro',
        intro: 'Todo lo que has aprendido, a la vez. Ada está tras la última puerta, y no te ayudará.',
        twist: 'Niebla sobre la frase, tinta, pistas encadenadas e ingeniosas, reloj y tres vidas. Todo a la vez.',
        phrase: 'Desde ahora, tú guardas el código',
        outro: 'Ada te entrega la llave del Gabinete Negro. El ciclo vuelve a empezar, más difícil, y esta vez tú escribes los mensajes.',
      },
    ],
  },
};
