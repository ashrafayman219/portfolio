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

  function jobWhen(job) {
    const line = [job.company, job.location, dateRange(job.startDate, job.endDate), jobType(job)]
      .filter(Boolean)
      .join(" · ");
    const partner = job.partnerName ? `<p class="when">${escapeHtml(job.partnerName)}</p>` : "";
    const site = job.website
      ? `<p class="job-link"><a href="${escapeHtml(job.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.website.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></p>`
      : "";
    return `<p class="when">${escapeHtml(line)}</p>${partner}${site}`;
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

  const IMG_FALLBACK = "this.onerror=null;this.style.background='#d5dde4';this.removeAttribute('src');";

  const PortfolioUI = {
    data: null,
    filter: "all",

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
                  <button type="button" class="btn btn-outline" data-map-project="${escapeHtml(project.id)}">Show on map</button>
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
            `<button type="button" class="${index === 0 ? "is-active" : ""}" data-thumb="${escapeHtml(src)}">
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

      body.innerHTML = `
        <h2 id="modalTitle">${escapeHtml(project.title)}</h2>
        <p class="project-meta">${escapeHtml(project.company)} · ${escapeHtml(project.year)} · ${escapeHtml(project.location.name)}</p>
        <div class="modal-gallery">
          ${video || `<img id="modalHero" src="${escapeHtml(main)}" alt="${escapeHtml(project.title)}" />`}
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

      body.querySelectorAll("[data-thumb]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const hero = document.getElementById("modalHero");
          if (hero) hero.src = btn.getAttribute("data-thumb");
          body.querySelectorAll("[data-thumb]").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
        });
      });

      const modal = document.getElementById("projectModal");
      modal.hidden = false;
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");
    },

    closeModal() {
      const modal = document.getElementById("projectModal");
      modal.classList.remove("is-open");
      modal.hidden = true;
      document.body.classList.remove("modal-open");
    },

    renderWork() {
      const root = document.getElementById("workTimeline");
      root.innerHTML = groupWork(this.data.workExperience)
        .map((group) => {
          if (group.roles.length === 1) {
            const job = group.roles[0];
            const extra = job.partnerLogo ? " has-partner" : "";
            return `
          <article class="timeline-item job-card reveal${extra}">
            <header class="job-head">
              ${jobLogos(job)}
              <div>
                <h3>${escapeHtml(job.position)}</h3>
                ${jobWhen(job)}
              </div>
            </header>
            <div class="job-body">
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
          <article class="company-card reveal">
            <header class="company-head">
              <img src="${escapeHtml(group.logo)}" alt="${escapeHtml(group.company)}" />
              <div>
                <h3>${escapeHtml(group.company)}</h3>
                <p class="when">${escapeHtml(group.location)} · ${escapeHtml(dateRange(oldest.startDate, newest.endDate))}</p>
              </div>
            </header>
            <ol class="role-path">${roles}</ol>
          </article>`;
        })
        .join("");
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
    if (event.key === "Escape") PortfolioUI.closeModal();
  });

  global.PortfolioUI = PortfolioUI;
})(window);
