(function (global) {
  "use strict";

  function yearsSince(dateText) {
    const parsed = Date.parse("1 " + dateText);
    if (Number.isNaN(parsed)) return 1;
    const years = (Date.now() - parsed) / (365.25 * 24 * 60 * 60 * 1000);
    return Math.max(1, Math.floor(years));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const MONTHS = {
    January: "Jan",
    February: "Feb",
    March: "Mar",
    April: "Apr",
    May: "May",
    June: "Jun",
    July: "Jul",
    August: "Aug",
    September: "Sep",
    October: "Oct",
    November: "Nov",
    December: "Dec"
  };

  function shortDate(value) {
    return String(value ?? "").replace(
      /January|February|March|April|May|June|July|August|September|October|November|December/g,
      (month) => MONTHS[month]
    );
  }

  function dateRange(start, end) {
    return shortDate(start) + " - " + shortDate(end);
  }

  function groupWork(jobs) {
    const groups = [];
    (jobs || []).forEach((job) => {
      const prev = groups[groups.length - 1];
      if (prev && prev.company === job.company) prev.roles.push(job);
      else {
        groups.push({
          company: job.company,
          location: job.location,
          logo: job.logo,
          roles: [job]
        });
      }
    });
    return groups;
  }

  function jobLogos(job) {
    const fill = job.logoFill ? " logo-frame-fill" : "";
    const main = `<span class="logo-frame logo-frame-circle${fill}"><img src="${escapeHtml(job.logo)}" alt="${escapeHtml(job.company)}" /></span>`;
    if (!job.partnerLogo) return main;
    return `<div class="logo-pair">
      ${main}
      <span class="logo-frame logo-frame-pill"><img src="${escapeHtml(job.partnerLogo)}" alt="${escapeHtml(job.partnerName || "")}" /></span>
    </div>`;
  }

  function jobType(job) {
    return [job.employmentType, job.workMode].filter(Boolean).join(" · ");
  }

  function jobSite(job) {
    if (!job.website) return "";
    const label = job.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `<p class="job-link"><a href="${escapeHtml(job.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
  }

  function jobWhen(job) {
    const place = job.displayPlace === false ? "" : job.location;
    const type = job.displayPlace === false ? job.employmentType : jobType(job);
    const line = [job.company, place, dateRange(job.startDate, job.endDate), type]
      .filter(Boolean)
      .join(" · ");
    const partner = job.partnerName ? `<p class="when">${escapeHtml(job.partnerName)}</p>` : "";
    const site = job.displayPlace === false ? "" : jobSite(job);
    return `<p class="when">${escapeHtml(line)}</p>${partner}${site}`;
  }

  function jobInsights(job) {
    const info = job.insights;
    if (!info) return "";
    const jss = Number(info.jss) || 0;
    const radius = 16;
    const circ = 2 * Math.PI * radius;
    const dash = (jss / 100) * circ;
    const badge = info.badge
      ? `<div class="insight-rated">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2.4 14.9 8.3l6.5.9-4.7 4.6 1.1 6.5L12 17.2l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9Z"/>
          </svg>
          <div>
            <strong>${escapeHtml(info.badge)}</strong>
            <span>Recognized talent</span>
          </div>
        </div>`
      : "";
    const score = info.jss != null
      ? `<div class="insight-jss">
          <div class="jss-wrap">
            <svg class="jss-ring" viewBox="0 0 40 40" aria-hidden="true">
              <circle class="jss-track" cx="20" cy="20" r="${radius}"></circle>
              <circle class="jss-value" cx="20" cy="20" r="${radius}" stroke-dasharray="${dash} ${circ}"></circle>
            </svg>
            <strong>${jss}%</strong>
          </div>
          <div class="insight-jss-copy">
            <strong>Job Success</strong>
            <span>Client satisfaction score</span>
          </div>
        </div>`
      : "";
    if (!badge && !score) return "";
    return `<div class="insights" aria-label="Upwork insights">${badge}${score}</div>`;
  }

  function jobHeadline(job) {
    if (!job.headline) return "";
    return `<p class="job-headline">${escapeHtml(job.headline)}</p>`;
  }

  function jobSummary(job) {
    if (!job.summary || !job.summary.length) return "";
    return job.summary.map((text) => `<p class="job-summary">${escapeHtml(text)}</p>`).join("");
  }

  function roleSkills(job) {
    if (!job.skills || !job.skills.length) return "";
    return `<p class="role-skills">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/>
      </svg>
      <span>${job.skills.map(escapeHtml).join(", ")}</span>
    </p>`;
  }

  function roleCopy(job) {
    const when = [dateRange(job.startDate, job.endDate), jobType(job)].filter(Boolean).join(" · ");
    return `
      <h4>${escapeHtml(job.position)}</h4>
      <p class="when">${escapeHtml(when)}</p>
      <ul>${job.responsibilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${roleSkills(job)}`;
  }

  function expandButton() {
    return `<button type="button" class="expando-btn" aria-expanded="false" aria-label="Show details">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    </button>`;
  }

  const IMG_FALLBACK = "this.onerror=null;this.style.background='#d5dde4';this.removeAttribute('src');";

  const PortfolioUI = {
    data: null,
    filter: "all",
    galleryImages: [],
    galleryIndex: 0,

    render(data) {
      this.data = data;
      const info = data.personalInfo;
      const years = yearsSince(info.careerStart || "April 2022");

      document.getElementById("heroAbout").textContent = info.about;
      document.getElementById("heroEmail").href = "mailto:" + info.email;
      document.getElementById("heroEmail").textContent = info.email;
      document.getElementById("heroPhoto").src = info.profileImage;
      document.getElementById("heroPhoto").alt = info.fullName || info.name;
      document.getElementById("statYears").textContent = years + "+ years";
      document.getElementById("statProjects").textContent = String(data.projects.length);
      document.getElementById("statNow").textContent = info.currentCompany;
      document.getElementById("heroRoles").textContent = info.roles[0];

      document.getElementById("navGithub").href = info.social.github;
      document.getElementById("navLinkedin").href = info.social.linkedin;
      document.getElementById("contactGithub").href = info.social.github;
      document.getElementById("contactLinkedin").href = info.social.linkedin;
      document.getElementById("contactEmail").href = "mailto:" + info.email;
      document.getElementById("contactEmail").textContent = info.email;
      document.getElementById("contactLocation").textContent = info.location;
      document.getElementById("contactRole").textContent =
        info.currentPosition + " at " + info.currentCompany;
      document.getElementById("contactGoal").textContent = info.goal;
      document.getElementById("cvLink").href = info.cvUrl;
      document.getElementById("resumeLink").href = info.resumeUrl;
      document.getElementById("footerCopy").textContent =
        "© " + (data.metadata && data.metadata.lastUpdated ? data.metadata.lastUpdated : "2026") +
        " " + info.name;

      this.renderProjects();
      this.renderWork();
      this.renderEducation();
      this.renderSkills();
      this.bindFilters();
    },

    startRoleCycle() {
      const roles = this.data.personalInfo.roles;
      const el = document.getElementById("heroRoles");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || roles.length < 2) {
        el.textContent = roles[0];
        return;
      }
      let i = 0;
      setInterval(() => {
        i = (i + 1) % roles.length;
        el.style.opacity = "0";
        setTimeout(() => {
          el.textContent = roles[i];
          el.style.opacity = "1";
        }, 220);
      }, 3200);
      el.style.transition = "opacity 0.2s ease";
    },

    renderProjects() {
      const grid = document.getElementById("projectsGrid");
      const list = this.data.projects.filter((project) => {
        return this.filter === "all" || project.category === this.filter;
      });

      grid.innerHTML = list
        .map((project) => {
          const image = project.images && project.images[0] ? project.images[0] : "";
          return `
            <article class="project-card reveal" data-project-id="${escapeHtml(project.id)}">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(project.title)}" onerror="${IMG_FALLBACK}" />
              <div class="project-card-body">
                <div class="project-meta">
                  <span>${escapeHtml(project.category)}</span>
                  <span>${escapeHtml(project.year)} · ${escapeHtml(project.company)}</span>
                </div>
                <h3>${escapeHtml(project.title)}</h3>
                <p>${escapeHtml(project.description)}</p>
                <div class="card-actions">
                  <button type="button" class="btn btn-primary" data-open-project="${escapeHtml(project.id)}">Details</button>
                  ${project.showOnMap === false ? "" : `<button type="button" class="btn btn-outline" data-map-project="${escapeHtml(project.id)}">Show on map</button>`}
                </div>
              </div>
            </article>`;
        })
        .join("");

      grid.querySelectorAll("[data-open-project]").forEach((btn) => {
        btn.addEventListener("click", () => this.openModal(btn.getAttribute("data-open-project")));
      });
      grid.querySelectorAll("[data-map-project]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-map-project");
          document.dispatchEvent(new CustomEvent("portfolio:goto", { detail: { id: "project-" + id } }));
          document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      if (global.PortfolioApp && global.PortfolioApp.observeReveals) {
        global.PortfolioApp.observeReveals();
      }
    },

    bindFilters() {
      document.querySelectorAll("#projectFilters [data-filter]").forEach((chip) => {
        chip.addEventListener("click", () => {
          this.filter = chip.getAttribute("data-filter");
          document.querySelectorAll("#projectFilters [data-filter]").forEach((c) => c.classList.remove("is-active"));
          chip.classList.add("is-active");
          this.renderProjects();
        });
      });
    },

    highlightProject(projectId, options) {
      const scroll = !options || options.scroll !== false;
      document.querySelectorAll(".project-card").forEach((card) => {
        card.classList.toggle("is-highlighted", card.getAttribute("data-project-id") === projectId);
      });
      const card = document.querySelector('.project-card[data-project-id="' + projectId + '"]');
      if (scroll && card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    },

    openModal(projectId) {
      const project = this.data.projects.find((item) => item.id === projectId);
      if (!project) return;
      const body = document.getElementById("modalBody");
      const images = project.images || [];
      const main = images[0] || "";
      const thumbs = images
        .map(
          (src, index) =>
            `<button type="button" class="${index === 0 ? "is-active" : ""}" data-thumb-index="${index}">
              <img src="${escapeHtml(src)}" alt="" />
            </button>`
        )
        .join("");

      const links = [];
      if (project.demoUrl) links.push(`<a class="btn btn-primary" href="${escapeHtml(project.demoUrl)}" target="_blank" rel="noopener noreferrer">Live app</a>`);
      if (project.githubUrl) links.push(`<a class="btn btn-outline" href="${escapeHtml(project.githubUrl)}" target="_blank" rel="noopener noreferrer">GitHub</a>`);
      if (project.documentationUrl) links.push(`<a class="btn btn-outline" href="${escapeHtml(project.documentationUrl)}" target="_blank" rel="noopener noreferrer">API docs</a>`);
      if (project.presentationUrl) links.push(`<a class="btn btn-outline" href="${escapeHtml(project.presentationUrl)}" target="_blank" rel="noopener noreferrer">Presentation</a>`);

      const video = project.videoUrl
        ? `<video class="modal-video" src="${escapeHtml(project.videoUrl)}" controls playsinline></video>`
        : "";

      const features = (project.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("");
      const techs = (project.technologies || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
      const collab = project.collaborators
        ? `<p><strong>With:</strong> ${escapeHtml(project.collaborators.join(", "))}</p>`
        : "";

      const galleryNav =
        !video && images.length > 1
          ? `<button type="button" class="gallery-nav gallery-prev" data-gallery-step="-1" aria-label="Previous image">‹</button>
             <button type="button" class="gallery-nav gallery-next" data-gallery-step="1" aria-label="Next image">›</button>
             <p class="gallery-count" id="galleryCount">1 / ${images.length}</p>`
          : "";

      body.innerHTML = `
        <h2 id="modalTitle">${escapeHtml(project.title)}</h2>
        <p class="project-meta">${escapeHtml(project.company)} · ${escapeHtml(project.year)} · ${escapeHtml(project.location.name)}</p>
        <div class="modal-gallery">
          ${video || `<img id="modalHero" src="${escapeHtml(main)}" alt="${escapeHtml(project.title)}" />`}
          ${galleryNav}
        </div>
        ${images.length > 1 ? `<div class="thumbs">${thumbs}</div>` : ""}
        <p>${escapeHtml(project.longDescription)}</p>
        ${collab}
        <h3>What it does</h3>
        <ul>${features}</ul>
        <h3>Technologies</h3>
        <ul class="tag-list">${techs}</ul>
        <div class="modal-links">${links.join("")}</div>
      `;

      this.galleryImages = images;
      this.galleryIndex = 0;
      this.galleryTitle = project.title;

      body.querySelectorAll("[data-gallery-step]").forEach((btn) => {
        btn.addEventListener("click", () => this.showGallery(this.galleryIndex + Number(btn.getAttribute("data-gallery-step"))));
      });
      body.querySelectorAll("[data-thumb-index]").forEach((btn) => {
        btn.addEventListener("click", () => this.showGallery(Number(btn.getAttribute("data-thumb-index"))));
      });

      const modal = document.getElementById("projectModal");
      modal.hidden = false;
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");
    },

    showGallery(index) {
      if (!this.galleryImages.length) return;
      this.galleryIndex = (index + this.galleryImages.length) % this.galleryImages.length;
      const hero = document.getElementById("modalHero");
      const count = document.getElementById("galleryCount");
      if (hero) {
        hero.src = this.galleryImages[this.galleryIndex];
        hero.alt = (this.galleryTitle || "Project") + " screenshot " + (this.galleryIndex + 1);
      }
      if (count) count.textContent = this.galleryIndex + 1 + " / " + this.galleryImages.length;
      document.querySelectorAll("#modalBody [data-thumb-index]").forEach((btn) => {
        btn.classList.toggle("is-active", Number(btn.getAttribute("data-thumb-index")) === this.galleryIndex);
      });
    },

    closeModal() {
      const modal = document.getElementById("projectModal");
      modal.classList.remove("is-open");
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      this.galleryImages = [];
      this.galleryIndex = 0;
      this.galleryTitle = "";
    },

    renderWork() {
      const root = document.getElementById("workTimeline");
      root.innerHTML = groupWork(this.data.workExperience)
        .map((group) => {
          if (group.roles.length === 1) {
            const job = group.roles[0];
            const extra = job.partnerLogo ? " has-partner" : "";
            return `
          <article class="timeline-item job-card reveal is-collapsed${extra}" data-expando>
            <header class="job-head">
              ${jobLogos(job)}
              <div class="job-copy">
                <h3>${escapeHtml(job.position)}</h3>
                ${jobHeadline(job)}
                ${jobWhen(job)}
              </div>
              ${expandButton()}
            </header>
            <div class="job-body">
              ${jobInsights(job)}
              ${jobSummary(job)}
              <ul>${job.responsibilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              ${roleSkills(job)}
            </div>
          </article>`;
          }

          const newest = group.roles[0];
          const oldest = group.roles[group.roles.length - 1];
          const roles = group.roles
            .map((job) => `<li class="role-item">${roleCopy(job)}</li>`)
            .join("");

          return `
          <article class="company-card reveal is-collapsed" data-expando>
            <header class="company-head">
              ${jobLogos(newest)}
              <div class="job-copy">
                <h3>${escapeHtml(group.company)}</h3>
                <p class="when">${escapeHtml([group.location, dateRange(oldest.startDate, newest.endDate), jobType(newest)].filter(Boolean).join(" · "))}</p>
                ${jobSite(newest)}
              </div>
              ${expandButton()}
            </header>
            <ol class="role-path">${roles}</ol>
          </article>`;
        })
        .join("");
      this.bindExpandos();
    },

    bindExpandos() {
      const root = document.getElementById("workTimeline");
      if (!root) return;
      root.querySelectorAll("[data-expando]").forEach((card) => {
        const btn = card.querySelector(".expando-btn");
        const header = card.querySelector(".job-head, .company-head");
        if (!btn || !header) return;
        const setOpen = (open) => {
          card.classList.toggle("is-open", open);
          card.classList.toggle("is-collapsed", !open);
          btn.setAttribute("aria-expanded", String(open));
          btn.setAttribute("aria-label", open ? "Hide details" : "Show details");
        };
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          setOpen(!card.classList.contains("is-open"));
        });
        header.addEventListener("click", (event) => {
          if (event.target.closest("a")) return;
          setOpen(!card.classList.contains("is-open"));
        });
      });
    },

    renderEducation() {
      const root = document.getElementById("eduTimeline");
      root.innerHTML = this.data.education
        .map((edu) => {
          const honors = edu.honors ? `<p>${escapeHtml(edu.honors.join(" · "))}</p>` : "";
          return `
          <article class="timeline-item reveal">
            <img src="${escapeHtml(edu.logo)}" alt="${escapeHtml(edu.institution)}" />
            <div>
              <h3>${escapeHtml(edu.institution)}</h3>
              <p class="when">${escapeHtml(edu.degree)} · ${escapeHtml(edu.field)} · ${escapeHtml(edu.graduationDate)}</p>
              ${honors}
            </div>
          </article>`;
        })
        .join("");
    },

    renderSkills() {
      const labels = {
        gis: "GIS and mapping",
        programming: "Programming",
        remoteSensing: "Remote sensing"
      };
      const root = document.getElementById("skillsGrid");
      root.innerHTML = Object.keys(this.data.skills)
        .map((key) => {
          const tags = this.data.skills[key].map((s) => `<li>${escapeHtml(s.name)}</li>`).join("");
          return `<article class="skill-card reveal"><h3>${escapeHtml(labels[key] || key)}</h3><ul class="tag-list">${tags}</ul></article>`;
        })
        .join("");
    }
  };

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => PortfolioUI.closeModal());
  });

  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("projectModal");
    const open = modal && modal.classList.contains("is-open");
    if (event.key === "Escape") {
      PortfolioUI.closeModal();
      return;
    }
    if (!open || PortfolioUI.galleryImages.length < 2) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      PortfolioUI.showGallery(PortfolioUI.galleryIndex + 1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      PortfolioUI.showGallery(PortfolioUI.galleryIndex - 1);
    }
  });

  global.PortfolioUI = PortfolioUI;
})(window);
