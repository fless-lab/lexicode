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
    prologue: "Ada a quitté son atelier sans prévenir. Sur le premier feuillet, entre deux colonnes de chiffres, elle a laissé ton nom et une direction à suivre.",
    cycle: 'Cycle',
    chapters: [
      {
        name: "L'Atelier",
        intro: "La porte de l'atelier bâille encore. Une lampe éclaire une grille inachevée, et l'encre d'Ada n'a pas eu le temps de sécher.",
        twist: 'Pour commencer, les indices restent directs et les numéros donnent leurs premières lettres.',
        phrase: 'Le livre sans titre attend dans la bibliothèque',
        outro: "Au fond de la grille, un livre sans titre. Ada t'apprend sa méthode à sa façon : en te laissant chercher.",
      },
      {
        name: 'La Bibliothèque',
        intro: "Dans la bibliothèque, la poussière a recouvert les pupitres. Les notes d'Ada sont glissées entre les pages, jamais là où on les attend.",
        twist: 'Les indices prennent des chemins de traverse et les lettres données se font plus rares.',
        phrase: 'Le prochain message part cette nuit par le train',
        outro: "Un billet tombe de la reliure. Le train de nuit part bientôt, et Ada a encore laissé une porte ouverte.",
      },
      {
        name: 'Le Train de nuit',
        intro: "Le train traverse les tunnels, Loupi blotti contre la vitre. Chaque message doit être déchiffré avant le prochain arrêt : le convoi ne ralentira pas pour toi.",
        twist: 'Chaque niveau est chronométré.',
        phrase: 'Au dernier arrêt les archives brûlent déjà',
        outro: "Au terminus, la fumée passe sous les portes. Les Archives sont juste derrière le quai.",
      },
      {
        name: 'Les Archives brûlées',
        intro: "La chaleur a gondolé les registres. Sous la suie, les marges sont pleines de trous et Loupi renifle des cendres près du coffre.",
        twist: "Des taches d'encre masquent certains numéros jusqu'à la découverte de la lettre correspondante.",
        phrase: "Les étoiles révèlent ce que l'encre cache",
        outro: "Par une fenêtre fendue, les étoiles dessinent la suite. Ada a préparé ce refuge depuis la coupole.",
      },
      {
        name: "L'Observatoire",
        intro: "La coupole tourne au-dessus de toi. Sur le bureau d'Ada, les indices sont empilés dans un ordre précis, comme les pièces d'une horloge.",
        twist: "Les indices s'ouvrent en chaîne : il faut résoudre un mot pour obtenir le suivant, et les formulations deviennent plus retorses.",
        phrase: 'Sous la grande horloge dort la salle des machines',
        outro: "Un tic-tac monte du plancher. La grande horloge cache l'escalier vers la salle des machines.",
      },
      {
        name: 'La Salle des machines',
        intro: "Les engrenages tournent déjà. Une seule erreur de trop arrêtera la machine, et l'huile a brouillé plusieurs lignes du carnet.",
        twist: "Tu n'as que trois vies. L'encre revient par taches et certaines lettres manquent aux indices.",
        phrase: 'Monte en haut de la tour, sans clé ni indice',
        outro: "Le dernier engrenage s'immobilise. Derrière lui, un escalier monte vers la tour, sans serrure ni poignée.",
      },
      {
        name: 'La Tour du chiffre',
        intro: "Au sommet, le vent secoue les feuilles d'Ada. Il n'y a plus d'indices, seulement une phrase chiffrée et les habitudes de la langue.",
        twist: 'Cryptogrammes purs : la phrase seule, sans aucun mot indice.',
        phrase: "Le cabinet noir t'attend derrière le miroir",
        outro: "Le miroir ne renvoie pas tout à fait ton geste. Derrière sa plaque, une porte donne sur le Cabinet noir.",
      },
      {
        name: 'Le Cabinet noir',
        intro: "La dernière salle rassemble les carnets, les clés et les messages. Ada est derrière la porte, mais elle te laisse cette grille.",
        twist: "La phrase se couvre de brume, les taches reviennent, les indices s'enchaînent, le chrono tourne et tu gardes trois vies.",
        phrase: "Désormais, c'est toi qui gardes le code",
        outro: "Ada te remet la clé du Cabinet noir. Le prochain cycle sera plus exigeant, et les messages porteront enfin ta signature.",
      },
    ],
  },
  en: {
    title: 'The Black Chamber',
    prologue: 'Ada left the workshop before dawn. On the first sheet, between two columns of figures, she wrote your name and a direction.',
    cycle: 'Cycle',
    chapters: [
      {
        name: 'The Workshop',
        intro: "The workshop door is still ajar. A lamp falls across Ada's unfinished grid, with wet ink beside the last square.",
        twist: 'The first clues stay direct while the numbers teach you their alphabet.',
        phrase: 'The untitled book waits in the library',
        outro: "An untitled book waits in the grid. Ada has left you a lesson, not an explanation.",
      },
      {
        name: 'The Library',
        intro: "Dust covers the library desks. Ada tucked her notes between the pages, never quite where a careful reader expects them.",
        twist: 'The clues take longer routes, and fewer letters are given away.',
        phrase: 'The next message leaves tonight by train',
        outro: "A ticket slips from the binding. The night train leaves soon, and Ada has left one more door unlocked.",
      },
      {
        name: 'The Night Train',
        intro: 'The train cuts through the dark, with Loupi pressed to the window. Decode each message before the next stop or watch it go.',
        twist: 'Every level is timed.',
        phrase: 'At the last stop the archives are already burning',
        outro: 'Smoke slips under the doors at the terminus. The Archives are just beyond the platform.',
      },
      {
        name: 'The Burnt Archives',
        intro: "Heat has warped the ledgers. Soot fills the margins, and Loupi noses through the ash beside a locked chest.",
        twist: 'Ink stains hide some numbers until the matching letter is found.',
        phrase: 'The stars reveal what the ink hides',
        outro: 'Through a cracked window, the stars mark the next step. Ada planned this shelter from the dome above.',
      },
      {
        name: 'The Observatory',
        intro: "The observatory dome turns overhead. Ada's clues are stacked in order, like parts of a clock waiting to be fitted.",
        twist: 'Clues open in a chain: solve one word to reveal the next, and the wording grows more cryptic.',
        phrase: 'Beneath the great clock sleeps the engine room',
        outro: 'A tick comes from below the floor. The great clock is hiding a stairway to the engine room.',
      },
      {
        name: 'The Engine Room',
        intro: "The gears are already moving. One mistake too many will stop them, and oil has blurred several lines in Ada's notebook.",
        twist: 'You have three lives. Ink returns in patches, and some clue letters are missing.',
        phrase: 'Climb to the top of the tower, with no key and no clue',
        outro: 'The last gear stops. Behind it, a stairway climbs to the tower with no lock and no handle.',
      },
      {
        name: 'The Cipher Tower',
        intro: "Wind shakes Ada's papers at the top of the tower. No clues remain, only an encoded phrase and the habits of the language.",
        twist: 'Pure cryptograms: the phrase alone, with no clue words.',
        phrase: 'The black chamber waits behind the mirror',
        outro: 'The mirror does not quite follow your movement. Behind its plate, a door leads into the Black Chamber.',
      },
      {
        name: 'The Black Chamber',
        intro: "The last room gathers the notebooks, keys, and messages. Ada is behind the door, but this grid is yours to solve.",
        twist: 'Fog covers the phrase, ink returns, clues chain together, the clock runs, and you keep three lives.',
        phrase: 'From now on, you are the keeper of the code',
        outro: 'Ada hands you the key to the Black Chamber. The next cycle will be harder, and this time the messages will carry your signature.',
      },
    ],
  },
  es: {
    title: 'El Gabinete Negro',
    prologue: 'Ada salió del taller antes del amanecer. En la primera hoja, entre dos columnas de cifras, escribió tu nombre y una dirección.',
    cycle: 'Ciclo',
    chapters: [
      {
        name: 'El Taller',
        intro: 'La puerta del taller sigue entreabierta. Una lámpara cae sobre la cuadrícula incompleta de Ada y la tinta aún brilla.',
        twist: 'Las primeras pistas son directas: los números empiezan a mostrar su alfabeto.',
        phrase: 'El libro sin título espera en la biblioteca',
        outro: 'Un libro sin título aparece al final de la cuadrícula. Ada te deja una lección, no una explicación.',
      },
      {
        name: 'La Biblioteca',
        intro: 'El polvo cubre las mesas de la biblioteca. Ada escondió sus notas entre las páginas, nunca en el sitio más evidente.',
        twist: 'Las pistas dan rodeos y aparecen menos letras de regalo.',
        phrase: 'El próximo mensaje sale esta noche en tren',
        outro: 'De la encuadernación cae un billete. El tren nocturno sale pronto y Ada ha dejado otra puerta abierta.',
      },
      {
        name: 'El Tren Nocturno',
        intro: 'El tren atraviesa la oscuridad y Loupi mira por la ventanilla. Descifra cada mensaje antes de la próxima parada o se irá sin ti.',
        twist: 'Todos los niveles tienen reloj.',
        phrase: 'En la última estación los archivos ya arden',
        outro: 'En la terminal, el humo se cuela por debajo de las puertas. Los Archivos están al otro lado del andén.',
      },
      {
        name: 'Los Archivos Quemados',
        intro: 'El calor ha deformado los registros. El hollín llena los márgenes y Loupi olfatea las cenizas junto a un cofre cerrado.',
        twist: 'Las manchas de tinta ocultan algunos números hasta encontrar la letra correspondiente.',
        phrase: 'Las estrellas revelan lo que esconde la tinta',
        outro: 'Por una ventana rota, las estrellas marcan el siguiente paso. Ada preparó este refugio desde la cúpula.',
      },
      {
        name: 'El Observatorio',
        intro: 'La cúpula gira sobre tu cabeza. Las pistas de Ada están ordenadas como piezas de un reloj, una detrás de otra.',
        twist: 'Las pistas se encadenan: cada palabra resuelta abre la siguiente y el lenguaje se vuelve más ingenioso.',
        phrase: 'Bajo el gran reloj duerme la sala de máquinas',
        outro: 'Un tictac sube del suelo. El gran reloj escondía la escalera hacia la sala de máquinas.',
      },
      {
        name: 'La Sala de Máquinas',
        intro: 'Los engranajes ya están en marcha. Un error de más los detendrá y el aceite ha borrado varias líneas del cuaderno de Ada.',
        twist: 'Tienes tres vidas. Vuelven las manchas de tinta y faltan letras en algunas pistas.',
        phrase: 'Sube a lo alto de la torre, sin llave y sin pista',
        outro: 'El último engranaje se para. Detrás aparece una escalera hacia la torre, sin cerradura ni pomo.',
      },
      {
        name: 'La Torre del Cifrado',
        intro: 'El viento sacude los papeles de Ada en lo alto de la torre. Ya no hay pistas, solo una frase cifrada y lo que sabes del idioma.',
        twist: 'Criptogramas puros: la frase sola, sin palabras pista.',
        phrase: 'El gabinete negro te espera tras el espejo',
        outro: 'El espejo no imita del todo tus movimientos. Tras la placa hay una puerta hacia el Gabinete Negro.',
      },
      {
        name: 'El Gabinete Negro',
        intro: 'La última sala reúne cuadernos, llaves y mensajes. Ada está tras la puerta, pero esta cuadrícula te toca a ti.',
        twist: 'La niebla cubre la frase, vuelve la tinta, las pistas se encadenan, corre el reloj y conservas tres vidas.',
        phrase: 'Desde ahora, tú guardas el código',
        outro: 'Ada te entrega la llave del Gabinete Negro. El próximo ciclo será más difícil y, esta vez, los mensajes llevarán tu firma.',
      },
    ],
  },
};
