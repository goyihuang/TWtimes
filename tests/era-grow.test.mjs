// 共用年代轉場：確認著色器注入點在 three（npm 版與 public/three.min.js 舊版）的內建材質都存在
import { ShaderLib } from 'three';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const libs = ['standard', 'physical', 'lambert', 'phong', 'basic', 'toon', 'matcap', 'depth', 'distance'];
const expand = s => s.replace(/#include <(\w+)>/g, (m, k) => m);   // 只檢查頂層 include
for (const k of libs) {
  const { vertexShader: v, fragmentShader: f } = ShaderLib[k];
  for (const tag of ['#include <common>', '#include <project_vertex>']) assert(expand(v).includes(tag), `${k} 頂點缺 ${tag}`);
  for (const tag of ['#include <common>', '#include <clipping_planes_fragment>']) assert(f.includes(tag), `${k} 片段缺 ${tag}`);
}
const old = readFileSync(new URL('../public/three.min.js', import.meta.url), 'utf8');
for (const tag of ['#include <project_vertex>', '#include <clipping_planes_fragment>', '#include <dithering_fragment>']) assert(old.includes(tag), `舊版 three 缺 ${tag}`);
console.log('era-grow：著色器注入點檢查通過');
