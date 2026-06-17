// drawio-ai-kit — registry "diagram type".
// Mỗi type khai báo bố cục + chiến lược điều hướng (routing) phù hợp, để generator/router
// chọn đúng kiểu góc & lane theo từng loại sơ đồ thay vì áp một cách cho tất cả.

export const DIAGRAM_TYPES = {
  pipeline: {
    label: "Layered pipeline (data / request flow)",
    orientation: "LR",          // luồng trái → phải
    edgeCorner: "rounded",      // dòng tuần tự bo góc
    laneStrategy: "corridor",   // nét lệch đi qua giữa khe giữa các cột
    grouping: "columns-by-tier",
    notes: "Spine cùng hàng → nét ngang thẳng; nét lệch dùng 2 waypoint qua giữa khe.",
  },
  hierarchy: {
    label: "Hierarchy / org tree (Landing Zone, org structure)",
    orientation: "TB",          // cha trên → con dưới
    edgeCorner: "sharp",        // cây phân cấp dùng góc vuông
    laneStrategy: "shared-bus", // các con cùng cha chia chung 1 lane (bus)
    grouping: "nested-ou",
    notes: "Fan từ 1 cha qua lane chung ngay dưới cha → trông như bus phân nhánh.",
  },
  network: {
    label: "VPC network topology (Multi-AZ)",
    orientation: "LR",          // tier trái → phải
    edgeCorner: "rounded",
    laneStrategy: "corridor",
    grouping: "nested-region-az-subnet", // Region → AZ → Subnet → SG
    mirrorAZ: true,             // các AZ đối xứng (chồng dọc)
    notes: "Container lồng sâu; LB/NAT là hub trải dọc qua các AZ → nét ngang thẳng tới mỗi tier; chỉ đi dọc khi qua AZ; replication/DR dùng nét đứt.",
  },
  hubspoke: {
    label: "Hub-and-spoke / event bus",
    orientation: "radial",
    edgeCorner: "rounded",
    laneStrategy: "hub-center", // hub ở giữa, spoke 2 phía
    grouping: "center-hub",
    notes: "Đặt hub (bus/TGW/EventBridge) giữa hàng; spoke nối ngang 2 phía (exitX=1 / exitX=0) → không cắt nhau.",
  },
  hybrid: {
    label: "Hybrid / DR (on-prem ↔ cloud)",
    orientation: "LR",
    edgeCorner: "rounded",
    laneStrategy: "site-link",  // nối 2 site qua 1 node liên kết
    grouping: "two-sites",
    notes: "Hai site tách khối; nối qua node Direct Connect/VPN; mirror thành phần 2 bên; liên kết 2 chiều nét đứt.",
  },
  mesh: {
    label: "Multi-account connectivity / service mesh (VPC Lattice · TGW · peering · RAM)",
    orientation: "free",        // các account là container ngang hàng
    edgeCorner: "rounded",
    laneStrategy: "association", // association/sharing giữa account; ưu tiên qua account 'shared/network'
    grouping: "peer-accounts",
    notes: "Account là container ngang hàng; 1 account shared/network ở trung tâm, các account khác 'associate' tới (service network / TGW / RAM share). Nét association/sharing có nhãn rõ; ưu tiên hub-and-spoke qua account chia sẻ thay vì lưới many-to-many (Well-Architected REL02-BP04).",
  },
  sequence: {
    label: "Sequence / interaction (numbered request walkthrough)",
    orientation: "steps",       // theo thứ tự bước
    edgeCorner: "rounded",
    laneStrategy: "numbered-steps",
    grouping: "components",
    notes: "Đánh số bước theo luồng request (1→N) trên sơ đồ kiến trúc; mỗi mũi tên gắn số thứ tự; đọc theo số, không cần mọi nét cùng hướng.",
  },
};

export function typePreset(name) {
  return DIAGRAM_TYPES[name] || DIAGRAM_TYPES.pipeline;
}

/**
 * rounded=0/1 cho một cạnh theo type + vai trò.
 * role: "tree"/"fanout" → luôn góc vuông; "flow"/mặc định → theo edgeCorner của type.
 */
export function edgeRounded(typeOrPreset, role) {
  const p = typeof typeOrPreset === "string" ? typePreset(typeOrPreset) : typeOrPreset;
  if (role === "tree" || role === "fanout") return 0;
  return p.edgeCorner === "sharp" ? 0 : 1;
}

export function listTypes() {
  return Object.entries(DIAGRAM_TYPES).map(([key, v]) => ({ key, ...v }));
}
