
let poemInput, speedSlider, saveButton;

let poem = "";
let chars = [];
let visibleCount = 0;
let lastInputAt = 0;
let lastAdvanceAt = 0;
let sceneSeed = 1234;
let currentSeason = "unknown";
let currentKigo = "";
let playing = false;

let seasonalWords = [];

const visualRules = [
  { words: ["鐘", "かね"], type: "bell" }
];

const palettes = {
  spring: ["#B4C9A3", "#D9B7B4", "#E9DCC4", "#799477", "#C6A6A0"],
  summer: ["#244B62", "#4C91A1", "#A6C7C4", "#E2D4B2", "#376A7B"],
  autumn: ["#B65F3A", "#D99A50", "#805044", "#D5B58A", "#564B42"],
  winter: ["#202C48", "#536A88", "#A9BACB", "#E0E3DF", "#596276"],
  newyear: ["#8D2838", "#C4A56B", "#E6D9BD", "#394D43", "#B7A1A0"],
  unknown: ["#6D7181", "#C2A8A0", "#B9B6A4", "#788F91", "#D4C5B2"]
};

// 色と透明度
function paint(hex, alpha = 255) {
  const result = color(hex);
  result.setAlpha(alpha);
  return result;
}

// --------------------------------
// 初期設定
// --------------------------------

async function setup() {
  createCanvas(900, 700);
  pixelDensity(1);

  // GitHubから季語データを読み込む
  try {
    const loadedKigo = await loadJSON(
      "https://raw.githubusercontent.com/kiokusouti-eng/kigo-data/main/kigo.json"
    );

    if (!Array.isArray(loadedKigo)) {
      throw new Error("季語データの形式が正しくありません");
    }

    seasonalWords = loadedKigo;
    console.log("季語データ読み込み成功:", seasonalWords.length);

  } catch (error) {
    console.error("季語データ読み込み失敗:", error);
    seasonalWords = [];
  }

  // 俳句入力欄
  poemInput = createInput("古池や蛙飛び込む春の朝");
  poemInput.position(30, 650);
  poemInput.size(490);
  poemInput.input(handleInput);

  // 表示速度
  speedSlider = createSlider(400, 1800, 900, 100);
  speedSlider.position(555, 650);
  speedSlider.size(130);

  // 保存ボタン
  saveButton = createButton("画像を保存");
  saveButton.position(755, 650);
  saveButton.mousePressed(() => saveCanvas("一句百景", "png"));

  textFont("serif");
  textAlign(CENTER, CENTER);

  handleInput();
}

// --------------------------------
// 入力処理
// --------------------------------

function handleInput() {
  poem = poemInput.value();

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("ja", {
      granularity: "grapheme"
    });

    chars = [...segmenter.segment(poem)].map(x => x.segment);

  } else {
    chars = Array.from(poem);
  }

  visibleCount = Math.min(visibleCount, chars.length);

  detectKigo();
  updateInputArtwork();

  lastInputAt = millis();
}

function updateInputArtwork() {
  let seed = 0;

  for (let i = 0; i < poem.length; i++) {
    seed += poem.charCodeAt(i) * (i + 1);
  }

  sceneSeed = Math.abs(seed + 2026);
}

// --------------------------------
// 季語判定
// --------------------------------

function detectKigo() {
  let found = [];

  for (const item of seasonalWords) {
    const words = [item.word, ...(item.aliases || [])];

    for (const word of words) {
      if (word && poem.includes(word)) {
        found.push({
          word,
          season: item.season,
          length: word.length
        });
      }
    }
  }

  found.sort((a, b) => b.length - a.length);

  if (found.length > 0) {
    currentKigo = found[0].word;
    currentSeason = found[0].season;
  } else {
    currentKigo = "";
    currentSeason = "unknown";
  }
}

function detectVisualElements() {
  const elements = [];

  for (const item of seasonalWords) {
    const words = [item.word, ...(item.aliases || [])];

    for (const word of words) {
      if (word && poem.includes(word)) {
        if (item.visual && item.visual.type) {
          elements.push(item.visual.type);
        }
        break;
      }
    }
  }

  for (const rule of visualRules) {
    for (const word of rule.words) {
      if (poem.includes(word)) {
        elements.push(rule.type);
        break;
      }
    }
  }

  return [...new Set(elements)];
}

// --------------------------------
// 文字・乱数
// --------------------------------

function charCodeSum(value) {
  let result = 0;

  for (const ch of value) {
    result += ch.codePointAt(0);
  }

  return result;
}

function updateSeed() {
  let baseSeed = 0;

  for (let i = 0; i < poem.length; i++) {
    baseSeed += poem.charCodeAt(i) * (i + 1);
  }

  const currentGlyph = chars[visibleCount - 1] || "";
  const previousGlyph = chars[visibleCount - 2] || "";

  sceneSeed = Math.abs(
    baseSeed +
    charCodeSum(currentGlyph) * 31 +
    charCodeSum(previousGlyph) * 17 +
    visibleCount * 137 +
    2026
  );
}

// --------------------------------
// 文字送り
// --------------------------------

function revealNext() {
  if (visibleCount >= chars.length) {
    playing = false;
    return;
  }

  visibleCount++;
  updateSeed();
  lastAdvanceAt = millis();

  if (visibleCount >= chars.length) {
    playing = false;
  }
}

// --------------------------------
// メイン描画
// --------------------------------

function draw() {
  const now = millis();

  if (
    !playing &&
    visibleCount < chars.length &&
    now - lastInputAt > 700
  ) {
    playing = true;
    revealNext();
  }

  if (
    playing &&
    now - lastAdvanceAt > speedSlider.value()
  ) {
    revealNext();
  }

  // 背景
  const palette = palettes[currentSeason] || palettes.unknown;
  background(palette[0]);

  drawArtwork();
  drawVerticalPoem();
  drawInformation();
}

// --------------------------------
// 絵の描画領域
// --------------------------------

function drawArtwork() {
  drawArtworkBase();

  if (currentKigo) {
    let visual = detectVisualElements(currentKigo);

    if (visual) {
      if (visual.type === "morning") drawMorningScene();
      if (visual.type === "frog") drawFrogScene();
      if (visual.type === "cicada") drawCicadaScene();
      if (visual.type === "persimmon") drawPersimmonScene();
      if (visual.type === "snow") drawSnowScene();
      if (visual.type === "bell") drawBellWaves();
    }
  }
}

// --------------------------------
// 抽象画のベース
// --------------------------------

function drawArtworkBase() {
  const palette = palettes[currentSeason] || palettes.unknown;
  const t = millis() / 1000;

  const currentGlyph = chars[visibleCount - 1] || "";
  const glyphType = getCharacterType(currentGlyph);
  const charCodeValue = charCodeSum(currentGlyph);

  const previousCode = visibleCount > 1
    ? charCodeSum(chars[visibleCount - 2])
    : 0;

  randomSeed(sceneSeed);
  noStroke();

  // 背景の色の広がり
  for (let i = 0; i < 12; i++) {
    const x = random(40, 800);
    const y = random(40, 560);
    const size = random(100, 360);

    fill(paint(palette[i % palette.length], 55));

    ellipse(
      x + sin(t + i) * 10,
      y + cos(t + i) * 10,
      size,
      size * random(0.5, 1.3)
    );
  }

  let shapeCount;
  let rotation;
  let sizeBase;
  let density;
  let curvePower;

  if (glyphType === "kanji") {
    shapeCount = 18 + (charCodeValue % 20);
    rotation = (charCodeValue % 360) * 0.03;
    sizeBase = 90 + (charCodeValue % 150);
    density = 25 + (previousCode % 25);
    curvePower = 0.2;

  } else if (glyphType === "hiragana") {
    shapeCount = 6 + (charCodeValue % 10);
    rotation = (charCodeValue % 360) * 0.008;
    sizeBase = 120 + (charCodeValue % 100);
    density = 8 + (previousCode % 12);
    curvePower = 1.8;

  } else if (glyphType === "katakana") {
    shapeCount = 12 + (charCodeValue % 16);
    rotation = (charCodeValue % 360) * 0.05;
    sizeBase = 70 + (charCodeValue % 130);
    density = 18 + (previousCode % 20);
    curvePower = 0.5;

  } else {
    shapeCount = 8 + (charCodeValue % 24);
    rotation = (charCodeValue % 360) * 0.01;
    sizeBase = 50 + (charCodeValue % 180);
    density = 10 + (previousCode % 30);
    curvePower = 1;
  }

  push();
  translate(335, 300);
  rotate(rotation + sin(t * 0.4) * 0.04);

  for (let i = 0; i < shapeCount; i++) {
    const angle = TWO_PI * i / shapeCount;
    const shapeDistance = sizeBase * (0.5 + i / shapeCount);

    const x = cos(angle) * shapeDistance;
    const y = sin(angle) * shapeDistance;

    fill(paint(palette[i % palette.length], 150));

    push();
    translate(x, y);
    rotate(angle + rotation);

    ellipse(
      0,
      0,
      sizeBase * 0.7,
      sizeBase * (0.25 + (charCodeValue % 10) * 0.04)
    );

    pop();
  }

  noFill();

  for (let i = 0; i < density; i++) {
    stroke(paint(palette[i % palette.length], 170));
    strokeWeight(1 + (charCodeValue % 4));

    beginShape();

    for (let x = -320; x <= 320; x += 15) {
      const waveBase = sin(x * 0.012 + i * 0.5 + t * 0.3);

      const wave =
        Math.sign(waveBase) *
        Math.pow(Math.abs(waveBase), curvePower) *
        (20 + charCodeValue % 50);

      const y = wave + cos(x * 0.006 + i + rotation) * 50;

      vertex(x, y + i * 2);
    }

    endShape();
  }

  pop();

  // 粒子
  randomSeed(sceneSeed + 1);

  for (let i = 0; i < 100; i++) {
    const x = random(0, 800);
    const y = random(height);

    noStroke();
    fill(paint(palette[i % palette.length], 150));
    circle(x, y, random(1, 5));
  }

  // 文字が切り替わった直後の輪
  const elapsed = millis() - lastAdvanceAt;
  const pulse = constrain(elapsed / 900, 0, 1);

  noFill();
  stroke(paint(palette[2], 150));
  strokeWeight(2);

  const ringSize = 40 + pulse * 300;
  ellipse(335, 300, ringSize, ringSize * 0.7);
}

// --------------------------------
// 春の朝
// --------------------------------

function drawMorningScene() {
  push();
  noStroke();

  fill(paint("#EADCCB"));
  rect(0, 0, 800, 800);

  fill(paint("#E8A77F"));
  circle(330, 245 + sin(frameCount * 0.01) * 2, 125);

  fill(paint("#B7B6A6"));
  beginShape();
  vertex(0, 390);
  vertex(130, 280);
  vertex(260, 380);
  vertex(410, 290);
  vertex(570, 390);
  vertex(800, 330);
  vertex(800, 800);
  vertex(0, 800);
  endShape(CLOSE);

  for (let i = 0; i < 9; i++) {
    fill(paint("#F5EBE1", 100));
    ellipse(
      100 + i * 65,
      410 + sin(frameCount * 0.008 + i) * 9,
      180,
      35
    );
  }

  stroke(paint("#FFF5DC", 100));
  strokeWeight(2);

  for (let i = 0; i < 7; i++) {
    line(330, 245, 80 + i * 90, 500);
  }

  pop();
}

// --------------------------------
// 蛙
// --------------------------------

function drawFrogScene() {
  push();
  noStroke();

  fill(paint("#789C91"));
  rect(0, 300, 800, 300);

  noFill();
  stroke(paint("#D0E2D5", 150));
  strokeWeight(2);

  for (let i = 0; i < 5; i++) {
    const rippleSize =
      50 + i * 45 + sin(frameCount * 0.04 + i) * 8;

    ellipse(330, 445, rippleSize * 2, rippleSize * 0.45);
  }

  noStroke();
  fill(paint("#557C61"));
  ellipse(330, 455, 190, 45);

  fill(paint("#769B66"));
  ellipse(330, 410, 105, 65);
  ellipse(330, 375, 85, 65);

  fill(paint("#B5C98D"));
  ellipse(305, 350, 27, 30);
  ellipse(355, 350, 27, 30);

  fill(paint("#263B2E"));
  circle(305, 350, 10);
  circle(355, 350, 10);

  stroke(paint("#769B66"));
  strokeWeight(9);
  line(300, 430, 265, 455);
  line(360, 430, 395, 455);

  noStroke();
  fill(paint("#E4F0E5"));

  for (let i = 0; i < 12; i++) {
    const angle = TWO_PI * i / 12;
    const spread = 45 + sin(frameCount * 0.05 + i) * 5;

    circle(
      330 + cos(angle) * spread,
      440 + sin(angle) * spread * 0.35,
      4
    );
  }

  pop();
}

// --------------------------------
// 蝉
// --------------------------------

function drawCicadaScene() {
  push();
  noStroke();

  fill(paint("#D5DFCF"));
  rect(0, 0, 800, 800);

  fill(paint("#77634D"));
  beginShape();
  vertex(90, 800);
  vertex(170, 800);
  vertex(155, 0);
  vertex(105, 0);
  endShape(CLOSE);

  fill(paint("#F3D88D", 130));

  for (let i = 0; i < 18; i++) {
    circle(
      220 + (i * 83) % 400,
      (i * 97) % 550,
      20 + (i % 3) * 12
    );
  }

  push();
  translate(290, 280);
  rotate(-0.25);

  fill(paint("#E1EFDA", 190));
  stroke(paint("#718D82"));
  strokeWeight(2);

  ellipse(-35, -20, 105, 35);
  ellipse(35, -20, 105, 35);

  stroke(paint("#A0B8A5"));
  strokeWeight(1);

  line(-35, -20, -75, -30);
  line(-35, -20, -70, -5);
  line(35, -20, 75, -30);
  line(35, -20, 70, -5);

  noStroke();
  fill(paint("#777D58"));
  ellipse(0, 0, 32, 75);

  fill(paint("#454D3B"));
  ellipse(0, -32, 28, 27);

  fill(paint("#252C25"));
  circle(-10, -35, 7);
  circle(10, -35, 7);

  pop();

  fill(paint("#F7E6A9", 170));

  for (let i = 0; i < 25; i++) {
    const x = 200 + (i * 71) % 430;
    const y = (i * 113 + frameCount * 0.15) % 560;
    circle(x, y, 3 + i % 3);
  }

  pop();
}

// --------------------------------
// 柿
// --------------------------------

function drawPersimmonScene() {
  randomSeed(sceneSeed);

  const t = millis() / 1000;
  const sway = sin(t * 0.6) * 3;

  push();
  noStroke();

  fill(paint("#F3DDBA"));
  ellipse(335, 280, 620, 430);

  fill(paint("#E9C99B"));
  ellipse(335, 310, 500, 340);

  noFill();
  stroke(paint("#59402D"));
  strokeWeight(13);
  bezier(40, 450, 190, 300, 380, 240, 800, 110);

  strokeWeight(7);
  bezier(300, 300, 340, 200, 420, 160, 470, 80);
  bezier(440, 230, 490, 250, 560, 240, 620, 190);

  for (let i = 0; i < 17; i++) {
    const x = random(120, 640);
    const y = random(100, 400);
    const leafSize = random(25, 65);

    push();
    translate(x, y + sway);
    rotate(random(-0.8, 0.8));

    noStroke();
    fill(paint(random([
      "#526B3B",
      "#71834A",
      "#9A9A55",
      "#B2A45D"
    ])));

    ellipse(0, 0, leafSize, leafSize * 0.38);

    stroke(paint("#D4C58A"));
    strokeWeight(1);
    line(-leafSize * 0.4, 0, leafSize * 0.4, 0);

    pop();
  }

  const fruits = [
    [230, 270, 92],
    [390, 180, 110],
    [510, 290, 100],
    [340, 390, 78],
    [800, 150, 72]
  ];

  for (let i = 0; i < fruits.length; i++) {
    const x = fruits[i][0];
    const y = fruits[i][1];
    const size = fruits[i][2];

    push();
    translate(x, y + sway * (i % 2 === 0 ? 1 : -1));

    noStroke();

    fill(paint("#A94C25"));
    ellipse(5, 8, size * 1.08, size * 0.92);

    fill(paint(i % 2 === 0 ? "#E87827" : "#F29A36"));
    ellipse(0, 0, size, size * 0.88);

    fill(paint("#FFC36C"));
    ellipse(-size * 0.2, -size * 0.18, size * 0.25, size * 0.15);

    fill(paint("#526B3B"));
    triangle(
      -size * 0.18, -size * 0.37,
      size * 0.18, -size * 0.37,
      0, -size * 0.52
    );

    pop();
  }

  noStroke();

  for (let i = 0; i < 45; i++) {
    fill(paint("#FFF3D1"));
    circle(random(40, 800), random(40, 550), random(2, 5));
  }

  pop();
}

// --------------------------------
// 雪
// --------------------------------

function drawSnowScene() {
  randomSeed(sceneSeed);

  const t = millis() / 1000;

  push();

  noStroke();
  fill(paint("#DCE5EB", 130));
  ellipse(335, 300, 800, 450);

  fill(paint("#EDF0F0", 130));
  ellipse(335, 430, 800, 220);

  fill(paint("#E0E3DF"));
  beginShape();
  vertex(0, 490);
  vertex(100, 460);
  vertex(220, 485);
  vertex(340, 450);
  vertex(480, 475);
  vertex(620, 445);
  vertex(800, 470);
  vertex(800, 800);
  vertex(0, 800);
  endShape(CLOSE);

  for (let i = 0; i < 100; i++) {
    const x = random(0, 800);
    const startY = random(height);
    const speed = random(8, 25);
    const y = (startY + t * speed) % height;

    noStroke();
    fill(paint("#FFFFFF", 230));
    circle(x, y, random(2, 6));
  }

  noFill();

  for (let i = 0; i < 12; i++) {
    stroke(paint("#FFFFFF", 160));
    strokeWeight(1);

    const y = 100 + i * 27 + sin(t + i) * 8;
    const x = 100 + sin(t * 0.4 + i) * 30;

    line(x, y, x + 80, y - 5);
  }

  pop();
}

// --------------------------------
// 鐘
// --------------------------------

function drawBellWaves() {
  push();
  noFill();

  const pulse = (millis() / 1000) % 2;
  const maxRadius = 100 + pulse * 100;

  for (let i = 0; i < 5; i++) {
    const radius = maxRadius - i * 22;

    stroke(paint("#FFE1AA", 130 - i * 18));
    strokeWeight(2);
    ellipse(335, 300, radius * 2, radius * 1.2);
  }

  pop();
}

// --------------------------------
// 文字の種類
// --------------------------------

function getCharacterType(glyph) {
  if (!glyph) return "other";

  const unicodeValue = glyph.codePointAt(0);

  if (unicodeValue >= 0x3040 && unicodeValue <= 0x309F) {
    return "hiragana";
  }

  if (
    (unicodeValue >= 0x30A0 && unicodeValue <= 0x30FF) ||
    (unicodeValue >= 0x31F0 && unicodeValue <= 0x31FF)
  ) {
    return "katakana";
  }

  if (
    (unicodeValue >= 0x3400 && unicodeValue <= 0x4DBF) ||
    (unicodeValue >= 0x4E00 && unicodeValue <= 0x9FFF) ||
    (unicodeValue >= 0xF900 && unicodeValue <= 0xFAFF)
  ) {
    return "kanji";
  }

  return "other";
}

// --------------------------------
// 俳句の背景パネル
// --------------------------------

function drawPoemPanel() {
  push();

  noStroke();
  fill(paint("#F3EBDD", 235));

  rect(650, 90, 225, 480, 12);

  // さりげない内側の線
  noFill();
  stroke(paint("#9C8B73", 100));
  strokeWeight(1);
  rect(659, 99, 207, 462, 8);

  pop();
}

// --------------------------------
// 俳句の縦書き
// --------------------------------

function drawVerticalPoem() {
  if (visibleCount <= 0) return;

  let columns = [];
  for (let i = 0; i < visibleCount; i += 1) {
    columns.push(chars[i]);
  }

  let rightEdge = width - 55;
  let topMargin = 45;
  let bottomMargin = 45;
  let availableHeight = height - topMargin - bottomMargin;

  let fontSize = 32;
  let columnCount = Math.ceil(columns.length / Math.floor(availableHeight / fontSize));

  if (columnCount > 1) {
    fontSize = Math.min(32, availableHeight / Math.ceil(columns.length / 2));
  }

  textSize(fontSize);
  textAlign(CENTER, TOP);
  fill(35, 35, 35);

  let charsPerColumn = Math.floor(availableHeight / fontSize);

  for (let i = 0; i < columns.length; i++) {
    let col = Math.floor(i / charsPerColumn);
    let row = i % charsPerColumn;

    let x = rightEdge - col * (fontSize + 12);
    let y = topMargin + row * fontSize;

    text(columns[i], x, y);
  }
}

// --------------------------------
// タイトル・季語・日時・文字数
// --------------------------------

function drawInformation() {
  const seasonNames = {
    spring: "春",
    summer: "夏",
    autumn: "秋",
    winter: "冬",
    newyear: "新年",
    unknown: "未判定"
  };

  push();

  // タイトル
  textAlign(CENTER, CENTER);
  textSize(26);
  fill("#F6EBDD");
  noStroke();

  text("一句百景", width / 2, 28);

  // 季節と季語
  textAlign(LEFT, CENTER);
  textSize(13);
  fill("#F6EBDD");

  text(
    "季節：" + (seasonNames[currentSeason] || "未判定") +
    "　季語：" + (currentKigo || "なし"),
    30,
    65
  );

  // 日時
  const now = new Date();

  const dateTime =
    now.getFullYear() + "/" +
    String(now.getMonth() + 1).padStart(2, "0") + "/" +
    String(now.getDate()).padStart(2, "0") + " " +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0");

  textAlign(LEFT, CENTER);
  textSize(12);
  fill("#F6EBDD");
  text(dateTime, 30, 785);

  // 文字数
  const poemLength = chars.filter(
    ch => ch !== "\n" && ch !== "\r"
  ).length;

  textAlign(RIGHT, CENTER);
  textSize(13);
  fill("#F6EBDD");

  text(
    poemLength + "文字",
    870,
    785
  );

  pop();
}
