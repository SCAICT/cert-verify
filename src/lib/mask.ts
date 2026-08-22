/**
 * 依 SCAICT 證書標準第 14 條，將受證人姓名遮罩後顯示（如「王小明」→「王○明」）。
 * 規範僅示範 3 字姓名，1、2 字與 4 字以上的規則為此處延伸定義：
 * - 1 字：完全遮罩（無姓可留）
 * - 2 字：保留姓氏，名字整個遮罩（沒有真正的「中間字」）
 * - 3 字以上：保留首尾各一字，中間一律以單一「○」取代（避免洩漏姓名確切長度）
 */
export function maskName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length <= 1) return '○';
  if (trimmed.length === 2) return `${trimmed[0]}○`;
  return `${trimmed[0]}○${trimmed[trimmed.length - 1]}`;
}
