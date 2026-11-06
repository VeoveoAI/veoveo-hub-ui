// A gallery of what a server lists, with a picture of each and a closer look. It knows nothing of
// what it shows: a server's adapter says how to list items, get a picture and open one. Every name
// here is a stranger's text, so it only ever reaches the page as text.
//
//   veoveoGallery((ui) => ({
//     title, aspect, placeholder, remoteSearch, refresh,
//     list: async ({ at, search, cursor }) => ({ items, next, trail, empty }),
//     thumbnail: async (item, size) => ({ mediaType, data }),
//     thumbnails: async (items, size) => [{ mediaType, data, pending }], // what is ready, by one request
//     open: (item) => url,
//     enter: (item) => at,            // for an item with `folder`
//     covers: async (items) => [[items]], // for items with `folder`: whose pictures show on each card
//   }));
//
// An item is { key, name, kind, about, detail, badge, group, folder, disabled }.
const veoveoGallery = (configure) => {
  const PICTURE_TIMEOUT = 240000;
  const AT_ONCE = 6;
  // What the cards coming on screen ask for gathers this long, so a screenful is one request of
  // at most this many.
  const GATHER_MS = 30;
  const TOGETHER = 24;
  const $ = (id) => document.getElementById(id);

  const ICONS = {
    repository: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H19v-5"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.5h7.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-8 9"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    audio: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    document: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    model: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    scene: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    other: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  };
  const icon = (kind) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind] || ICONS.other}</svg>`;
  const LABELS = { image: "Image", video: "Video", audio: "Audio", document: "Document", model: "3D", scene: "USD", other: "File" };
  const FILTERS = [["all", "All"], ["image", "Images"], ["video", "Video"], ["model", "3D"], ["document", "Documents"], ["audio", "Audio"], ["other", "Other"]];
  const filterOf = (item) => (item.kind === "scene" ? "model" : item.kind);

  const size = (bytes) => {
    if (typeof bytes !== "number") return "";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
  };
  const extensionOf = (name) => {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  };
  /** What a file holds, by its name, then by its media type. */
  const kindOf = (name, mediaType = "") => {
    const extension = extensionOf(name);
    if (["usd", "usda", "usdc", "usdz"].includes(extension)) return "scene";
    if (["glb", "gltf", "fbx", "obj", "stl", "ply", "dae", "3ds", "off", "step", "stp", "iges", "igs", "brep", "3mf", "dxf", "dwg", "abc", "wrl", "vrml", "ifc", "drc", "pts"].includes(extension)) return "model";
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "avif", "ico", "psd", "svg", "tga", "exr", "hdr", "jp2"].includes(extension)) return "image";
    if (["mp4", "m4v", "mov", "mkv", "webm", "avi", "wmv", "flv", "mpg", "mpeg", "ogv", "3gp"].includes(extension)) return "video";
    if (["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "opus", "wma", "aiff"].includes(extension)) return "audio";
    if (["pdf", "doc", "docx", "odt", "rtf", "xls", "xlsx", "ods", "csv", "tsv", "ppt", "pptx", "odp", "md", "markdown", "txt", "log", "html", "htm", "xhtml", "json", "yaml", "yml", "toml", "xml", "rs", "py", "js", "ts", "tsx", "jsx", "c", "h", "cpp", "hpp", "go", "java", "sh", "css", "sql"].includes(extension)) return "document";
    if (mediaType.startsWith("image/")) return "image";
    if (mediaType.startsWith("video/")) return "video";
    if (mediaType.startsWith("audio/")) return "audio";
    if (mediaType.startsWith("model/")) return "model";
    if (mediaType.startsWith("text/") || mediaType === "application/pdf") return "document";
    return "other";
  };

  const ui = { tool: veoveoApp.tool, read: veoveoApp.read, size, kindOf, extensionOf, labelOf: (kind) => LABELS[kind] || "File", PICTURE_TIMEOUT };
  const config = configure(ui);
  if (config.aspect) document.documentElement.style.setProperty("--aspect", config.aspect);
  if (config.placeholder) {
    $("search").placeholder = config.placeholder;
    $("search").setAttribute("aria-label", config.placeholder);
  }
  $("refresh").hidden = !config.refresh;

  // What is showing.
  let at = null;
  let items = [];
  let trail = [];
  let emptyText = "";
  let cursor = null;
  let shown = [];
  let filter = "all";
  let rows = false;
  let generation = 0;

  // Pictures: only for what is on screen, at most AT_ONCE at a time, the newest asked first.
  const pictures = new Map();
  const waiting = [];
  let running = 0;
  const pump = () => {
    while (running < AT_ONCE && waiting.length) {
      const job = waiting.pop();
      if (job.generation !== generation) continue;
      running += 1;
      job.run().catch(() => {}).finally(() => { running -= 1; pump(); });
    }
  };
  const inTurn = (run) => { waiting.push({ generation, run }); pump(); };
  const pictureUrl = (answer) => (answer && answer.data && /^image\//.test(answer.mediaType || "") ? `data:${answer.mediaType};base64,${answer.data}` : null);
  const picture = async (item, wanted = "small") => {
    const key = `${wanted}\0${item.key}`;
    if (pictures.has(key)) return pictures.get(key);
    const url = pictureUrl(await config.thumbnail(item, wanted));
    pictures.set(key, url);
    return url;
  };
  const gathering = (send) => {
    let asked = [];
    let timer = null;
    const flush = () => {
      timer = null;
      const current = asked.filter((job) => job.generation === generation);
      asked = [];
      for (let first = 0; first < current.length; first += TOGETHER) send(current.slice(first, first + TOGETHER));
    };
    return (job) => {
      asked.push({ ...job, generation });
      timer ??= setTimeout(flush, GATHER_MS);
    };
  };
  const drawnAlone = (item, done) => inTurn(() => picture(item).then(done, () => done(null)));
  // One request answers what is ready. A picture still to be drawn takes its own turn, so a slow
  // draw never holds up a screen.
  const askReady = gathering((jobs) => inTurn(async () => {
    const answers = await config.thumbnails(jobs.map((job) => job.item), "small").catch(() => []);
    jobs.forEach(({ item, done }, index) => {
      const answer = answers[index];
      if (!answer || answer.pending) {
        drawnAlone(item, done);
        return;
      }
      const url = pictureUrl(answer);
      pictures.set(`small\0${item.key}`, url);
      done(url);
    });
  }));
  const smallPicture = (item) => new Promise((done) => {
    const known = pictures.get(`small\0${item.key}`);
    if (known !== undefined) done(known);
    else if (config.thumbnails) askReady({ item, done });
    else drawnAlone(item, done);
  });
  const watcher = new IntersectionObserver((seen) => {
    for (const { isIntersecting, target } of seen) {
      if (!isIntersecting) continue;
      watcher.unobserve(target);
      target._onScreen?.();
    }
  }, { rootMargin: "240px" });
  const place = (holder, url) => {
    const image = new Image();
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("load", () => image.classList.add("ready"), { once: true });
    image.src = url;
    holder.append(image);
  };

  const fillPicture = async (thumb, item) => {
    thumb.classList.add("drawing");
    const url = await smallPicture(item);
    if (url) {
      place(thumb, url);
      thumb.classList.add("has-picture");
    }
    thumb.classList.remove("drawing");
  };
  // A card's cover is what the server says shows it, by one request for the screen. Its pictures
  // are asked for after that request's turn ends: a turn that waited for them would hold the place
  // they need.
  const showCover = async (thumb, inside) => {
    const found = (await Promise.all(inside.slice(0, 4).map(smallPicture))).filter(Boolean);
    if (!found.length) return;
    const mosaic = document.createElement("div");
    mosaic.className = "mosaic";
    mosaic.dataset.count = String(found.length);
    for (const url of found) {
      const cell = document.createElement("span");
      place(cell, url);
      mosaic.append(cell);
    }
    thumb.append(mosaic);
    thumb.classList.add("has-picture");
  };
  const askCover = gathering((jobs) => inTurn(async () => {
    const answers = await config.covers(jobs.map((job) => job.item)).catch(() => []);
    jobs.forEach(({ thumb }, index) => { showCover(thumb, answers[index] || []); });
  }));

  const card = (item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.kind = item.kind;
    button.disabled = Boolean(item.disabled);
    const thumb = document.createElement("span");
    thumb.className = "thumb";
    thumb.innerHTML = icon(item.kind);
    const badge = item.badge ?? (item.folder ? "" : extensionOf(item.name).toUpperCase());
    if (badge) {
      const mark = document.createElement("span");
      mark.className = "badge";
      mark.textContent = badge;
      thumb.append(mark);
    }
    const title = document.createElement("span");
    title.className = "name";
    title.textContent = item.name;
    title.title = item.name;
    const facts = document.createElement("span");
    facts.className = "about";
    facts.textContent = item.about || " ";
    button.append(thumb, title, facts);
    if (item.disabled) return button;
    if (item.folder) {
      button.addEventListener("click", () => go(config.enter(item)));
      if (config.covers) {
        button._onScreen = () => askCover({ item, thumb });
        watcher.observe(button);
      }
    } else {
      button.addEventListener("click", () => look(index));
      button._onScreen = () => fillPicture(thumb, item);
      watcher.observe(button);
    }
    return button;
  };

  const showNote = (text) => { $("note").textContent = text; $("note").hidden = !text; };
  const showProblem = (text) => { $("problem-text").textContent = text; $("problem").hidden = !text; };

  const drawCrumbs = () => {
    const holder = $("crumbs");
    holder.replaceChildren();
    const steps = trail.length ? trail : [{ label: config.title }];
    steps.forEach((step, index) => {
      if (index) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "/";
        holder.append(sep);
      }
      if (index < steps.length - 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = step.label;
        button.title = step.label;
        button.addEventListener("click", () => go(step.at));
        holder.append(button);
      } else {
        const here = document.createElement("span");
        here.className = "here";
        here.textContent = step.label;
        here.setAttribute("aria-current", "location");
        holder.append(here);
      }
    });
  };

  const drawChips = () => {
    const holder = $("chips");
    holder.replaceChildren();
    const present = new Set(items.filter((item) => !item.folder && !item.disabled).map(filterOf));
    const offered = FILTERS.filter(([key]) => key === "all" || present.has(key));
    holder.hidden = offered.length < 3;
    if (!offered.some(([key]) => key === filter)) filter = "all";
    for (const [key, label] of offered) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-pressed", String(key === filter));
      button.addEventListener("click", () => { filter = key; drawChips(); draw(); });
      holder.append(button);
    }
  };

  const grid = () => {
    const holder = document.createElement("div");
    holder.className = rows ? "grid rows" : "grid";
    return holder;
  };

  const draw = () => {
    generation += 1;
    const wanted = config.remoteSearch ? "" : $("search").value.trim().toLowerCase();
    const named = (item) => !wanted || item.name.toLowerCase().includes(wanted);
    const visible = items.filter((item) => named(item) && (filter === "all" || (!item.folder && !item.disabled && filterOf(item) === filter)));
    // Folders first, as a listing has them, and only files take a closer look.
    shown = visible.filter((item) => !item.folder && !item.disabled);
    const holder = $("groups");
    holder.replaceChildren();
    const groups = new Map();
    for (const item of visible) {
      const name = item.group || "";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(item);
    }
    for (const [name, inGroup] of groups) {
      const cards = grid();
      cards.append(...inGroup.map((item) => card(item, shown.indexOf(item))));
      if (!name) {
        holder.append(cards);
        continue;
      }
      const section = document.createElement("section");
      section.className = "group";
      const title = document.createElement("h2");
      title.textContent = name;
      section.append(title, cards);
      holder.append(section);
    }
    if (visible.length) showNote("");
    else showNote(items.length ? "Nothing here matches." : emptyText || "Nothing here yet.");
  };

  const skeleton = () => {
    const cards = grid();
    for (let index = 0; index < 8; index += 1) {
      const piece = document.createElement("div");
      piece.className = "card skeleton";
      piece.innerHTML = '<span class="thumb"></span><span class="line"></span>';
      cards.append(piece);
    }
    $("groups").replaceChildren(cards);
  };

  const load = async (fresh) => {
    if (fresh) {
      cursor = null;
      skeleton();
    }
    showProblem("");
    showNote("");
    const mine = ++generation;
    try {
      const search = config.remoteSearch ? $("search").value.trim() : "";
      const page = await config.list({ at, search, cursor });
      if (mine !== generation) return;
      items = fresh ? page.items : [...items, ...page.items];
      trail = page.trail || [];
      emptyText = page.empty || "";
      cursor = page.next || null;
      $("more").hidden = !cursor;
      drawCrumbs();
      drawChips();
      draw();
    } catch (error) {
      if (mine !== generation) return;
      $("groups").replaceChildren();
      if (fresh) items = [];
      showProblem(`This could not be read: ${error.message}`);
    }
  };

  const go = (target) => {
    at = target;
    filter = "all";
    $("search").value = "";
    $("chips").hidden = true;
    return load(true);
  };

  // A closer look.
  let looking = -1;
  let lookTurn = 0;
  const look = async (index) => {
    const item = shown[index];
    if (!item) return;
    looking = index;
    const turn = ++lookTurn;
    $("look-title").textContent = item.name;
    $("look-detail").textContent = item.detail || item.about || "";
    $("previous").disabled = index === 0;
    $("next").disabled = index === shown.length - 1;
    const image = $("stage-image");
    const small = pictures.get(`small\0${item.key}`);
    image.hidden = !small;
    if (small) image.src = small;
    $("stage-icon").innerHTML = small ? "" : icon(item.kind);
    $("stage-say").hidden = true;
    $("stage").classList.add("drawing");
    if (!$("look").open) $("look").showModal();
    try {
      const url = await picture(item, "large");
      if (turn !== lookTurn) return;
      if (url) {
        image.src = url;
        image.hidden = false;
        $("stage-icon").innerHTML = "";
      } else if (!small) {
        $("stage-say").textContent = "There is no picture of this. Open it to see it.";
        $("stage-say").hidden = false;
      }
    } catch (error) {
      if (turn !== lookTurn) return;
      $("stage-say").textContent = `The picture could not be read: ${error.message}`;
      $("stage-say").hidden = false;
    } finally {
      if (turn === lookTurn) $("stage").classList.remove("drawing");
    }
  };
  const openLooked = async () => {
    const item = shown[looking];
    if (!item) return;
    try {
      await veoveoApp.openLink(config.open(item));
    } catch (error) {
      $("stage-say").textContent = `This could not be opened: ${error.message}`;
      $("stage-say").hidden = false;
    }
  };

  // The controls.
  let typing;
  $("search").addEventListener("input", () => {
    if (config.remoteSearch) {
      clearTimeout(typing);
      typing = setTimeout(() => load(true), 250);
    } else {
      drawChips();
      draw();
    }
  });
  $("again").addEventListener("click", () => load(true));
  $("refresh").addEventListener("click", () => load(true));
  $("more").addEventListener("click", () => load(false));
  $("close").addEventListener("click", () => $("look").close());
  $("open").addEventListener("click", openLooked);
  $("previous").addEventListener("click", () => look(looking - 1));
  $("next").addEventListener("click", () => look(looking + 1));
  $("look").addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" && looking > 0) look(looking - 1);
    if (event.key === "ArrowRight" && looking < shown.length - 1) look(looking + 1);
  });
  $("look").addEventListener("click", (event) => { if (event.target === $("look")) $("look").close(); });
  const showAs = (asRows) => {
    rows = asRows;
    document.querySelectorAll("#groups .grid").forEach((cards) => cards.classList.toggle("rows", rows));
    $("as-rows").setAttribute("aria-pressed", String(rows));
    $("as-grid").setAttribute("aria-pressed", String(!rows));
  };
  $("as-grid").addEventListener("click", () => showAs(false));
  $("as-rows").addEventListener("click", () => showAs(true));

  (async () => {
    drawCrumbs();
    try {
      await veoveoApp.connect(config.title);
    } catch (error) {
      showProblem(`This could not connect to its host: ${error.message}`);
      return;
    }
    await load(true);
  })();
};
