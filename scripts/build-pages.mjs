import { readFile, writeFile, mkdir } from "node:fs/promises";
import { EFFECTS, GROUPS, pictogram } from "../src/data/catalog.js";
const root = new URL("../", import.meta.url),
  out = new URL("public/", root);
const research = JSON.parse(
  await readFile(new URL("docs/research/field-guide-data.json", root), "utf8"),
);
const sourceById = Object.fromEntries(research.sources.map((s) => [s.id, s]));
const aliases = { star: "star-pattern", waterfall: "waterfall-curtain" };
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const theme = await readFile(new URL("src/theme.css", root), "utf8");
const css = `${theme}\n@font-face{font-family:'Oxanium ProDyn';src:url('./fonts/Oxanium-wght.woff2') format('woff2');font-weight:200 800;font-display:swap}@font-face{font-family:'Departure Mono ProDyn';src:url('./fonts/DepartureMono-Regular.woff2') format('woff2');font-weight:400;font-display:swap}*{box-sizing:border-box}html{background:var(--pd-field);color:var(--pd-ivory);font-family:var(--pd-font-body);line-height:1.6}body{margin:0;padding:32px;max-width:1100px}a{color:var(--pd-signal);text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:2px solid var(--pd-signal);outline-offset:4px}header{border-bottom:1px solid var(--pd-line);padding-bottom:32px;margin-bottom:40px}header>a{text-decoration:none;font-family:var(--pd-font-hud);font-size:12px}h1{font-size:clamp(34px,5vw,64px);font-weight:350;line-height:1.1;letter-spacing:var(--ls-display);margin:24px 0}h2{font-weight:500;font-size:28px;margin:40px 0 16px}h3{font-size:18px;font-weight:500;margin:0}p{max-width:760px;color:var(--pd-ivory-muted)}.eyebrow{font:11px var(--pd-font-hud);letter-spacing:.12em;color:var(--pd-signal)}nav{display:flex;flex-wrap:wrap;gap:16px;margin:24px 0}nav a{font:12px var(--pd-font-hud)}.entries{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--pd-line);border:1px solid var(--pd-line)}article{padding:24px;background:var(--pd-field)}.effect-title{display:flex;align-items:center;gap:16px}.effect-title svg{width:48px;height:48px;flex-shrink:0;color:var(--pd-ivory)}article p{font-size:14px;margin:16px 0}summary{cursor:pointer;color:var(--pd-ivory);font-size:14px;min-height:32px}dl{font-size:13px}dt{color:var(--pd-signal);font-family:var(--pd-font-hud);font-size:11px;margin-top:12px}dd{margin:4px 0;color:var(--pd-ivory-muted)}.refs{display:flex;gap:8px;margin-top:16px}.refs a{font:11px var(--pd-font-hud)}.try{display:inline-block;margin-top:16px;font:11px var(--pd-font-hud);text-decoration:none}li{margin-bottom:12px;color:var(--pd-ivory-muted)}.source-list{padding-left:0;list-style:none;font-size:13px}.source-list li{overflow-wrap:anywhere}.licence{white-space:pre-wrap;font:12px/1.7 var(--pd-font-hud);color:var(--pd-ivory-muted);border-top:1px solid var(--pd-line);padding-top:24px}footer{margin-top:48px;padding-block:24px;border-top:1px solid var(--pd-line);font-size:12px;color:var(--pd-ivory-muted)}@media(max-width:767px){body{padding:20px}.entries{grid-template-columns:1fr}article{padding:20px}}
`;
await mkdir(new URL("assets/", out), { recursive: true });
await writeFile(
  new URL("assets/docs.css", out),
  css + "\naudio{display:block;width:100%;max-width:640px}\n",
);

// Authored Mexico/LATAM Spanish. Rows: id | name | summary | geometry | motion | trail | naming.
// Keep research citations and proper source titles in their original language.
const spanishRows = `
peony|Peonía|Estrellas de colores sin estela: una esfera limpia y redonda.|Puntos distribuidos sobre una superficie esférica en expansión, no un disco plano.|Apertura rápida, desaceleración y una ligera caída conjunta.|Solo un destello breve, sin estelas persistentes.|Kiku/crisantemo y botan/peonía se distinguen por la estela; una estrella sin cola también puede caer.
chrysanthemum|Crisantemo|Una esfera completa de estelas finas y brillantes.|Estrellas dispuestas en una esfera; cada una deja un radio visible.|Apertura rápida y redonda, seguida de un descenso curvo y suave.|Estelas continuas de chispas que se apagan por separado; las cabezas siguen visibles.|Las estelas persistentes distinguen al crisantemo de la peonía, casi sin cola.
dahlia|Dalia|Menos estrellas, más brillantes: una flor amplia y abierta.|Puntos grandes y brillantes sin cola, separados por espacios claros.|Mayor alcance y puntos visibles durante más tiempo que en la peonía.|Sin estela persistente en este ajuste.|El tamaño, brillo y número son relativos, no cantidades ni velocidades absolutas.
diadem|Diadema|Un núcleo compacto y brillante dentro de una flor abierta.|Peonía exterior con un grupo interior compacto.|La esfera exterior se expande; el núcleo se mueve menos y se apaga antes.|La estela depende de la flor exterior; el núcleo conserva puntos definidos.|Distinción de núcleo compacto diseñada a partir de HEX; otros proveedores usan diadema como pistilo.
pistil|Pistilo|Una flor pequeña al centro de otra más grande.|Flor exterior con un núcleo esférico concéntrico más pequeño.|Ambas capas comienzan juntas; la interior alcanza un radio menor.|Cada capa puede tener su propia estela.|Es una variante de núcleo presentada como ajuste listo para usar, no una ley de partículas distinta.
double-pistil|Doble pistilo|Tres esferas anidadas se abren desde un mismo centro.|Una flor exterior y dos núcleos esféricos: tres capas visibles en total.|Apertura simultánea con un centro compartido y radios distintos.|Capas interiores sin cola para conservar los espacios; estela exterior opcional.|Nombre del ajuste en inglés para dos núcleos internos; no pretende ser una clasificación japonesa.
multi-pistil|Pistilo múltiple|Una flor exterior y tres núcleos forman cuatro esferas concéntricas.|Una esfera exterior y tres núcleos internos por defecto; un cuarto núcleo es opcional.|Expansión concéntrica con profundidad y tiempos de apagado similares.|Colas discretas para no fusionar los núcleos en una masa sólida.|Tres núcleos internos corresponden a sanjushin: no son tres esferas totales ni anillos planos.
willow|Sauce|Largas estelas doradas se curvan hacia abajo como una cortina.|Esfera amplia que se abre en una sombrilla de ramas finas y colgantes.|La apertura pronto cede a una curva descendente marcada y prolongada.|Chispas largas, finas y tenues de color ámbar o dorado.|Este es el sauce occidental; el yanagi japonés puede ser un grupo no esférico que cae suavemente.
brocade|Brocado|Una copa dorada, densa y brillante, con textura de tejido.|Sombrilla completa con hilos más densos que los del sauce.|Apertura redondeada que se convierte en arcos de caída lenta.|Textura dorada de destellos finos, más llena y brillante que nuestro sauce.|Brocado, corona, sauce y kamuro se superponen; la densidad relativa es una decisión visual propia.
kamuro|Kamuro|Una corona colgante de estelas doradas, largas y finas.|Copa grande y redondeada que se cierra en una cortina colgante.|Las cabezas duran mucho y descienden bastante después de expandirse.|Estelas densas y largas de ámbar a dorado plateado, con centelleo discreto.|En Japón suele aludir a nishiki-kamurogiku; kamuro y nishiki no son tipos universalmente separados.
nishiki|Nishiki|Una copa dorada, llena de destellos, que permanece en el cielo.|La misma forma de copa que kamuro, con una apariencia más llena y brillante diseñada aquí.|Caída larga, sin sustituirla por explosiones repetidas.|Estelas granulares de oro pálido y blanco, no una cortina sólida de neón.|Ajuste dentro de la familia kamuro; tono y densidad son decisiones propias, no una copia de un fabricante.
palm|Palmera|Pocas ramas gruesas se abren sobre un tronco ascendente.|Unas cuantas hojas anchas; un tronco ascendente opcional llega a la copa.|Salida enérgica y caída curva, con espacios visibles entre brazos.|Estelas gruesas y muy brillantes, distintas de los hilos del sauce.|APA describe seis hojas, pero no es una cantidad universal.
spider|Araña|Brazos rápidos y rectos se abren, frenan y caen.|Radios rectos, de densidad baja a moderada, con apertura rápida e irregular.|Movimiento veloz hacia afuera; se apagan antes de una caída pronunciada.|Trazos rectos y brillantes de corta duración, no hojas largas de palmera.|Trayectoria plana significa poca curvatura visible, no un disco obligatoriamente bidimensional.
horsetail|Cola de caballo|Un penacho compacto se dobla y cae en colas paralelas cercanas.|Penacho compacto hacia un lado, no una flor esférica completa.|El impulso ascendente se dobla pronto en una caída muy agrupada.|Colas largas y casi paralelas que permanecen juntas.|Los penachos más amplios suelen llamarse cascadas aéreas; son distintos de la cortina suspendida.
ring|Anillo|Un solo círculo de estrellas se expande en un plano.|Puntos sobre un círculo plano situado en el espacio 3D.|Expansión radial proporcional, seguida de una ligera caída y apagado.|Sin cola o con destellos muy breves; no una línea continua que una los puntos.|La vista frontal facilita la lectura; al girar el plano, se proyecta como una elipse.
saturn|Saturno|Una esfera brillante rodeada por un anillo inclinado.|Un anillo plano exterior rodea una flor esférica más pequeña.|El anillo y el centro se abren juntos con radios distintos.|Principalmente puntos limpios; textura de estela opcional en el núcleo.|La combinación anillo-pistilo está documentada en productos; proporciones y orientación 3D son propias.
heart|Corazón|Un corazón que se expande, dibujado con estrellas individuales.|Contorno plano de corazón en expansión, no una imagen rellena.|Conserva los lóbulos y la hendidura al abrirse; después permite la caída.|Puntos casi sin cola para proteger la silueta.|Familia reconocida de figuras; forma exacta y presentación frontal diseñadas aquí.
star|Estrella|Una figura de cinco puntas trazada con luz: una interpretación propia.|Contorno de estrella de cinco puntas en un plano 3D, con puntos en el perímetro.|Se expande el contorno completo; velocidades aleatorias borrarían las puntas.|Casi sin cola.|Motivo de cinco puntas diseñado aquí, no una reconstrucción de un espectáculo profesional concreto.
spiral|Espiral|Estrellas trazan una espiral en expansión, una variante propia.|Curva espiral plana formada por estrellas.|La curva aumenta de escala; no son torbellinos que giran por separado.|Puntos con colas mínimas o sin ellas.|Lidu documenta el nombre; la curva y el movimiento son propios, no copiados de una grabación.
smiley|Carita feliz|Un círculo, dos ojos y una sonrisa, mejor vistos de frente.|Círculo exterior con puntos separados para ojos y boca.|Expansión coordinada que conserva las proporciones antes de una ligera caída.|Sin cola por defecto.|La figura está documentada; orientarla hacia la cámara es una decisión de usabilidad.
strobe|Estroboscópico|Las estrellas parpadean por separado en toda la explosión.|Esfera de estrellas cuyo brillo cambia con el tiempo.|Las estrellas siguen su trayectoria durante la oscuridad; no se congelan ni reaparecen desde cero.|Estela mínima para distinguir los puntos encendidos y apagados.|HEX sugiere 1–2 Hz; la animación es propia. El modo de destellos reducidos debe suprimirlo, no prometer seguridad universal.
glitter|Centelleo|Pequeños destellos aparecen con retraso a lo largo de las estelas.|Flor con cola cuyas chispas destellan a distintas edades.|Las cabezas siguen arcos normales; las chispas quedan atrás y se apagan.|Destellos locales dispersos en una estela granular, no parpadeo de toda la cabeza.|Variante de estela presentada como ajuste; los nombres comerciales pueden confundirla con el estroboscópico.
crackle|Crepitar|La explosión termina en pequeñas ramas de luz y chasquidos.|Campo de chispas diminutas en expansión y microdestellos breves.|Siguen a las estrellas principales o forman grupos finales; su impulso local dura poco.|Chispas cortas y tupidas, sin ramas que brillen permanentemente.|Crackle, time rain y dragon eggs se superponen; no todas las variantes comparten el mismo ritmo.
ghost|Fantasma|Una ola de color recorre los sectores de una esfera en expansión.|Flor esférica limpia con un frente de color que avanza por sectores.|Las estrellas siguen expandiéndose mientras cambia su emisión.|Poca estela persistente para que el color anterior no oculte el frente.|Sweeper ghost es la descripción profesional más precisa; desaparecer y reaparecer es solo una posible variante.
color-change|Cambio de color|Las estrellas cambian de color durante el mismo vuelo.|Esfera de peonía con una transición de color coordinada.|Trayectorias continuas; el color avanza con la edad de cada estrella.|Sin cola por defecto; en otras bases, cabeza y estela pueden tener colores independientes.|Es una variante, no una forma nueva; colores simultáneos no equivalen a un cambio en el tiempo.
salute|Salva|Un destello blanco breve y un estruendo fuerte, con pocas estrellas.|Destello compacto y breve con muy pocas estrellas persistentes.|Se apaga rápidamente en una pequeña señal de humo tenue, no una gran flor de colores.|Sin estela por defecto; acentos plateados dispersos como variante opcional.|Acento centrado en el sonido. Las salvas reales varían; no se midieron presión sonora ni forma de onda.
crossette|Crossette|Cada estrella en movimiento se divide en cuatro brazos pequeños.|Cada estrella radial se divide en una cruz pequeña de cuatro brazos.|Primero viaja la estrella madre; las hijas heredan posición e impulso y luego se separan.|Estela media en la madre; estelas cortas y limpias en las hijas.|Lo que define el efecto es la subdivisión tardía visible, no una explosión inicial con forma de cruz.
falling-leaves|Hojas que caen|Puntos suaves descienden sin una apertura explosiva marcada.|Nube suelta de puntos de color persistentes o trazos diminutos.|Descenso lento por gravedad, con balanceo lateral suave y viento compartido.|Casi ninguna; cada hoja no debe volverse un cometa largo.|La deriva pasiva distingue este ajuste de peces y abejas activos; el aleteo es una decisión artística.
bees|Abejas|Pequeñas luces se impulsan y salen disparadas del centro.|Enjambre compacto de luces pequeñas e irregulares.|Giros y aceleraciones breves pero continuos, no saltos aleatorios en cada fotograma.|Trazos cortos amarillos o plateados; cada trayectoria se mantiene visible.|Los nombres occidentales se cruzan con peces y giradores; no todo producto llamado abejas garantiza un zumbido.
fish|Peces|Estrellas de corta vida nadan por curvas pequeñas.|Grupo suelto de luces que serpentean de forma independiente.|Recorridos más largos y suaves que nuestras abejas; movimiento activo, no caída pasiva.|Trazos mínimos y cortos, no cortinas como las del sauce.|La relación de tamaño entre abejas y peces depende del proveedor; escala y suavidad son distinciones propias.
tourbillon|Torbellino|Elementos giratorios sueltan chispas mientras recorren el aire.|Fuentes móviles que giran y dejan trazos curvos locales.|Deriva combinada con emisión giratoria y cambios irregulares de dirección.|Rocío corto en tirabuzón, no una figura espiral estática.|También se usan tourbillion, tourbillions y turbillion. Farfalle está relacionado, pero no requiere un botón aparte.
shell-of-shells|Carcasa de carcasas|Una carcasa libera una constelación de explosiones más pequeñas.|Dispersión inicial seguida de muchas flores pequeñas con centros separados.|Los centros hijos se alejan antes de expandirse en sus propias esferas.|Separación visible antes de las flores hijas; cada una tiene una estela compacta.|No es una serie de explosiones sobre una misma trayectoria; miles no es una cantidad literal obligatoria.
comet|Cometa|Una estrella asciende con una cola gruesa, sin explosión aérea.|Cabeza brillante ascendente con cola, sin explosión esférica final por defecto.|Asciende, desacelera y se apaga; arco ligero o inclinación como opciones propias.|Cola gruesa y continua de chispas que se apagan individualmente.|También puede acompañar el ascenso de otro efecto; el ajuste independiente no debe explotar automáticamente.
mine|Mina|Un abanico repentino de estrellas sale directamente del suelo.|Cono bajo y ancho de estrellas que surgen juntas del horizonte.|Expansión ascendente inmediata, desaceleración y caída; sin explosión madre a gran altura.|Trazos cortos y limpios, o textura elegida de centelleo o crepitar.|Nace en tierra y lanza luz al aire; no equivale a una flor aérea alta.
fan|Abanico|Una apertura coordinada de cometas inclinados cruza el cielo.|Disposición de varios emisores o explosiones en el espacio y el tiempo.|Trayectorias bajas o medias: apertura simultánea, barrido lateral, del centro hacia afuera o pares reflejados.|Hereda las estelas de sus efectos; no tiene una cola de partículas propia.|Es coreografía, no geometría de explosión. V, W y barridos en Z son variantes; la separación diseñada puede empezar en 0.10–0.25 s.
fountain|Fuente|Un rocío bajo y continuo de chispas con un siseo suave.|Emisión ascendente persistente desde un punto fijo del suelo.|Suben chispas nuevas mientras las anteriores describen arcos y caen.|Chispas granulares de duración media, más brillantes cerca de la salida.|Los nombres gerb y fuente varían; este ajuste representa una fuente en cascada, no un modelo de equipo.
waterfall|Cortina de cascada|Una línea suspendida deja caer una cortina de chispas.|Franja horizontal elevada y fija que produce chispas descendentes.|Caída continua por gravedad desde una línea quieta, con viento compartido moderado.|Hilos largos y finos de chispas; sin gran explosión aérea central.|Cascada puede nombrar estrellas aéreas o una cortina suspendida; aquí se usa la cortina descrita por Pyrostar y JPA.
roman-candle|Candela romana|Una secuencia de estrellas asciende desde un mismo punto.|Perlas o cometas individuales repetidos desde el mismo lugar.|Cada luz tiene su ascenso y apagado; una pequeña flor final tipo bombette es una variante opcional.|Heredada de perla o cometa, no una especie de estela nueva.|Intervalo diseñado de 0.6–1.0 s; es una secuencia de emisión, no una forma de explosión única.
wheel|Rueda|Una rueda fija gira y lanza chorros curvos de chispas.|Patrón circular giratorio de emisión con centro fijo.|Las chispas salen de una fuente giratoria y caen; el centro no se mueve.|Arcos cortos que muestran el giro sin llenar todo el disco de luz.|No confundir la rueda terrestre con una girándola voladora. La velocidad angular es diseñada, no medida.
set-piece|Figura fija|Un contorno inmóvil se enciende con puntos pequeños y constantes.|Puntos luminosos de colores trazan un símbolo, palabra o dibujo estático.|La luz permanece fija en el espacio, con un parpadeo independiente mínimo.|Poca o ninguna estela móvil.|El botón representa figuras de luces tipo lancework; el término general incluye otros efectos de suelo. Las letras son arte original de la app.
`
  .trim()
  .split("\n")
  .map((row) => row.split("|"));
const esEffects = Object.fromEntries(
  spanishRows.map(([id, ...values]) => [id, values]),
);
if (
  spanishRows.length !== EFFECTS.length ||
  EFFECTS.some((e) => esEffects[e.id]?.length !== 6)
)
  throw new Error("Incomplete Spanish field guide");
const esGroups = {
  blooms: "Flores",
  canopies: "Copas",
  shapes: "Figuras",
  textures: "Texturas",
  alive: "En movimiento",
  ground: "Desde el suelo",
};
const pair = (en, es) => `data-en="${escape(en)}" data-es-mx="${escape(es)}"`;
const t = (en, es) => {
  if (!en || !es) throw new Error("Missing bilingual text");
  return `<span ${pair(en, es)}>${escape(en)}</span>`;
};
const attr = (name, en, es) =>
  `${name}="${escape(en)}" data-language-attribute="${name}" ${pair(en, es)}`;
const p = (en, es) => `<p>${t(en, es)}</p>`;
const h2 = (en, es) => `<h2>${t(en, es)}</h2>`;
const link = (href, en, es, extra = "") =>
  `<a href="${href}" ${extra}>${t(en, es)}</a>`;
const audio = (file, en, es) =>
  `<audio controls preload="none" ${attr("aria-label", en, es)} src="./audio/${escape(file)}"></audio>`;
function shell(title, titleEs, description, descriptionEs, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#050A0F"><meta name="description" ${attr("content", description, descriptionEs)}><title ${pair(title + " — Afterlight", titleEs + " — Afterlight")}>${escape(title)} — Afterlight</title><link rel="stylesheet" href="./assets/docs.css"><link rel="icon" href="./assets/icon.svg" type="image/svg+xml"><script type="module" src="./docs-language.js"></script></head><body><div class="docs-language"><label for="docs-language">${t("Language", "Idioma")}</label><select id="docs-language" data-language-switch><option value="en" lang="en">English</option><option value="es-MX" lang="es-MX">Español (México / LATAM)</option></select></div>${body}<footer>${t("AFTERLIGHT · Original application, artwork and synthesized audio: MIT. Imported recordings: rights UNVERIFIED, not MIT. Fonts retain OFL terms.", "AFTERLIGHT · Aplicación, arte y audio sintetizado originales: MIT. Grabaciones importadas: derechos NO VERIFICADOS, no MIT. Las fuentes conservan sus términos OFL.")} ${link("./", "Back to the sky ↗", "Volver al cielo ↗")}</footer></body></html>`;
}
function header(eyebrow, eyebrowEs, title, titleEs, body = "") {
  return `<header><a href="./">← AFTERLIGHT</a><p class="eyebrow">${t(eyebrow, eyebrowEs)}</p><h1>${t(title, titleEs)}</h1>${body}</header>`;
}
const usedIds = new Set();
const content = GROUPS.map(
  (group) =>
    `<section id="${group.id}">${h2(group.name, esGroups[group.id])}<div class="entries">${EFFECTS.filter(
      (e) => e.group === group.id,
    )
      .map((effect) => {
        const r = research.catalog.find(
          (c) => c.id === (aliases[effect.id] || effect.id),
        );
        if (!r) throw new Error(`Missing research for ${effect.id}`);
        const [name, description, ...notes] = esEffects[effect.id];
        r.source_ids.forEach((id) => usedIds.add(id));
        const refs = r.source_ids
          .map(
            (id) =>
              `<a href="#source-${id}" ${attr("aria-label", `Source ${id}`, `Fuente ${id}`)}>[${id}]</a>`,
          )
          .join("");
        const labels = [
          ["GEOMETRY", "GEOMETRÍA"],
          ["MOTION", "MOVIMIENTO"],
          ["TRAIL", "ESTELA"],
          ["NAMING", "NOMBRES"],
        ];
        const original = [
          r.geometry,
          r.motion_and_fall,
          r.trail_rendering,
          r.uncertainty_and_aliases,
        ];
        return `<article id="${effect.id}"><div class="effect-title">${pictogram(effect.id)}<h3>${t(effect.name, name)}</h3></div>${p(effect.description, description)}<details><summary>${t("The shape of the effect", "La forma del efecto")}</summary><dl>${labels.map(([en, es], i) => `<dt>${t(en, es)}</dt><dd>${t(original[i], notes[i])}</dd>`).join("")}</dl></details><div class="refs">${refs}</div>${link(`./?effect=${effect.id}`, "TRY THIS EFFECT ↗", "PROBAR ESTE EFECTO ↗", 'class="try"')}</article>`;
      })
      .join("")}</div></section>`,
).join("");
const sources = [...usedIds]
  .sort((a, b) => a - b)
  .map((id) => {
    const s = sourceById[id];
    if (!s) throw new Error(`Missing source ${id}`);
    return `<li id="source-${id}"><a href="${escape(s.url)}" rel="noopener" target="_blank">[${id}] ${escape(s.title)}</a></li>`;
  })
  .join("");
const field = shell(
  "A small field guide",
  "Una pequeña guía de campo",
  "The shapes, trails and movement behind Afterlight’s fireworks.",
  "Las formas, estelas y movimientos de los fuegos artificiales de Afterlight.",
  header(
    "LOOK A LITTLE CLOSER",
    "MIRA UN POCO MÁS DE CERCA",
    "A small field guide to a very big sky.",
    "Una pequeña guía para un cielo inmenso.",
    p(
      `${EFFECTS.length} presets, grouped by what you see. Built from display-industry glossaries and Japanese makers’ descriptions; animation timings, colours and interface groupings are authored for Afterlight.`,
      `${EFFECTS.length} efectos agrupados por su apariencia. Basados en glosarios de pirotecnia y descripciones de fabricantes japoneses; los tiempos, colores y grupos de la interfaz se diseñaron para Afterlight.`,
    ) +
      p(
        "Some names overlap. Canopies such as kamuro and nishiki share a family; a fan is an arrangement, not a new kind of burst. Each preset’s notes keep those distinctions visible.",
        "Algunos nombres se superponen. Kamuro y nishiki comparten una familia; un abanico es una disposición, no una nueva explosión. Las notas de cada efecto conservan estas distinciones.",
      ) +
      `<nav ${attr("aria-label", "Effect families", "Familias de efectos")}>${GROUPS.map((g) => link("#" + g.id, g.name.toUpperCase(), esGroups[g.id].toUpperCase())).join("")}</nav>`,
  ) +
    content +
    `<section>${h2("Sources", "Fuentes")}${p("The links below support the visual vocabulary. A spiral and five-point star are authored pattern interpretations, not frame-matched reproductions of a specific show. Source titles remain in their original languages.", "Estos enlaces respaldan el vocabulario visual. La espiral y la estrella de cinco puntas son interpretaciones propias, no reproducciones cuadro por cuadro de un espectáculo. Los títulos de las fuentes conservan su idioma original.")}<ol class="source-list">${sources}</ol></section>`,
);
await writeFile(new URL("field-guide.html", out), field);

// Render public current examples during page generation; no evidence prerequisite.
const { renderCurrentAudio } = await import("./render-current-audio.mjs");
await renderCurrentAudio();
const audioPack = JSON.parse(
  await readFile(new URL("public/audio/manifest.json", root), "utf8"),
);
const signatures = {
  launch: ["Launch", "Lanzamiento"],
  burst: ["Burst", "Explosión"],
  crackle: ["Crackle", "Crepitar"],
  salute: ["Salute", "Salva"],
  comet: ["Comet", "Cometa"],
  sizzle: ["Sizzle", "Siseo"],
  fountain: ["Fountain", "Fuente"],
  whistle: ["Whistle", "Silbido"],
};
const audioCards = audioPack.samples
  .map((s) => {
    const names = signatures[s.signature];
    if (!names) throw new Error(`Missing audio translation: ${s.signature}`);
    return `<article><h3>${t(...names)}</h3>${audio(s.file, `Original ${names[0]} sample`, `Muestra original: ${names[1]}`)}<p>${link("./audio/" + s.file, `${s.duration}s · DOWNLOAD WAV ↗`, `${s.duration}s · DESCARGAR WAV ↗`, "download")}</p></article>`;
  })
  .join("");
const recordingCards = [
  [
    "lift1.mp3",
    "Launch / lift",
    "Lanzamiento / ascenso",
    "Used for launch events and Roman candle shots. Standalone comet events retain their synthesized comet sound.",
    "Se usa en los lanzamientos y disparos de candela romana. Los cometas independientes conservan su sonido sintetizado.",
  ],
  [
    "burst1.mp3",
    "Aerial burst",
    "Explosión aérea",
    "Used for ordinary burst events. Salute/maroon bursts route to the separate synthesized salute, not this recording.",
    "Se usa en las explosiones comunes. Las salvas y maroons usan una salva sintetizada aparte, no esta grabación.",
  ],
  [
    "crackle-sm-1.mp3",
    "Small crackle",
    "Crepitar pequeño",
    "The smallcrackle recording supplies crackle events: the Crackle effect’s delayed snaps, not every aerial burst.",
    "La grabación smallcrackle se usa en los eventos de crepitar: los chasquidos tardíos del efecto Crepitar, no en cada explosión aérea.",
  ],
]
  .map(
    ([file, en, es, desc, descEs]) =>
      `<article><h3>${t(en, es)}</h3>${p(desc, descEs)}${audio(file, en + " — current recording", es + " — grabación actual")}<p><code>${file}</code> · ${t("Rights UNVERIFIED · Not MIT", "Derechos NO VERIFICADOS · No MIT")}</p></article>`,
  )
  .join("");
const textureCards = [
  ["fountain", 6.5, 1701, "Fountain", "Fuente"],
  ["waterfall", 6, 1702, "Waterfall curtain", "Cortina de cascada"],
]
  .map(
    ([id, duration, seed, en, es]) =>
      `<article><h3>${t(en, es)}</h3>${p(`${duration}s finite, non-looping hiss · mono · 48 kHz · 16-bit PCM · seed ${seed}.`, `${duration}s de siseo finito, sin bucle · mono · 48 kHz · PCM de 16 bits · semilla ${seed}.`)}${audio(`current-${id}.wav`, en + " — current synthesized texture", es + " — textura sintetizada actual")}<p>${link(`./audio/current-${id}.wav`, "DOWNLOAD CURRENT WAV ↗", "DESCARGAR WAV ACTUAL ↗", "download")} · MIT</p></article>`,
  )
  .join("");
const soundPage = shell(
  "Sound library",
  "Biblioteca de sonidos",
  "Current simulator recordings and finite synthesized textures, with the separate original MIT sample pack.",
  "Grabaciones y texturas sintetizadas actuales del simulador, junto al paquete original MIT separado.",
  header(
    "THE OTHER HALF OF THE SKY",
    "LA OTRA MITAD DEL CIELO",
    "Let there be sound.",
    "Que suene el cielo.",
    p(
      "Listen to the current simulator sources first. The original v1 sample pack and its demonstration remain below, clearly separated. Press play on any sample; nothing plays automatically.",
      "Escucha primero las fuentes actuales del simulador. El paquete original v1 y su demostración siguen abajo, en secciones separadas. Presiona reproducir en cualquier muestra; nada suena automáticamente.",
    ),
  ) +
    `<section id="current-recordings">${h2("Current simulator · imported recordings", "Simulador actual · grabaciones importadas")}${p("These three self-hosted MP3s are included in this release. Recording ownership and audio-specific reuse/redistribution rights remain UNVERIFIED. They are NOT MIT and this page grants no recording rights.", "Estos tres MP3 alojados localmente se incluyen en esta versión. La titularidad y los permisos específicos de reutilización y redistribución siguen SIN VERIFICARSE. NO son MIT y esta página no otorga derechos sobre las grabaciones.")}<p>${link("./audio/NOTICE-recordings.txt", "Recording provenance and rights notes (original English)", "Procedencia y notas de derechos (original en inglés)")} · ${link("./audio/recordings.json", "Source metadata", "Metadatos de origen")}</p><div class="entries">${recordingCards}</div>${p("These are dry source previews. In the simulator, distance delay, filtering, stereo position, gain and playback-rate variation change what you hear. If a recording cannot load, the simulator uses its original synthesized fallback.", "Son muestras de las fuentes sin procesamiento espacial. En el simulador, el retardo por distancia, los filtros, la posición estéreo, la ganancia y la velocidad de reproducción cambian lo que escuchas. Si una grabación no carga, se usa la alternativa sintetizada original.")}</section>` +
    `<section id="current-textures">${h2("Current simulator · finite synthesized textures", "Simulador actual · texturas sintetizadas finitas")}${p("Fountain and waterfall use fresh finite noise from the current src/audio/sizzle.js synthesizeSizzle API, not the old repeating texture. These fixed-seed dry renders use the same implementation; the live simulator varies the seed per emitter and spatializes the result. They are examples, not recordings of a complete live show.", "La fuente y la cascada usan ruido nuevo y finito de la API actual synthesizeSizzle en src/audio/sizzle.js, no la antigua textura repetitiva. Estas muestras sin procesamiento espacial y con semilla fija usan la misma implementación; el simulador cambia la semilla por emisor y sitúa el sonido en el espacio. Son ejemplos, no grabaciones de un espectáculo completo.")}<div class="entries">${textureCards}</div>${p("Original synthesis and these WAV renders: MIT. Reproduce with node scripts/render-current-audio.mjs; no imported recordings are used.", "Síntesis original y estos archivos WAV: MIT. Se reproducen con node scripts/render-current-audio.mjs; no utilizan grabaciones importadas.")}</section>` +
    `<section id="original-library">${h2("Original v1 · MIT sample library", "Original v1 · biblioteca de muestras MIT")}${p("Eight original stereo sound signatures generated from the included synthesis code. This is the original pack, not a claim that every sample is the current simulator source. Salute, comet and other procedural routes remain distinct from the three imported recordings.", "Ocho sonidos originales estéreo generados con el código de síntesis incluido. Este es el paquete original; no significa que cada muestra sea la fuente actual del simulador. La salva, el cometa y otras rutas sintetizadas siguen separadas de las tres grabaciones importadas.")}<p>${link("./licenses/audio.txt", "Original audio licence and notes (English)", "Licencia y notas del audio original (inglés)")} · MIT</p><div class="entries">${audioCards}</div>${p("Stereo · 48 kHz · 16-bit PCM. These original v1 WAV files contain no third-party recordings and may be reused under MIT. The imported MP3 rights are separate and unresolved.", "Estéreo · 48 kHz · PCM de 16 bits. Estos WAV originales v1 no contienen grabaciones de terceros y pueden reutilizarse bajo MIT. Los derechos de los MP3 importados son independientes y siguen sin resolverse.")}</section>` +
    `<section id="original-demonstration">${h2("Original v1 demonstration · not the current sound mix", "Demostración original v1 · no es la mezcla actual")}${p(`An original ${audioPack.demonstration.duration}-second authored mix of the original synthesis pack, with distance delays and layered reports. It does not demonstrate the imported recordings or current finite fountain/waterfall textures.`, `Mezcla original de ${audioPack.demonstration.duration} segundos del paquete de síntesis original, con retardos por distancia y explosiones en capas. No demuestra las grabaciones importadas ni las texturas finitas actuales de fuente y cascada.`)}${audio("demonstration.wav", "Original v1 spatial fireworks demonstration", "Demostración espacial original v1 de fuegos artificiales")}<p>${link("./audio/demonstration.wav", "DOWNLOAD ORIGINAL DEMONSTRATION WAV ↗", "DESCARGAR DEMOSTRACIÓN ORIGINAL WAV ↗", "download")}</p></section>`,
);
await writeFile(new URL("sound-library.html", out), soundPage);
const licence = await readFile(new URL("LICENSE", root), "utf8");
const credits = shell(
  "Credits & licence",
  "Créditos y licencia",
  "Afterlight’s MIT licence, original audio and open-source credits.",
  "Licencia MIT, audio original y créditos de código abierto de Afterlight.",
  header(
    "BUILT TO BE PLAYED WITH",
    "HECHO PARA EXPERIMENTAR",
    "A free sky.",
    "Un cielo libre.",
    p(
      "Afterlight’s application code, original firework pictograms, procedural graphics and original synthesized audio are released under MIT. Fork it, change it, and make another kind of night. The imported recordings are excluded from this licence.",
      "El código, los pictogramas originales, los gráficos procedurales y el audio sintetizado original de Afterlight se publican bajo MIT. Crea una copia, modifícala y haz otra clase de noche. Las grabaciones importadas quedan fuera de esta licencia.",
    ),
  ) +
    h2("Made here", "Hecho aquí") +
    p(
      "The scene, fireworks, interface, pictograms and sound synthesis are original work. The interface draws on the ProDyn DSM’s typography, dark field and restrained cyan; the sky keeps the colours of its subject.",
      "La escena, los fuegos artificiales, la interfaz, los pictogramas y la síntesis sonora son trabajo original. La interfaz toma del DSM de ProDyn su tipografía, fondo oscuro y cian discreto; el cielo conserva sus propios colores.",
    ) +
    h2("Open-source foundations", "Bases de código abierto") +
    `<ul>${[
      [
        "https://threejs.org/",
        "Three.js",
        "3D renderer, MIT.",
        "Motor de renderizado 3D, MIT.",
        "Three-MIT.txt",
      ],
      [
        "https://phosphoricons.com/",
        "Phosphor Icons",
        "Utility symbols, MIT.",
        "Símbolos de interfaz, MIT.",
        "Phosphor-MIT.txt",
      ],
      [
        null,
        "Oxanium",
        "Display and body type, SIL OFL 1.1.",
        "Tipografía de títulos y texto, SIL OFL 1.1.",
        "Oxanium-OFL.txt",
      ],
      [
        null,
        "Departure Mono",
        "Control labels, SIL OFL 1.1.",
        "Etiquetas de controles, SIL OFL 1.1.",
        "Departure-Mono-OFL.txt",
      ],
    ]
      .map(
        ([url, name, en, es, file]) =>
          `<li>${url ? `<a href="${url}" rel="noopener">${name}</a>` : name} — ${t(en, es)} ${link("./licenses/" + file, "Licence (original English)", "Licencia (original en inglés)")}</li>`,
      )
      .join(
        "",
      )}<li>${t("Original synthesized fireworks audio — generated from the included source, MIT.", "Audio sintetizado original de fuegos artificiales: generado con el código incluido, MIT.")} ${link("./licenses/audio.txt", "Audio notes (English)", "Notas de audio (inglés)")}</li></ul>` +
    h2(
      "Research and recording rights",
      "Investigación y derechos de las grabaciones",
    ) +
    `<p>${t("Read the field guide for effect descriptions and references. Research photographs are not bundled.", "Consulta la guía de campo para ver las descripciones y referencias. No se incluyen fotografías de investigación.")} ${link("./field-guide.html", "Firework field guide", "Guía de fuegos artificiales")}</p>` +
    p(
      "The app includes three separately sourced recordings: lift1.mp3, burst1.mp3 and crackle-sm-1.mp3. Recording ownership and reuse/redistribution permission remain UNVERIFIED. They are not MIT. Inclusion grants no recording rights; engine credit is not recording-author attribution.",
      "La app incluye tres grabaciones de origen independiente: lift1.mp3, burst1.mp3 y crackle-sm-1.mp3. La titularidad y los permisos de reutilización y redistribución siguen SIN VERIFICARSE. No son MIT. Su inclusión no otorga derechos; el crédito del motor no identifica al autor de las grabaciones.",
    ) +
    `<p>${link("./audio/NOTICE-recordings.txt", "Recording notes (original English)", "Notas de las grabaciones (original en inglés)")} · ${link("./sound-library.html", "Current and original sound library", "Biblioteca de sonidos actuales y originales")}</p>` +
    p(
      "Third-party quotations and source titles retain their original language, attribution and owners’ rights.",
      "Las citas de terceros y los títulos de las fuentes conservan su idioma original, atribución y derechos de sus titulares.",
    ) +
    h2("Your show stays yours", "Tu espectáculo sigue siendo tuyo") +
    p(
      "No account, tracking or analytics. Finales are saved in this browser. Exporting downloads a local file. Sharing places the finale in a link’s fragment; the app does not upload it to a server.",
      "Sin cuenta, rastreo ni analítica. Los finales se guardan en este navegador. Exportar descarga un archivo local. Compartir coloca el final en el fragmento de un enlace; la app no lo sube a un servidor.",
    ) +
    h2("MIT licence", "Licencia MIT") +
    p(
      "The original English legal text follows unchanged. It covers the original work, not the imported recordings or separately licensed fonts.",
      "El texto legal original en inglés aparece a continuación sin cambios. Cubre el trabajo original, no las grabaciones importadas ni las fuentes con licencia independiente.",
    ) +
    `<pre class="licence" lang="en">${escape(licence)}</pre>`,
);
await writeFile(new URL("credits.html", out), credits);
await writeFile(
  new URL("assets/docs.css", out),
  css +
    `\naudio{display:block;width:100%;min-width:0;max-width:640px}article{min-width:0}code{overflow-wrap:anywhere}.docs-language{display:flex;align-items:center;flex-wrap:wrap;gap:var(--sp-3);margin-bottom:var(--sp-6);font:var(--fs-meta) var(--pd-font-hud)}.docs-language select{font:inherit;color:var(--pd-ivory);background:var(--pd-field);border:1px solid var(--pd-line);border-radius:var(--r-0);padding:var(--sp-3);max-width:100%;min-height:44px}.docs-language select:focus-visible{outline:2px solid var(--pd-signal);outline-offset:4px}a{overflow-wrap:anywhere}\n`,
);
console.log(
  `Generated bilingual field guide: ${EFFECTS.length} effects, ${usedIds.size} sources; current/original sound library and credits.`,
);
