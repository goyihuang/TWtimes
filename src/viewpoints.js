// 景點與鏡頭位置。之後可在每個景點掛上「舊照機位」：舊照片 + 拍攝位置，切換時疊在畫面上。
export const VIEWPOINTS = [
  { key: 'station', place: '臺中驛前', title: '臺中驛（車站舊站）', lon: 120.68526, lat: 24.13691, eye: { lon: 120.68420, lat: 24.13760, h: 45 }, targetY: 8 },
  { key: 'newstation', place: '臺中車站', title: '高架新站', lon: 120.68673, lat: 24.13736, eye: { lon: 120.68560, lat: 24.13880, h: 60 }, targetY: 12 },
  { key: 'miyahara', place: '綠川町', title: '宮原眼科', lon: 120.68372, lat: 24.13765, eye: { lon: 120.68330, lat: 24.13720, h: 30 } },
  { key: 'green', place: '綠川', title: '綠川', lon: 120.68330, lat: 24.13840, eye: { lon: 120.68280, lat: 24.13700, h: 25 }, targetY: 0 },
  { key: 'zhongshan', place: '新盛橋通（中山路）', title: '中山路', lon: 120.68230, lat: 24.13880, eye: { lon: 120.68360, lat: 24.13760, h: 30 }, targetY: 4 },
  { key: 'prefecture', place: '臺中州廳', title: '臺中州廳', lon: 120.67833, lat: 24.13853, eye: { lon: 120.67980, lat: 24.13780, h: 50 } },
  { key: 'cityhall', place: '臺中市役所', title: '臺中市役所', lon: 120.67907, lat: 24.13833, eye: { lon: 120.68020, lat: 24.13900, h: 40 } },
  { key: 'market', place: '新富町', title: '第二市場 六角樓', lon: 120.67878, lat: 24.14238, eye: { lon: 120.68000, lat: 24.14160, h: 40 } },
  { key: 'park', place: '臺中公園', title: '臺中公園 湖心亭', lon: 120.68422, lat: 24.14366, eye: { lon: 120.68330, lat: 24.14260, h: 35 }, targetY: 2 },
];
