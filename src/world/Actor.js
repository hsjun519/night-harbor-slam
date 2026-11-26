// A person drawn outside the fight system: townspeople, the player walking around town, run-ins at the ring side.
import { Joints, dimsFor, solveFK, toWorld } from '../anim/skeleton.js';
import { STANCES, stancePose, gaitPose, clip, hasClip, sampleClip } from '../anim/clips.js';
import { updateTails } from '../anim/AnimationSystem.js';
import { FLOOR } from './locations.js';

const P = new Float32Array(16);
export class Actor {
  constructor(look, o = {}) { this.look = look; this.dims = dimsFor(look.build, look.scale || 1); this.x = o.x || 100; this.y = FLOOR + (o.y || 0); this.vx = 0; this.vy = 0; this.face = o.face || 1; this.ground = true; this.stance = o.stance || 'calm'; this.gait = 0; this.t = Math.random() * 3; this.poseT = this.t; this.joints = new Joints(); this.expr = 'neutral'; this.exprT = 0; this.tails = null; this.idx = 0; this.id = o.id; this.home = this.x; this.wander = o.wander || 0; this.wT = 2; this.talkT = 0; this.y0 = this.y; }
  pose(dt) {
    this.t += dt; this.poseT = this.t;
    const moving = Math.abs(this.vx) > 6;
    if (!this.ground) sampleClip(clip(this.vy < 0 ? 'jump' : 'fall'), .2, P);
    else if (this.talkT > 0) sampleClip(clip('talk'), this.t, P);
    else if (STANCES[this.stance]) { stancePose(this.stance, this.t, P); if (moving) { this.gait += dt * (2.6 + Math.abs(this.vx) * .07) * (this.vx * this.face >= 0 ? 1 : -1); gaitPose(P, this.gait, Math.abs(this.vx) > 150 ? 'run' : 'walk', 1); } }
    else if (hasClip(this.stance)) sampleClip(clip(this.stance), this.t, P);
    else stancePose('calm', this.t, P);
    if (!this.ground) solveFK(P, this.dims, this.joints, { snap: false, py: -this.dims.leg * .92 });
    else solveFK(P, this.dims, this.joints, {});
    toWorld(this.joints, this.face, this.x, this.y);
    this.faceExpr = this.exprT > 0 ? this.expr : (Math.floor(this.t * .7) % 5 === 0 && (this.t % 1.43) < .12 ? 'blink' : this.talkT > 0 ? (Math.floor(this.t * 8) % 2 ? 'talk' : 'neutral') : 'neutral');
    if (this.exprT > 0) this.exprT -= dt;
    if (this.talkT > 0) this.talkT -= dt;
    updateTails(this, dt, this.y);
  }
}
