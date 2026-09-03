(function (global) {
  "use strict";

  const PIN_COLORS = {
    "od-travel-time-matrix": "#1B2A4A",
    "ameriwater-territory-map": "#1565A8",
    "gt-agroptics": "#15803D",
    "cop27-sharm": "#0E7490",
    "geowarehouse-solutions": "#2F4A6D"
  };

  const HOME_CAMERA = {
    position: { longitude: 8, latitude: 28, z: 12500000 },
    heading: 0,
    tilt: 22
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
        const radius = 0.8;
        item.latitude += radius * Math.cos(angle);
        item.longitude += (radius * Math.sin(angle)) / Math.cos((item.latitude * Math.PI) / 180);
      });
    });
    return features;
  }

  function collectFeatures(data) {
    return offsetOverlaps(
      (data.projects || []).map((project, index) => ({
        id: "project-" + project.id,
        projectId: project.id,
        name: project.title,
        mapLabel: project.mapLabel || project.title,
        subtitle: project.company,
        category: project.category || "professional",
        period: String(project.year),
        latitude: project.location.latitude,
        longitude: project.location.longitude,
        color: PIN_COLORS[project.id] || "#1A7A8C",
        phase: index * 0.9
      }))
    );
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

  function categoryLabel(category) {
    return category === "academic" ? "Academic" : "Professional";
  }

  const GISMap = {
    view: null,
    map: null,
    graphics: null,
    labelsLayer: null,
    features: [],
    modules: null,
    currentBasemap: "satellite",
    layerVisible: { professional: true, academic: true },
    selectedId: null,
    pulseRaf: null,

    async init(data) {
      this.features = collectFeatures(data);
      this.renderList(this.features);
      this.renderSearchHits(this.features);
      this.renderPills();
      this.bindSearch();
      this.updateStatusCounts();

      try {
        await this.createMap();
        this.addMarkers();
        this.bindChrome();
        this.setLabelMode((global.MapUI && global.MapUI.state.labelMode) || "off");
        this.startPulse();
      } catch (error) {
        console.error(error);
        this.showError("The map could not load. Check your connection and try again.");
      }
    },

    keepPageFocus() {
      const root = this.view && this.view.container;
      if (!root) return;
      const blurIfMapHoldsFocus = () => {
        if (root.contains(document.activeElement)) document.activeElement.blur();
      };
      blurIfMapHoldsFocus();
      requestAnimationFrame(blurIfMapHoldsFocus);
      setTimeout(blurIfMapHoldsFocus, 50);
      setTimeout(blurIfMapHoldsFocus, 250);
      const surface = root.querySelector(".esri-view-surface");
      if (surface) surface.setAttribute("tabindex", "-1");
    },

    showError(message) {
      const host = document.getElementById("map-wrap") || document.getElementById("mapView");
      const box = document.createElement("div");
      box.className = "map-error";
      box.textContent = message;
      host.appendChild(box);
    },

    visibleFeatures() {
      return this.features.filter((feature) => this.layerVisible[feature.category] !== false);
    },

    pinSymbol(color, size, offset) {
      const { PointSymbol3D, IconSymbol3DLayer } = this.modules;
      return new PointSymbol3D({
        symbolLayers: [
          new IconSymbol3DLayer({
            resource: { primitive: "circle" },
            material: { color: color },
            size: size,
            outline: { color: "#ffffff", size: 1.4 }
          })
        ],
        verticalOffset: {
          screenLength: offset,
          maxWorldLength: 120000,
          minWorldLength: 8000
        },
        callout: {
          type: "line",
          size: 1.6,
          color: color,
          border: { color: "#ffffff" }
        }
      });
    },

    renderList(features) {
      const list = document.getElementById("locationList");
      if (!list) return;
      const rows = features || this.visibleFeatures();
      list.innerHTML = rows
        .map(
          (feature) => `
          <li>
            <button type="button" data-loc="${feature.id}">
              ${feature.mapLabel}
              <small>${categoryLabel(feature.category)} · ${feature.period}</small>
            </button>
          </li>`
        )
        .join("");
      list.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => this.goTo(button.getAttribute("data-loc")));
      });
    },

    renderPills() {
      const root = document.getElementById("project-pills");
      if (!root) return;
      root.innerHTML = this.features
        .map(
          (feature) =>
            `<button type="button" class="bookmark-pill" data-loc="${feature.id}">
              <span class="pill-dot" style="background:${feature.color}"></span>
              ${feature.mapLabel}
            </button>`
        )
        .join("");
      root.querySelectorAll("[data-loc]").forEach((btn) => {
        btn.addEventListener("click", () => this.goTo(btn.getAttribute("data-loc")));
      });
      if (global.MapUI && global.MapUI.state.theme === "glass") global.MapUI.syncLiquidGlass();
    },

    syncPills(id) {
      document.querySelectorAll("#project-pills .bookmark-pill").forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-loc") === id);
      });
    },

    bindSearch() {
      const dockInput = document.getElementById("locationSearch");
      const flyInput = document.getElementById("search-input");
      const onQuery = (value) => {
        const q = String(value || "").trim().toLowerCase();
        const pool = this.visibleFeatures();
        const next = pool.filter((feature) => {
          return (
            feature.name.toLowerCase().includes(q) ||
            feature.mapLabel.toLowerCase().includes(q) ||
            feature.subtitle.toLowerCase().includes(q) ||
            feature.category.toLowerCase().includes(q) ||
            String(feature.period).toLowerCase().includes(q)
          );
        });
        this.renderList(q ? next : pool);
        this.renderSearchHits(q ? next : pool);
        if (q && next.length === 1) this.goTo(next[0].id);
      };
      if (dockInput) dockInput.addEventListener("input", () => onQuery(dockInput.value));
      if (flyInput) {
        flyInput.addEventListener("input", () => {
          onQuery(flyInput.value);
          if (dockInput) dockInput.value = flyInput.value;
        });
      }
    },

    renderSearchHits(features) {
      const root = document.getElementById("search-results");
      if (!root) return;
      root.innerHTML = (features || [])
        .map(
          (feature) =>
            `<button type="button" class="search-hit" data-loc="${feature.id}">
              <span>${feature.mapLabel}</span>
              <span class="hit-kind">${categoryLabel(feature.category)}</span>
            </button>`
        )
        .join("");
      root.querySelectorAll("[data-loc]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.goTo(btn.getAttribute("data-loc"));
          if (global.MapUI) global.MapUI.closeFlyouts();
        });
      });
    },

    updateStatusCounts() {
      const el = document.getElementById("stat-project");
      if (el) el.textContent = String(this.visibleFeatures().length);
    },

    setLayerVisible(category, on) {
      this.layerVisible[category] = !!on;
      if (this.graphics) {
        this.graphics.graphics.forEach((graphic) => {
          if (graphic.attributes && graphic.attributes.category === category) graphic.visible = !!on;
        });
      }
      document.querySelectorAll("#project-pills .bookmark-pill").forEach((btn) => {
        const feature = this.features.find((item) => item.id === btn.getAttribute("data-loc"));
        btn.hidden = !!(feature && this.layerVisible[feature.category] === false);
      });
      this.rebuildLabels();
      this.renderList();
      this.updateStatusCounts();
    },

    async createMap() {
      const [
        esriConfig,
        Map,
        SceneView,
        GraphicsLayer,
        Graphic,
        Point,
        PointSymbol3D,
        IconSymbol3DLayer,
        TextSymbol3DLayer
      ] = await Promise.all([
        loadModule("esri/config"),
        loadModule("esri/Map"),
        loadModule("esri/views/SceneView"),
        loadModule("esri/layers/GraphicsLayer"),
        loadModule("esri/Graphic"),
        loadModule("esri/geometry/Point"),
        loadModule("esri/symbols/PointSymbol3D"),
        loadModule("esri/symbols/IconSymbol3DLayer"),
        loadModule("esri/symbols/TextSymbol3DLayer")
      ]);

      const key = (global.PORTFOLIO_CONFIG && global.PORTFOLIO_CONFIG.arcgisApiKey) || "";
      if (key) esriConfig.apiKey = key;

      this.modules = { Map, SceneView, GraphicsLayer, Graphic, Point, PointSymbol3D, IconSymbol3DLayer, TextSymbol3DLayer };

      this.graphics = new GraphicsLayer({ title: "Projects", elevationInfo: { mode: "relative-to-ground" } });
      this.labelsLayer = new GraphicsLayer({ title: "Labels", elevationInfo: { mode: "relative-to-ground" } });
      this.map = new Map({
        basemap: "satellite",
        ground: "world-elevation",
        layers: [this.graphics, this.labelsLayer]
      });

      this.view = new SceneView({
        container: "mapView",
        map: this.map,
        camera: HOME_CAMERA,
        ui: { components: ["attribution"] },
        popupEnabled: false
      });

      await this.view.when();
      this.keepPageFocus();

      this.view.on("click", async (event) => {
        const hit = await this.view.hitTest(event, { include: this.graphics });
        const graphic = hit.results.map((r) => r.graphic).find((g) => g && g.attributes && g.attributes.id);
        if (graphic) this.onSelect(graphic.attributes.id);
        else if (global.MapUI) {
          global.MapUI.closeDetail();
          this.selectedId = null;
          this.syncPills(null);
        }
      });

      this.view.on("pointer-move", (event) => {
        const point = this.view.toMap({ x: event.x, y: event.y });
        const el = document.getElementById("stat-coords");
        if (!el || !point) return;
        el.textContent = point.longitude.toFixed(2) + ", " + point.latitude.toFixed(2);
      });

      this.view.watch("zoom", (zoom) => {
        const el = document.getElementById("stat-zoom");
        if (el && typeof zoom === "number") el.textContent = zoom.toFixed(1);
      });
    },

    setBasemap(name) {
      if (!this.map) return;
      this.currentBasemap = name;
      document.querySelectorAll("#basemap-menu [data-basemap]").forEach((item) => {
        item.classList.toggle("active", item.getAttribute("data-basemap") === name);
      });
      const ids = { gray: "gray-vector", streets: "streets-vector", satellite: "satellite" };
      this.map.basemap = ids[name] || "satellite";
    },

    addMarkers() {
      const { Graphic, Point } = this.modules;
      this.features.forEach((feature) => {
        const graphic = new Graphic({
          geometry: new Point({ longitude: feature.longitude, latitude: feature.latitude }),
          symbol: this.pinSymbol(feature.color, 14, 40),
          attributes: feature,
          visible: this.layerVisible[feature.category] !== false
        });
        this.graphics.add(graphic);
      });
    },

    startPulse() {
      this.stopPulse();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const tick = (now) => {
        if (!this.graphics || !this.modules) return;
        const t = now / 1000;
        this.graphics.graphics.forEach((graphic) => {
          const feature = graphic.attributes;
          if (!feature) return;
          const selected = this.selectedId === feature.id;
          const wave = Math.sin(t * (selected ? 3.4 : 2.2) + (feature.phase || 0));
          const size = (selected ? 18 : 14) + wave * (selected ? 5 : 2.5);
          const offset = (selected ? 52 : 40) + wave * (selected ? 8 : 4);
          graphic.symbol = this.pinSymbol(feature.color, size, offset);
        });
        this.pulseRaf = requestAnimationFrame(tick);
      };
      this.pulseRaf = requestAnimationFrame(tick);
    },

    stopPulse() {
      if (this.pulseRaf) cancelAnimationFrame(this.pulseRaf);
      this.pulseRaf = null;
    },

    rebuildLabels() {
      if (!this.labelsLayer || !this.modules) return;
      this.labelsLayer.removeAll();
      const mode = (global.MapUI && global.MapUI.state.labelMode) || "off";
      if (mode !== "name") return;
      const { Graphic, Point, PointSymbol3D, TextSymbol3DLayer } = this.modules;
      this.visibleFeatures().forEach((feature) => {
        this.labelsLayer.add(
          new Graphic({
            geometry: new Point({ longitude: feature.longitude, latitude: feature.latitude }),
            symbol: new PointSymbol3D({
              symbolLayers: [
                new TextSymbol3DLayer({
                  text: feature.mapLabel,
                  material: { color: "#ffffff" },
                  halo: { color: [20, 32, 56, 0.9], size: 1.2 },
                  font: { size: 11, family: "Noto Sans", weight: "bold" },
                  size: 12
                })
              ],
              verticalOffset: { screenLength: 64, maxWorldLength: 140000, minWorldLength: 10000 }
            })
          })
        );
      });
    },

    setLabelMode(mode) {
      if (global.MapUI) {
        global.MapUI.savePrefs({ labelMode: mode === "name" ? "name" : "off" });
        global.MapUI.syncLabelsToolButton();
      }
      document.querySelectorAll("#labels-menu [data-labels]").forEach((item) => {
        item.classList.toggle("active", item.getAttribute("data-labels") === (mode === "name" ? "name" : "off"));
      });
      this.rebuildLabels();
    },

    changeZoom(delta) {
      if (!this.view) return;
      const zoom = this.view.zoom;
      if (typeof zoom === "number" && isFinite(zoom)) {
        this.view.goTo({ zoom: zoom + delta }, { duration: 400 }).catch(() => {});
        return;
      }
      const cam = this.view.camera.clone();
      cam.position.z = Math.max(400000, cam.position.z * (delta > 0 ? 0.6 : 1.6));
      this.view.goTo(cam, { duration: 400 }).catch(() => {});
    },

    bindChrome() {
      const home = document.getElementById("btn-home");
      if (home) home.addEventListener("click", () => this.goHome());

      const zoomIn = document.getElementById("btn-zoom-in");
      if (zoomIn) zoomIn.addEventListener("click", () => this.changeZoom(1));

      const zoomOut = document.getElementById("btn-zoom-out");
      if (zoomOut) zoomOut.addEventListener("click", () => this.changeZoom(-1));

      const full = document.getElementById("btn-fullscreen");
      const wrap = document.getElementById("map-wrap");
      if (full && wrap) {
        full.addEventListener("click", () => {
          if (document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            return;
          }
          const request = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
          if (!request) return;
          const result = request.call(wrap);
          if (result && typeof result.catch === "function") result.catch(() => {});
        });
        const onFull = () => {
          const on = document.fullscreenElement === wrap || document.webkitFullscreenElement === wrap;
          document.body.classList.toggle("map-fullscreen", on);
          full.classList.toggle("active", on);
          if (this.view) this.view.resize();
        };
        document.addEventListener("fullscreenchange", onFull);
        document.addEventListener("webkitfullscreenchange", onFull);
      }

      document.querySelectorAll("#basemap-menu [data-basemap]").forEach((item) => {
        item.addEventListener("click", () => {
          this.setBasemap(item.getAttribute("data-basemap"));
          if (global.MapUI) global.MapUI.closeFlyouts();
        });
      });

      document.querySelectorAll("#labels-menu [data-labels]").forEach((item) => {
        item.addEventListener("click", () => {
          this.setLabelMode(item.getAttribute("data-labels"));
          if (global.MapUI) global.MapUI.closeFlyouts();
        });
      });

      document.querySelectorAll("#panel-layers [data-layer]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const type = btn.getAttribute("data-layer");
          const next = !btn.classList.contains("active");
          btn.classList.toggle("active", next);
          this.setLayerVisible(type, next);
        });
      });

      const detailBody = document.getElementById("detail-body");
      if (detailBody) {
        detailBody.addEventListener("click", (event) => {
          const action = event.target.closest("[data-open-mapped-project]");
          if (!action) return;
          const projectId = action.getAttribute("data-open-mapped-project");
          if (global.PortfolioUI) {
            global.PortfolioUI.filter = "all";
            document.querySelectorAll("#projectFilters [data-filter]").forEach((chip) => {
              chip.classList.toggle("is-active", chip.getAttribute("data-filter") === "all");
            });
            global.PortfolioUI.renderProjects();
            global.PortfolioUI.highlightProject(projectId, { scroll: true });
          }
          const projects = document.getElementById("projects");
          if (projects) projects.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },

    goHome() {
      if (!this.view) return;
      this.selectedId = null;
      this.syncPills(null);
      this.view.goTo(HOME_CAMERA, { duration: 1000 }).catch(() => {});
      if (global.MapUI) global.MapUI.closeDetail();
    },

    onSelect(id) {
      const feature = this.features.find((item) => item.id === id);
      if (!feature) return;
      this.selectedId = id;
      this.syncPills(id);

      document.querySelectorAll("#locationList button").forEach((btn) => {
        btn.classList.toggle("is-active", btn.getAttribute("data-loc") === id);
      });

      if (this.view) {
        this.view
          .goTo(
            {
              target: [feature.longitude, feature.latitude],
              zoom: 7,
              tilt: 48,
              heading: 20
            },
            { duration: 1100 }
          )
          .catch(() => {});
      }

      const body =
        `<div class="map-stat-grid">
          <div class="map-stat"><div class="k">Type</div><div class="v">${categoryLabel(feature.category)}</div></div>
          <div class="map-stat"><div class="k">When</div><div class="v">${feature.period}</div></div>
        </div>
        <p>${feature.subtitle}</p>
        <button type="button" class="detail-action" data-open-mapped-project="${feature.projectId}">Open project</button>`;

      if (global.MapUI) global.MapUI.openDetail(categoryLabel(feature.category), feature.name, body);
    },

    goTo(id) {
      this.onSelect(id);
    }
  };

  document.addEventListener("portfolio:goto", (event) => {
    GISMap.goTo(event.detail.id);
  });

  global.GISMap = GISMap;
})(window);
