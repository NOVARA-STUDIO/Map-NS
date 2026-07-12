// ==============================================
//  НАЛАШТУВАННЯ ФОТО-МАПИ
// ==============================================
// tileWidth / tileHeight — розмір одного фото (px), у вашому випадку 1920×1080
// overlap  — на скільки пікселів сусідні фото "заходять" одне на одне,
//            щоб приховати шви на краях (підберіть під ваші фото, напр. 20–80)
// rows / cols — розмір сітки мапи
// tiles — список фото. row/col — позиція у сітці (0,0 — лівий верхній кут).
//         src — шлях до файлу в папці photos/. Якщо файл ще не додали —
//         залиште src порожнім і на цьому місці буде плейсхолдер з номером,
//         щоб було видно структуру мапи.

const MAP_CONFIG = {
  tileWidth: 1080,
  tileHeight: 1080,
  overlap: 100,
  rows: 3,
  cols: 3,

  tiles: [
    { row: 0, col: 0, src: "photos/0_0.jpg" },
    { row: 0, col: 1, src: "photos/0_1.jpg" },
    { row: 0, col: 2, src: "photos/0_2.jpg" },
    { row: 0, col: 3, src: "photos/0_3.jpg" },
    { row: 0, col: 4, src: "photos/0_4.jpg" },
    { row: 0, col: 5, src: "photos/0_5.jpg" },

    { row: 1, col: 0, src: "photos/1_0.jpg" },
    { row: 1, col: 1, src: "photos/1_1.jpg" },
    { row: 1, col: 2, src: "photos/1_2.jpg" },
    { row: 1, col: 3, src: "photos/1_3.jpg" },
    { row: 1, col: 4, src: "photos/1_4.jpg" },
    { row: 1, col: 5, src: "photos/1_5.jpg" },

    { row: 2, col: 0, src: "photos/2_0.jpg" },
    { row: 2, col: 1, src: "photos/2_1.jpg" },
    { row: 2, col: 2, src: "photos/2_2.jpg" },
    { row: 2, col: 3, src: "photos/2_3.jpg" },
    { row: 2, col: 4, src: "photos/2_4.jpg" },
    { row: 2, col: 5, src: "photos/2_5.jpg" },
  ],
};
