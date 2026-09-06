import { useState, type FormEvent, type ChangeEvent } from 'react'
import { api } from '../lib/api'
import { uploadApplicationPhotos } from '../lib/storage'

const STATUS_COLOR = 'bg-indigo-600'

export function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [instrumentType, setInstrumentType] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessRegNumber, setBusinessRegNumber] = useState('')
  const [instrumentMake, setInstrumentMake] = useState('')
  const [instrumentModel, setInstrumentModel] = useState('')
  const [instrumentSerial, setInstrumentSerial] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [isReverification, setIsReverification] = useState(false)
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    setFiles(selected)

    previews.forEach((url) => URL.revokeObjectURL(url))

    if (selected) {
      const newPreviews = Array.from(selected).map((file) => URL.createObjectURL(file))
      setPreviews(newPreviews)
    } else {
      setPreviews([])
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!files || files.length === 0) {
      setError('At least one photo is required.')
      return
    }

    setLoading(true)
    try {
      const photoPaths = await uploadApplicationPhotos(files)

      await api.submitApplication({
        instrument_type: instrumentType,
        business_details: {
          name: businessName,
          address: businessAddress,
          registration_number: businessRegNumber,
          instrument_make: instrumentMake,
          instrument_model: instrumentModel,
          instrument_serial: instrumentSerial,
        },
        photo_paths: photoPaths,
        is_reverification: isReverification,
        parent_application_id: isReverification ? parentId || null : null,
      })
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl">
      <div className={`h-1 w-16 ${STATUS_COLOR} mb-6`} />
      <h2 className="text-2xl font-semibold text-gray-900 mb-8">New Application</h2>

      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-4">
        Instrument Details
      </p>

      <label className="block text-sm font-medium text-gray-700 mb-1">Instrument type</label>
      <select
        value={instrumentType}
        onChange={(e) => setInstrumentType(e.target.value)}
        required
        className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
      >
        <option value="" disabled>
          Select an instrument type
        </option>
        <option value="Weighing Scale">Weighing Scale</option>
        <option value="Fuel Dispenser">Fuel Dispenser</option>
        <option value="Water Meter">Water Meter</option>
        <option value="Electricity Meter">Electricity Meter</option>
        <option value="Length Measure">Length Measure (tape/rod/chain)</option>
        <option value="Volume Measure">Volume Measure</option>
        <option value="Other">Other</option>
      </select>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
          <input
            value={instrumentMake}
            onChange={(e) => setInstrumentMake(e.target.value)}
            required
            className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <input
            value={instrumentModel}
            onChange={(e) => setInstrumentModel(e.target.value)}
            required
            className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Serial no.</label>
          <input
            value={instrumentSerial}
            onChange={(e) => setInstrumentSerial(e.target.value)}
            required
            className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
          />
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-4 mt-2">
        Business Details
      </p>

      <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
      <input
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        required
        className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">Business address</label>
      <input
        value={businessAddress}
        onChange={(e) => setBusinessAddress(e.target.value)}
        required
        className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">
        Business registration / license number
      </label>
      <input
        value={businessRegNumber}
        onChange={(e) => setBusinessRegNumber(e.target.value)}
        required
        className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
      />

      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-4 mt-2">
        Supporting Documents
      </p>

      <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
      <label
        htmlFor="photo-upload"
        className="inline-block cursor-pointer border-2 border-dashed border-indigo-300 text-indigo-600 font-medium px-5 py-3 rounded-md mb-2 transition-all duration-150 hover:border-indigo-600 hover:bg-indigo-50 active:scale-[0.98]"
      >
        Choose photos
      </label>
      <input
        id="photo-upload"
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        required
        className="hidden"
      />
      {previews.length > 0 ? (
        <div className="flex flex-wrap gap-3 mb-6">
          {previews.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Selected photo ${i + 1}`}
              className="w-20 h-20 object-cover rounded-md border border-gray-200"
            />
          ))}
        </div>
      ) : (
        <div className="mb-6" />
      )}

      <label className="flex items-center gap-2 mb-6 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isReverification}
          onChange={(e) => setIsReverification(e.target.checked)}
        />
        This is a re-verification of a prior application
      </label>

      {isReverification && (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prior application ID</label>
          <input
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full border-b-2 border-gray-300 focus:border-indigo-600 outline-none py-2 mb-6 bg-transparent"
          />
        </>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-indigo-600 text-white font-medium px-6 py-3 rounded-md transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit application'}
      </button>
    </form>
  )
}