// 產生 public/data/tw-counties.geo.json（全臺 22 縣市界，供地圖首頁離線顯示）。
// 資料：taiwan-atlas（MIT）重新散布的內政部「直轄市、縣市界線(TWD97經緯度)」https://data.gov.tw/dataset/7442（政府資料開放授權條款）。
// 一次性工具，不在 package.json 依賴中：
//   mkdir tmp && cd tmp && npm i taiwan-atlas topojson-client topojson-simplify
//   cp ../scripts/build-counties.mjs . && node build-counties.mjs node_modules/taiwan-atlas/counties-10t.json ../public/data/tw-counties.geo.json
import fs from 'fs';
import * as tc from 'topojson-client';
import * as ts from 'topojson-simplify';
const topo=JSON.parse(fs.readFileSync(process.argv[2]));
let t=ts.presimplify(topo); t=ts.simplify(t, ts.quantile(t, 0.25));
const gj=tc.feature(t,t.objects.counties);
// round coords
const r=a=>Array.isArray(a[0])?a.map(r):[+a[0].toFixed(4),+a[1].toFixed(4)];
gj.features.forEach(f=>{f.geometry.coordinates=r(f.geometry.coordinates);f.properties={id:f.properties.COUNTYID||f.id,name:f.properties.COUNTYNAME,en:f.properties.COUNTYENG}});
fs.writeFileSync(process.argv[3],JSON.stringify(gj));
console.log(gj.features.length, gj.features.map(f=>f.properties.name).join(','));
