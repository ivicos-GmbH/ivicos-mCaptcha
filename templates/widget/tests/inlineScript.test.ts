// SPDX-License-Identifier: MIT OR Apache-2.0

// Runs the inline <script> of templates/widget/index.html against the
// elements it looks for, and checks the texts it sets.

import { readFileSync } from "fs";
import { join } from "path";

const html = readFileSync(join(__dirname, "../index.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];

const setUp = () => {
  document.body.innerHTML = `
    <span id="widget__verification-text">I'm not a robot.</span>
    <a class="widget__mcaptcha-info-link" href="https://mcaptcha.org/privacy-policy">Privacy</a>
    <a class="widget__mcaptcha-info-link" href="https://mcaptcha.org/security">Terms</a>
  `;
};

const run = (query: string) => {
  window.history.replaceState({}, "", `/widget/?sitekey=imbatman${query}`);
  setUp();
  new Function(scripts[0][1])();
  const [privacy, terms] = Array.from(
    document.querySelectorAll(".widget__mcaptcha-info-link")
  );
  return {
    BEFORE: document.getElementById("widget__verification-text").textContent,
    PRIVACY: privacy.textContent,
    TERMS: terms.textContent,
  };
};

const setBrowserLanguage = (language: string) => {
  jest.spyOn(window.navigator, "language", "get").mockReturnValue(language);
};

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = "";
});

it("index.html has exactly one inline script", () => {
  expect(scripts).toHaveLength(1);
});

it("?lang=fr shows French BEFORE, Privacy and Terms", () => {
  setBrowserLanguage("en-US");
  expect(run("&lang=fr")).toEqual({
    BEFORE: "Je ne suis pas un robot.",
    PRIVACY: "Confidentialité",
    TERMS: "Conditions d’utilisation",
  });
});

it("a French browser with no ?lang= gets French", () => {
  setBrowserLanguage("fr-FR");
  expect(run("").PRIVACY).toBe("Confidentialité");
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
