// drawio-ai-kit — bộ định tuyến cạnh (auto edge routing).
// Cho 2 hình chữ nhật, tự sinh exit/entry + waypoint để nét THẲNG khi có thể,
// và đi qua GIỮA HÀNH LANG (nhãn cân) khi buộc phải bẻ góc. Không hardcode từng nét.
//
// rect = { x, y, w, h }.  Trả { pins, wp } — pins là chuỗi style; wp là {x,y} hoặc null.

const frac = (v, lo, len) => ((v - lo) / len).toFixed(3);

// laneX/laneY: toạ độ "khe" cho đoạn vuông góc — nên là GIỮA KHE TRẮNG giữa hai cột/hàng,
// không phải giữa hai node (node có thể là icon hẹp nằm giữa cột → điểm giữa node rơi vào mép frame).
// Nếu không truyền, mặc định lấy giữa hai mép node gần nhau (đủ dùng khi không có frame).

// wp luôn là MẢNG điểm (rỗng nếu nét thẳng). Nét gãy dùng 2 điểm trên cùng lane
// để ép đoạn vuông góc nằm đúng khe (tránh drawio tự bẻ bám mép node).

/** Nối trái → phải (source nằm bên trái target). */
export function routeLR(s, t, { tol = 8, laneX = null } = {}) {
  const ov0 = Math.max(s.y, t.y);
  const ov1 = Math.min(s.y + s.h, t.y + t.h);
  if (ov1 - ov0 >= tol) {
    const y = (ov0 + ov1) / 2; // trùng dải dọc → nét ngang thẳng tại Y chung
    return {
      pins: `exitX=1;exitY=${frac(y, s.y, s.h)};exitDx=0;exitDy=0;entryX=0;entryY=${frac(y, t.y, t.h)};entryDx=0;entryDy=0;`,
      wp: [],
    };
  }
  const lx = Math.round(laneX != null ? laneX : (s.x + s.w + t.x) / 2);
  const sy = Math.round(s.y + s.h / 2), ty = Math.round(t.y + t.h / 2);
  return {
    pins: "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;",
    wp: [{ x: lx, y: sy }, { x: lx, y: ty }], // ngang → đứng (tại lx) → ngang
  };
}

/** Nối trên → dưới (source nằm phía trên target). */
export function routeTB(s, t, { tol = 8, laneY = null } = {}) {
  const ov0 = Math.max(s.x, t.x);
  const ov1 = Math.min(s.x + s.w, t.x + t.w);
  if (ov1 - ov0 >= tol) {
    const x = (ov0 + ov1) / 2;
    return {
      pins: `exitX=${frac(x, s.x, s.w)};exitY=1;exitDx=0;exitDy=0;entryX=${frac(x, t.x, t.w)};entryY=0;entryDx=0;entryDy=0;`,
      wp: [],
    };
  }
  const ly = Math.round(laneY != null ? laneY : (s.y + s.h + t.y) / 2);
  const sx = Math.round(s.x + s.w / 2), tx = Math.round(t.x + t.w / 2);
  return {
    pins: "exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;",
    wp: [{ x: sx, y: ly }, { x: tx, y: ly }], // đứng → ngang (tại ly) → đứng
  };
}

/** X để đặt một node rộng w nằm GIỮA RÃNH ngang giữa 2 rect (left, right). */
export function centerInGapX(left, right, w) {
  return Math.round((left.x + left.w + right.x) / 2 - w / 2);
}
/** Y để đặt một node cao h nằm GIỮA RÃNH dọc giữa 2 rect (top, bottom). */
export function centerInGapY(top, bottom, h) {
  return Math.round((top.y + top.h + bottom.y) / 2 - h / 2);
}

/** X để canh GIỮA node rộng w trong box. */
export function centerInBoxX(box, w) {
  return Math.round(box.x + (box.w - w) / 2);
}
/**
 * Y (góc trên) cho phần tử thứ i / n, phân bố ĐỀU theo chiều dọc trong box,
 * chừa header `top` và lề `bottom`. itemH = chiều cao ô (icon + nhãn).
 */
export function distributeY(box, n, i, { top = 50, bottom = 24, itemH = 78 } = {}) {
  const usable = box.h - top - bottom;
  const step = usable / n;
  return Math.round(box.y + top + step * (i + 0.5) - itemH / 2);
}

/** Kích thước box VỪA với n icon (lưới cols cột) — box không thừa chỗ. */
export function panelSize(n, { cols = 1, itemW = 130, itemH = 84, gap = 18, pad = 20, header = 34 } = {}) {
  const rows = Math.ceil(n / cols);
  return {
    w: pad * 2 + cols * itemW + (cols - 1) * gap,
    h: header + pad + rows * itemH + (rows - 1) * gap + pad - 10,
  };
}

/** Tự chọn LR/TB theo vị trí tương đối (ưu tiên trục lệch nhiều hơn). */
export function route(s, t, opts) {
  const dx = (t.x + t.w / 2) - (s.x + s.w / 2);
  const dy = (t.y + t.h / 2) - (s.y + s.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? routeLR(s, t, opts) : routeLR(t, s, opts);
  return dy >= 0 ? routeTB(s, t, opts) : routeTB(t, s, opts);
}
