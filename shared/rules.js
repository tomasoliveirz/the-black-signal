export const PHASES = [
  { id: 'prep', duration: 20, zone: 0, night: -1 },
  { id: 'day1', duration: 300, zone: 0, night: -1 },
  { id: 'night1', duration: 60, zone: 0, night: 0 },
  { id: 'day2', duration: 210, zone: 1, night: -1 },
  { id: 'night2', duration: 70, zone: 1, night: 1 },
  { id: 'day3', duration: 180, zone: 2, night: -1 },
  { id: 'final', duration: 140, zone: 2, night: 2 },
];
export function sectorDay(zone) {
  const phase = PHASES.find(p => p.zone === zone && p.id.startsWith('day'));
  return phase ? Number(phase.id.slice(3)) : null;
}
export const RULES = {
  repairTime: 8, cooperativeRepairTime: 5, reviveTime: 5, reviveHp: 50, reviveShield: 2,
  bleedTime: 40, executeTime: 2.5, useRange: 2.6, pickupRange: 1.9,
  bloodTime: 6, bloodGain: 30, bloodClue: 40, passiveEnergy: .12,
  transformThreshold: 50, transformCost: 15, energyDrain: .9, monsterHp: 150,
  fireCd: .38, attackCd: 1.45, clawRange: 2, clawWindup: .22,
  bulletDmg: 30, bulletDmgMonster: 25, clawDmg: 30, flareTime: 15, flareRadius: 6, flareStun: 2,
  extractWarmup: 45, extractTime: 5, resultsTime: 20, ammoStart: 4, ammoCap: 12, ammoPickup: 3,
};
