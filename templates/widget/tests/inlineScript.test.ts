// SPDX-License-Identifier: MIT OR Apache-2.0

// Runs the inline <script> of templates/widget/index.html against the real
// <form> markup of that template, and checks the texts it sets.

import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../..");
const html = readFileSync(join(__dirname, "../index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];

// The template builds the link hrefs from Rust values:
// crate::PKG_HOMEPAGE (Cargo.toml `homepage`) and crate::PAGES.<name>
// (src/pages/routes.rs `Routes::new`). Read them from those files so the test
// breaks if a path stops matching the script's selectors.
const homepage = readFileSync(join(root, "Cargo.toml"), "utf8").match(
  /^homepage\s*=\s*"([^"]*)"/m
)[1];
const pages: Record<string, string> = Object.fromEntries(
  [
    ...readFileSync(join(root, "src/pages/routes.rs"), "utf8").matchAll(
      /^\s+(\w+): "([^"]*)",$/gm
    ),
  ].map((m) => [m[1], m[2]])
);

const resolveTemplate = (markup: string) =>
  markup
    .replace(/<\.=\s*crate::PKG_HOMEPAGE\s*\.>/g, homepage)
    .replace(/<\.=\s*crate::PAGES\.(\w+)\s*\.>/g, (_, name: string) => {
      if (!(name in pages)) throw new Error(`PAGES.${name} not in routes.rs`);
      return pages[name];
    });

const form = resolveTemplate(html.match(/<form[\s\S]*?<\/form>/)[0]);

const setUp = () => {
  document.body.innerHTML = form;
};

const links = () =>
  Array.from(
    document.querySelectorAll<HTMLAnchorElement>(".widget__mcaptcha-info-link")
  );

const run = (query: string) => {
  window.history.replaceState({}, "", `/widget/?sitekey=imbatman${query}`);
  setUp();
  new Function(scripts[0][1])();
  const [privacy, terms] = links();
  return {
    BEFORE: document.getElementById("widget__verification-text").textContent,
    PRIVACY: privacy.textContent,
    TERMS: terms.textContent,
  };
};

const setBrowserLanguage = (language: string) => {
  jest.spyOn(window.navigator, "language", "get").mockReturnValue(language);
};

const FR = {
  BEFORE: "Je ne suis pas un robot.",
  PRIVACY: "Confidentialité",
  TERMS: "Conditions d’utilisation",
};

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = "";
});

it("index.html has exactly one inline script", () => {
  expect(scripts).toHaveLength(1);
});

it("the script's link selectors find the real Privacy and Terms links", () => {
  expect(pages.privacy).toBeDefined();
  expect(pages.security).toBeDefined();
  setUp();
  const [privacy, terms] = links();
  expect(links()).toHaveLength(2);
  expect(privacy.getAttribute("href")).toBe(homepage + pages.privacy);
  expect(terms.getAttribute("href")).toBe(homepage + pages.security);

  // the selectors the script uses, taken from the script itself, must each
  // find their link (the script skips a link it can't find, silently)
  const selectors = [
    ...scripts[0][1].matchAll(/querySelector\('([^']*info-link[^']*)'\)/g),
  ].map((m) => m[1]);
  expect(selectors).toHaveLength(2);
  const [foundPrivacy, foundTerms] = selectors.map((s) =>
    document.querySelector(s)
  );
  expect(foundPrivacy).toBe(privacy);
  expect(foundTerms).toBe(terms);
});

it("?lang=fr shows French BEFORE, Privacy and Terms", () => {
  setBrowserLanguage("en-US");
  expect(run("&lang=fr")).toEqual(FR);
});

it("a French browser with no ?lang= gets French", () => {
  setBrowserLanguage("fr-FR");
  expect(run("")).toEqual(FR);
});

it("?lang=en and ?lang=de are unchanged, and unknown falls back to English", () => {
  setBrowserLanguage("fr-FR");
  const en = {
    BEFORE: "I'm not a robot.",
    PRIVACY: "Privacy",
    TERMS: "Terms",
  };
  expect(run("&lang=en")).toEqual(en);
  expect(run("&lang=de")).toEqual({
    BEFORE: "Ich bin kein Roboter.",
    PRIVACY: "Datenschutz",
    TERMS: "Nutzungsbedingungen",
  });
  expect(run("&lang=it")).toEqual(en);
});
