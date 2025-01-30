import { Readability } from "@mozilla/readability";
import Alpine from "alpinejs";
import DOMPurify from "dompurify";

document.addEventListener("alpine:init", () => {
  Alpine.data("content", () => ({
    text: "",
    source: "",
    title: "",
    date: "",

    async getContent() {
      const article = await getText(
        sanitizeURL(this.source),
      );
      this.text = article.content
        ? DOMPurify.sanitize(article.content)
        : "Failed to extract content.";
      this.title = article.title ? article.title : "Article";
      const dateString = new Date(article.publishedTime);
      const options = { year: "numeric", month: "long", day: "2-digit" };
      this.date = dateString.toLocaleDateString("en-US", options);
    },
  }));

  Alpine.data("theme", () => ({
    theme: localStorage.getItem("theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"),
    buttonText: "",

    init() {
      this.applyTheme(this.theme);
    },

    applyTheme(newTheme) {
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
      this.theme = newTheme;
      this.buttonText = this.theme === "dark" ? "☀️" : "🌙";
    },

    toggleTheme() {
      this.applyTheme(this.theme === "dark" ? "light" : "dark");
    },
  }));
});

window.Alpine = Alpine;
Alpine.start();
window.getText = getText;

/*
 * Sanitize the URL for any possible XSS, so
 * an attacker can't provide a dangerous link.
 */
function sanitizeURL(url) {
  // Remove possible HTML and dangerous symbols
  url = url.replace(/<[^>]*>/g, "");
  url = url.replace(/[<>\'";()]/g, "");

  // Use HTTPS
  if (url.startsWith("http://")) {
    url = "https://" + url.slice(7);
  }
  if (!url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    let out = new URL(url);
    return out.href;
  } catch (e) {
    throw new Error("Invalid URL");
  }
}

/*
 * Get text from the original article using archive.ph
 * The archive lets us bypass paywalls, as well as solving some CORS issues.
 * TODO: Add other archive options like removepaywall.com
 */
async function getText(url) {
  // Sanitize the URL and search for an archive
  const sanitizedURL = sanitizeURL(url);
  const archiveRes = await fetch(
    `https://archive.ph/${encodeURIComponent(sanitizedURL)}`,
  );
  if (!archiveRes.ok) {
    throw new Error(`Archive request failed with status ${archiveRes.status}`);
  }

  // The archive site returns a list of possible results so
  // we grab the first link from row0
  const archiveHTML = await archiveRes.text();
  const archiveParser = new DOMParser();
  const archiveDoc = archiveParser.parseFromString(archiveHTML, "text/html");
  const archiveLink = archiveDoc.querySelector("#row0 a");
  if (!archiveLink) {
    throw new Error(
      "Failed to find an archived version of the source content.",
    );
  }

  // Sanitize the link that the archive sites provide
  const articleRes = await fetch(sanitizeURL(archiveLink.href));
  if (!articleRes.ok) {
    throw new Error(`Failed to fetch article: ${articleRes.status}`);
  }

  // Parse the article with mozilla's readability package
  const articleHTML = await articleRes.text();
  const articleParser = new DOMParser();
  const articleDoc = articleParser.parseFromString(articleHTML, "text/html");

  const reader = new Readability(articleDoc);
  const article = reader.parse();
  const contentDoc = new DOMParser().parseFromString(
    article.content,
    "text/html",
  );

  // Replace src attribute in images so it doesn't point to localhost
  contentDoc.querySelectorAll("img").forEach((img) => {
    if (img.hasAttribute("old-src")) {
      console.log(img.getAttribute("old-src"));
      img.setAttribute("src", img.getAttribute("old-src"));
      img.removeAttribute("old-src");
    }
  });

  article.content = contentDoc.body.innerHTML;
  article.content = article.content.replaceAll("h2", "h3");
  console.log(article.content);

  return article;
}
