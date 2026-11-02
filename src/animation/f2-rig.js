const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, n) => a.map(v => v * n);
const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const norm = a => mul(a, 1 / (Math.hypot(...a) || 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;

export const DIRECTION_ANGLES = { east: 0, 'south-east': Math.PI / 4, south: Math.PI / 2, 'south-west': Math.PI * 3 / 4, west: Math.PI, 'north-west': Math.PI * 5 / 4, north: Math.PI * 3 / 2, 'north-east': Math.PI * 7 / 4 };

export function projectedStride(config, gait, direction) {
  const angle = DIRECTION_ANGLES[direction], [sx, sy] = config.cameraGroundScale;
  const f = norm([Math.cos(angle) / (2 * sx) + Math.sin(angle) / (2 * sy), 0, -Math.cos(angle) / (2 * sx) + Math.sin(angle) / (2 * sy)]);
  return config.gaits[gait].stride * Math.hypot((f[0] - f[2]) * sx, (f[0] + f[2]) * sy);
}

/** A planted foot moves backwards at root speed during stance.
 * During swing it lifts, passes the supporting foot, and returns in front.
 */
export function footCycle(phase, gait) {
  if (!gait.stride) return { forward: 0, lift: 0, contact: true, roll: 0 };
  const p = ((phase % 1) + 1) % 1, duty = gait.stanceFraction;
  const half = gait.stride * duty / 2;
  if (p < duty) return { forward: half - gait.stride * p, lift: 0, contact: true, roll: Math.max(0, p / duty - 0.66) / 0.34 };
  const s = (p - duty) / (1 - duty), ease = s * s * (3 - 2 * s);
  return { forward: mix(-half, half, ease), lift: Math.sin(Math.PI * s) ** 1.15 * gait.lift, contact: false, roll: 0 };
}

export function kneeJoint(hip, ankle, forward, upper, lower) {
  const delta = sub(ankle, hip), d = clamp(Math.hypot(...delta), 0.001, upper + lower - 0.0001), axis = norm(delta);
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const bend = norm(sub(forward, mul(axis, dot(forward, axis))));
  return add(add(hip, mul(axis, along)), mul(bend, Math.sqrt(Math.max(0, upper * upper - along * along))));
}

function shade(hex, value) {
  const rgb = hex.slice(1).match(/../g).map(v => parseInt(v, 16));
  return '#' + rgb.map(v => clamp(Math.round(v * value), 0, 255).toString(16).padStart(2, '0')).join('');
}

/** Hard pixel primitives shared by browser and offline export. */
export class PixelPaint {
  constructor(ctx) { this.ctx = ctx; }
  polygon(vertices, color) {
    this.ctx.fillStyle = color;
    const top = Math.ceil(Math.min(...vertices.map(p => p[1])) - 0.5), bottom = Math.floor(Math.max(...vertices.map(p => p[1])) - 0.5);
    for (let y = top; y <= bottom; y++) {
      const xs = [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) xs.push(a[0] + (y + 0.5 - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const left = Math.ceil(xs[i] - 0.5), right = Math.floor(xs[i + 1] - 0.5);
        if (right >= left) this.ctx.fillRect(left, y, right - left + 1, 1);
      }
    }
  }
  ellipse(x, y, rx, ry, color) {
    this.ctx.fillStyle = color;
    for (let yy = Math.ceil(y - ry - 0.5); yy <= Math.floor(y + ry - 0.5); yy++) {
      const k = 1 - ((yy + 0.5 - y) / ry) ** 2;
      if (k < 0) continue;
      const span = rx * Math.sqrt(k), left = Math.ceil(x - span - 0.5), right = Math.floor(x + span - 0.5);
      if (right >= left) this.ctx.fillRect(left, yy, right - left + 1, 1);
    }
  }
  segment(a, b, radius, color) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d * 1.5));
    for (let i = 0; i <= n; i++) this.ellipse(mix(a[0], b[0], i / n), mix(a[1], b[1], i / n), radius, radius, color);
  }
}

export function extractF2Face(imageData) {
  const { width, data } = imageData, result = [];
  for (let y = 10; y <= 25; y++) for (let x = 24; x <= 42; x++) {
    const i = (y * width + x) * 4, [r, g, b, a] = data.slice(i, i + 4);
    const blue = b > r * 1.12 && b >= g * 0.9 && g < 125;
    const cyan = g > 160 && b > 140 && r < g * 0.9;
    if (a && (blue || cyan)) result.push({ u: (x - 24) / 19, v: (y - 10) / 16, color: `rgb(${r},${g},${b})` });
  }
  return { width: 19, height: 16, pixels: result };
}

export class F2Rig {
  constructor(config, faceTexture = null) { this.config = config; this.faceTexture = faceTexture; }
  pose({ phase = 0, direction = 'south', gait = 'run', time = 0, motionWeight = gait === 'idle' ? 0 : 1 } = {}) {
    const c = this.config, m = c.model, originalGait = c.gaits[gait], angle = DIRECTION_ANGLES[direction];
    if (!originalGait || angle === undefined) throw new Error('Unknown F2 gait/direction');
    const weight = clamp(motionWeight, 0, 1);
    const g = { ...originalGait, stride: originalGait.stride * weight, lift: originalGait.lift * weight, bob: originalGait.bob * weight, lean: originalGait.lean * weight, armSwing: originalGait.armSwing * weight };
    // Inverse isometric projection: heading follows screen-space input.
    const screenX = Math.cos(angle), screenY = Math.sin(angle);
    const f = norm([screenX / (2 * c.cameraGroundScale[0]) + screenY / (2 * c.cameraGroundScale[1]), 0, -screenX / (2 * c.cameraGroundScale[0]) + screenY / (2 * c.cameraGroundScale[1])]);
    const r = [-f[2], 0, f[0]];
    const idleBob = Math.sin(time * TAU / 2.4) * c.gaits.idle.bob;
    const bob = (gait === 'idle' ? 0 : -Math.cos((phase - (gait === 'run' ? 0.14 : 0)) * TAU * 2) * g.bob) + idleBob * (1 - weight);
    const cycles = [footCycle(phase, g), footCycle(phase + 0.5, g)];
    const reach = m.upperLeg + m.lowerLeg - 0.008;
    let hipY = m.hipHeight + bob;
    for (const cycle of cycles) {
      const maxHeight = 0.065 + cycle.lift + cycle.roll * 0.035 + Math.sqrt(Math.max(0.001, reach * reach - cycle.forward * cycle.forward));
      hipY = Math.min(hipY, maxHeight);
    }
    const sway = Math.sin(phase * TAU) * (gait === 'walk' ? 0.014 : gait === 'run' ? 0.009 : 0) * weight;
    const local = (u, h, v = 0) => add(add(mul(r, u + sway), mul(f, v)), [0, h, 0]);
    const leanAt = h => g.lean * clamp((h - hipY) / 0.7, 0, 1);
    const body = (u, h, v = 0) => local(u, h, v + leanAt(h));
    const legs = [1, -1].map((side, index) => {
      const cycle = cycles[index], u = side * m.hipWidth / 2;
      const hip = local(u, hipY), ankle = local(u, 0.065 + cycle.lift + cycle.roll * 0.035, cycle.forward);
      return { side, cycle, hip, ankle, knee: kneeJoint(hip, ankle, f, m.upperLeg, m.lowerLeg) };
    });
    const arms = [1, -1].map((side, index) => {
      const p = phase + index * 0.5;
      // Arm swings opposite the same-side leg; the heavy wrench damps the dominant arm.
      const swing = -Math.sin(p * TAU) * g.armSwing * (side === 1 ? 0.7 : 1);
      const shoulder = body(side * m.shoulderWidth / 2, hipY + 0.315);
      const elbow = add(shoulder, add(mul(f, Math.sin(swing) * m.upperArm), [0, -Math.cos(swing) * m.upperArm, 0]));
      const foreAngle = swing + mix(0.12, gait === 'run' ? 0.48 : 0.16, weight);
      const wrist = add(elbow, add(mul(f, Math.sin(foreAngle) * m.lowerArm), [0, -Math.cos(foreAngle) * m.lowerArm, 0]));
      return { side, shoulder, elbow, wrist };
    });
    return { phase, direction, gait, time, motionWeight: weight, f, r, hipY, local, body, leanAt, legs, arms, head: body(0, hipY + m.headHeightAboveHip + (m.hipHeight - hipY) * 0.6), faceVisible: dot(f, norm([1, 0, 1])) > -0.2 };
  }

  render(ctx, state = {}, options = {}) {
    const c = this.config, m = c.model, p = c.palette, pose = this.pose(state), paint = new PixelPaint(ctx), queue = [];
    const scale = options.scale || c.pixelsPerUnit, origin = options.origin || c.origin;
    const project = v => [origin[0] + (v[0] - v[2]) * c.cameraGroundScale[0] * scale, origin[1] + ((v[0] + v[2]) * c.cameraGroundScale[1] - v[1]) * scale];
    const depth = v => v[0] + v[2] + v[1] * 0.9;
    const poly = (vertices, color, bias = 0) => {
      const center = vertices.reduce((s, v) => add(s, mul(v, 1 / vertices.length)), [0, 0, 0]);
      queue.push({ depth: depth(center) + bias, draw: () => paint.polygon(vertices.map(project), color) });
    };
    const disk = (center, rx, ry, color, bias = 0) => queue.push({ depth: depth(center) + bias, draw: () => { const s = project(center); paint.ellipse(s[0], s[1], rx * scale, ry * scale, color); } });
    const bone = (a, b, radius, color) => queue.push({ depth: (depth(a) + depth(b)) / 2, draw: () => {
      const aa = project(a), bb = project(b);
      paint.segment(aa, bb, radius * scale + 0.8, p.outline);
      paint.segment(aa, bb, radius * scale, shade(color, 0.83));
      paint.segment([aa[0] - 0.4, aa[1] - 0.6], [bb[0] - 0.4, bb[1] - 0.6], Math.max(0.5, radius * scale * 0.62), color);
    } });
    const plane = (center, width, height, color, bias = 0) => {
      const at = (u, h) => add(add(center, mul(pose.r, u)), [0, h, 0]);
      poly([at(-width / 2, height / 2), at(width / 2, height / 2), at(width / 2, -height / 2), at(-width / 2, -height / 2)], color, bias);
    };
    const box = (center, width, height, length, color, bias = 0, pitch = 0) => {
      const at = (u, h, v) => add(add(add(center, mul(pose.r, u)), mul(pose.f, v * Math.cos(pitch) + h * Math.sin(pitch))), [0, h * Math.cos(pitch) - v * Math.sin(pitch), 0]);
      const vs = [-1, 1].flatMap(h => [-1, 1].flatMap(v => [-1, 1].map(u => at(u * width / 2, h * height / 2, v * length / 2))));
      for (const [indices, light] of [[[4, 5, 7, 6], 1.1], [[0, 1, 5, 4], 0.7], [[2, 3, 7, 6], 1], [[0, 2, 6, 4], 0.83], [[1, 3, 7, 5], 0.92]]) poly(indices.map(i => vs[i]), shade(color, light), bias);
    };
    const shell = (center, radii, color) => {
      const [rx, ry, rz] = radii;
      const vertex = (lat, lon) => add(center, [Math.sin(lat) * Math.cos(lon) * rx, Math.cos(lat) * ry, Math.sin(lat) * Math.sin(lon) * rz]);
      for (let a = 0; a < 7; a++) for (let b = 0; b < 14; b++) {
        const lat = (a + 0.5) / 7 * Math.PI, lon = (b + 0.5) / 14 * TAU;
        const normal = [Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon)];
        if (dot(normal, norm([1, 1.6, 1])) < -0.05) continue;
        const lighting = 0.94 + clamp(dot(normal, norm([-0.5, 1, -0.4])), -0.3, 0.7) * 0.1;
        poly([vertex(a / 7 * Math.PI, b / 14 * TAU), vertex((a + 1) / 7 * Math.PI, b / 14 * TAU), vertex((a + 1) / 7 * Math.PI, (b + 1) / 14 * TAU), vertex(a / 7 * Math.PI, (b + 1) / 14 * TAU)], shade(color, lighting));
      }
    };

    if (options.shadow !== false) {
      const center = project([0, 0, 0]); paint.ellipse(center[0], center[1] + 1, 0.24 * scale, 0.08 * scale, '#b4b39c');
    }
    for (const leg of pose.legs) {
      bone(leg.hip, leg.knee, 0.066, p.metalDark);
      bone(leg.knee, leg.ankle, 0.064, p.joint);
      disk(leg.knee, 0.058, 0.047, p.outline, 0.02);
      const patch = add(leg.knee, mul(pose.f, 0.035));
      plane(patch, 0.08, 0.075, leg.side === 1 ? p.cloth : shade(p.cloth, 0.92), 0.035);
      const foot = add(leg.ankle, add(mul(pose.f, 0.025), [0, -0.027, 0]));
      const footPitch = Math.atan2(leg.cycle.roll * 0.035, m.footLength / 2);
      box(foot, m.footWidth, 0.078, m.footLength, p.sole, 0, footPitch);
      box(add(foot, [0, 0.045, 0]), m.footWidth * 0.95, 0.075, m.footLength * 0.9, p.boot, 0, footPitch);
    }

    box(pose.body(0, pose.hipY + 0.025), 0.21, 0.12, 0.16, p.joint);
    box(pose.body(0, pose.hipY + 0.19), m.torsoWidth, m.torsoHeight, m.torsoDepth, p.metal, 0.01, pose.torsoPitch || 0);

    for (const arm of pose.arms) {
      disk(arm.shoulder, 0.082, 0.067, p.outline);
      bone(arm.shoulder, arm.elbow, 0.063, p.metalDark);
      disk(add(arm.shoulder, mul(pose.f, 0.017)), 0.071, 0.055, p.cloth, 0.02);
      bone(arm.elbow, arm.wrist, 0.058, p.joint);
      disk(arm.elbow, 0.047, 0.039, p.goldDark, 0.015);
      disk(arm.wrist, 0.061, 0.053, p.outline, 0.025);
      disk(add(arm.wrist, [0, 0.008, 0]), 0.048, 0.038, p.metalDark, 0.035);
    }
    const right = pose.arms.find(a => a.side === 1);
    const weaponDir = pose.weaponDirection || norm(add(mul(norm(sub(right.wrist, right.elbow)), 0.8), mul(pose.f, -0.12)));
    const end = add(right.wrist, mul(weaponDir, m.wrenchLength));
    bone(right.wrist, end, 0.018, p.wrench);
    const jawCenter = add(end, mul(weaponDir, 0.018));
    const jaw = [[-0.065, -0.02], [-0.065, 0.035], [-0.043, 0.065], [-0.02, 0.065], [-0.02, 0.012], [0.02, 0.012], [0.02, 0.065], [0.043, 0.065], [0.065, 0.035], [0.065, -0.02]];
    poly(jaw.map(([u, v]) => add(add(jawCenter, mul(pose.weaponAcross || pose.r, u)), mul(weaponDir, v))), p.wrench, 0.04);

    if (pose.faceVisible) {
      const gear = pose.body(-0.068, pose.hipY + 0.238, m.torsoDepth / 2 + 0.015);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8, center = add(gear, add(mul(pose.r, Math.cos(a) * 0.055), [0, Math.sin(a) * 0.055, 0]));
        plane(center, 0.035, 0.032, p.gold, 0.04);
      }
      plane(gear, 0.09, 0.09, p.goldDark, 0.05);
      plane(add(gear, [0, 0.009, 0]), 0.067, 0.067, p.gold, 0.06);
      plane(gear, 0.024, 0.024, p.goldDark, 0.07);
      plane(pose.body(0.087, pose.hipY + 0.115, m.torsoDepth / 2 + 0.02), 0.038, 0.045, p.red, 0.07);
    } else {
      const key = pose.body(0, pose.hipY + 0.22, -m.torsoDepth / 2 - 0.07);
      bone(key, add(key, mul(pose.r, 0.105)), 0.024, p.goldDark);
      disk(add(key, mul(pose.r, 0.095)), 0.05, 0.039, p.gold);
    }

    const scarfH = pose.hipY + 0.415;
    bone(pose.body(0, scarfH), add(pose.head, [0, -m.headRadii[1] + 0.035, 0]), 0.067, p.joint);
    box(pose.body(0, scarfH), 0.28, 0.065, 0.24, p.scarfDark, 0.015);
    plane(pose.body(0, scarfH + 0.013, 0.135), 0.245, 0.04, p.scarf, 0.03);
    const clothSway = delay => pose.motionWeight * Math.sin(pose.phase * TAU - delay) + (1 - pose.motionWeight) * Math.sin(pose.time * TAU / 2.4 - delay);
    const tail = [pose.body(0.11, scarfH + 0.01, -0.08), pose.body(0.15, scarfH - 0.03 + clothSway(0.7) * 0.018, -0.24), pose.body(0.18, scarfH - 0.07 + clothSway(1.3) * 0.025, -0.38)];
    poly([tail[0], add(tail[0], mul(pose.r, -0.07)), add(tail[1], mul(pose.r, -0.07)), tail[1]], p.scarfDark);
    poly([tail[1], add(tail[1], mul(pose.r, -0.07)), add(tail[2], mul(pose.r, -0.07)), tail[2]], p.scarf);

    const head2D = project(pose.head), headRx = m.headRadii[0] * 1.225 * scale, headRy = m.headRadii[1] * 1.19 * scale;
    queue.push({ depth: depth(pose.head) - 0.31, draw: () => paint.ellipse(head2D[0], head2D[1], headRx + 0.8, headRy + 0.8, p.outline) });
    shell(pose.head, m.headRadii, p.ivory);
    for (const side of [1, -1]) {
      const ear = add(pose.head, add(mul(pose.r, side * 0.265), [0, -0.015, 0]));
      disk(ear, 0.07, 0.095, p.outline);
      disk(add(ear, mul(pose.r, side * 0.012)), 0.06, 0.082, p.goldDark, 0.01);
      disk(add(ear, mul(pose.r, side * 0.017)), 0.043, 0.06, p.gold, 0.02);
    }
    // The patch sits on the same anatomical side as the approved reference.
    const patch = add(pose.head, add(add(mul(pose.r, 0.145), mul(pose.f, 0.085)), [0, 0.175, 0]));
    plane(patch, 0.12, 0.085, p.cloth, 0.055);
    for (const u of [-0.035, 0.01, 0.04]) plane(add(patch, add(mul(pose.r, u), [0, 0.012, 0])), 0.012, 0.027, p.ivory, 0.07);
    if (pose.faceVisible) {
      const surface = (u, h) => {
        const height = h - 0.025;
        const fwd = m.headRadii[2] * Math.sqrt(Math.max(0.025, 1 - (u / m.headRadii[0]) ** 2 - (height / m.headRadii[1]) ** 2)) + 0.008;
        const pitch = pose.headPitch || 0;
        return add(pose.head, add(add(mul(pose.r, u), mul(pose.f, fwd * Math.cos(pitch) + height * Math.sin(pitch))), [0, height * Math.cos(pitch) - fwd * Math.sin(pitch), 0]));
      };
      const screenPixel = (u, h, w, height, color) => {
        const heightFromCenter = h - 0.025;
        const fwd = m.headRadii[2] * Math.sqrt(Math.max(0.025, 1 - (u / m.headRadii[0]) ** 2 - (heightFromCenter / m.headRadii[1]) ** 2));
        const normal = add(add(mul(pose.r, u / m.headRadii[0] ** 2), mul(pose.f, fwd / m.headRadii[2] ** 2)), [0, heightFromCenter / m.headRadii[1] ** 2, 0]);
        if (dot(norm(normal), norm([1, 1, 1])) <= 0.03) return;
        const vertices = [surface(u - w / 2, h + height / 2), surface(u + w / 2, h + height / 2), surface(u + w / 2, h - height / 2), surface(u - w / 2, h - height / 2)];
        // The display is a decal on the shell, never hidden by coarse shell facets.
        queue.push({ depth: depth(pose.head) + 0.75, draw: () => paint.polygon(vertices.map(project), color) });
      };
      if (this.faceTexture) {
        const texture = this.faceTexture, w = m.faceWidth / texture.width, h = m.faceHeight / texture.height;
        for (const pixel of texture.pixels) {
          const rgb = pixel.color.match(/\d+/g).map(Number), cyan = rgb[1] > 160 && rgb[2] > 140 && rgb[0] < rgb[1] * 0.9;
          const power = pose.facePower ?? 1;
          if (cyan && power < 0.3) continue;
          let height = (0.5 - pixel.v - 0.5 / texture.height) * m.faceHeight;
          if (cyan && pose.faceFlinch) height = (height - 0.01) * (1 - pose.faceFlinch * 0.82) + 0.01;
          const color = cyan && power < 1 ? `rgb(${rgb.map(v => Math.round(v * power)).join(',')})` : pixel.color;
          screenPixel((0.5 - pixel.u - 0.5 / texture.width) * m.faceWidth, height, w * 1.12, h * (cyan && pose.faceFlinch ? 0.55 : 1.1), color);
        }
        if ((pose.facePower ?? 1) < 0.3) screenPixel(0, -0.035, 0.09, 0.018, shade(p.cyan, Math.max(0.18, pose.facePower)));
      } else {
        screenPixel(0, 0, m.faceWidth, m.faceHeight, p.navy);
        for (const u of [-0.07, 0.07]) screenPixel(u, 0.015, 0.04, 0.075, p.cyan);
        screenPixel(0, -0.078, 0.05, 0.018, p.cyan);
      }
    }

    queue.sort((a, b) => a.depth - b.depth);
    for (const item of queue) item.draw();
    return pose;
  }
}
