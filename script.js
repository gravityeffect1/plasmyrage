document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("bloodVesselCanvas");
  const ctx = canvas.getContext("2d");
  const infoBox = document.getElementById("infoBox");
  const infoBoxTitle = document.getElementById("infoBoxTitle");
  const infoBoxList = document.getElementById("infoBoxList");
  const introCard = document.getElementById("introCard");
  const startButton = document.getElementById("startButton");
  const exitButton = document.getElementById("exitButton");
  const simulationUI = document.getElementById("simulationUI");
  const backButton = document.getElementById("backButton");
  const goodbyeScreen = document.getElementById("goodbyeScreen");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // --- State ---
  let animationFrameId = null;
  let cells = [];
  let bacteria = [];

  const CONFIG = {
    RBC_COUNT: 70,
    PLATELET_COUNT: 25,
    NEUTROPHIL_COUNT: 2,
    LYMPHOCYTE_COUNT: 1,
    MONOCYTE_COUNT: 1,
    BACTERIUM_COUNT: 1,
    MIN_SPEED: 0.5,
    MAX_SPEED: 2.5,
    Y_DRIFT_AMPLITUDE: 3,
    Y_DRIFT_FREQUENCY: 0.02,
    NEUTROPHIL_DETECTION_RADIUS: 250,
    NEUTROPHIL_ATTRACTION_FORCE: 0.2,
    NEUTROPHIL_ENGULF_PULSE_FRAMES: 15, 
    VESSEL_WALL_COLOR: "rgba(227, 180, 180, 0.5)",
    VESSEL_OUTLINE_COLOR: "#2c1e1e",
    NUCLEUS_COLOR: "#6a5acd",
    RBC_COLOR_OUTER: "#ff4d4d",
    RBC_COLOR_INNER: "#c63a3a",
    RBC_HIGHLIGHT: "rgba(255, 150, 150, 0.5)",
    PLATELET_COLOR: "#ffdd99",
    NEUTROPHIL_CYTOPLASM: "rgba(230, 220, 240, 0.8)",
    LYMPHOCYTE_CYTOPLASM: "rgba(210, 220, 240, 0.7)",
    MONOCYTE_CYTOPLASM: "rgba(220, 225, 240, 0.8)",
    BACTERIUM_COLOR: "#84cc16"
  };

  
  const CELL_FACTS = {
    RBC: {
      title: "Red Blood Cell (Erythrocyte)",
      facts: [
        "Transports oxygen via hemoglobin.",
        "Lacks a nucleus when mature to maximize space.",
        "Most numerous blood cell."
      ]
    },
    PLATELET: {
      title: "Platelet (Thrombocyte)",
      facts: [
        "Cell fragment essential for blood clotting.",
        "Forms a plug at injury sites.",
        "Derived from megakaryocytes in bone marrow."
      ]
    },
    NEUTROPHIL: {
      title: "Neutrophil",
      facts: [
        "Most abundant white blood cell.",
        "A phagocyte that engulfs bacteria via chemotaxis.",
        "Has a characteristic multi-lobed nucleus."
      ]
    },
    LYMPHOCYTE: {
      title: "Lymphocyte",
      facts: [
        "Core of the adaptive immune system (T/B cells).",
        "Large nucleus fills most of the cell.",
        "Creates immune memory."
      ]
    },
    MONOCYTE: {
      title: "Monocyte",
      facts: [
        "Largest white blood cell.",
        "Matures into a macrophage in tissues.",
        "Has a kidney-bean shaped nucleus."
      ]
    }
  };

  const vesselPadding = 100;
  const vesselCurve = 20;

  
  class Bacterium {
    constructor() {
      this.radius = 7;
      this.width = 14;
      this.height = 6;
      this.reset(true);
    }
    reset(initial = false) {
      const vesselHeight = canvas.height - (vesselPadding + vesselCurve) * 2;
      const yStart = vesselPadding + vesselCurve;
      this.x = initial ? Math.random() * canvas.width : -this.width;
      this.y =
        yStart + this.radius + Math.random() * (vesselHeight - this.radius * 2);
      this.speed =
        CONFIG.MIN_SPEED +
        Math.random() * (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED) * 0.5;
      this.angle = Math.random() * Math.PI * 2;
    }
    update() {
      this.x += this.speed;
      this.angle += (Math.random() - 0.5) * 0.1;
      if (this.x > canvas.width + this.width) {
        this.reset();
      }
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillStyle = CONFIG.BACTERIUM_COLOR;
      ctx.beginPath();
      ctx.roundRect(
        -this.width / 2,
        -this.height / 2,
        this.width,
        this.height,
        this.height / 2
      );
      ctx.fill();
      ctx.strokeStyle = CONFIG.BACTERIUM_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2, 0);
      ctx.quadraticCurveTo(-this.width, this.height, -this.width * 1.5, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  
  class Cell {
    constructor(type) {
      this.type = type;
      this.setRadius();
      this.reset(true);
    }
    setRadius() {
      switch (this.type) {
        case "RBC":
          this.radius = 15;
          break;
        case "PLATELET":
          this.radius = 5;
          break;
        case "NEUTROPHIL":
          this.radius = 22;
          break;
        case "LYMPHOCYTE":
          this.radius = 18;
          break;
        case "MONOCYTE":
          this.radius = 24;
          break;
      }
    }
    reset(initial = false) {
      const vesselHeight = canvas.height - (vesselPadding + vesselCurve) * 2;
      const yStart = vesselPadding + vesselCurve;
      this.x = initial ? Math.random() * canvas.width : -this.radius * 2;
      this.baseY =
        yStart + this.radius + Math.random() * (vesselHeight - this.radius * 2);
      this.y = this.baseY;
      this.speed =
        CONFIG.MIN_SPEED +
        Math.random() * (CONFIG.MAX_SPEED - CONFIG.MIN_SPEED);
      this.driftAmplitude = (Math.random() - 0.5) * CONFIG.Y_DRIFT_AMPLITUDE;
      this.driftFrequency = CONFIG.Y_DRIFT_FREQUENCY * (0.5 + Math.random());
      if (this.type === "NEUTROPHIL") this.engulfingTimeout = 0;
      if (this.type === "PLATELET")
        this.shapePoints = this.createIrregularShape();
    }
    createIrregularShape() {
      const points = [];
      const pointCount = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pointCount; i++) {
        const angle = (i / pointCount) * Math.PI * 2;
        const radius = this.radius * (0.7 + Math.random() * 0.6);
        points.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius
        });
      }
      return points;
    }
    update() {
      if (this.type === "NEUTROPHIL") {
        let closestBacterium = null;
        let minDistance = Infinity;
        bacteria.forEach((b) => {
          const d = Math.sqrt((b.x - this.x) ** 2 + (b.y - this.y) ** 2);
          if (d < minDistance) {
            minDistance = d;
            closestBacterium = b;
          }
        });
        if (
          closestBacterium &&
          minDistance < CONFIG.NEUTROPHIL_DETECTION_RADIUS
        ) {
          const dx = closestBacterium.x - this.x;
          const dy = closestBacterium.y - this.y;

          if (minDistance < this.radius) {
            closestBacterium.reset();
            this.engulfingTimeout = CONFIG.NEUTROPHIL_ENGULF_PULSE_FRAMES; 
          } else {
            this.x += (dx / minDistance) * CONFIG.NEUTROPHIL_ATTRACTION_FORCE;
            this.baseY +=
              (dy / minDistance) * CONFIG.NEUTROPHIL_ATTRACTION_FORCE;
          }
        }
        if (this.engulfingTimeout > 0) this.engulfingTimeout--;
      }
      this.x += this.speed;
      this.y =
        this.baseY +
        Math.sin(this.x * this.driftFrequency) * this.driftAmplitude;
      if (this.x > canvas.width + this.radius) this.reset();
    }
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      switch (this.type) {
        case "RBC":
          this.drawRBC();
          break;
        case "PLATELET":
          this.drawPlatelet();
          break;
        case "NEUTROPHIL":
          this.drawNeutrophil();
          break;
        case "LYMPHOCYTE":
          this.drawLymphocyte();
          break;
        case "MONOCYTE":
          this.drawMonocyte();
          break;
      }
      ctx.restore();
    }
    drawRBC() {
      const gradient = ctx.createRadialGradient(
        0,
        0,
        this.radius * 0.4,
        0,
        0,
        this.radius
      );
      gradient.addColorStop(0, CONFIG.RBC_COLOR_INNER);
      gradient.addColorStop(1, CONFIG.RBC_COLOR_OUTER);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.8, Math.PI * 1.3, Math.PI * 1.9);
      ctx.strokeStyle = CONFIG.RBC_HIGHLIGHT;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    drawPlatelet() {
      ctx.beginPath();
      ctx.moveTo(this.shapePoints[0].x, this.shapePoints[0].y);
      this.shapePoints.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = CONFIG.PLATELET_COLOR;
      ctx.fill();
    }
    drawWBC(cytoplasmColor, drawNucleusFn) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = cytoplasmColor;
      ctx.fill();
      const pulse = Math.sin(Date.now() * 0.002) * 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = cytoplasmColor.replace(/, ?0\.\d+\)/, ", 0.2)");
      ctx.fill();
      drawNucleusFn();
    }
    drawNeutrophil() {
      this.drawWBC(CONFIG.NEUTROPHIL_CYTOPLASM, () => {
        ctx.fillStyle = CONFIG.NUCLEUS_COLOR;
        ctx.beginPath();
        ctx.arc(
          -this.radius * 0.4,
          -this.radius * 0.2,
          this.radius * 0.25,
          0,
          Math.PI * 2
        );
        ctx.arc(
          this.radius * 0.3,
          -this.radius * 0.3,
          this.radius * 0.3,
          0,
          Math.PI * 2
        );
        ctx.arc(
          this.radius * 0.4,
          this.radius * 0.3,
          this.radius * 0.25,
          0,
          Math.PI * 2
        );
        ctx.arc(
          -this.radius * 0.2,
          this.radius * 0.4,
          this.radius * 0.3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      // Draw engulfing pulse if active
      if (this.engulfingTimeout > 0) {
        const pulseProgress =
          this.engulfingTimeout / CONFIG.NEUTROPHIL_ENGULF_PULSE_FRAMES;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          this.radius * (1 + (1 - pulseProgress) * 0.5),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255, 255, 150, ${pulseProgress * 0.7})`;
        ctx.fill();
      }
    }
    drawLymphocyte() {
      this.drawWBC(CONFIG.LYMPHOCYTE_CYTOPLASM, () => {
        ctx.fillStyle = CONFIG.NUCLEUS_COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    drawMonocyte() {
      this.drawWBC(CONFIG.MONOCYTE_CYTOPLASM, () => {
        ctx.fillStyle = CONFIG.NUCLEUS_COLOR;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, -Math.PI * 0.4, Math.PI * 0.8, false);
        ctx.arc(
          this.radius * 0.3,
          0,
          this.radius * 0.3,
          Math.PI * 0.8,
          -Math.PI * 0.4,
          true
        );
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  function init() {
    cells = [];
    bacteria = [];
    for (let i = 0; i < CONFIG.RBC_COUNT; i++) cells.push(new Cell("RBC"));
    for (let i = 0; i < CONFIG.PLATELET_COUNT; i++)
      cells.push(new Cell("PLATELET"));
    for (let i = 0; i < CONFIG.NEUTROPHIL_COUNT; i++)
      cells.push(new Cell("NEUTROPHIL"));
    for (let i = 0; i < CONFIG.LYMPHOCYTE_COUNT; i++)
      cells.push(new Cell("LYMPHOCYTE"));
    for (let i = 0; i < CONFIG.MONOCYTE_COUNT; i++)
      cells.push(new Cell("MONOCYTE"));
    cells.sort((a, b) => a.radius - b.radius);
    for (let i = 0; i < CONFIG.BACTERIUM_COUNT; i++)
      bacteria.push(new Bacterium());
  }

  function drawVessel() {
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 15;
    const drawWall = (yPos, curveDir) => {
      const gradient = ctx.createLinearGradient(0, yPos - 10, 0, yPos + 10);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(0.5, CONFIG.VESSEL_WALL_COLOR);
      gradient.addColorStop(1, "transparent");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.quadraticCurveTo(
        canvas.width / 2,
        yPos + curveDir * vesselCurve,
        canvas.width,
        yPos
      );
      ctx.stroke();
    };
    drawWall(vesselPadding, -1);
    drawWall(canvas.height - vesselPadding, 1);
    const drawOutline = (yPos, curveDir) => {
      ctx.strokeStyle = CONFIG.VESSEL_OUTLINE_COLOR;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.quadraticCurveTo(
        canvas.width / 2,
        yPos + curveDir * vesselCurve,
        canvas.width,
        yPos
      );
      ctx.stroke();
    };
    drawOutline(vesselPadding, -1);
    drawOutline(canvas.height - vesselPadding, 1);
    ctx.fillStyle = "rgba(190, 150, 150, 0.6)";
    for (let i = 0; i < canvas.width; i += 150) {
      const x = i + Math.random() * 50;
      const yTop = vesselPadding + 5 + Math.random() * 5;
      const yBottom = canvas.height - vesselPadding - 5 - Math.random() * 5;
      ctx.beginPath();
      ctx.ellipse(x, yTop, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 75, yBottom, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = "transparent";
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawVessel();
    cells.forEach((cell) => {
      cell.update();
      cell.draw();
    });
    bacteria.forEach((b) => {
      b.update();
      b.draw();
    });
    animationFrameId = requestAnimationFrame(animate);
  }

  function startSimulation() {
    introCard.classList.remove("visible");
    introCard.classList.add("hidden");
    setTimeout(() => {
      simulationUI.classList.add("visible");
      init();
      animate();
    }, 500);
  }

  function stopSimulation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    simulationUI.classList.remove("visible");
    infoBox.classList.remove("visible");
    setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      introCard.classList.remove("hidden");
      introCard.classList.add("visible");
    }, 500);
  }

  function exitApplication() {
    introCard.classList.remove("visible");
    introCard.classList.add("hidden");
    setTimeout(() => {
      goodbyeScreen.classList.add("visible");
    }, 500);
  }

  startButton.addEventListener("click", startSimulation);
  backButton.addEventListener("click", stopSimulation);
  exitButton.addEventListener("click", exitApplication);

  canvas.addEventListener("click", (e) => {
    if (!animationFrameId) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    let cellClicked = false;
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i];
      const distance = Math.sqrt(
        (clickX - cell.x) ** 2 + (clickY - cell.y) ** 2
      );
      if (distance < cell.radius) {
        const data = CELL_FACTS[cell.type];
        infoBoxTitle.textContent = data.title;
        infoBoxList.innerHTML = data.facts
          .map((fact) => `<li>${fact}</li>`)
          .join("");
        infoBox.style.left = `${e.clientX + 15}px`;
        infoBox.style.top = `${e.clientY + 15}px`;
        infoBox.classList.add("visible");
        cellClicked = true;
        break;
      }
    }
    if (!cellClicked) infoBox.classList.remove("visible");
  });

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (animationFrameId) init();
  });

  introCard.classList.add("visible");
});

const histologyButton = document.getElementById("histologyButton");
const histologyPanel = document.getElementById("histologyPanel");
const closeHistology = document.getElementById("closeHistology");

if (histologyButton && histologyPanel && closeHistology) {
  histologyButton.addEventListener("click", () => {
    histologyPanel.classList.add("visible");
  });

  closeHistology.addEventListener("click", () => {
    histologyPanel.classList.remove("visible");
  });
}
