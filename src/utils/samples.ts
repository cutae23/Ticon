import { SpriteSheetSample } from "../types";

/**
 * Generates a 6x6 sprite sheet of a rotating golden coin on a transparent background
 */
function generateCoinSpriteSheet(): string {
  const canvas = document.createElement("canvas");
  const cols = 6;
  const rows = 6;
  const cellSize = 128;
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Clear background (completely transparent)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frameIndex = r * cols + c;
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;

      // Draw shadow
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.beginPath();
      // Shadow squashes slightly and follows coin rotation
      const shadowScaleX = Math.abs(Math.cos((frameIndex / 36) * Math.PI * 2));
      ctx.ellipse(cx, cy + 45, 30 * shadowScaleX, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);

      // Rotation angle
      const angle = (frameIndex / 36) * Math.PI * 2;
      const scaleX = Math.cos(angle);
      ctx.scale(scaleX, 1);

      // Outer coin ring
      const goldGrad = ctx.createRadialGradient(-10, -10, 5, 0, 0, 40);
      goldGrad.addColorStop(0, "#FFE082"); // Light gold
      goldGrad.addColorStop(0.5, "#FFB300"); // Mid gold
      goldGrad.addColorStop(1, "#8D6E63"); // Bronze gold border

      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fillStyle = goldGrad;
      ctx.fill();

      // Coin stroke border
      ctx.strokeStyle = "#5D4037"; // Dark brown
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner coin ring
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner gold base
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      const innerGold = ctx.createLinearGradient(-20, -20, 20, 20);
      innerGold.addColorStop(0, "#FFA000");
      innerGold.addColorStop(1, "#FF6F00");
      ctx.fillStyle = innerGold;
      ctx.fill();
      ctx.strokeStyle = "#FF8F00";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw star in center
      ctx.save();
      ctx.fillStyle = "#FFF9C4"; // Soft yellow star
      ctx.strokeStyle = "#E65100"; // Deep orange outline
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";

      const spikes = 5;
      const outerRadius = 14;
      const innerRadius = 6;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        let sx = Math.cos(rot) * outerRadius;
        let sy = Math.sin(rot) * outerRadius;
        ctx.lineTo(sx, sy);
        rot += step;

        sx = Math.cos(rot) * innerRadius;
        sy = Math.sin(rot) * innerRadius;
        ctx.lineTo(sx, sy);
        rot += step;
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Specular highlight line (makes it look glossy)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, 33, -Math.PI / 3, -Math.PI / 6);
      ctx.stroke();

      ctx.restore();

      // Add a sparkly star effect at specific frames
      if (frameIndex % 9 === 0) {
        ctx.save();
        ctx.translate(cx + 25, cy - 25);
        const sparkleScale = 0.5 + 0.5 * Math.sin((frameIndex / 36) * Math.PI);
        ctx.scale(sparkleScale, sparkleScale);

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.quadraticCurveTo(0, 0, 15, 0);
        ctx.quadraticCurveTo(0, 0, 0, 15);
        ctx.quadraticCurveTo(0, 0, -15, 0);
        ctx.quadraticCurveTo(0, 0, 0, -15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Generates a 6x6 sprite sheet of a squishy bouncing red ball with squash & stretch
 */
function generateBallSpriteSheet(): string {
  const canvas = document.createElement("canvas");
  const cols = 6;
  const rows = 6;
  const cellSize = 128;
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Clear background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frameIndex = r * cols + c;
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;

      // Bounce math
      // Two bounce cycles across 36 frames (18 frames per bounce)
      const cycleFrame = frameIndex % 18;
      const progress = cycleFrame / 17; // 0 to 1
      const heightVal = Math.sin(progress * Math.PI); // 0 -> 1 -> 0

      // Ball core Y coordinate (floor is at cy + 35, peak height is cy - 35)
      const floorY = cy + 35;
      const peakHeight = 70;
      const ballY = floorY - heightVal * peakHeight;

      // Squash and stretch factors based on cycle progress
      let sx = 1.0;
      let sy = 1.0;

      // When hitting the floor (progress near 0 or 1), squash!
      if (progress < 0.15) {
        const factor = (0.15 - progress) / 0.15; // 1 to 0
        sx = 1.0 + 0.35 * factor;
        sy = 1.0 - 0.35 * factor;
      } else if (progress > 0.85) {
        const factor = (progress - 0.85) / 0.15; // 0 to 1
        sx = 1.0 + 0.35 * factor;
        sy = 1.0 - 0.35 * factor;
      } else {
        // In mid-air, stretch vertically according to velocity
        // Velocity is high near progress 0.2 and 0.8
        const velocity = Math.abs(Math.cos(progress * Math.PI));
        sx = 1.0 - 0.18 * velocity;
        sy = 1.0 + 0.18 * velocity;
      }

      // Draw shadow on the floor (y = floorY)
      // Shadow scales: bigger/darker on floor, smaller/fainter in air
      const shadowRadius = 32 * (1.0 + (sx - 1.0) * 0.5);
      const shadowAlpha = 0.4 - (heightVal * 0.28);
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(cx, floorY + 4, shadowRadius, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw ball
      ctx.save();
      ctx.translate(cx, ballY);
      ctx.scale(sx, sy);

      // Red/Orange/Pink glossy gradient
      const ballGrad = ctx.createRadialGradient(-10, -15, 5, 0, 0, 32);
      ballGrad.addColorStop(0, "#FF8A80"); // Bright coral
      ballGrad.addColorStop(0.4, "#FF1744"); // Vibrant red
      ballGrad.addColorStop(1, "#880E4F"); // Deep maroon shadow

      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();

      // Stroke outline
      ctx.strokeStyle = "#2D0014";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Highlights
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      ctx.arc(-10, -10, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(-5, -5, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  return canvas.toDataURL("image/png");
}

/**
 * Generates a 6x6 sprite sheet of a rotating neon magic portal orb
 */
function generatePortalSpriteSheet(): string {
  const canvas = document.createElement("canvas");
  const cols = 6;
  const rows = 6;
  const cellSize = 128;
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const frameIndex = r * cols + c;
      const cx = c * cellSize + cellSize / 2;
      const cy = r * cellSize + cellSize / 2;

      ctx.save();
      ctx.translate(cx, cy);

      const angle = (frameIndex / 36) * Math.PI * 2;

      // Glow backdrop
      const glowGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 45);
      glowGrad.addColorStop(0, "rgba(0, 229, 255, 0.4)");
      glowGrad.addColorStop(0.5, "rgba(213, 0, 249, 0.2)");
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.fill();

      // Outer dashed energy rings (rotates forward)
      ctx.save();
      ctx.rotate(angle);
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Inner dashed energy ring (rotates backwards)
      ctx.save();
      ctx.rotate(-angle * 1.5);
      ctx.strokeStyle = "#D500F9";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Center glowing core
      const corePulse = 1.0 + 0.12 * Math.sin(angle * 3);
      const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 15 * corePulse);
      coreGrad.addColorStop(0, "#FFFFFF");
      coreGrad.addColorStop(0.3, "#E0F7FA");
      coreGrad.addColorStop(0.7, "#00E5FF");
      coreGrad.addColorStop(1, "rgba(213, 0, 249, 0.8)");

      ctx.save();
      ctx.scale(corePulse, corePulse);
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.restore();

      // Orbiting particles (rotating around the core)
      const numParticles = 4;
      for (let i = 0; i < numParticles; i++) {
        const pAngle = angle + (i * Math.PI * 2) / numParticles;
        const dist = 26 + 6 * Math.sin(angle * 2 + i);
        const px = Math.cos(pAngle) * dist;
        const py = Math.sin(pAngle) * dist;

        ctx.fillStyle = i % 2 === 0 ? "#00E5FF" : "#FFFFFF";
        ctx.beginPath();
        ctx.arc(px, py, 3 + Math.sin(angle * 4 + i), 0, Math.PI * 2);
        ctx.fill();

        // Little particle trails
        ctx.fillStyle = "rgba(0, 229, 255, 0.3)";
        ctx.beginPath();
        ctx.arc(
          Math.cos(pAngle - 0.15) * dist,
          Math.sin(pAngle - 0.15) * dist,
          2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.restore();
    }
  }

  return canvas.toDataURL("image/png");
}

export const sampleCoin = generateCoinSpriteSheet();
export const sampleBall = generateBallSpriteSheet();
export const samplePortal = generatePortalSpriteSheet();

export const samples: SpriteSheetSample[] = [
  {
    id: "gold_coin",
    name: "Golden Coin (회전하는 금화)",
    description: "36프레임으로 부드럽게 360도 회전하는 입체적인 금화 애니메이션입니다. 그림자 효과와 광원 반짝임이 포함되어 있습니다.",
    imageUrl: sampleCoin,
    cols: 6,
    rows: 6,
    fps: 20
  },
  {
    id: "bouncing_ball",
    name: "Squishy Ball (바운싱 볼)",
    description: "가속도와 스쿼시 앤 스트레치(Squash & Stretch) 물리 애니메이션 기법이 조화롭게 적용된 통통 튀는 빨간 공입니다.",
    imageUrl: sampleBall,
    cols: 6,
    rows: 6,
    fps: 24
  },
  {
    id: "portal_orb",
    name: "Neon Portal (네온 매직 포탈)",
    description: "회전하는 에너지 고리와 궤도를 공전하는 오라 입자들로 구성된 빛나는 신비로운 우주 네온 구체 포탈입니다.",
    imageUrl: samplePortal,
    cols: 6,
    rows: 6,
    fps: 15
  }
];
