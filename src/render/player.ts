import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { SavedGame, Settings } from '../game/save';
import type { Axes } from './input';
export interface Solid { x: number; y: number; z: number; hx: number; hy: number; hz: number }
let ready: Promise<void> | undefined;
export function initPhysics(): Promise<void> { return ready ??= RAPIER.init(); }
export class Player {
  readonly position = new T.Vector3();
  private previous = new T.Vector3();
  yaw: number; pitch: number; speed = 0;
  private world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private walkingTime = 0;
  constructor(private camera: T.PerspectiveCamera, solids: readonly Solid[], private bounds: { width: number; depth: number }, pose?: SavedGame['pose']) {
    const x = pose?.x ?? -bounds.width / 2 + 1.2, z = pose?.z ?? -bounds.depth / 2 + 1.5;
    this.yaw = pose?.yaw ?? 0; this.pitch = pose?.pitch ?? -.9;
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(bounds.width / 2 + 15, .2, bounds.depth / 2 + 15).setTranslation(0, -.2, 0));
    for (const s of solids) this.world.createCollider(RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz).setTranslation(s.x, s.y, s.z));
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, .84, z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(.54, .28), this.body);
    this.controller = this.world.createCharacterController(.015);
    this.controller.enableAutostep(.22, .15, false);
    this.controller.enableSnapToGround(.3);
    this.position.set(x, .84, z);
    this.previous.copy(this.position);
    this.world.step();
  }
  look(dx: number, dy: number, settings: Settings): void {
    this.yaw -= dx * .002 * settings.sensitivity;
    this.pitch = T.MathUtils.clamp(this.pitch - dy * .002 * settings.sensitivity * (settings.invertY ? -1 : 1), -1.48, 1.48);
  }
  update(dt: number, axes: Axes, settings: Settings): void {
    const pace = axes.sprint ? 5.2 : 3.1;
    const dx = (axes.x * Math.cos(this.yaw) + axes.z * Math.sin(this.yaw)) * pace * dt;
    const dz = (-axes.x * Math.sin(this.yaw) + axes.z * Math.cos(this.yaw)) * pace * dt;
    this.controller.computeColliderMovement(this.collider, { x: dx, y: -.25, z: dz });
    const corrected = this.controller.computedMovement(), old = this.body.translation();
    this.body.setNextKinematicTranslation({ x: T.MathUtils.clamp(old.x + corrected.x, -this.bounds.width / 2 - 3.5, this.bounds.width / 2 + 3.5), y: old.y + corrected.y, z: T.MathUtils.clamp(old.z + corrected.z, -this.bounds.depth / 2 - 3.5, this.bounds.depth / 2 + 3.5) });
    this.world.timestep = dt; this.world.step();
    const p = this.body.translation();
    this.previous.copy(this.position);
    this.speed = Math.hypot(p.x - this.position.x, p.z - this.position.z) / Math.max(dt, .001);
    this.position.set(p.x, p.y, p.z);
    this.walkingTime += dt * Math.min(this.speed, 5);
    this.render(1, settings);
  }
  /** Interpolate fixed-step translation; apply mouse look on every display frame. */
  render(alpha: number, settings: Settings): void {
    const bob = settings.headBob && !settings.reducedMotion ? Math.sin(this.walkingTime * 3) * .018 * Math.min(this.speed, 1) : 0;
    this.camera.position.lerpVectors(this.previous, this.position, T.MathUtils.clamp(alpha, 0, 1));
    this.camera.position.y += .82 + bob;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.camera.fov !== settings.fov) { this.camera.fov = settings.fov; this.camera.updateProjectionMatrix(); }
  }
  pose(): SavedGame['pose'] { return { x: this.position.x, z: this.position.z, yaw: this.yaw, pitch: this.pitch }; }
  dispose(): void { this.world.free(); }
}
