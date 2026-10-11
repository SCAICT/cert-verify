import type { APIRoute } from 'astro';
import { loadCertificateDownloads } from '../../lib/certificates';

export async function getStaticPaths() {
  const downloads = await loadCertificateDownloads();
  return downloads.map(({ certificate_no, encrypted }) => ({
    params: { certificate_no },
    props: { encrypted },
  }));
}

// GitHub Pages 上只有加密後的靜態檔案；解密在持有人的瀏覽器中完成。
export const GET: APIRoute = ({ props }) =>
  new Response(props.encrypted, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
