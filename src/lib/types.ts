export type CertificateStatus = 'valid' | 'void' | 'reissued';

export interface CertificateRecord {
  certificate_no: string;
  type_code: string;
  roc_year: string;
  issued_date: string;
  status: CertificateStatus;
  holder_name_masked: string;
  reissued_to?: string;
}
