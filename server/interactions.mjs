import { RULES as R } from '../shared/rules.js';
import { eye } from '../shared/sight.js';

export function interactionPoint(game, p, target) {
  if (!target || !Number.isSafeInteger(target.id) || !['item','tx','blood','player'].includes(target.kind)) return null;
  const collection = target.kind === 'item' ? game.items : target.kind === 'tx' ? game.tx : target.kind === 'blood' ? game.blood : null;
  const object = collection ? collection.find(o => o.id === target.id) : game.players.get(target.id);
  if (!object || object === p || (object.zone !== undefined && object.zone > game.unlocked)) return null;
  if (target.kind === 'item' && !object.available) return null;
  if (target.kind === 'player') {
    if (object.spectator) return null;
    return { ...object.s, y: object.s.y + (object.st === 1 ? .35 : 1.0) };
  }
  return { x: object.x, y: object.y + (target.kind === 'item' ? .88 : .9), z: object.z };
}

export function interact(game, p, target, dt, repairs, revives) {
  const point = interactionPoint(game, p, target);
  if (!point || !game.canReach(p, point, target.kind === 'item' ? R.pickupRange : R.useRange)) {
    p.interaction = null; p.executing = null; return;
  }
  const signature = target.kind + ':' + target.id;
  const changed = p.interaction?.signature !== signature || p.interaction?.version !== p.damageVersion;
  if (changed) p.interaction = { signature, version: p.damageVersion, progress: 0 };
  const action = p.interaction;

  if (target.kind === 'player') {
    const q = game.players.get(target.id);
    if (q.st !== 1) return;
    if (p.form) {
      if (!game.combatOpen || p.protect > 0 || Math.hypot(p.s.x - q.s.x, p.s.z - q.s.z) > R.clawRange) return;
      p.executing = q.id; action.progress += dt / R.executeTime;
      if (action.progress >= 1) { game.kill(q); p.interaction = null; p.executing = null; }
    } else {
      revives.add(q.id);
      q.rv += dt / R.reviveTime;
      action.progress = q.rv;
      if (q.rv >= 1) {
        q.st = 0; q.hp = R.reviveHp; q.protect = R.reviveShield; q.rv = 0; q.interaction = null;
        game.metrics.revives++; game.record('revive', {id:q.id,by:p.id});
        game.broadcast({t:'ev',k:'revive',id:q.id,by:p.id});
      }
    }
    return;
  }
  if (p.form) return;
  p.executing = null;
  if (target.kind === 'item') {
    const item = game.items.find(i => i.id === target.id);
    if ((item.type === 'cell' && p.cell >= 1) || (item.type === 'ammo' && p.ammo >= R.ammoCap)) return;
    item.available = false;
    if (item.type === 'cell') p.cell = 1;
    else if (item.type === 'ammo') p.ammo = Math.min(R.ammoCap, p.ammo + R.ammoPickup);
    else if (item.type === 'med') p.med++;
    else if (item.type === 'flare') p.flare++;
    game.metrics.pickups++;
    if (!p.bot) game.send(p,{t:'ev',k:'pickup',type:item.type});
    p.interaction = null;
  } else if (target.kind === 'blood') {
    const source = game.blood.find(b => b.id === target.id);
    if (source.used || p.role !== 'echo' || game.night || p.energy >= 100) return;
    action.progress += dt / R.bloodTime;
    if (action.progress >= 1) {
      source.used = true; source.clue = R.bloodClue;
      p.energy = Math.min(100,p.energy+R.bloodGain);
      game.metrics.drains++; game.record('blood', {id:p.id,station:source.id});
      if (!p.bot) game.send(p,{t:'ev',k:'fed'});
      p.interaction = null;
    }
  } else if (target.kind === 'tx') {
    const tx = game.tx.find(t=>t.id===target.id);
    if (tx.on) return;
    if (!tx.fuse) {
      if (p.cell) {
        p.cell = 0; tx.fuse = true;
        game.broadcast({t:'ev',k:'fuse',tx:tx.id});
      }
    } else {
      const current = repairs.get(tx.id) ?? [];
      current.push(p); repairs.set(tx.id,current);
    }
  }
}

export function resolveInteractions(game, repairs, revives, dt) {
  for (const [id, users] of repairs) {
    const tx = game.tx[id];
    const helpers = users.filter(p=>p.role === 'operative');
    if (!helpers.length) continue;
    tx.p = Math.min(1, tx.p + dt / (helpers.length > 1 ? R.cooperativeRepairTime : R.repairTime));
    for (const p of users) if (p.interaction) p.interaction.progress = tx.p;
    if (tx.p >= 1) {
      tx.on = true;
      game.record('objective',{id});
      game.broadcast({t:'ev',k:'txon',tx:id});
    }
  }
  for (const p of game.active()) if (p.st === 1 && !revives.has(p.id)) p.rv = Math.max(0,p.rv-dt*.5);
}
