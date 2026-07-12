// Автоматично згенеровано align_photos.py (ORB + RANSAC feature matching) —
// координати обчислені з реального збігу деталей на фото (дороги, будівлі),
// не підбирайте x/y вручну.
const MAP_CONFIG = {
  tileWidth: 1920,
  tileHeight: 1080,

  edgeFade: true,
  fadeWidth: null,

  tiles: [
    { row: 0, col: 0, x: 0, y: 4, src: "photos/0_0.png" },
    { row: 0, col: 1, x: 449, y: 0, src: "photos/0_1.png" },
    { row: 0, col: 2, x: 890, y: 0, src: "photos/0_2.png" },
    { row: 1, col: 0, x: 3, y: 446, src: "photos/1_0.png" },
    { row: 1, col: 1, x: 447, y: 443, src: "photos/1_1.png" },
    { row: 1, col: 2, x: 889, y: 441, src: "photos/1_2.png" },
    { row: 2, col: 0, x: 6, y: 887, src: "photos/2_0.png" },
    { row: 2, col: 1, x: 440, y: 884, src: "photos/2_1.png" },
    { row: 2, col: 2, x: 888, y: 891, src: "photos/2_2.png" },
  ],
};
