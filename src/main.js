import { Readability } from "@mozilla/readability";
import Alpine from "alpinejs";
import DOMPurify from "dompurify";

document.addEventListener("alpine:init", () => {
  Alpine.data("content", () => ({
    text: "",
    source: "",
    title: "",
    date: "",

    async init() {
      const params = new URLSearchParams(window.location.search);
      const querySource = params.get("q");

      if (querySource) {
        this.source = querySource;
        await this.getContent();
      }

      this.$watch("source", (newValue) => {
        this.updateQueryParam(newValue);
      });
    },

    async getContent() {
      const article = await getText(
        sanitizeURL(this.source),
      );
      this.text = article.content
        ? DOMPurify.sanitize(article.content)
        : "Failed to extract content.";
      this.title = article.title;
      const dateString = new Date(article.publishedTime);
      const options = { year: "numeric", month: "long", day: "2-digit" };
      this.date = article.publisedTime == ""
        ? dateString.toLocaleDateString("en-US", options)
        : "";
    },

    updateQueryParam(newSource) {
      const params = new URLSearchParams(window.location.search);

      if (newSource) {
        params.set("q", newSource);
      } else {
        params.delete("q");
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newUrl);
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
  if (typeof url !== "string") {
    throw new Error(`${url} is not a string`);
  }

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
  const archiveElem = archiveDoc.querySelector("#row0 a");
  let archiveLink;
  if (!archiveElem) {
    archiveLink = sanitizedURL;
  } else {
    archiveLink = archiveElem.href;
  }

  // Sanitize the link that the archive sites provide and catch any CORS errors if accessing the original URL
  try {
    const articleRes = await fetch(sanitizeURL(archiveLink));
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

    // Replace h2 with h3, since the headline will be h2
    article.content = article.content.replaceAll("h2", "h3");
    console.log(article.content);

    return article;
  } catch (networkError) {
    if (
      networkError.message.includes("NetworkError") ||
      networkError.message.includes("CORS")
    ) {
      let article = {};
      article.content =
        "No archive was found for this link, and the original source is blocking access.";
      article.title = "";
      article.source = "";
      article.publishedTime = "";
      return article;
    }
  }
}
