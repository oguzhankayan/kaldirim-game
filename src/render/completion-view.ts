import * as T from 'three';
/** A skippable camera presentation; the player pose and authoritative job stay untouched. */
export class CompletionView {
  active = false;
  before = false;
  label: 'lift' | 'before' | 'after' = 'after';
  private age = 0;
  private firstFrame = true;
  private reduced = false;
  private start = new T.Vector3();
  private end = new T.Vector3();
  private startRotation = new T.Quaternion();
  private endRotation = new T.Quaternion();
  begin(camera: T.PerspectiveCamera, width: number, depth: number, reduced: boolean): void {
    this.active = true; this.age = 0; this.reduced = reduced; this.before = false; this.firstFrame = true;
    this.label = reduced ? 'after' : 'lift';
    this.start.copy(camera.position); this.startRotation.copy(camera.quaternion);
    const halfFov = Math.min(Math.atan(Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), T.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.hypot(width, depth) * .56 / Math.sin(halfFov);
    this.end.set(.38, 1, .65).normalize().multiplyScalar(distance);
    const helper = new T.PerspectiveCamera(); helper.position.copy(this.end); helper.lookAt(0, 0, 0); this.endRotation.copy(helper.quaternion);
    this.pose(camera);
  }
  /** Real presentation time, not clamped physics time. Every stage gets at least one frame. */
  update(dt: number, camera: T.PerspectiveCamera): boolean {
    if (!this.active) return false;
    // The frame in which completion begins still includes time spent on the preceding work.
    if (this.firstFrame) this.firstFrame = false;
    else this.age += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this.label === 'lift' && this.age >= 1.05) { this.label = 'before'; this.age = 0; }
    else if (this.label === 'before' && this.age >= 1.6) { this.label = 'after'; this.age = 0; }
    else if (this.label === 'after' && this.age >= (this.reduced ? 2.2 : 2.65)) {
      this.active = false; this.before = false; this.pose(camera); return true;
    }
    this.before = this.label === 'before'; this.pose(camera); return false;
  }
  private pose(camera: T.PerspectiveCamera): void {
    const t = this.label === 'lift' ? Math.min(1, this.age / 1.05) : 1, eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(this.start, this.end, eased);
    camera.quaternion.slerpQuaternions(this.startRotation, this.endRotation, eased);
  }
  cancel(): void { this.active = this.before = false; }
}
