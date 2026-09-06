import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Certificate } from '../types'

export function CertificateView() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const [cert, setCert] = useState<Certificate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!applicationId) return
    api
      .getCertificate(applicationId)
      .then(setCert)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load certificate.'))
  }, [applicationId])

  if (error) return <div className="p-10 text-red-600">{error}</div>
  if (!cert) return <div className="p-10 text-gray-500">Loading certificate...</div>

  return (
    <div className="min-h-screen p-10 bg-white">
      <Link to="/dashboard" className="text-indigo-600 text-sm mb-8 inline-block">
        Back to dashboard
      </Link>

      <div className="h-1 w-16 bg-emerald-600 mb-6" />
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Certificate</h1>

      <div className="max-w-md space-y-4 text-sm">
        <div>
          <span className="text-gray-500">Certificate ID</span>
          <p className="text-gray-900 font-medium">{cert.id}</p>
        </div>
        <div>
          <span className="text-gray-500">Verified at</span>
          <p className="text-gray-900 font-medium">
            {new Date(cert.verified_at).toLocaleString()}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Verifying LMO</span>
          <p className="text-gray-900 font-medium">{cert.verifying_lmo_id}</p>
        </div>
      </div>

      <div className="mt-8">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cert.qr_payload)}`}
          alt="Certificate QR code"
          width={180}
          height={180}
        />
      </div>

      {cert.pdf_url && (
          <a

          href={cert.pdf_url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-8 text-indigo-600 font-medium"
        >
          Download PDF
        </a>
      )}
    </div>
  )
}