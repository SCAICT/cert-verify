// 對應 SCAICT 證書標準附錄 A。新增類別碼時請同步更新此表；
// 未登錄的代碼會直接顯示原始代碼字串，不會壞掉。
export const TYPE_CODE_LABELS: Record<string, string> = {
  staff: '工作人員 / 志工服務證明',
  complete: '結業證書',
  attend: '參與證明',
  award: '獲獎證書',
  thanks: '感謝狀',
  member: '任職證明',
};

export function typeCodeLabel(code: string): string {
  return TYPE_CODE_LABELS[code] ?? code;
}
