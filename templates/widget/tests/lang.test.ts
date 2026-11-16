// SPDX-License-Identifier: MIT OR Apache-2.0

// const.ts picks its language once, when the module loads. Each test sets the
// URL and the browser language first, then loads a fresh copy of the module.

const EN = {
  BEFORE: "I'm not a robot.",
  DURING: "Processing...",
  AFTER: "Verified!",
  ERROR: "Something went wrong",
};

const DE = {
  BEFORE: "Ich bin kein Roboter.",
  DURING: "Verarbeitung...",
  AFTER: "Verifiziert!",
  ERROR: "Etwas ist schief gelaufen",
};

const FR = {
  BEFORE: "Je ne suis pas un\u00a0robot.",
  DURING: "Traitement en\u00a0cours...",
  AFTER: "Vérifié\u00a0!",
  ERROR: "Une erreur s’est\u00a0produite",
};

const setUrl = (query: string) => {
  window.history.replaceState({}, "", `/widget/?sitekey=imbatman${query}`);
};

const setBrowserLanguage = (language: string) => {
  jest.spyOn(window.navigator, "language", "get").mockReturnValue(language);
};

const loadConst = async () => {
  jest.resetModules();
  return await import("../const");
};

const texts = (CONST: typeof import("../const")) => ({
  BEFORE: CONST.BEFORE,
  DURING: CONST.DURING,
  AFTER: CONST.AFTER,
  ERROR: CONST.ERROR,
});

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = "";
  setUrl("");
});

it("?lang=fr shows the French texts", async () => {
  setUrl("&lang=fr");
  setBrowserLanguage("en-US");
  const CONST = await loadConst();
  expect(texts(CONST)).toEqual(FR);

  const msg = document.createElement("span");
  msg.id = "widget__verification-text";
  const checkbox = document.createElement("input");
  checkbox.id = CONST.btnId;
  document.body.append(msg, checkbox);

  // jsdom implements neither innerText nor ariaValueText: both are plain
  // properties here, so these checks show which value showMsg() wrote to
  // which element, not what a browser renders (that was checked in Chrome).
  // ariaValueText is on the checkbox, a second element showMsg() must update.
  const show = CONST.messageText();
  const states: [() => void, string][] = [
    [show.before, FR.BEFORE],
    [show.during, FR.DURING],
    [show.after, FR.AFTER],
    [show.error, FR.ERROR],
  ];
  expect(checkbox.ariaValueText).toBeUndefined();
  for (const [showState, text] of states) {
    showState();
    expect(msg.innerText).toBe(text);
    expect(checkbox.ariaValueText).toBe(text);
  }
});

it("a French browser with no ?lang= gets French", async () => {
  setUrl("");
  setBrowserLanguage("fr-FR");
  expect(texts(await loadConst())).toEqual(FR);

  setBrowserLanguage("fr-CA");
  expect(texts(await loadConst())).toEqual(FR);
});

it("?lang= wins over the browser", async () => {
  setUrl("&lang=de");
  setBrowserLanguage("fr-FR");
  expect(texts(await loadConst())).toEqual(DE);

  setUrl("&lang=fr");
  setBrowserLanguage("de-DE");
  expect(texts(await loadConst())).toEqual(FR);
});

it("?lang=en and ?lang=de are unchanged", async () => {
  setBrowserLanguage("fr-FR");

  setUrl("&lang=en");
  expect(texts(await loadConst())).toEqual(EN);

  setUrl("&lang=de");
  expect(texts(await loadConst())).toEqual(DE);
});

it("an unknown ?lang= still falls back to English", async () => {
  setUrl("&lang=it");
  setBrowserLanguage("fr-FR");
  expect(texts(await loadConst())).toEqual(EN);
});
