const TAU = Math.PI * 2;
const DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/** Playback policy shared by a sprite preview and a later game adapter.
 * Clip phase follows distance, so changing speed does not slide the feet.
 * This module does not invent or generate image frames.
 */
export class Locomotion {
  constructor(config) {
    this.config = config;
    this.x = 0;
    this.y = 0;
    this.velocity = { x: 0, y: 0 };
    this.phase = 0;
    this.idleTime = 0;
    this.direction = 'south';
    this.moving = false;
    this.motionWeight = 0;
  }

  update(deltaSeconds, axis, maxSpeed, { paused = false } = {}) {
    if (paused) return this.snapshot();
    const dt = Math.max(0, Math.min(deltaSeconds, this.config.maxDeltaSeconds));
    const length = Math.hypot(axis.x, axis.y);
    const factor = maxSpeed / Math.max(1, length);
    const target = { x: axis.x * factor, y: axis.y * factor };
    const response = length > 0 ? this.config.accelerationResponseSeconds : this.config.decelerationResponseSeconds;
    const blend = 1 - Math.exp(-dt / response);
    this.velocity.x += (target.x - this.velocity.x) * blend;
    this.velocity.y += (target.y - this.velocity.y) * blend;
    let speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (!length && speed < this.config.idleThreshold) {
      this.velocity.x = 0;
      this.velocity.y = 0;
      speed = 0;
    }
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    this.x += dx;
    this.y += dy;
    this.phase = (this.phase + Math.hypot(dx, dy) / this.config.strideLengthUnits) % 1;
    this.moving = speed > (this.moving ? this.config.idleThreshold : this.config.movingThreshold);
    const settle = 1 - Math.exp(-dt / (this.moving ? 0.075 : 0.10));
    this.motionWeight += ((this.moving ? 1 : 0) - this.motionWeight) * settle;
    if (this.motionWeight < 0.0001) this.motionWeight = 0;
    if (this.moving) {
      const angle = (Math.atan2(this.velocity.y, this.velocity.x) + TAU) % TAU;
      const currentAngle = DIRECTIONS.indexOf(this.direction) * Math.PI / 4;
      const threshold = Math.PI / 8 + this.config.directionHysteresisDegrees * Math.PI / 180;
      if (angleDistance(angle, currentAngle) > threshold) {
        this.direction = DIRECTIONS[Math.round(angle / (Math.PI / 4)) % DIRECTIONS.length];
      }
      this.idleTime = 0;
    } else {
      this.idleTime += dt;
    }
    return this.snapshot();
  }

  frame(frameCount) {
    if (!Number.isInteger(frameCount) || frameCount < 1) throw new Error('A real clip with one or more frames is required.');
    return this.moving
      ? Math.floor(this.phase * frameCount) % frameCount
      : Math.floor(this.idleTime * this.config.idleFramesPerSecond) % frameCount;
  }

  snapshot() {
    return { x: this.x, y: this.y, speed: Math.hypot(this.velocity.x, this.velocity.y), direction: this.direction, phase: this.phase, moving: this.moving, motionWeight: this.motionWeight };
  }
}
