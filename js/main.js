(function () {
  "use strict";

  const PortfolioApp = {
    observer: null,

    initTheme() {
      const saved = localStorage.getItem("portfolio-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved || (prefersDark ? "dark" : "light");
      this.setTheme(theme, false);

      document.getElementById("themeToggle").addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        this.setTheme(next, true);
      });
    },

    setTheme(theme, persist) {
      document.documentElement.setAttribute("data-theme", theme);
      if (persist) localStorage.setItem("portfolio-theme", theme);
      document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
      const toggle = document.getElementById("themeToggle");
      toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    },

    initNav() {
      const links = document.getElementById("navLinks");
      const toggle = document.getElementById("menuToggle");
      toggle.addEventListener("click", () => {
        const open = links.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      links.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          links.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });

      const sections = document.querySelectorAll("main section[id]");
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = entry.target.id;
            links.querySelectorAll("a").forEach((a) => {
              a.classList.toggle("is-active", a.getAttribute("data-section") === id);
            });
          });
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
      );
      sections.forEach((section) => spy.observe(section));
    },

    initBackToTop() {
      const button = document.getElementById("backToTop");
      window.addEventListener("scroll", () => {
        button.classList.toggle("is-visible", window.scrollY > 480);
      });
      button.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    },

    observeReveals() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
        return;
      }
      if (!this.observer) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                this.observer.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
      }
      document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => this.observer.observe(el));
    },

    async loadData() {
      const response = await fetch("data/projects.json");
      if (!response.ok) throw new Error("Could not load portfolio data");
      return response.json();
    }
  };

  window.PortfolioApp = PortfolioApp;

  document.addEventListener("DOMContentLoaded", async () => {
    PortfolioApp.initTheme();
    PortfolioApp.initNav();
    PortfolioApp.initBackToTop();

    try {
      const data = await PortfolioApp.loadData();
      window.PortfolioUI.render(data);
      window.PortfolioUI.startRoleCycle();
      document.querySelectorAll(".section-header, .hero-grid > div").forEach((el) => el.classList.add("reveal"));
      PortfolioApp.observeReveals();
      await window.GISMap.init(data);
    } catch (error) {
      console.error(error);
      document.getElementById("heroAbout").textContent =
        "The portfolio data file could not be loaded. Open this site through a local server so data/projects.json can be fetched.";
    }
  });
})();
