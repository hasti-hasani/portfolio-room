import * as THREE from 'three';
import { C, HQ, ENV } from '../config.js';
import { pbr } from './loaders.js';

export const env = { k: 1 };   // the night mood dims the HDRI light; models loaded later read it

export const OAK = HQ ? pbr('white_oak_veneer', [1, 1]) : {};
export const LINEN = HQ ? pbr('rough_linen', [2, 2], 'nr', 0.6) : {};
export const PLASTER = HQ ? pbr('plastered_wall_04', [2, 1], 'nr', 0.5) : {};
export const VELVET = HQ ? pbr('velour_velvet', [1.5, 1.5], 'nr', 0.5) : {};

// Palette colours that become real wood when the photo textures are available
const SURFACE = new Map(HQ ? [[C.woodLight, { color: 0xfff4e8, ...OAK }], [C.wood, { color: 0xe2bf9c, ...OAK }]] : []);

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...SURFACE.get(color), ...o });
export const brass = () => mat(C.gold, { metalness: HQ ? 0.85 : 0.45, roughness: 0.3 });
// standard material with the velvet's pile maps: a real sheen layer costs a second lighting pass for one small cushion
export const velvet = color => mat(color, { roughness: 0.9, ...VELVET });

export const envIntensity = () => ENV * env.k;
