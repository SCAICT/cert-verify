import type { RawSheetRow } from './sheets';

// 僅供本機開發／建置測試使用（未設定 GOOGLE_SHEET_ID 時的 fallback）。
// 內容取自證書標準附錄 B 的範例登記簿。
export const SAMPLE_ROWS: RawSheetRow[] = [
  {
    certificate_no: 'scaict-staff-11401',
    type_code: 'staff',
    roc_year: '114',
    serial: '01',
    holder_name: '王小明',
    activity_name: 'SCIST x SCAICT 聯合寒訓',
    issued_date: '2026-02-05',
    status: 'valid',
    remark: '',
  },
  {
    certificate_no: 'scaict-staff-11402',
    type_code: 'staff',
    roc_year: '114',
    serial: '02',
    holder_name: '李小美',
    activity_name: 'SCIST x SCAICT 聯合寒訓',
    issued_date: '2026-02-05',
    status: 'void',
    remark: '誤發（未達服務時數）',
  },
  {
    certificate_no: 'scaict-award-11401',
    type_code: 'award',
    roc_year: '114',
    serial: '01',
    holder_name: '陳小華',
    activity_name: 'SCINT x SCAICT x SCIST Hackathon',
    issued_date: '2026-07-20',
    status: 'valid',
    remark: '第一名',
  },
  {
    certificate_no: 'scaict-thanks-11401',
    type_code: 'thanks',
    roc_year: '114',
    serial: '01',
    holder_name: '張老師',
    activity_name: '大里高中 APCS 初級營',
    issued_date: '2026-08-22',
    status: 'valid',
    remark: '',
  },
];
