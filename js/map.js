(function (global) {
  "use strict";

  const COLORS = {
    work: "#2C3E50",
    project: "#1A7A8C",
    education: "#8A7A62"
  };

  function offsetOverlaps(features) {
    const groups = new Map();
    features.forEach((feature) => {
      const key = feature.latitude.toFixed(3) + "," + feature.longitude.toFixed(3);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(feature);
    });
    groups.forEach((items) => {
      if (items.length < 2) return;
      items.forEach((item, index) => {
        const angle = (Math.PI * 2 * index) / items.length;
        const radius = 0.018;
        item.latitude += radius * Math.cos(angle);
        item.longitude += (radius * Math.sin(angle)) / Math.cos((item.latitude * Math.PI) / 180);
      });
    });
    return features;
  }

  function collectFeatures(data) {
    const features = [];

    data.workExperience.forEach((job) => {
      features.push({
        id: "work-" + job.id,
        name: job.company,
        subtitle: job.position,
        type: "work",
        period: job.startDate + " – " + job.endDate,
        latitude: job.latitude,
        longitude: job.longitude,
        projectId: null
      });
    });

    data.projects.forEach((project) => {
      features.push({
        id: "project-" + project.id,
        name: project.title,
        subtitle: project.company,
        type: "project",
        period: String(project.year),
        latitude: project.location.latitude,
        longitude: project.location.longitude,
        projectId: project.id
      });
    });

    data.education.forEach((edu) => {
      features.push({
        id: "edu-" + edu.id,
        name: edu.institution,
        subtitle: edu.field,
        type: "education",
        period: edu.graduationDate,
        latitude: edu.location.latitude,
        longitude: edu.location.longitude,
        projectId: null
      });
    });

    return offsetOverlaps(features);
  }

  function loadModule(name) {
    return new Promise((resolve, reject) => {
      if (typeof require !== "function") {
        reject(new Error("ArcGIS API did not load"));
        return;
      }
      require([name], resolve, reject);
    });
  }

  const GISMap = {
    view: null,
    map: null,
    graphics: null,
    features: [],
    modules: null,
    currentBasemap: "gray",
    layers: {},

    async init(data) {
      this.features = collectFeatures(data);
      this.renderList(this.features);
      this.bindSearch();
      this.bindBasemapButtons();

      try {
        await this.createMap();
        this.addMarkers();
      } catch (error) {
        console.error(error);
        this.showError("The map could not load. Check your connection and try again.");
      }
    },

    showError(message) {
      const host = document.querySelector(".map-frame") || document.getElementById("mapView");
      const box = document.createElement("div");
      box.className = "map-error";
      box.textContent = message;
      host.appendChild(box);
    },

    renderList(features) {
      const list = document.getElementById("locationList");
      list.innerHTML = features
        .map(
          (feature) => `
          <li>
            <button type="button" data-loc="${feature.id}">
              ${feature.name}
              <small>${feature.type} · ${feature.period}</small>
            </button>
          </li>`
        )
        .join("");

      list.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => this.goTo(button.getAttribute("data-loc"), true));
      });
    },

    bindSearch() {
      const input = document.getElementById("locationSearch");
      input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        const next = this.features.filter((feature) => {
          return (
            feature.name.toLowerCase().includes(q) ||
            feature.subtitle.toLowerCase().includes(q) ||
            feature.type.toLowerCase().includes(q)
          );
        });
        this.renderList(q ? next : this.features);
        if (q && next.length === 1) this.goTo(next[0].id, false);
      });
    },

    bindBasemapButtons() {
      document.querySelectorAll("[data-basemap]").forEach((button) => {
        button.addEventListener("click", () => {
          this.setBasemap(button.getAttribute("data-basemap"));
          document.querySelectorAll("[data-basemap]").forEach((b) => b.classList.remove("is-active"));
          button.classList.add("is-active");
        });
      });
    },

    async createMap() {
      const [esriConfig, Map, MapView, Basemap, TileLayer, GraphicsLayer, Graphic, Point, SimpleMarkerSymbol, PopupTemplate] =
        await Promise.all([
          loadModule("esri/config"),
          loadModule("esri/Map"),
          loadModule("esri/views/MapView"),
          loadModule("esri/Basemap"),
          loadModule("esri/layers/TileLayer"),
          loadModule("esri/layers/GraphicsLayer"),
          loadModule("esri/Graphic"),
          loadModule("esri/geometry/Point"),
          loadModule("esri/symbols/SimpleMarkerSymbol"),
          loadModule("esri/PopupTemplate")
        ]);

      const key = (global.PORTFOLIO_CONFIG && global.PORTFOLIO_CONFIG.arcgisApiKey) || "";
      if (key) esriConfig.apiKey = key;

      this.modules = { Map, MapView, Basemap, TileLayer, GraphicsLayer, Graphic, Point, SimpleMarkerSymbol, PopupTemplate };

      const theme = document.documentElement.getAttribute("data-theme") || "light";
      this.layers.grayLight = new TileLayer({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer"
      });
      this.layers.grayDark = new TileLayer({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer"
      });
      this.layers.satellite = new TileLayer({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
      });

      this.graphics = new GraphicsLayer({ title: "Portfolio locations" });
      this.map = new Map({
        basemap: new Basemap({
          baseLayers: [theme === "dark" ? this.layers.grayDark : this.layers.grayLight],
          title: "Gray"
        }),
        layers: [this.graphics]
      });

      this.view = new MapView({
        container: "mapView",
        map: this.map,
        center: [31.4, 30.6],
        zoom: 6,
        ui: { components: ["attribution"] },
        constraints: { minZoom: 4, maxZoom: 16 },
        popup: {
          dockEnabled: true,
          dockOptions: { position: "bottom-left", breakpoint: false }
        }
      });

      await this.view.when();

      this.view.on("click", async (event) => {
        const hit = await this.view.hitTest(event, { include: this.graphics });
        const graphic = hit.results.map((r) => r.graphic).find((g) => g && g.attributes && g.attributes.id);
        if (graphic) this.onSelect(graphic.attributes.id);
      });

      document.addEventListener("themechange", (event) => {
        if (this.currentBasemap === "gray") this.applyGrayBasemap(event.detail.theme);
      });
    },

    applyGrayBasemap(theme) {
      if (!this.map || !this.modules) return;
      const layer = theme === "dark" ? this.layers.grayDark : this.layers.grayLight;
      this.map.basemap = new this.modules.Basemap({ baseLayers: [layer], title: "Gray" });
    },

    setBasemap(name) {
      if (!this.map) return;
      this.currentBasemap = name;
      if (name === "satellite") {
        this.map.basemap = new this.modules.Basemap({
          baseLayers: [this.layers.satellite],
          title: "Satellite"
        });
        return;
      }
      this.applyGrayBasemap(document.documentElement.getAttribute("data-theme") || "light");
    },

    addMarkers() {
      const { Graphic, Point, SimpleMarkerSymbol, PopupTemplate } = this.modules;
      this.features.forEach((feature) => {
        const isEducation = feature.type === "education";
        const graphic = new Graphic({
          geometry: new Point({ longitude: feature.longitude, latitude: feature.latitude }),
          symbol: new SimpleMarkerSymbol({
            style: isEducation ? "square" : feature.type === "project" ? "diamond" : "circle",
            color: COLORS[feature.type],
            size: 11,
            outline: { color: "#ffffff", width: 1 }
          }),
          attributes: feature,
          popupTemplate: new PopupTemplate({
            title: "{name}",
            content: "<p>{subtitle}<br>{type} · {period}</p>"
          })
        });
        this.graphics.add(graphic);
      });
    },

    onSelect(id, openPopup = true) {
      const feature = this.features.find((item) => item.id === id);
      if (!feature) return;

      document.querySelectorAll("#locationList button").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-loc") === id);
      });

      if (this.view) {
        this.view.goTo({ center: [feature.longitude, feature.latitude], zoom: 11 }, { duration: 900 }).catch(() => {});
        if (openPopup) {
          let graphic = null;
          this.graphics.graphics.forEach((item) => {
            if (item.attributes && item.attributes.id === id) graphic = item;
          });
          if (graphic) this.view.openPopup({ features: [graphic], location: graphic.geometry });
        }
      }

      if (feature.projectId && global.PortfolioUI) {
        global.PortfolioUI.filter = "all";
        document.querySelectorAll("#projectFilters [data-filter]").forEach((chip) => {
          chip.classList.toggle("is-active", chip.getAttribute("data-filter") === "all");
        });
        global.PortfolioUI.renderProjects();
        global.PortfolioUI.highlightProject(feature.projectId, { scroll: false });
      }
    },

    goTo(id, openPopup) {
      this.onSelect(id, openPopup);
    }
  };

  document.addEventListener("portfolio:goto", (event) => {
    GISMap.goTo(event.detail.id, true);
  });

  global.GISMap = GISMap;
})(window);
