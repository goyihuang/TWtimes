import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 兩種視角：鳥瞰（拖曳旋轉、滾輪縮放）與漫步（WASD／方向鍵、拖曳轉頭、手機搖桿）
export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom; this.mode = 'orbit';
    this.orbit = new OrbitControls(camera, dom);
    Object.assign(this.orbit, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.495, minDistance: 3, maxDistance: 1600, screenSpacePanning: false });
    this.keys = new Set(); this.yaw = 0; this.pitch = 0; this.eye = 1.6; this.stick = { x: 0, y: 0 };
    this.tween = null;
    addEventListener('keydown', e => { if (e.target.closest('input,select,textarea')) return; this.keys.add(e.code); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dom.addEventListener('pointerdown', e => { if (this.mode !== 'walk') return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const s = 0.0035; this.yaw -= (e.clientX - drag.x) * s; this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - drag.y) * s, -1.3, 1.3); drag.x = e.clientX; drag.y = e.clientY; });
    addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) drag = null; });
  }
  setMode(mode) {
    if (mode === this.mode) return;
    const cam = this.camera;
    if (mode === 'walk') {
      const t = this.orbit.target.clone();
      const dir = t.clone().sub(cam.position); dir.y = 0;
      this.yaw = Math.atan2(-dir.x, -dir.z); this.pitch = 0;
      this.flyTo(new THREE.Vector3(t.x, this.eye, t.z), null, 1.0, () => { this.mode = 'walk'; this.orbit.enabled = false; });
      this.orbit.enabled = false; this.mode = 'walk';
    } else {
      this.mode = 'orbit'; this.orbit.enabled = true;
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const target = cam.position.clone().addScaledVector(fwd, 30).setY(0);
      const eye = cam.position.clone().addScaledVector(fwd, -60).setY(70);
      this.flyTo(eye, target, 1.2);
    }
  }
  // 平滑飛到某個位置；target 為 null 時保持漫步視角方向
  flyTo(eye, target, dur = 1.6, done) {
    const cam = this.camera;
    this.tween = { t: 0, dur, e0: cam.position.clone(), e1: eye.clone(), t0: this.orbit.target.clone(), t1: target ? target.clone() : null, done };
  }
  lookFrom(eye, target) { // 漫步模式直接面向目標
    const d = target.clone().sub(eye); this.yaw = Math.atan2(-d.x, -d.z); this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  }
  update(dt) {
    const cam = this.camera;
    if (this.tween) {
      const tw = this.tween; tw.t += dt / tw.dur; const k = tw.t >= 1 ? 1 : 1 - Math.pow(1 - tw.t, 3);
      cam.position.lerpVectors(tw.e0, tw.e1, k);
      if (tw.t1) { this.orbit.target.lerpVectors(tw.t0, tw.t1, k); if (this.mode === 'orbit') cam.lookAt(this.orbit.target); }
      if (this.mode === 'walk') cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      if (tw.t >= 1) { this.tween = null; tw.done && tw.done(); }
      if (this.mode === 'orbit') this.orbit.update();
      return;
    }
    if (this.mode === 'orbit') { this.orbit.update(); return; }
    const k = this.keys; const run = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1;
    let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.stick.y;
    let s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.stick.x;
    if (k.has('ArrowLeft')) this.yaw += dt * 1.6; if (k.has('ArrowRight')) this.yaw -= dt * 1.6;
    if (k.has('KeyE')) this.eye = Math.min(60, this.eye + dt * 6); if (k.has('KeyQ')) this.eye = Math.max(1.6, this.eye - dt * 6);
    const speed = 4.2 * run;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    cam.position.addScaledVector(fwd, f * speed * dt).addScaledVector(right, s * speed * dt);
    cam.position.y = this.eye;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
