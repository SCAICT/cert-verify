import type { APIRoute } from 'astro';
import { loadCertificates } from '../../lib/certificates';
import { certificateLookupHash } from '../../lib/lookup';

export async function getStaticPaths() {
  const records = await loadCertificates();
  return Promise.all(
    records.map(async (record) => ({
      params: { hash: await certificateLookupHash(record.certificate_no) },
      props: { url: `/${record.route_id}/` },
    })),
  );
}

export const GET: APIRoute = ({ props }) => Response.json({ url: props.url });
