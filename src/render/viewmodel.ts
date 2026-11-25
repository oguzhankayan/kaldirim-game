import * as T from 'three';
import type { Phase } from '../game/session';
import { Materials } from './materials';
import { handheld, disposeGeometry } from './models';

/** Only the small hand tool belongs in the camera. Machines work through the ground preview. */
export class ViewModel {
  readonly group = new T.Group();
  private recoil = 0;
  private motion = true;

  constructor(materials: Materials) {
    this.group.name = 'first-person-hand';
    this.group.add(handheld(materials, 0));
    this.group.scale.setScalar(.62);
    this.group.position.set(.36, -.50, -1.14);
    this.group.rotation.set(.06, -.06, 0);
    this.group.visible = false;
  }

  setReducedMotion(reduced: boolean): void { this.motion = !reduced; }
  impact(): void { this.recoil = 1; }

  update(dt: number, time: number, tier: number, phase: Phase, progress: number, walking: boolean, inventory: number): void {
    // Do not construct or render clamp/row-layer/K-48/compactor viewmodels. Their bars used to
    // cover the actual aiming point. Hide an empty hand as well; the HUD still identifies the tool.
    this.group.visible = phase === 'laying' && tier === 0 && inventory > 0;
    this.recoil = Math.max(0, this.recoil - dt * 6);
    if (!this.group.visible) return;
    const stroke = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
    this.group.position.x = .36 + (this.motion && walking ? Math.sin(time * 7) * .008 : 0);
    this.group.position.y = -.50 - (this.motion ? stroke * .05 + this.recoil * .04 : 0);
    this.group.position.z = -1.14 - (this.motion ? stroke * .07 : 0);
    this.group.rotation.x = .06 + (this.motion ? stroke * .07 + this.recoil * .04 : 0);
    this.group.rotation.z = this.motion && walking ? Math.sin(time * 7) * .005 : 0;
  }

  dispose(): void { disposeGeometry(this.group); this.group.clear(); }
}
