// 臺南驛前五個年代。confidence：A 有照片或官方文字直接佐證；B 依照片比例推估；C 示意。
export const ERAS = [
  {
    id: '1920', year: '1920', name: '第一代木造臺南驛', en: 'TAINAN STATION · 1900 TIMBER HALL',
    story: '1900 年縱貫線通車時的木造站房，正面迴廊與玄關山牆依館藏舊照重建；站前立有 1912 年揭幕的後藤新平銅像。',
    station: '1900', statue: 'goto', plaza: 'earth', roads: 'earth', blocks: 'tile', traffic: 'rickshaw', train: 'steam', rail: true,
    grade: { sat: 0.6, con: 1.1, warm: 0.5, sepia: 0.38, lift: 0.0, vig: 0.4, grain: 0.045, paper: 0.12, teal: 0 },
    evidence: [['站房外觀', 'A', '館藏〈臺南站第一代木造站房〉兩張、1931 朝日新聞正面照'], ['站房長寬與確切位置', 'B', '照片比例推估，長 44 m'], ['站前銅像', 'A', '1912 年後藤新平銅像揭幕照（確切位置為推估）'], ['周邊街屋', 'C', '以現代主要道路兩側街廓位置示意，非當年測繪']],
  },
  {
    id: '1936', year: '1936', name: '第二代臺南驛', en: 'TAINAN STATION · 1936',
    story: '1936 年落成的鋼筋混凝土站房，二樓設鐵道飯店。七扇高拱窗、八道壁柱、三拱門廊與兩側圓窗皆依落成照建模，外牆為淡褐色面磚。',
    station: '1936', skin: 'tile', statue: 'goto', plaza: 'gravel', roads: 'gravel', blocks: 'shophouse', traffic: 'early', train: 'steam', rail: true,
    grade: { sat: 0.82, con: 1.06, warm: 0.45, sepia: 0.12, lift: 0.03, vig: 0.34, grain: 0.03, paper: 0.06, teal: 0 },
    evidence: [['站房立面', 'A', '1936 落成照、「全島一の臺南驛」明信片、鐵道局 1936 二代站房材料說明'], ['外框與方位', 'A', 'OSM relation 6477070'], ['樓高與出挑', 'B', '以門廊拱高約 4.7 m 依照片比例推算'], ['月臺雨棚', 'A', '1936 落成照及現存鋼軌雨棚（國定古蹟）'], ['周邊街屋與車流', 'C', '示意，不代表特定店家']],
  },
  {
    id: '1970', year: '1970', name: '戰後府城', en: 'POSTWAR TAINAN · c.1970',
    story: '戰後站房外牆漆白、加掛站名招牌，站前形成圓環與公車轉運，周邊街屋增高至三、四層。招牌只寫行業別，不虛構店名。',
    station: '1936', skin: 'paint', sign: '1970', plaza: 'roundabout', roads: 'asphalt', blocks: 'postwar', traffic: 'postwar', train: 'diesel', rail: true,
    grade: { sat: 0.9, con: 1.04, warm: 0.38, sepia: 0.05, lift: 0.05, vig: 0.3, grain: 0.035, paper: 0, teal: 0.15 },
    evidence: [['站房漆白時間', 'B', '戰後至 2009 照片為白色，確切粉刷年份待查'], ['站名招牌樣式', 'C', '推估'], ['街區高度', 'C', '以現代街廓位置示意 3–5 層'], ['縱貫線電氣化', 'A', '西部幹線 1979 年完成電氣化，故本年代無架空線']],
  },
  {
    id: '2019', year: '2019', name: '地下化前', en: 'BEFORE UNDERGROUNDING · 2019',
    story: '白色站房頂上立著藍字「台南車站」與電子鐘，站前圓環種滿大王椰子，背後是遠東百貨的圓柱高樓；列車仍在地面月臺進出，後站尚未拆除。',
    station: '1936', skin: 'paint', sign: '2019', statue: 'modern', plaza: 'roundabout', roads: 'asphalt', blocks: 'osm', traffic: 'modern', train: 'emu', rail: true, catenary: true, rearStation: true,
    grade: { sat: 1.0, con: 1.03, warm: 0.12, sepia: 0, lift: 0.02, vig: 0.24, grain: 0.02, paper: 0, teal: 0.25 },
    evidence: [['站房外觀與招牌', 'A', '2009 年臺南車站照片、館藏 TRA_TaiNan_Station'], ['周邊建物', 'A', 'OSM 外框與樓層（缺樓層者以 2 層計）'], ['後站', 'A', '「因台南鐵路地下化工程而拆除的台南後站」2021 年 4 月拆除'], ['站前銅像', 'B', '2009 照片可見，人物身分未查證故不標名']],
  },
  {
    id: '2026', year: '2026', name: '地下車站啟用', en: 'UNDERGROUND STATION · 2026',
    story: '2026 年 10 月 17 日起列車改走地下，地面軌道陸續拆除、規劃為綠廊。古蹟站房的修復工程停擺多年，主體仍被鷹架與帆布包覆（依 2026 年 3 月報導），只有門廊露出修復後的面磚原色。',
    station: '1936', skin: 'tile', statue: 'modern', plaza: 'roundabout', roads: 'asphalt', blocks: 'osm', traffic: 'modern', train: null, rail: false, scaffold: true, works: true,
    grade: { sat: 0.98, con: 1.04, warm: 0.08, sepia: 0, lift: 0.02, vig: 0.22, grain: 0.02, paper: 0, teal: 0.3 },
    evidence: [['地下化通車', 'A', '交通部鐵道局 2026-10-19 新聞稿、中央社 2026-10-15'], ['站房包覆現況', 'A', '聯合新聞網 2026-03-26：修復停擺、外觀被鐵皮鷹架包覆'], ['門廊面磚', 'A', '2024 年臺鐵修復工程新聞稿照片'], ['地面綠廊', 'B', '規劃中，本場景以施工中表現'], ['地下站出入口位置', 'C', '示意']],
  },
];

// 鏡位：位置、目標、焦距（mm，35mm 等效）
export const SHOTS = [
  { name: '站前正面', pos: [-4, 6.5, 74], target: [-4, 7.2, 15], mm: 32 },
  { name: '站前廣場（人眼）', pos: [-24, 1.65, 50], target: [-4, 6.5, 18], mm: 28 },
  { name: '北門路斜側', pos: [-62, 9, 40], target: [-4, 7, 12], mm: 35 },
  { name: '成功路方向', pos: [1, 5, 205], target: [-4, 8, 20], mm: 50 },
  { name: '第一月臺', pos: [44, 2.55, -30], target: [-30, 3.2, -31], mm: 24 },
  { name: '空拍', pos: [175, 150, 215], target: [-5, 0, 0], mm: 30 },
];
export const mmToFov = mm => 2 * Math.atan(12 / mm) * 180 / Math.PI;   // 35mm 片幅垂直 24 mm
